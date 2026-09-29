/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club con `node`, no lo empaqueta nadie. */
/**
 * RECOGE LA CARPETA DE ANÁLISIS DE UNA JORNADA Y PREPARA AL RIVAL.
 *
 *   node scripts/rival-carpeta.cjs --ruta "C:\...\VICTOR J5 AD ALCORCON" --equipo "AD Alcorcón"
 *
 * Lo lanza el vigía cuando alguien pega la ruta en «ABP del Rival» o en «Área
 * del Rival», y se puede lanzar a mano. Recorre la carpeta entera y:
 *
 * - **Clasifica cada vídeo** por la carpeta en la que está: «CORNER OFF»,
 *   «CORNER DEF», «FALTA OFF», «FALTA DEF», o cualquier cosa con «CENTRO»
 *   (con «DEF» son los centros que defiende). El partido sale de «VS …».
 * - **Lo comprime antes de subirlo** a 720p. No es un capricho: la jornada del
 *   Alcorcón traía 770 MB en 52 clips y el almacenamiento entero es de 1 GB.
 *   Comprimido se queda en una fracción y se ve igual de bien en la tele.
 * - Sube los PDF tal cual.
 * - Apunta todo en `rival-analisis-clips:<equipo>`, clip a clip, así que si se
 *   corta se relanza y **sigue donde lo dejó**: lo que ya está subido, con el
 *   mismo fichero de origen y el mismo tamaño, no se vuelve a subir.
 *
 * Termina con una línea `RESUMEN: …`, que es lo que enseña la pantalla.
 */

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));
const { entorno } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));
const {
  CLIPS_KIND,
  carpetaBucket,
  clipsKey,
  jornadaDeTexto,
  normalizaClips,
  nuevoIdAnalisis,
} = require(path.join(RAIZ, "lib/rivals/analisis.ts"));
const { slugClave } = require(path.join(RAIZ, "lib/rivals/media.ts"));

const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const BUCKET = "performance";
const TEMPORAL = path.join(RAIZ, ".cache", "rival-carpeta");

const VIDEO = /\.(mp4|mov|m4v|avi|mkv)$/i;
const DOC = /\.(pdf|pptx)$/i;

function bandera(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);

  return i >= 0 ? process.argv[i + 1] : undefined;
}

function termina(codigo, resumen) {
  console.log(`RESUMEN: ${resumen}`);

  /* `process.exit()` con el cliente de Supabase abierto revienta en Windows
     con una aserción de libuv: se marca el código y se deja morir. */
  process.exitCode = codigo;
}

/* ------------------------------------------------------------------ */
/*  CLASIFICAR                                                         */
/* ------------------------------------------------------------------ */

/** De qué sección es un fichero, mirando sus carpetas de dentro afuera. */
function seccionDe(segmentos) {
  for (const crudo of [...segmentos].reverse()) {
    const s = crudo.toUpperCase();

    const defiende = /\bDEF/.test(s);

    if (/CENTRO/.test(s)) return defiende ? "centros-def" : "centros-of";

    if (/C[OÓ]RNER/.test(s)) return defiende ? "corner-def" : "corner-of";

    if (/FALTA/.test(s)) return defiende ? "falta-def" : "falta-of";
  }

  return null;
}

/** «0_17_CENTRO LAT VS EUROPA» → «VS EUROPA». */
function partidoDe(segmentos) {
  for (const crudo of [...segmentos].reverse()) {
    const vs = crudo.match(/\bVS\.?\s+(.+)$/i);

    if (vs) return `VS ${vs[1].trim().toUpperCase()}`;
  }

  return "";
}

/** «2-CORNER OFF #"2 copia 2.mp4» → «2 · CORNER OFF». */
function nombreDe(fichero) {
  const base = path
    .basename(fichero, path.extname(fichero))
    .replace(/\s+copia(\s+\d+)?$/i, "")
    .replace(/#"?\s*\d*$/, "")
    .replace(/["#]/g, "")
    .trim();

  const numero = base.match(/^(\d+)\s*[-_.]\s*(.+)$/);

  return numero ? `${Number(numero[1])} · ${numero[2].trim()}` : base;
}

const ordenDe = (nombre) => Number(nombre.match(/^(\d+)/)?.[1] ?? 999);

function recorre(dir, salida = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    /* Las `._algo` y `.DS_Store` son basura del Mac: no son vídeos. */
    if (entrada.name.startsWith(".")) continue;

    const ruta = path.join(dir, entrada.name);

    if (entrada.isDirectory()) recorre(ruta, salida);
    else salida.push(ruta);
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  COMPRIMIR                                                          */
/* ------------------------------------------------------------------ */

function comprime(entrada, salida) {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG,
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        entrada,
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "27",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        salida,
      ],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(String(stderr || error.message).slice(-400)));
        else resolve();
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

async function principal() {
  const ruta = bandera("ruta");
  const equipo = bandera("equipo");

  if (!ruta || !equipo) {
    return termina(1, "faltan la ruta o el equipo");
  }

  /*
  | La ruta puede ser una carpeta o uno o varios ficheros sueltos (los PDF del
  | informe de la semana), separados por saltos de línea o «;». Así basta con
  | copiar la ruta de cada PDF en el Explorador y pegarla, sin montar carpeta.
  */
  const rutas = ruta
    .split(/[\r\n;]+/)
    .map((r) => r.trim().replace(/^"+|"+$/g, ""))
    .filter(Boolean);

  const noEsta = rutas.find((r) => !fs.existsSync(r));

  if (noEsta) {
    return termina(1, `no encuentro «${noEsta}» en el ordenador del club`);
  }

  const jornada =
    bandera("jornada") ||
    rutas.map((r) => jornadaDeTexto(r.split(/[\\/]/).reverse().join(" "))).find(Boolean) ||
    null;

  if (!jornada) {
    return termina(1, "no sé de qué jornada es: la carpeta o el fichero tiene que llevar «J5», «J12»…");
  }

  const env = entorno();

  if (!env) return termina(1, "faltan las claves de Supabase en .env.local");

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const clave = clipsKey(equipo);

  const lee = async () => {
    const { data, error } = await supabase
      .from("app_documents")
      .select("data")
      .eq("key", clave)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return normalizaClips(data?.data);
  };

  /** Relee y cambia sólo esta jornada: lo de las demás no se toca. */
  const guarda = async (cambia) => {
    const doc = await lee();

    const suya = doc.jornadas[jornada] ?? { clips: [], docs: [], rutas: [] };

    doc.jornadas[jornada] = cambia(suya);

    const { error } = await supabase.from("app_documents").upsert(
      { key: clave, kind: CLIPS_KIND, data: doc, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

    if (error) throw new Error(error.message);
  };

  const carpeta = carpetaBucket(equipo, jornada);

  const sube = async (fichero, destino, tipo) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(destino, fs.readFileSync(fichero), { contentType: tipo, upsert: true });

    if (error) throw new Error(error.message);

    return supabase.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl;
  };

  fs.mkdirSync(TEMPORAL, { recursive: true });

  /* Cada fichero con la base contra la que se cuenta su ruta relativa (la
     que decide la sección y lo que «ya está»): su carpeta si es suelto. */
  const base = new Map();
  const ficheros = [];

  for (const r of rutas) {
    const dentro = fs.statSync(r).isDirectory() ? recorre(r) : [r];

    for (const f of dentro) {
      base.set(f, fs.statSync(r).isDirectory() ? r : path.dirname(r));
      ficheros.push(f);
    }
  }

  const relativaDe = (f) => path.relative(base.get(f), f);

  const previo = (await lee()).jornadas[jornada] ?? { clips: [], docs: [] };

  const yaEsta = (origen, tamano, lista) =>
    lista.some((uno) => uno.origen === origen && (tamano == null || uno.origenTamano === tamano));

  let subidos = 0;
  let saltados = 0;
  let megas = 0;
  let pdfs = 0;
  const sinSitio = [];
  const fallos = [];

  await guarda((suya) => ({
    ...suya,
    rutas: [...new Set([...(suya.rutas ?? []), ...rutas])],
  }));

  const videos = ficheros.filter((f) => VIDEO.test(f));

  console.log(`${equipo} · ${jornada}: ${videos.length} vídeos en «${rutas.join(" · ")}».`);

  for (const [i, fichero] of videos.entries()) {
    const relativa = relativaDe(fichero);
    const segmentos = relativa.split(/[\\/]/);
    const seccion = seccionDe(segmentos);

    if (!seccion) {
      sinSitio.push(relativa);
      continue;
    }

    const tamano = fs.statSync(fichero).size;

    if (yaEsta(relativa, tamano, previo.clips)) {
      saltados += 1;
      continue;
    }

    const partido = partidoDe(segmentos.slice(0, -1));
    const nombre = nombreDe(fichero);

    const temporal = path.join(TEMPORAL, `clip-${process.pid}-${i}.mp4`);

    try {
      await comprime(fichero, temporal);

      const pesa = fs.statSync(temporal).size;

      const destino = `${carpeta}/${seccion}/${slugClave(partido || "sin-partido")}-${slugClave(
        path.basename(fichero, path.extname(fichero)),
      )}.mp4`;

      const url = await sube(temporal, destino, "video/mp4");

      await guarda((suya) => ({
        ...suya,
        clips: [
          ...suya.clips.filter((c) => c.origen !== relativa),
          {
            id: nuevoIdAnalisis(),
            seccion,
            partido,
            nombre,
            url,
            path: destino,
            tamano: pesa,
            origen: relativa,
            origenTamano: tamano,
          },
        ].sort(
          (a, b) =>
            a.seccion.localeCompare(b.seccion) ||
            a.partido.localeCompare(b.partido) ||
            ordenDe(a.nombre) - ordenDe(b.nombre),
        ),
        importadoEn: new Date().toISOString(),
      }));

      subidos += 1;
      megas += pesa / 1e6;

      console.log(
        `  [${i + 1}/${videos.length}] ${seccion} · ${partido} · ${nombre} — ${(tamano / 1e6).toFixed(1)} → ${(pesa / 1e6).toFixed(1)} MB`,
      );
    } catch (error) {
      fallos.push(`${relativa}: ${error.message}`);
      console.log(`  [${i + 1}/${videos.length}] FALLO ${relativa}: ${error.message}`);
    } finally {
      fs.rmSync(temporal, { force: true });
    }
  }

  for (const fichero of ficheros.filter((f) => DOC.test(f))) {
    const relativa = relativaDe(fichero);

    if (yaEsta(relativa, null, previo.docs)) continue;

    try {
      const tamano = fs.statSync(fichero).size;

      if (tamano > 48 * 1024 * 1024) {
        fallos.push(`${relativa}: pesa más de 48 MB`);
        continue;
      }

      const destino = `${carpeta}/docs/${slugClave(path.basename(fichero, path.extname(fichero)))}${path
        .extname(fichero)
        .toLowerCase()}`;

      const tipo = /\.pdf$/i.test(fichero)
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      const url = await sube(fichero, destino, tipo);

      await guarda((suya) => ({
        ...suya,
        docs: [
          ...suya.docs.filter((d) => d.origen !== relativa),
          {
            id: nuevoIdAnalisis(),
            /* «J6 INFORME CEN LAT» es de centros laterales aunque no diga «centro». */
            ambito: /CENTRO|CEN\.? ?LAT|LATERAL|\bAREA|ÁREA/i.test(relativa) ? "area" : "abp",
            nombre: path.basename(fichero, path.extname(fichero)),
            url,
            path: destino,
            tamano,
            origen: relativa,
          },
        ],
      }));

      pdfs += 1;

      console.log(`  documento: ${relativa}`);
    } catch (error) {
      fallos.push(`${relativa}: ${error.message}`);
    }
  }

  /*
  | Los PDF nuevos se pasan a láminas aquí mismo, con el mismo lector que el
  | botón «Pasar a láminas»: pegar la ruta y abrir la pantalla con el informe
  | ya dibujado. Sólo añade láminas que no estén (misma sección y título).
  */
  let laminas = "";

  if (pdfs > 0) {
    laminas = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(RAIZ, "scripts/rival-pdf-laminas.mjs"), "--equipo", equipo, "--jornada", jornada, "--escribe"],
        { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60 * 1000 },
        (error, stdout) => {
          const dice = String(stdout || "").match(/RESUMEN: (.*)/)?.[1] ?? "";
          if (error && !dice) fallos.push(`pasar a láminas: ${error.message}`);
          resolve(dice);
        },
      );
    });

    if (laminas) console.log(`Láminas: ${laminas}`);
  }

  const partes = [
    `${equipo} ${jornada}: ${subidos} vídeo${subidos === 1 ? "" : "s"} subido${subidos === 1 ? "" : "s"} (${megas.toFixed(0)} MB)`,
  ];

  if (saltados) partes.push(`${saltados} ya estaban`);
  if (pdfs) partes.push(`${pdfs} documento${pdfs === 1 ? "" : "s"}`);
  if (laminas) partes.push(laminas);
  if (sinSitio.length) partes.push(`${sinSitio.length} sin sección (la carpeta no dice córner, falta ni centro)`);
  if (fallos.length) partes.push(`${fallos.length} fallo${fallos.length === 1 ? "" : "s"}`);

  if (sinSitio.length) console.log(`Sin sección:\n  ${sinSitio.join("\n  ")}`);
  if (fallos.length) console.log(`Fallos:\n  ${fallos.join("\n  ")}`);

  termina(fallos.length && !subidos ? 1 : 0, partes.join(" · "));
}

principal().catch((error) => termina(1, `se ha roto: ${error.message}`));
