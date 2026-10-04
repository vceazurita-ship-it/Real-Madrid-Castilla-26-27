/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * ACTUALIZAR EL ANÁLISIS DEL PARTIDO: EL BOTÓN DE AJUSTES, DE PRINCIPIO A FIN.
 *
 * Lo lanza el vigía (`scripts/vigia.cjs`) cuando alguien pulsa «Actualizar
 * análisis» en /ajustes. No necesita que nadie le diga nada: el partido es el
 * último que ha jugado el Castilla según el calendario de BeSoccer.
 *
 *   node scripts/analisis-partido.cjs               → el último partido jugado
 *   node scripts/analisis-partido.cjs --jornada 6   → uno en concreto
 *   node scripts/analisis-partido.cjs --sin-wyscout --sin-claude   → para probar
 *   node scripts/analisis-partido.cjs --solo 2,6,7 → sólo esos pasos; el resto
 *       se aprovecha de la pasada anterior (lo pide Ajustes con «Repetir sólo
 *       lo que falló»). El 1 y el 7 se hacen siempre, y un paso que se salta
 *       se hace igual si en la carpeta no está lo que dejó la otra vez.
 *
 * Tres fuentes, cada una en su sitio:
 *   - WYSCOUT: los datos del partido y de cada jugador → Data Análisis.
 *   - HUDL: la retransmisión de TV con todo el etiquetado (timeline de
 *     Sportscode) → saques de banda, córners, faltas, penaltis y robos.
 *   - LA CÁMARA TÁCTICA del club, en `Downloads/RMCF CASTILLA/PARTIDOS`
 *     («J 06 - …mov») → lo que sólo se ve con los 22 en plano: ocupación,
 *     defensa, defensores entre la falta y la portería.
 *
 * Los pasos, en orden (cada uno se puede repetir sin estropear nada):
 *   1. Localiza el partido y prepara su carpeta de trabajo
 *      (`PARTIDOS/ANALISIS/J06 <rival>/partido.json`).
 *   2. Wyscout: baja la liga, toma la foto de la jornada y lo publica.
 *   3. Hudl: el timeline del partido y la lista del vídeo.
 *   4. La base del dato: banda, córners, faltas y robos sacados del timeline.
 *   5. El análisis de vídeo: Claude Code, sin ventana, sigue
 *      `scripts/partido/MANUAL.md` — mira cada jugada en la TV y en la táctica,
 *      rellena las columnas de criterio, cuenta defensores y mide el desfase
 *      de la cámara táctica.
 *   6. Escribe en las cuatro hojas de ABP, regenera faltas y transiciones y lo
 *      sube a GitHub (Vercel lo despliega).
 *   7. Verifica sección por sección leyendo lo que ve la app.
 *
 * Va diciendo por dónde va con líneas «PASO: …» (el vigía las pone en la
 * pantalla) y acaba con «SECCIONES: [json]» y «RESUMEN: …».
 * Códigos: 0 todo al día, 1 alguna sección sin hacer, 3 el partido aún no
 * está en Hudl (se puede volver a pedir más tarde).
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts", "cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules", "@supabase", "supabase-js"));
const { entorno } = require(path.join(RAIZ, "scripts", "supabase-local.cjs"));
const { CLAVE_CALENDARIO, comoNuestro, ordenaPartidos } = require(path.join(RAIZ, "lib", "castilla", "calendario.ts"));

const { CLUB, publicada, etiquetaJornada, sinTildes, palabras, mismoEquipo } = require("./partido/comun.cjs");

const PARTIDOS = path.join(CLUB, "PARTIDOS");
const TRANSICIONES = path.join(CLUB, "ANALISIS TRANSICIONES");
const FALTAS = path.join(CLUB, "ANALISIS FALTAS");

const CLAUDE = [
  path.join(process.env.USERPROFILE ?? "", ".local", "bin", "claude.exe"),
  path.join(process.env.APPDATA ?? "", "npm", "claude.cmd"),
].find((r) => fs.existsSync(r));

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const bandera = (n) => process.argv.includes(`--${n}`);

/* Los pasos que se hacen en esta pasada (04/10/2026); sin --solo, todos. */
const SOLO = arg("solo") ? new Set(String(arg("solo")).split(",").map(Number).filter(Boolean)) : null;

const toca = (n) => !SOLO || SOLO.has(n);

const deAntes = (texto) => console.log(`(${texto}: de la pasada anterior)`);

const TOTAL_PASOS = 7;

const paso = (n, texto) => console.log(`PASO: ${n}/${TOTAL_PASOS} · ${texto}`);

const secciones = [];

const anota = (nombre, ok, detalle) => {
  secciones.push({ nombre, ok: Boolean(ok), detalle });

  console.log(`${ok ? "✓" : "✗"} ${nombre}: ${detalle}`);
};

/** Ejecuta algo, deja su salida a la vista y devuelve el código y su RESUMEN. */
function corre(orden, args, opciones = {}) {
  return new Promise((resolve) => {
    let texto = "";

    const hijo = spawn(orden, args, { cwd: RAIZ, windowsHide: true, ...opciones });

    const recoge = (trozo) => {
      process.stdout.write(trozo);

      texto = (texto + trozo.toString()).slice(-200_000);
    };

    hijo.stdout?.on("data", recoge);
    hijo.stderr?.on("data", recoge);

    hijo.on("error", (error) => resolve({ codigo: -1, texto: error.message, resumen: error.message }));

    hijo.on("close", (codigo) => {
      const resumenes = texto.match(/RESUMEN:\s*(.+)/g) ?? [];

      resolve({
        codigo: codigo ?? -1,
        texto,
        resumen: (resumenes[resumenes.length - 1] ?? "").replace(/^RESUMEN:\s*/, "").trim(),
      });
    });
  });
}

const node = (script, ...args) => corre(process.execPath, [path.join(RAIZ, script), ...args]);

const seccionesDe = (texto) => {
  const lineas = texto.match(/SECCIONES:\s*(\[.*\])/g) ?? [];

  try {
    return JSON.parse(lineas[lineas.length - 1].replace(/^SECCIONES:\s*/, ""));
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  1. EL PARTIDO                                                      */
/* ------------------------------------------------------------------ */

async function localiza() {
  const env = entorno();

  if (!env) throw new Error("faltan las claves de Supabase en .env.local");

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase.from("app_documents").select("data").eq("key", CLAVE_CALENDARIO).maybeSingle();

  if (error) throw new Error(error.message);

  const partidos = ordenaPartidos(data?.data?.partidos ?? []).map(comoNuestro);

  const pedida = Number(arg("jornada"));

  /*
  | Por FECHA, no por «tiene marcador». El calendario se refresca cada seis
  | horas: pulsado la noche del partido, el último con marcador era el
  | anterior y se rehacía la jornada pasada entera. El último que ya ha
  | terminado (dos horas y media de gracia) es el que toca; si aún no tiene
  | marcador, se espera.
  */
  const corte = Date.now() - 2.5 * 3_600_000;

  const terminados = partidos.filter((p) => Date.parse(p.cuando) < corte);

  const elegido = pedida ? partidos.find((p) => p.jornada === pedida) : terminados[terminados.length - 1];

  if (!elegido) throw new Error(pedida ? `no hay jornada ${pedida} en el calendario` : "el calendario no tiene ningún partido jugado");

  if (!elegido.jugado) {
    const error = new Error(`la J${elegido.jornada} (${elegido.rival}) aún no tiene marcador en el calendario: se puede volver a pedir en un rato`);

    error.codigo = 3;

    throw error;
  }

  return elegido;
}

/**
 * Cómo escribe la hoja al rival: «AD ALCORCÓN», «UE SANT ANDREU».
 *
 * Primero, si ya sale en la hoja (pretemporada, otra vuelta), tal cual. Si no,
 * el nombre largo del calendario de la quiniela, en mayúsculas.
 */
async function nombreEnHoja(rival) {
  try {
    const valores = new Set([...(await publicada("piezasOf")), ...(await publicada("bandaOf"))].map((f) => f.Rival).filter(Boolean));

    const ya = [...valores].find((v) => mismoEquipo(v, rival));

    if (ya) return ya;
  } catch {
    /* sin hoja, se tira del calendario */
  }

  try {
    const fuente = fs.readFileSync(path.join(RAIZ, "lib", "quiniela", "calendario.ts"), "utf8");

    const nombres = [...new Set([...fuente.matchAll(/(?:local|visitante): "((?:[^"\\]|\\.)+)"/g)].map((m) => m[1].replace(/\\"/g, '"')))];

    const largo = nombres.filter((n) => mismoEquipo(n, rival)).sort((a, b) => b.length - a.length)[0];

    if (largo) return largo.toUpperCase();
  } catch {
    /* sigue */
  }

  return rival.toUpperCase();
}

/**
 * «J6 Atlético Madrileño» → «j06-atletico-madrileno».
 *
 * Con la jornada delante: en la segunda vuelta se repiten los rivales y, sin
 * ella, el J30 del Alcorcón pisaba las carpetas de faltas y robos del J5.
 */
const slugDe = (jornada, rival) =>
  `j${String(jornada).padStart(2, "0")}-${sinTildes(rival)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 2)
    .join("-")
    .replace(/ñ/g, "n")}`;

/**
 * La grabación táctica: «J 06 - …» en PARTIDOS.
 *
 * Si no hay ninguna con la jornada, sólo vale una SIN número de jornada que
 * nombre al rival entero: con números, en la segunda vuelta se cogía en
 * silencio el vídeo de la primera.
 */
function videoTactico(jornada, rival) {
  if (!fs.existsSync(PARTIDOS)) return null;

  const videos = fs.readdirSync(PARTIDOS).filter((f) => /\.(mov|mp4|mkv|m4v)$/i.test(f));

  const porJornada = videos.find((f) => new RegExp(`^J\\s*0*${jornada}\\b`, "i").test(f));

  if (porJornada) return path.join(PARTIDOS, porJornada).replace(/\\/g, "/");

  const suyas = palabras(rival);

  const porRival = videos.find(
    (f) => !/^J\s*\d+/i.test(f) && suyas.length > 0 && suyas.every((p) => sinTildes(f).includes(p)),
  );

  return porRival ? path.join(PARTIDOS, porRival).replace(/\\/g, "/") : null;
}

/* ------------------------------------------------------------------ */
/*  PUBLICAR                                                           */
/* ------------------------------------------------------------------ */

function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" }).trim();
}

/**
 * Sube sólo los ficheros de datos del partido; nada más del árbol.
 *
 * Si antes de empezar ya había commits locales sin subir (de alguien que está
 * trabajando en este ordenador), no se sube nada: un push los mandaría a
 * Vercel sin que nadie lo haya decidido. Y si traer lo de fuera choca, se
 * deja el repositorio como estaba en vez de a medio rebase.
 */
function publica(mensaje, rutas) {
  try {
    git("fetch", "-q", "origin");
  } catch {
    /* sin red: el push dirá */
  }

  /* Los commits propios de una pasada anterior que no llegó a subir, sí. */
  const ajenos = git("log", "origin/main..HEAD", "--format=%s")
    .split(/\r?\n/)
    .filter((linea) => linea && !/^Análisis del partido: .+ \(faltas y robos\)$/.test(linea)).length;

  /* Los generadores reescriben siempre la línea «Generado: <fecha>»: si es lo
     único que cambia, no es un cambio y no se sube. */
  for (const r of rutas) {
    const cambios = git("diff", "-U0", "--", r)
      .split(/\r?\n/)
      .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l) && !/Generado:/.test(l));

    if (!cambios.length && git("status", "--porcelain", "--", r) !== "") git("checkout", "--", r);
  }

  const cambiadas = rutas.filter((r) => git("status", "--porcelain", "--", r) !== "");

  if (cambiadas.length) {
    git("add", "--", ...cambiadas);

    git("commit", "-m", mensaje, "--", ...cambiadas);
  }

  if (git("rev-list", "--count", "origin/main..HEAD") === "0") return cambiadas.length ? "subido" : "sin cambios";

  if (ajenos > 0) {
    throw new Error(
      `en este ordenador había ${ajenos} commit(s) sin subir que no son del análisis: se ha guardado en git pero no se ha subido (un «git push» a mano lo publica todo)`,
    );
  }

  try {
    git("push");
  } catch {
    /* Otro ordenador ha subido algo: se trae y se vuelve a subir. */
    try {
      git("pull", "--rebase", "--autostash");
    } catch (error) {
      try {
        git("rebase", "--abort");
      } catch {
        /* no había rebase a medias */
      }

      throw new Error(`no se ha podido traer lo de GitHub para subir (${String(error.message).split("\n")[0]})`);
    }

    git("push");
  }

  return "subido";
}

/* ------------------------------------------------------------------ */
/*  TODO                                                               */
/* ------------------------------------------------------------------ */

async function principal() {
  /* ---------------- 1 ---------------- */

  paso(1, "buscando el último partido");

  const partido = await localiza();

  const rivalHoja = await nombreEnHoja(partido.rival);

  const slug = slugDe(partido.jornada, partido.rival);

  const fecha = partido.cuando.slice(0, 10);

  const tactico = videoTactico(partido.jornada, partido.rival);

  const nombreCarpeta = `J${String(partido.jornada).padStart(2, "0")} ${rivalHoja}`.replace(/[\\/:*?"<>|]/g, "");

  const CARPETA = path.join(PARTIDOS, "ANALISIS", nombreCarpeta).replace(/\\/g, "/");

  fs.mkdirSync(CARPETA, { recursive: true });

  const datos = {
    jornada: partido.jornada,
    etiqueta: etiquetaJornada(partido.jornada),
    rival: partido.rival,
    rivalHoja,
    slug,
    local: partido.lado === "casa",
    fecha,
    cuando: partido.cuando,
    gf: partido.golesFavor,
    gc: partido.golesContra,
    videoTactico: tactico,
    carpeta: CARPETA,
  };

  fs.writeFileSync(path.join(CARPETA, "partido.json"), JSON.stringify(datos, null, 2), "utf8");

  console.log(`Partido: J${partido.jornada} ${partido.lado === "casa" ? "Castilla - " + partido.rival : partido.rival + " - Castilla"} ${partido.golesFavor}-${partido.golesContra} (${fecha})`);
  console.log(`Hoja: ${datos.etiqueta} · ${rivalHoja} · carpeta ${CARPETA}`);
  console.log(`Cámara táctica: ${tactico ?? "NO ESTÁ en PARTIDOS"}`);

  if (!tactico) anota("Cámara táctica", false, `no hay vídeo «J ${String(partido.jornada).padStart(2, "0")} - …» en PARTIDOS: lo que sólo se ve con ella queda con «?»`);

  /* ---------------- 2 ---------------- */

  if (bandera("sin-wyscout")) {
    console.log("(Wyscout saltado a petición)");
  } else if (!toca(2)) {
    deAntes("Wyscout");
  } else {
    paso(2, "Wyscout: bajando la liga (se abre un Chrome que se mueve solo)");

    const w = await corre("cmd.exe", ["/d", "/c", path.join(RAIZ, "scripts", "wyscout-semanal.cmd"), "--forzar"]);

    const MOTIVO = {
      0: [true, "bajado y publicado"],
      3: [true, "bajado; no había nada nuevo"],
      2: [false, "la sesión de Wyscout ha caducado: hay que entrar una vez a mano (scripts\\actualizar-wys.cmd)"],
      4: [false, "bajado, pero la subida (git push) ha fallado"],
      5: [false, "bajado, pero no se ha podido releer la carpeta"],
      6: [false, "Wyscout está con otra cuenta (la del juvenil, sin el layout ALL): no se ha bajado nada; hay que entrar con la del Castilla (scripts\\actualizar-wys.cmd)"],
    };

    const [ok, dice] = MOTIVO[w.codigo] ?? [false, `la descarga ha fallado (código ${w.codigo})`];

    console.log(`Wyscout: ${dice}`);

    if (!ok) anota("Wyscout", false, dice);
  }

  /* ---------------- 3 ---------------- */

  const hayHudl = ["timeline-hudl.json", "video-hudl.json"].every((f) => fs.existsSync(path.join(CARPETA, f)));

  if (!toca(3) && hayHudl) {
    deAntes("Hudl");
  } else {
    paso(3, "Hudl: leyendo el timeline del partido");

    const h = await node("scripts/hudl-partido.mjs", "--fecha", fecha, "--salida", CARPETA);

    if (h.codigo !== 0) {
      anota("Timeline de Hudl", false, h.resumen || `ha fallado (código ${h.codigo})`);

      return termina(CARPETA, h.codigo === 3 ? 3 : 1);
    }
  }

  /* Donde lo buscan robos y faltas, con lo que hay que saber del partido. */
  const dirTrans = path.join(TRANSICIONES, slug);
  const dirFaltas = path.join(FALTAS, slug);

  fs.mkdirSync(dirTrans, { recursive: true });
  fs.mkdirSync(dirFaltas, { recursive: true });

  fs.copyFileSync(path.join(CARPETA, "timeline-hudl.json"), path.join(dirTrans, "timeline-hudl.json"));

  const resultado = `${partido.lado === "casa" ? partido.golesFavor : partido.golesContra}-${partido.lado === "casa" ? partido.golesContra : partido.golesFavor}`;

  const video = JSON.parse(fs.readFileSync(path.join(CARPETA, "video-hudl.json"), "utf8"));

  let segundosTactica = null;

  if (tactico) {
    const d = await node("scripts/partido/tactica.cjs", "dura", CARPETA);

    segundosTactica = Number(d.texto.trim().split(/\s+/).pop()) || null;
  }

  const segundosVideo = segundosTactica ?? Math.round((video.duracionMs ?? 6_000_000) / 1000);

  const fichaTrans = path.join(dirTrans, "partido.json");

  /* Si ya existe se respetan sus notas y goles (los pone el análisis). */
  const previoTrans = fs.existsSync(fichaTrans) ? JSON.parse(fs.readFileSync(fichaTrans, "utf8")) : {};

  fs.writeFileSync(
    fichaTrans,
    JSON.stringify(
      {
        jornada: `J${partido.jornada}`,
        rival: partido.rival,
        local: datos.local,
        fecha,
        resultado,
        video: tactico ?? "",
        segundosVideo,
        bloquesTotales: Math.ceil(segundosVideo / 300),
        notas: previoTrans.notas ?? [
          "Sacado del timeline de Hudl (el etiquetado de Wyscout del partido), no mirando imagen a imagen: salen TODOS los robos del partido.",
          "Cuenta como robo la interceptación, el duelo defensivo que acaba con el balón nuestro y la recuperación con el rival presionado o tras nuestra pérdida. No cuentan las del portero, las que vienen de un despeje, un rechace o un balón parado del rival, ni las faltas pitadas.",
          tactico
            ? "El segundo es el del vídeo táctico del club, atado al de Hudl por tramos medidos jugada a jugada."
            : "No había vídeo táctico: el segundo es el de la retransmisión de Hudl.",
        ],
        goles: previoTrans.goles ?? [],
      },
      null,
      2,
    ),
    "utf8",
  );

  const fichaFaltas = path.join(dirFaltas, "partido.json");

  const previoFaltas = fs.existsSync(fichaFaltas) ? JSON.parse(fs.readFileSync(fichaFaltas, "utf8")) : {};

  fs.writeFileSync(
    fichaFaltas,
    JSON.stringify(
      {
        jornada: datos.etiqueta,
        rival: partido.rival,
        local: datos.local,
        fecha,
        resultado,
        clips: `Hudl · Castilla · «${video.titulo}» (timeline de Sportscode)${tactico ? ` y la cámara táctica ${path.basename(tactico)}` : ""}`,
        notas: previoFaltas.notas ?? [
          "Sale del timeline de Sportscode subido a Hudl —minuto, quién la hace, sobre quién y la tarjeta— y cada falta se mira después en la retransmisión y en la cámara táctica del club: zona, carril, distancia, defensores y la nota salen de la imagen.",
          "El campo se cuenta siempre hacia la portería que ataca quien saca la falta.",
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  /* ---------------- 4 ---------------- */

  const hayBase = [path.join("base", "bandaOf.tsv"), path.join("faltas", "of-hudl.csv"), path.join("faltas", "def-hudl.csv")].every((f) =>
    fs.existsSync(path.join(CARPETA, f)),
  );

  if (!toca(4) && hayBase) {
    deAntes("La base del dato");
  } else {
    paso(4, "la base del dato: banda, córners, faltas y robos");

    const pr = await node("scripts/partido/preparar.cjs", "--carpeta", CARPETA);

    if (pr.codigo !== 0) {
      anota("Base del timeline", false, pr.resumen);

      return termina(CARPETA, 1);
    }

    /* Los robos salen ya; con los desfases de la táctica se rehacen en el paso 6. */
    await node("scripts/partido/robos.cjs", slug, "--segundos", String(segundosVideo));
  }

  /* La base de las faltas, por si el análisis de vídeo no llega a hacerse:
     mejor el dato con «?» que nada. No pisa lo que ya esté revisado, y si
     el partido ya tiene sus CSV con otro nombre (J4, J5) no añade nada:
     `faltas-datos.mjs` lee todos los de la carpeta y saldrían dobles. */
  const yaTiene = fs.readdirSync(dirFaltas).some((f) => f.endsWith(".csv"));

  for (const lado of yaTiene ? [] : ["of", "def"]) {
    fs.copyFileSync(path.join(CARPETA, "faltas", `${lado}-hudl.csv`), path.join(dirFaltas, `${lado}-partido.csv`));
  }

  /* ---------------- 5 ---------------- */

  if (bandera("sin-claude")) {
    console.log("(análisis de vídeo saltado a petición)");
  } else if (!toca(5)) {
    deAntes("Análisis de vídeo");
  } else if (!CLAUDE) {
    anota("Análisis de vídeo", false, "no está Claude Code en este ordenador (~/.local/bin/claude.exe)");
  } else {
    paso(5, "análisis de vídeo de cada jugada (lo más largo: horas)");

    const progreso = path.join(CARPETA, "progreso.txt");

    let visto = "";

    const reloj = setInterval(() => {
      try {
        const ultima = fs.readFileSync(progreso, "utf8").trim().split(/\r?\n/).pop() ?? "";

        if (ultima && ultima !== visto) {
          visto = ultima;

          paso(5, `vídeo · ${ultima.slice(0, 120)}`);
        }
      } catch {
        /* todavía no ha escrito */
      }
    }, 30_000);

    const encargo = [
      `Analiza el partido de la carpeta ${CARPETA} siguiendo AL PIE DE LA LETRA ${path.join(RAIZ, "scripts", "partido", "MANUAL.md").replace(/\\/g, "/")}.`,
      "Trabajas solo y sin nadie delante: no preguntes nada, decide con el manual y apunta las dudas en informe.md.",
      /* Si una pasada anterior se quedó a medias, no se tiran horas de trabajo. */
      "Si en la carpeta ya hay trabajo de una pasada anterior (progreso.txt, hoja/, informe.md…), continúa donde se quedó: revisa lo hecho, no lo rehagas, y sigue con lo que falta.",
      `Ve dejando una línea por cada avance en ${progreso.replace(/\\/g, "/")} (qué jugadas llevas de cuántas).`,
      "No escribas en las hojas ni hagas git: eso lo hace el script que te ha llamado cuando acabes. Tu trabajo son los ficheros que pide el manual.",
    ].join("\n");

    /* Un `.cmd` no se puede lanzar sin shell en Node 24 (EINVAL). */
    const c = await corre(
      CLAUDE.endsWith(".cmd") ? "cmd.exe" : CLAUDE,
      [
        ...(CLAUDE.endsWith(".cmd") ? ["/d", "/c", CLAUDE] : []),
        "-p",
        encargo,
        "--permission-mode",
        "bypassPermissions",
        "--add-dir",
        CLUB.replace(/\\/g, "/"),
        "--add-dir",
        RAIZ.replace(/\\/g, "/"),
        "--output-format",
        "text",
      ],
      { cwd: CARPETA, stdio: ["ignore", "pipe", "pipe"] },
    );

    clearInterval(reloj);

    fs.writeFileSync(path.join(CARPETA, "claude-salida.txt"), c.texto, "utf8");

    if (c.codigo !== 0) anota("Análisis de vídeo", false, `Claude Code ha salido con código ${c.codigo}: ${c.texto.trim().split(/\r?\n/).pop()?.slice(0, 200) ?? ""}`);
  }

  /* ---------------- 6 ---------------- */

  if (!toca(6)) {
    deAntes("Escribir en las hojas y publicar");
  } else {
    paso(6, "escribiendo en las hojas de ABP y publicando");

    /* Si el análisis de vídeo no dejó las filas, al menos las del dato. */
    const dirHoja = path.join(CARPETA, "hoja");

    fs.mkdirSync(dirHoja, { recursive: true });

    for (const clave of ["bandaOf", "bandaDef"]) {
      if (!fs.existsSync(path.join(dirHoja, `${clave}.tsv`))) {
        anota(`ABP · ${clave}`, false, "el análisis de vídeo no dejó las filas: se escriben sólo las columnas del dato");

        fs.copyFileSync(path.join(CARPETA, "base", `${clave}.tsv`), path.join(dirHoja, `${clave}.tsv`));
      }
    }

    const e = await node("scripts/partido/escribir.cjs", "--carpeta", CARPETA, "--hoja");

    console.log(`Hojas: ${e.resumen}`);

    /* Lo que no se pudo escribir —un choque con filas puestas a mano— tiene que
       llegar a la pantalla: es justo lo que alguien debe mirar. */
    for (const s of seccionesDe(e.texto) ?? []) if (!s.ok) anota(`Hoja · ${s.nombre}`, false, s.detalle);

    /* Con los desfases ya medidos, los robos van al segundo bueno de la táctica. */
    await node("scripts/partido/robos.cjs", slug, "--segundos", String(segundosVideo));

    await node("scripts/transiciones-datos.mjs");
    await node("scripts/faltas-datos.mjs");

    try {
      const r = publica(`Análisis del partido: ${datos.etiqueta} ${partido.rival} (faltas y robos)`, [
        "lib/faltas/datos.ts",
        "lib/transiciones/datos.ts",
      ]);

      console.log(`Publicar: ${r}`);
    } catch (error) {
      anota("Publicar", false, `git ha fallado: ${String(error.message).split("\n")[0]}`);
    }
  }

  /* ---------------- 7 ---------------- */

  paso(7, "comprobando sección por sección");

  return termina(CARPETA, null);
}

async function termina(carpeta, codigoForzado) {
  let codigo = codigoForzado ?? 0;

  if (codigoForzado === null) {
    const v = await node("scripts/partido/verificar.cjs", "--carpeta", carpeta);

    const vistas = seccionesDe(v.texto) ?? [];

    for (const s of vistas) secciones.push(s);

    /* Si se rompió sin decir nada, eso sí es un fallo. */
    if (v.codigo !== 0 && !vistas.length) anota("Comprobación", false, v.resumen || `se ha roto (código ${v.codigo})`);
  }

  /*
  | Lo que sólo espera a que Wyscout publique el partido (suele ser el martes)
  | no es un fallo del análisis: no hay nada que repetir hoy. Sale como hecho,
  | con el aviso en el resumen; la descarga semanal lo completa sola. Antes
  | daba la pasada por fallida y la pantalla ofrecía repetirla (04/10/2026).
  */
  const espera = (s) => !s.ok && /todavía no trae el partido|no hay foto de Wyscout posterior/i.test(s.detalle ?? "");

  /* Lo que falló por el camino y la verificación no mira (Wyscout, Hudl…). */
  const fallos = secciones.filter((s) => !s.ok && !espera(s));

  const esperando = secciones.filter(espera);

  if (codigoForzado === null) codigo = fallos.length ? 1 : 0;
  else if (fallos.length && codigo === 0) codigo = 1;

  const bien = secciones.filter((s) => s.ok).length;

  console.log(`SECCIONES: ${JSON.stringify(secciones)}`);

  let partido = "";

  try {
    const p = JSON.parse(fs.readFileSync(path.join(carpeta, "partido.json"), "utf8"));

    partido = `${p.etiqueta} ${p.rival}`;
  } catch {
    /* sin partido.json */
  }

  console.log(
    codigo === 0
      ? `RESUMEN: ${partido} al día en las ${bien} secciones${
          esperando.length ? `; a la espera de que Wyscout publique el partido (suele el martes): ${esperando.map((s) => s.nombre.replace(/^Data Análisis · /, "")).join(" y ")}` : ""
        }`
      : `RESUMEN: ${partido} — ${bien} de ${secciones.length} secciones al día; falta: ${fallos.map((s) => s.nombre).join(", ")}`,
  );

  process.exitCode = codigo;
}

principal().catch((error) => {
  console.log(
    error.codigo === 3
      ? `RESUMEN: ${error.message}`
      : `RESUMEN: el análisis del partido se ha roto (${error.message})`,
  );
  process.exitCode = error.codigo === 3 ? 3 : 1;
});
