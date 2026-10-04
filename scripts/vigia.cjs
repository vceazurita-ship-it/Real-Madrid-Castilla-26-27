/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club con `node`, no lo empaqueta nadie. */
/**
 * EL VIGÍA: LOS BOTONES DE AJUSTES, ATENDIDOS AL MOMENTO.
 *
 * Los botones de `/ajustes` dejan un encargo en Supabase porque el servidor no
 * puede hacer el trabajo: BeSoccer le contesta con páginas vacías y Wyscout
 * sólo se baja manejando un Chrome con la sesión del club. Hasta el 19/09/2026
 * ese encargo lo recogía la tarea nocturna, que se despierta cada dos horas:
 * se pulsaba el botón y pasaba una hora sin que ocurriera nada.
 *
 * Esto se queda despierto en el ordenador del club y mira cada diez segundos:
 *
 *   - `quiniela` → `quiniela-resultados.cjs`. Segundos.
 *   - `rivales`  → lanza la tarea programada de la jornada nocturna. Unos
 *                  cuarenta minutos. Se lanza **la tarea** y no el .cmd a pelo
 *                  para que nunca corran dos pasadas a la vez: el Programador
 *                  no arranca una segunda (`IgnoreNew`). El .cmd apunta él mismo
 *                  cuándo empieza y cómo acaba.
 *   - `wyscout`  → `wyscout-semanal.cmd --forzar`: baja los equipos y los
 *                  jugadores, relee la carpeta, toma la foto de la jornada y
 *                  publica. Unos diez minutos, con un Chrome que se mueve solo.
 *   - `partido`  → `analisis-partido.cjs`: el análisis entero del último
 *                  partido (Wyscout, Hudl, cámara táctica) en todas las
 *                  secciones. Horas. Va contando el paso en el encargo.
 *                  Comparte el Chrome de Wyscout: nunca corren a la vez.
 *
 * Y cada medio minuto deja un latido (`mantenimiento:vigia`), para que la
 * pantalla sepa si hay alguien escuchando o si el ordenador está apagado.
 *
 *   node scripts/vigia.cjs          → se queda escuchando
 *   node scripts/vigia.cjs --una    → mira una vez, hace lo que haya y sale
 *
 * Lo arranca `scripts/instalar-vigia.ps1` al entrar en Windows, sin ventana.
 * El registro queda en `.cache/vigia/`.
 */

const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));

const {
  CLAVE_MANTENIMIENTO,
  CLAVE_VIGIA,
  estadoEncargo,
  normalizaMantenimiento,
} = require(path.join(RAIZ, "lib/mantenimiento.ts"));

const { entorno } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));
const { ETAPAS, Seguimiento, recorridoCortado } = require(path.join(RAIZ, "lib/progreso.ts"));

const TAREA_NOCTURNA = "RMCF Castilla - Jornada nocturna";

/* Un puerto sólo para saber si ya hay otro vigía: si está cogido, sobra éste. */
const PUERTO_TESTIGO = 47831;

const CADA_MS = 10_000;

const LATIDO_MS = 30_000;

const REGISTRO = path.join(RAIZ, ".cache", "vigia");

fs.mkdirSync(REGISTRO, { recursive: true });

const soloUna = process.argv.includes("--una");

/* ------------------------------------------------------------------ */
/*  REGISTRO                                                           */
/* ------------------------------------------------------------------ */

const FICHERO_LOG = path.join(REGISTRO, "vigia.log");

function apunta(texto) {
  const linea = `${new Date().toLocaleString("es-ES")} · ${texto}`;

  console.log(linea);

  try {
    /* Que no crezca sin fin: pasado un mega, se empieza otro. */
    if (fs.existsSync(FICHERO_LOG) && fs.statSync(FICHERO_LOG).size > 1_000_000) {
      fs.renameSync(FICHERO_LOG, path.join(REGISTRO, "vigia.anterior.log"));
    }

    fs.appendFileSync(FICHERO_LOG, `${linea}\n`);
  } catch {
    /* sin registro se sigue igual */
  }
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

const env = entorno();

if (!env) {
  apunta("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");

  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function leeEncargos() {
  const { data, error } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE_MANTENIMIENTO)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return normalizaMantenimiento(data?.data);
}

/**
 * Cambia el trozo de una tarea, releyendo justo antes.
 *
 * El documento lo escribe también la app cuando alguien pulsa un botón: con
 * una copia de hace diez segundos se podría llevar por delante ese pedido.
 */
async function marca(tarea, cambio) {
  const estado = await leeEncargos();

  const { error } = await supabase.from("app_documents").upsert(
    {
      key: CLAVE_MANTENIMIENTO,
      kind: "mantenimiento",
      data: { ...estado, [tarea]: { ...estado[tarea], ...cambio } },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);
}

const empieza = (tarea) => marca(tarea, { empezadoEn: new Date().toISOString() });

const acaba = (tarea, ok, resultado) =>
  marca(tarea, { hechoEn: new Date().toISOString(), ok, resultado, ...cierraSeguimiento(tarea, ok) });

/* ------------------------------------------------------------------ */
/*  EL PROGRESO                                                        */
/* ------------------------------------------------------------------ */

/*
| Por dónde va cada trabajo (04/10/2026): etapa, cuenta («60/532») y lo que
| queda, para que Ajustes enseñe un porcentaje y no sólo «en marcha». Las reglas
| están en `lib/progreso.ts`; aquí sólo se le pasan las líneas de cada script y
| se publica en el latido, como mucho cada pocos segundos.
|
| Lo que tarda cada etapa se aprende de las pasadas que fueron bien
| (`.cache/vigia/duraciones.json`, la mediana de las cinco últimas), así que
| el «quedan X min» se ajusta a ESTE ordenador y a ESTA red.
*/
const seguimientos = new Map();

let progresoCambiado = false;

const FICHERO_DURACIONES = path.join(REGISTRO, "duraciones.json");

function leeDuraciones() {
  try {
    return JSON.parse(fs.readFileSync(FICHERO_DURACIONES, "utf8"));
  } catch {
    return {};
  }
}

function esperadoDe(tarea) {
  const historia = leeDuraciones()[tarea];

  if (!Array.isArray(historia) || !historia.length) return undefined;

  const columnas = Math.max(...historia.map((fila) => fila.length));

  return Array.from({ length: columnas }, (_, i) => {
    const vistas = historia
      .map((fila) => fila[i])
      .filter((x) => typeof x === "number" && x > 0)
      .sort((a, b) => a - b);

    return vistas.length ? vistas[Math.floor(vistas.length / 2)] : 0;
  });
}

function sigue(tarea, plan) {
  const seguimiento = new Seguimiento(tarea, esperadoDe(tarea), Date.now(), plan);

  seguimientos.set(tarea, seguimiento);
  progresoCambiado = true;

  return (linea) => {
    if (seguimiento.linea(linea)) progresoCambiado = true;
  };
}

/** Al acabar: el recorrido para el encargo, y lo aprendido al fichero. */
function cierraSeguimiento(tarea, ok) {
  const seguimiento = seguimientos.get(tarea);

  if (!seguimiento) return {};

  seguimientos.delete(tarea);
  progresoCambiado = true;

  olvidaEnCurso(tarea);

  const { recorrido, duraciones } = seguimiento.cierra(ok);

  if (ok && duraciones.some((d) => d !== null)) {
    try {
      const todas = leeDuraciones();

      todas[tarea] = [...(todas[tarea] ?? []), duraciones].slice(-5);

      fs.writeFileSync(FICHERO_DURACIONES, JSON.stringify(todas));
    } catch {
      /* sin lo aprendido, valen los minutos de partida */
    }
  }

  return { recorrido };
}

/*
| Lo que va, también en disco (04/10/2026). Si el ordenador se apaga a media
| pasada, el encargo se quedaba «en marcha» hasta agotar su plazo y se perdía
| por dónde iba. Al volver, el vigía lo lee de aquí, apunta en el encargo en
| qué etapa se cortó y la pantalla propone seguir desde ahí.
*/
const FICHERO_EN_CURSO = path.join(REGISTRO, "en-curso.json");

function leeEnCurso() {
  try {
    return JSON.parse(fs.readFileSync(FICHERO_EN_CURSO, "utf8"));
  } catch {
    return {};
  }
}

function guardaEnCurso() {
  try {
    const todo = leeEnCurso();

    for (const [tarea, sg] of seguimientos) todo[tarea] = sg.estado();

    fs.writeFileSync(FICHERO_EN_CURSO, JSON.stringify(todo));
  } catch {
    /* sin copia en disco, un corte se ve como «cortado» y ya */
  }
}

function olvidaEnCurso(tarea) {
  try {
    const todo = leeEnCurso();

    delete todo[tarea];

    fs.writeFileSync(FICHERO_EN_CURSO, JSON.stringify(todo));
  } catch {
    /* nada */
  }
}

/** Las pasadas que se cortaron sin acabar: se cierran con lo que se sabía de ellas. */
async function cierraCortadas(estados) {
  const todo = leeEnCurso();

  for (const [tarea, vivo] of Object.entries(todo)) {
    if (!ETAPAS[tarea] || !vivo || enMarcha.has(tarea) || seguimientos.has(tarea)) continue;

    if (tarea === "rivales" && nocturnaCorriendo) continue;

    /* Sólo si el encargo sigue sin cerrar: si ya tiene su final, sobra. */
    if (estados[tarea] !== "en-marcha" && estados[tarea] !== "cortado") {
      olvidaEnCurso(tarea);
      continue;
    }

    const recorrido = recorridoCortado(tarea, vivo);

    const donde = recorrido.find((r) => r.estado === "fallo")?.nombre ?? "";

    await marca(tarea, {
      hechoEn: new Date().toISOString(),
      ok: false,
      resultado: `se cortó${donde ? ` en «${donde}»` : ""} (se apagó o se cerró el ordenador del club); se puede seguir desde ahí`,
      recorrido,
      paso: "",
    });

    olvidaEnCurso(tarea);

    apunta(`${tarea}: la pasada anterior se cortó${donde ? ` en «${donde}»` : ""}; queda apuntado.`);
  }
}

/** El plan de la pasada que se pide (las etapas a hacer), o nada si es entera. */
const planDe = (encargo) => (Array.isArray(encargo?.plan) && encargo.plan.length ? encargo.plan.map(Number) : undefined);

/**
 * Lee lo que va escribiendo un registro que no es nuestro.
 *
 * Wyscout y la jornada nocturna son `.cmd` que mandan su salida a su propio
 * fichero (`.cache/wyscout`, `.cache/jornada-nocturna`), no a nosotros. Se
 * coge el más nuevo que se haya tocado desde que empezó el trabajo y se le va
 * leyendo lo que crece.
 */
function sigueRegistro(carpeta, desde, alLinea) {
  let fichero = "";
  let leido = 0;
  let resto = "";

  const mira = () => {
    try {
      if (!fichero) {
        const candidatos = fs
          .readdirSync(carpeta)
          .filter((f) => /^\d{4}-\d{2}-\d{2}_\d{4}\.log$/.test(f))
          .map((f) => ({ f, t: fs.statSync(path.join(carpeta, f)).mtimeMs }))
          .filter((x) => x.t >= desde - 60_000)
          .sort((a, b) => b.t - a.t);

        if (!candidatos.length) return;

        fichero = path.join(carpeta, candidatos[0].f);
      }

      const tamano = fs.statSync(fichero).size;

      if (tamano <= leido) return;

      const trozo = Buffer.alloc(tamano - leido);
      const fd = fs.openSync(fichero, "r");

      fs.readSync(fd, trozo, 0, trozo.length, leido);
      fs.closeSync(fd);

      leido = tamano;

      const lineas = (resto + trozo.toString("utf8")).split(/\r?\n/);

      resto = lineas.pop() ?? "";

      for (const linea of lineas) alLinea(linea);
    } catch {
      /* el fichero aún no está, o lo están rotando: a la siguiente */
    }
  };

  const reloj = setInterval(mira, 3_000);

  return () => {
    mira();
    clearInterval(reloj);
  };
}

/* La jornada nocturna corre fuera del vigía: se sigue mientras dure. */
let dejaDeSeguirNocturna = null;

/* ------------------------------------------------------------------ */
/*  LOS TRABAJOS                                                       */
/* ------------------------------------------------------------------ */

/** Lo que está corriendo desde este vigía. */
const enMarcha = new Set();

/**
 * El calendario del Castilla, que no es un encargo de nadie.
 *
 * Lo necesita el microciclo para saber cuándo se juega el próximo partido, y
 * cambia poco: se refresca al arrancar y cada seis horas. Es **una** página de
 * BeSoccer, así que no molesta a nada.
 */
let calendarioEn = 0;

const CALENDARIO_CADA_MS = 6 * 3_600_000;

async function refrescaCalendario() {
  calendarioEn = Date.now();

  const { codigo, texto } = await ejecuta("calendario", process.execPath, [
    path.join(RAIZ, "scripts/castilla-calendario.cjs"),
  ]);

  apunta(`Calendario: ${resumen(texto) || (codigo === 0 ? "al día" : `no ha salido (${codigo})`)}.`);
}

/** Cuándo se lanzó por última vez la tarea nocturna, para no insistir. */
let tareaLanzadaEn = 0;

let nocturnaCorriendo = false;

/**
 * Ejecuta algo sin ventana y devuelve su código y lo que escribió.
 *
 * La salida va también a un fichero por pasada, que es lo que se mira cuando
 * la pantalla dice que algo ha fallado.
 */
function ejecuta(tarea, orden, args, alLinea, variables) {
  return new Promise((resolve) => {
    /* Con segundos: dos pasadas de la misma tarea dentro del mismo minuto
       compartían fichero y la segunda borraba el registro de la primera, que
       es justo el que se va a mirar cuando algo falle. */
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");

    const fichero = path.join(REGISTRO, `${tarea}-${sello}.log`);

    const salida = fs.createWriteStream(fichero);

    let texto = "";

    const hijo = spawn(orden, args, { cwd: RAIZ, windowsHide: true, ...(variables ? { env: { ...process.env, ...variables } } : {}) });

    let resto = "";

    const recoge = (trozo) => {
      salida.write(trozo);

      texto = (texto + trozo.toString()).slice(-20_000);

      if (!alLinea) return;

      const lineas = (resto + trozo.toString()).split(/\r?\n/);

      resto = lineas.pop() ?? "";

      for (const linea of lineas) alLinea(linea);
    };

    hijo.stdout.on("data", recoge);
    hijo.stderr.on("data", recoge);

    hijo.on("error", (error) => {
      salida.end();

      resolve({ codigo: -1, texto: error.message });
    });

    hijo.on("close", (codigo) => {
      salida.end();

      resolve({ codigo: codigo ?? -1, texto });
    });
  });
}

/** La última línea «RESUMEN: …» que haya escrito el script. */
function resumen(texto) {
  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.match(/RESUMEN:\s*(.+)$/)?.[1]?.trim())
    .filter(Boolean);

  return lineas[lineas.length - 1] ?? "";
}

/** Limpia los registros de pasada: se guardan los cuarenta últimos. */
function limpiaRegistros() {
  try {
    const viejos = fs
      .readdirSync(REGISTRO)
      .filter((f) => /^(quiniela|wyscout|calendario|rivales|carpeta|partido)-\d+\.log$/.test(f))
      .sort()
      .reverse()
      .slice(40);

    for (const f of viejos) fs.rmSync(path.join(REGISTRO, f), { force: true });
  } catch {
    /* nada */
  }
}

async function haceQuiniela() {
  await empieza("quiniela");

  apunta("Quiniela: mirando BeSoccer…");
  const { codigo, texto } = await ejecuta(
    "quiniela",
    process.execPath,
    [path.join(RAIZ, "scripts/quiniela-resultados.cjs")],
    sigue("quiniela"),
  );

  const dice = resumen(texto);

  if (codigo === 0) {
    await acaba("quiniela", true, dice || "hecho");

    apunta(`Quiniela: ${dice || "hecho"}.`);
  } else {
    await acaba("quiniela", false, dice || `ha fallado (código ${codigo})`);

    apunta(`Quiniela: FALLO (código ${codigo}).`);
  }
}

const MOTIVO_WYSCOUT = {
  0: [true, "publicado: la plataforma lo tiene en un par de minutos"],
  3: [true, "bajado, pero no había nada nuevo que publicar"],
  2: [false, "la sesión de Wyscout ha caducado: hay que entrar una vez a mano en el ordenador del club (scripts\\actualizar-wys.cmd)"],
  4: [false, "bajado y guardado, pero la subida (git push) ha fallado: queda sin publicar"],
  5: [false, "bajado, pero no se ha podido releer la carpeta: no se publica"],
};

async function haceWyscout() {
  const plan = planDe((await leeEncargos()).wyscout);

  await empieza("wyscout");

  /* Es una cadena: se empieza en la primera etapa marcada y se sigue hasta el
     final. El .cmd salta hasta ella con RMCF_DESDE. */
  const desde = plan ? Math.min(...plan) : 0;

  apunta(desde >= 2 ? `Wyscout: sin volver a bajar, desde «${ETAPAS.wyscout[desde].nombre}»…` : "Wyscout: bajando la liga (se abre un Chrome que se mueve solo)…");

  const deja = sigueRegistro(path.join(RAIZ, ".cache", "wyscout"), Date.now(), sigue("wyscout", plan));

  const { codigo } = await ejecuta(
    "wyscout",
    "cmd.exe",
    ["/d", "/c", path.join(RAIZ, "scripts", "wyscout-semanal.cmd"), "--forzar"],
    undefined,
    { RMCF_DESDE: String(desde) },
  ).finally(deja);

  const [ok, dice] = MOTIVO_WYSCOUT[codigo] ?? [false, `la descarga ha fallado (código ${codigo}); el registro está en .cache\\wyscout`];

  await acaba("wyscout", ok, dice);

  apunta(`Wyscout: ${dice}.`);
}

/**
 * La carpeta de análisis de una jornada: vídeos de ABP y de centros y los PDF.
 *
 * La ruta es del disco de ESTE ordenador —la pega alguien en «ABP del Rival» o
 * en «Área del Rival»—, que es el único sitio donde se puede leer.
 */
async function haceCarpeta() {
  const encargos = await leeEncargos();

  const datos = encargos.carpeta?.datos;

  await empieza("carpeta");

  if (!datos?.ruta || !datos?.equipo) {
    await acaba("carpeta", false, "el encargo no traía la ruta o el rival");

    return;
  }

  apunta(`Carpeta: ${datos.equipo} · ${datos.ruta}`);

  const args = [
    path.join(RAIZ, "scripts/rival-carpeta.cjs"),
    "--ruta",
    datos.ruta,
    "--equipo",
    datos.equipo,
    ...(datos.jornada ? ["--jornada", datos.jornada] : []),
  ];

  const { codigo, texto } = await ejecuta("carpeta", process.execPath, args, sigue("carpeta"));

  const dice = resumen(texto) || (codigo === 0 ? "hecho" : `ha fallado (código ${codigo})`);

  await acaba("carpeta", codigo === 0, dice);

  apunta(`Carpeta: ${dice}.`);
}

/**
 * El análisis del último partido, de principio a fin.
 *
 * Tarda horas (mirar en vídeo cada jugada a balón parado), así que va dejando
 * en el encargo por dónde va: el script escribe «PASO: …» y se copia aquí, sin
 * escribir más de una vez cada veinte segundos.
 */
/**
 * Por dónde va el análisis del partido. Viaja en el LATIDO, no en el
 * documento de encargos: reescribir ése cada pocos segundos durante horas
 * ensanchaba la carrera con los botones de Ajustes —un pedido que entrara
 * entre la lectura y la escritura se perdía—. El latido es sólo del vigía.
 */
let pasoPartido = "";

async function haceAnalisisPartido() {
  /* Al empezar se limpian las secciones de la pasada anterior: si ésta se
     rompe, la pantalla no puede enseñar las ✓ de la otra. */
  await marca("partido", { empezadoEn: new Date().toISOString(), secciones: [], paso: "" });

  apunta("Partido: empieza el análisis del último partido…");

  pasoPartido = "empezando";
  const plan = planDe((await leeEncargos()).partido);
  if (plan) apunta(`Partido: sólo ${plan.map((i) => ETAPAS.partido[i]?.nombre).join(", ")}; lo demás, de la pasada anterior.`);
  const alSeguimiento = sigue("partido", plan);
  const { codigo, texto } = await ejecuta(
    "partido",
    process.execPath,
    [path.join(RAIZ, "scripts/analisis-partido.cjs"), ...(plan ? ["--solo", plan.map((i) => i + 1).join(",")] : [])],
    (linea) => {
      alSeguimiento(linea);
      const paso = linea.match(/^PASO:\s*(.+)$/)?.[1];
      if (paso) pasoPartido = paso.trim();
    },
  ).finally(() => {
    pasoPartido = "";
  });

  let secciones = null;

  try {
    const lineas = texto.match(/SECCIONES:\s*(\[.*\])/g) ?? [];

    secciones = JSON.parse(lineas[lineas.length - 1].replace(/^SECCIONES:\s*/, ""));
  } catch {
    /* sin el desglose, queda el resumen */
  }

  const dice =
    resumen(texto) ||
    (codigo === 0 ? "hecho" : codigo === 3 ? "el partido aún no está en Hudl" : `ha fallado (código ${codigo})`);

  await marca("partido", {
    hechoEn: new Date().toISOString(),
    ok: codigo === 0,
    resultado: dice,
    paso: "",
    secciones: secciones ?? [],
    ...cierraSeguimiento("partido", codigo === 0),
  });
  apunta(`Partido: ${dice}.`);
}

/** ¿Está corriendo la tarea programada de la jornada? */
function estadoTareaNocturna() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `(Get-ScheduledTask -TaskName '${TAREA_NOCTURNA}' -ErrorAction SilentlyContinue).State`,
      ],
      { windowsHide: true, timeout: 30_000 },
      (error, salida) => resolve(error ? "" : String(salida).trim()),
    );
  });
}

/**
 * Las secciones de la jornada que hay que hacer, para el .cmd: la tarea
 * programada no recibe argumentos, así que van en `.cache/jornada-nocturna/solo.txt`
 * («HACER_2=1», una por línea). El .cmd lo lee y lo borra; sin él, todas.
 */
function dejaPlanRivales(plan) {
  const fichero = path.join(RAIZ, ".cache", "jornada-nocturna", "solo.txt");

  try {
    if (!plan) {
      fs.rmSync(fichero, { force: true });

      return;
    }

    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    fs.writeFileSync(fichero, `${plan.map((i) => `HACER_${i}=1`).join("\r\n")}\r\n`);
  } catch (error) {
    apunta(`Rivales: no se ha podido dejar qué secciones repetir (${error.message}); se hace entera.`);
  }
}

async function lanzaRivales(plan) {
  const estado = await estadoTareaNocturna();

  if (estado === "Running") {
    /* Ya hay una pasada. Si empezó antes del pedido no lo contesta, y en
       cuanto acabe este vigía lanzará otra. */
    return;
  }

  tareaLanzadaEn = Date.now();
  dejaPlanRivales(plan);
  if (estado) {
    apunta(plan ? `Rivales: lanzando sólo ${plan.map((i) => ETAPAS.rivales[i]?.nombre).join(", ")}…` : "Rivales: lanzando la tarea de la jornada nocturna…");

    execFile("schtasks.exe", ["/Run", "/TN", TAREA_NOCTURNA], { windowsHide: true }, (error) => {
      if (error) {
        /* Si no arrancó, se quita la espera de cinco minutos: lo que toca es
           volver a intentarlo, no quedarse esperando a algo que no salió. */
        tareaLanzadaEn = 0;

        apunta(`Rivales: no se ha podido lanzar la tarea (${error.message}).`);
      }
    });

    return;
  }

  /* Sin la tarea instalada, a pelo. El .cmd apunta él mismo el encargo. */
  apunta("Rivales: la tarea programada no está instalada; se lanza el .cmd directamente.");

  enMarcha.add("rivales");

  ejecuta("rivales", "cmd.exe", ["/d", "/c", path.join(RAIZ, "scripts", "jornada-nocturna.cmd")])
    .catch(() => {})
    .finally(() => enMarcha.delete("rivales"));
}

/** Arranca un trabajo sin esperarlo: la quiniela no tiene por qué esperar a Wyscout. */
function arranca(tarea, trabajo) {
  enMarcha.add(tarea);

  trabajo()
    .catch(async (error) => {
      apunta(`${tarea}: se ha roto (${error.message}).`);

      await acaba(tarea, false, `se ha roto: ${error.message}`).catch(() => {});
    })
    .finally(() => {
      enMarcha.delete(tarea);

      limpiaRegistros();
    });
}

/* ------------------------------------------------------------------ */
/*  LA RONDA                                                           */
/* ------------------------------------------------------------------ */

let ultimoLatido = 0;

async function latido() {
  const ocupado = [...enMarcha];

  if (nocturnaCorriendo && !ocupado.includes("rivales")) ocupado.push("rivales");

  const { error } = await supabase.from("app_documents").upsert(
    {
      key: CLAVE_VIGIA,
      kind: "mantenimiento",
      data: {
        vistoEn: new Date().toISOString(),
        equipo: os.hostname(),
        ocupado,
        ...(pasoPartido ? { paso: pasoPartido } : {}),
        ...(seguimientos.size ? { progreso: Object.fromEntries([...seguimientos].map(([tarea, sg]) => [tarea, sg.estado()])) } : {}),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);
  ultimoLatido = Date.now();
  progresoCambiado = false;
}

/* Mientras algo avanza, el latido sale antes: la barra de Ajustes se mueve
   cada pocos segundos y no cada medio minuto. */
setInterval(() => {
  if (progresoCambiado && Date.now() - ultimoLatido > 4_000) {
    guardaEnCurso();
    latido().catch(() => {});
  }
}, 2_000).unref();

async function ronda() {
  const encargos = await leeEncargos();

  const estados = {
    quiniela: estadoEncargo("quiniela", encargos.quiniela),
    rivales: estadoEncargo("rivales", encargos.rivales),
    wyscout: estadoEncargo("wyscout", encargos.wyscout),
    carpeta: estadoEncargo("carpeta", encargos.carpeta),
    partido: estadoEncargo("partido", encargos.partido),
  };

  if (estados.carpeta === "pedido" && !enMarcha.has("carpeta")) {
    arranca("carpeta", haceCarpeta);
  }

  if (estados.quiniela === "pedido" && !enMarcha.has("quiniela")) {
    arranca("quiniela", haceQuiniela);
  }

  /* Wyscout y el análisis del partido manejan el mismo Chrome (perfil y
     puerto): el segundo espera, pedido, a que acabe el primero. */
  if (estados.wyscout === "pedido" && !enMarcha.has("wyscout") && !enMarcha.has("partido")) {
    arranca("wyscout", haceWyscout);
  }

  if (estados.partido === "pedido" && !enMarcha.has("partido") && !enMarcha.has("wyscout")) {
    arranca("partido", haceAnalisisPartido);
  }

  /* Los rivales: se mira la tarea sólo cuando hay algo que mirar, que cada
     consulta es un PowerShell. */
  /* «Cortado» también se mira: si la pasada sigue corriendo de verdad, el
     latido tiene que seguir diciéndolo en vez de dejar el botón suelto. */
  if (
    estados.rivales === "pedido" ||
    estados.rivales === "en-marcha" ||
    estados.rivales === "cortado"
  ) {
    nocturnaCorriendo = (await estadoTareaNocturna()) === "Running";

    if ((nocturnaCorriendo || enMarcha.has("rivales")) && !dejaDeSeguirNocturna) {
      const desde = Date.parse(encargos.rivales?.empezadoEn ?? "") || Date.now();

      dejaDeSeguirNocturna = sigueRegistro(path.join(RAIZ, ".cache", "jornada-nocturna"), desde, sigue("rivales", planDe(encargos.rivales)));
    }

    const reciente = Date.now() - tareaLanzadaEn < 5 * 60_000;

    if (estados.rivales === "pedido" && !nocturnaCorriendo && !reciente && !enMarcha.has("rivales")) {
      await lanzaRivales(planDe(encargos.rivales));
    }
  } else {
    nocturnaCorriendo = false;
  }

  /* La pasada de la jornada ha acabado (el .cmd ya apuntó cómo): se deja de
     leer su registro y se guarda el recorrido en el encargo. */
  if (dejaDeSeguirNocturna && !nocturnaCorriendo && !enMarcha.has("rivales") && estados.rivales !== "en-marcha") {
    dejaDeSeguirNocturna();
    dejaDeSeguirNocturna = null;

    const fin = await leeEncargos();

    const cierre = cierraSeguimiento("rivales", fin.rivales?.ok !== false);

    if (cierre.recorrido) await marca("rivales", cierre).catch(() => {});
  }

  await cierraCortadas(estados).catch((error) => apunta(`No se han podido cerrar las pasadas cortadas: ${error.message}`));

  if (Date.now() - calendarioEn > CALENDARIO_CADA_MS && !enMarcha.has("calendario")) {
    enMarcha.add("calendario");

    refrescaCalendario()
      .catch((error) => apunta(`Calendario: se ha roto (${error.message}).`))
      .finally(() => enMarcha.delete("calendario"));
  }

  if (Date.now() - ultimoLatido > LATIDO_MS) await latido();
}

/* ------------------------------------------------------------------ */
/*  ARRANQUE                                                           */
/* ------------------------------------------------------------------ */

function soyElUnico() {
  return new Promise((resolve) => {
    const testigo = net.createServer();

    testigo.once("error", () => resolve(false));

    testigo.listen(PUERTO_TESTIGO, "127.0.0.1", () => {
      testigo.unref();

      resolve(true);
    });
  });
}

async function principal() {
  if (soloUna) {
    await ronda();

    /* Espera a lo que haya arrancado. */
    while (enMarcha.size > 0) await new Promise((r) => setTimeout(r, 1000));

    await latido();

    process.exitCode = 0;

    setTimeout(() => process.exit(0), 150).unref();

    return;
  }

  if (!(await soyElUnico())) {
    console.log("Ya hay un vigía escuchando en este ordenador.");

    return;
  }

  apunta(`Vigía en marcha en ${os.hostname()}: mira los encargos cada ${CADA_MS / 1000} s.`);

  let fallosSeguidos = 0;

  for (;;) {
    try {
      await ronda();

      if (fallosSeguidos > 0) apunta("Vuelve a haber conexión.");

      fallosSeguidos = 0;
    } catch (error) {
      /* Sin red (el portal cautivo de la wifi del club, el portátil
         suspendido): se apunta la primera vez y se sigue intentando. */
      if (fallosSeguidos === 0) apunta(`No se puede mirar: ${error.message}`);

      fallosSeguidos += 1;
    }

    await new Promise((r) => setTimeout(r, CADA_MS));
  }
}

principal();
