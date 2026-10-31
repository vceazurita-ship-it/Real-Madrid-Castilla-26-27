#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| LOS TRES VÍDEOS DE CADA PARTIDO NUESTRO (31/10/2026)
|--------------------------------------------------------------------------
|
| «Vídeo Análisis de Partidos» (/match-plans) lleva, en cada partido del
| Castilla, a sus tres vídeos:
|
|   - HUDL: la copia del partido que se llama como Wyscout («AAAA-MM-DD
|     Local - Visitante x - y»), la que trae el timeline. Su id sale de lo que
|     ya bajó `scripts/hudl-partido.mjs` (video-hudl.json) y de los
|     timeline-hudl.json de las carpetas de análisis (llevan `videoId`).
|   - LA GRABACIÓN TÁCTICA: «J 07 - UD IBIZA - RM CASTILLA.mp4» en
|     Downloads/RMCF CASTILLA/PARTIDOS. Sólo se apunta el nombre; la abre el
|     vigía del ordenador del club (scripts/grabacion-tactica.cjs).
|   - EL RESUMEN DE LA FEDERACIÓN EN YOUTUBE: lo busca cada mañana
|     `scripts/abp-videos-youtube.mjs` (sin API) para todos los partidos de
|     1.ª RFEF; aquí sólo se recogen los nuestros y sólo del canal de la RFEF.
|
|     node scripts/video-partido-enlaces.mjs        → escribe lib/video-partido/enlaces.json
|     node scripts/video-partido-enlaces.mjs --ver  → sólo cuenta lo que hay
|
| Sin las carpetas (Vercel, otro ordenador) no toca el fichero. Con ellas,
| suma a lo que ya había: un id de Hudl o de YouTube no caduca. La grabación
| táctica sí se mira entera cada vez, porque la carpeta manda.
|
| Termina con «RESUMEN: …». Códigos: 0 cambiado, 3 sin cambios, 1 roto.
*/

import fs from "node:fs";
import path from "node:path";

const RAIZ = path.join(import.meta.dirname, "..");

/** Downloads/RMCF CASTILLA: el repositorio vive en RMCF/<repo>. */
const CASA = path.join(RAIZ, "..", "..");

const PARTIDOS = path.join(CASA, "PARTIDOS");

const CARPETAS_HUDL = [path.join(PARTIDOS, "ANALISIS"), path.join(CASA, "ANALISIS TRANSICIONES"), path.join(CASA, "HUDL ALCORCON")];

const LISTA_WYSCOUT = path.join(RAIZ, ".cache", "wyscout", "abp-acciones", "primera-rfef", "_partidos.json");

const YOUTUBE = path.join(RAIZ, ".cache", "abp-videos", "primera-rfef");

const SALIDA = path.join(RAIZ, "lib", "video-partido", "enlaces.json");

const SOLO_VER = process.argv.includes("--ver");

const VIDEO = /\.(mov|mp4|m4v|mkv|mxf|avi)$/i;

const leeJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** «Águilas - Real Madrid Castilla 1 - 0» y «… (team-based)» comparables. */
const clave = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(team-based\)/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const DIA = 86_400_000;

const dias = (a, b) => Math.abs(Date.parse(`${a.slice(0, 10)}T12:00:00Z`) - Date.parse(`${b.slice(0, 10)}T12:00:00Z`)) / DIA;

/* ------------------------------------------------------------------ */
/*  HUDL                                                               */
/* ------------------------------------------------------------------ */

/** Las copias de Hudl ya vistas: id, título y, si se sabe, el día. */
function copiasDeHudl() {
  const salida = [];

  const mira = (carpeta, hondo) => {
    let entradas;

    try {
      entradas = fs.readdirSync(carpeta, { withFileTypes: true });
    } catch {
      return;
    }

    const video = leeJson(path.join(carpeta, "video-hudl.json"));

    if (video?.id && video?.titulo) {
      salida.push({ id: video.id, titulo: video.titulo, dia: String(video.titulo).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null });
    }

    if (entradas.some((d) => d.isFile() && d.name === "timeline-hudl.json")) {
      try {
        const texto = fs.readFileSync(path.join(carpeta, "timeline-hudl.json"), "utf8");

        const id = texto.match(/"videoId"\s*:\s*"([^"]+)"/)?.[1];

        const titulo = texto.match(/"title"\s*:\s*"([^"]*\(team-based\))"/)?.[1];

        if (id && titulo) salida.push({ id, titulo, dia: null });
      } catch {
        /* un timeline roto es como si no estuviera */
      }
    }

    if (hondo > 0) for (const d of entradas) if (d.isDirectory()) mira(path.join(carpeta, d.name), hondo - 1);
  };

  for (const c of CARPETAS_HUDL) mira(c, 2);

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LA GRABACIÓN TÁCTICA                                               */
/* ------------------------------------------------------------------ */

/** jornada → fichero de PARTIDOS («J 06 -CASTILLA - ATL. MADRILEÑO.mov» también vale). */
function grabaciones() {
  if (!fs.existsSync(PARTIDOS)) return null;

  const porJornada = new Map();

  for (const d of fs.readdirSync(PARTIDOS, { withFileTypes: true })) {
    if (!d.isFile() || !VIDEO.test(d.name)) continue;

    const j = Number(d.name.match(/^J\s*0*(\d{1,2})\s*-/i)?.[1]);

    if (!j) continue;

    const tam = fs.statSync(path.join(PARTIDOS, d.name)).size;

    /* Si hay dos de la misma jornada, la grande: la otra suele ser un corte. */
    if (!porJornada.has(j) || porJornada.get(j).tam < tam) porJornada.set(j, { fichero: d.name, tam });
  }

  return porJornada;
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

function principal() {
  const lista = leeJson(LISTA_WYSCOUT);

  const previo = leeJson(SALIDA) ?? { partidos: [] };

  const anteriores = new Map((previo.partidos ?? []).map((p) => [p.jornada, p]));

  const tacticas = grabaciones();

  if (!lista && !tacticas) {
    console.log("RESUMEN: sin las carpetas del ordenador del club; se deja el fichero como está.");

    process.exitCode = 3;

    return;
  }

  const nuestros = (lista?.partidos ?? []).filter((p) => p.jugado && p.jornada && /real madrid castilla/i.test(p.titulo));

  const copias = copiasDeHudl();

  const jornadas = new Set([...nuestros.map((p) => p.jornada), ...anteriores.keys(), ...(tacticas?.keys() ?? [])]);

  const partidos = [];

  for (const jornada of [...jornadas].sort((a, b) => a - b)) {
    const antes = anteriores.get(jornada) ?? {};

    const w = nuestros.find((p) => p.jornada === jornada);

    const fecha = w ? w.fecha.slice(0, 10) : antes.fecha;

    if (!fecha) continue;

    const uno = { jornada, fecha, partido: w ? w.titulo.replace(/\s+\d+\s*-\s*\d+\s*$/, "") : antes.partido };

    /* Hudl: la copia de Wyscout con el mismo título (y el mismo día, si lo dice). */
    if (w) {
      const suyas = copias.filter((c) => clave(c.titulo) === clave(w.titulo) && (!c.dia || dias(c.dia, fecha) <= 1));

      /* Un mismo título en las dos vueltas (mismo marcador y campo): sin día no se sabe cuál es. */
      const repetido = nuestros.filter((p) => clave(p.titulo) === clave(w.titulo)).length > 1;

      const buena = suyas.find((c) => c.dia) ?? (repetido ? null : suyas[0]);

      if (buena) uno.hudl = { id: buena.id, url: `https://www.hudl.com/watch/video/${buena.id}` };
    }

    if (!uno.hudl && antes.hudl) uno.hudl = antes.hudl;

    /* La grabación táctica: la carpeta manda; sin carpeta, lo de antes. */
    if (tacticas) {
      const t = tacticas.get(jornada);

      if (t) uno.tactica = { fichero: t.fichero };
    } else if (antes.tactica) {
      uno.tactica = antes.tactica;
    }

    /* El resumen, sólo del canal de la federación. */
    const yt = w ? leeJson(path.join(YOUTUBE, `${w.id}.json`))?.video : null;

    if (yt?.id && /federaci[oó]n/i.test(yt.canal ?? "")) {
      uno.resumen = { id: yt.id, url: `https://www.youtube.com/watch?v=${yt.id}`, canal: yt.canal, titulo: yt.titulo };
    } else if (antes.resumen) {
      uno.resumen = antes.resumen;
    }

    partidos.push(uno);
  }

  const doc = { carpetaTactica: PARTIDOS, partidos };

  const texto = `${JSON.stringify(doc, null, 2)}\n`;

  const cuenta = (k) => partidos.filter((p) => p[k]).length;

  const linea = `${partidos.length} partidos · Hudl ${cuenta("hudl")} · grabación táctica ${cuenta("tactica")} · resumen de la RFEF ${cuenta("resumen")}`;

  for (const p of partidos) {
    console.log(`  J${String(p.jornada).padStart(2, "0")} ${p.fecha} ${p.partido} · ${p.hudl ? "Hudl" : "-"} · ${p.tactica ? p.tactica.fichero : "-"} · ${p.resumen ? p.resumen.id : "-"}`);
  }

  if (SOLO_VER) {
    console.log(`RESUMEN: ${linea} (sin escribir)`);

    return;
  }

  let viejo = "";

  try {
    viejo = fs.readFileSync(SALIDA, "utf8");
  } catch {
    /* primera vez */
  }

  if (viejo === texto) {
    console.log(`RESUMEN: sin cambios (${linea})`);

    process.exitCode = 3;

    return;
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });

  fs.writeFileSync(SALIDA, texto, "utf8");

  console.log(`RESUMEN: ${linea}`);
}

try {
  principal();
} catch (error) {
  console.log(`RESUMEN: ha fallado (${error.message})`);

  process.exitCode = 1;
}
