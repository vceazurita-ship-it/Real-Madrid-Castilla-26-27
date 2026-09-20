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
  marca(tarea, { hechoEn: new Date().toISOString(), ok, resultado });

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
function ejecuta(tarea, orden, args) {
  return new Promise((resolve) => {
    /* Con segundos: dos pasadas de la misma tarea dentro del mismo minuto
       compartían fichero y la segunda borraba el registro de la primera, que
       es justo el que se va a mirar cuando algo falle. */
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");

    const fichero = path.join(REGISTRO, `${tarea}-${sello}.log`);

    const salida = fs.createWriteStream(fichero);

    let texto = "";

    const hijo = spawn(orden, args, { cwd: RAIZ, windowsHide: true });

    const recoge = (trozo) => {
      salida.write(trozo);

      texto = (texto + trozo.toString()).slice(-20_000);
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
      .filter((f) => /^(quiniela|wyscout|calendario|rivales)-\d+\.log$/.test(f))
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

  const { codigo, texto } = await ejecuta("quiniela", process.execPath, [
    path.join(RAIZ, "scripts/quiniela-resultados.cjs"),
  ]);

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
  await empieza("wyscout");

  apunta("Wyscout: bajando la liga (se abre un Chrome que se mueve solo)…");

  const { codigo } = await ejecuta("wyscout", "cmd.exe", [
    "/d",
    "/c",
    path.join(RAIZ, "scripts", "wyscout-semanal.cmd"),
    "--forzar",
  ]);

  const [ok, dice] = MOTIVO_WYSCOUT[codigo] ?? [false, `la descarga ha fallado (código ${codigo}); el registro está en .cache\\wyscout`];

  await acaba("wyscout", ok, dice);

  apunta(`Wyscout: ${dice}.`);
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

async function lanzaRivales() {
  const estado = await estadoTareaNocturna();

  if (estado === "Running") {
    /* Ya hay una pasada. Si empezó antes del pedido no lo contesta, y en
       cuanto acabe este vigía lanzará otra. */
    return;
  }

  tareaLanzadaEn = Date.now();

  if (estado) {
    apunta("Rivales: lanzando la tarea de la jornada nocturna…");

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
      data: { vistoEn: new Date().toISOString(), equipo: os.hostname(), ocupado },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);

  ultimoLatido = Date.now();
}

async function ronda() {
  const encargos = await leeEncargos();

  const estados = {
    quiniela: estadoEncargo("quiniela", encargos.quiniela),
    rivales: estadoEncargo("rivales", encargos.rivales),
    wyscout: estadoEncargo("wyscout", encargos.wyscout),
  };

  if (estados.quiniela === "pedido" && !enMarcha.has("quiniela")) {
    arranca("quiniela", haceQuiniela);
  }

  if (estados.wyscout === "pedido" && !enMarcha.has("wyscout")) {
    arranca("wyscout", haceWyscout);
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

    const reciente = Date.now() - tareaLanzadaEn < 5 * 60_000;

    if (estados.rivales === "pedido" && !nocturnaCorriendo && !reciente && !enMarcha.has("rivales")) {
      await lanzaRivales();
    }
  } else {
    nocturnaCorriendo = false;
  }

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
