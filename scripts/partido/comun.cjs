/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * LO QUE COMPARTEN LOS PASOS DEL ANÁLISIS DE UN PARTIDO.
 *
 * Generaliza lo que se hizo a mano con el J5 (Alcorcón) en
 * `Downloads/RMCF CASTILLA/HUDL ALCORCON`: leer el timeline de Sportscode que
 * hay en Hudl, saber de qué equipo es cada jugador y en qué minuto pasa cada
 * cosa, y leer y escribir las cuatro hojas de ABP.
 *
 * Todo cuelga de la carpeta de trabajo del partido
 * (`Downloads/RMCF CASTILLA/PARTIDOS/ANALISIS/J06 <rival>/`), que lleva un
 * `partido.json` con lo que hace falta saber del partido (lo escribe
 * `scripts/analisis-partido.cjs`).
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..", "..");

const CLUB = path.join(REPO, "..", "..");

const Papa = require(path.join(REPO, "node_modules", "papaparse"));

/** El libro de ABP, publicado como CSV: es lo que lee la app. */
const LIBRO_ABP =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub";

/** Las cuatro pestañas que se llenan con cada partido. */
const HOJAS = {
  piezasOf: { gid: "675048698", nombre: "Córners y faltas a favor (piezas ofensivo)" },
  piezasDef: { gid: "1071911136", nombre: "Córners y faltas en contra (piezas defensivo)" },
  bandaOf: { gid: "1484189905", nombre: "Saques de banda ofensivos" },
  bandaDef: { gid: "1250621633", nombre: "Saques de banda defensivos" },
};

/** La /exec del Apps Script del libro de ABP (`scripts/abp-hoja.gs`). */
function urlEscritura() {
  const fuente = fs.readFileSync(path.join(REPO, "lib", "abp", "sheets.ts"), "utf8");

  return (fuente.match(/ABP_ESCRITURA_URL =\s*"([^"]+)"/) || [])[1] || "";
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function publicada(clave) {
  const texto = await fetch(`${LIBRO_ABP}?gid=${HOJAS[clave].gid}&single=true&output=csv&t=${Date.now()}`, {
    cache: "no-store",
  }).then((r) => r.text());

  return Papa.parse(texto, { header: true, skipEmptyLines: true }).data;
}

/**
 * Manda una orden al Apps Script y no se fía del primer «no».
 *
 * Tras publicar una versión, Google tarda en servirla en todos sus servidores
 * y una llamada puede contestar con la vieja: se reintenta a los 20 s.
 */
async function mandaHoja(cuerpo) {
  const url = urlEscritura();

  if (!url) throw new Error("falta ABP_ESCRITURA_URL en lib/abp/sheets.ts");

  let ultimo = "";

  for (let i = 0; i < 4; i++) {
    try {
      const texto = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(cuerpo),
      }).then((x) => x.text());

      const json = JSON.parse(texto);

      if (json.success) return json;

      ultimo = json.error || texto.slice(0, 200);
    } catch (error) {
      ultimo = error.message;
    }

    await espera(20_000);
  }

  throw new Error(`la hoja no escribe: ${ultimo}`);
}

/* ------------------------------------------------------------------ */
/*  EL PARTIDO                                                         */
/* ------------------------------------------------------------------ */

function leePartido(carpeta) {
  return JSON.parse(fs.readFileSync(path.join(carpeta, "partido.json"), "utf8"));
}

/** «LIGA 06», como escribe la jornada la hoja. */
const etiquetaJornada = (n) => `LIGA ${String(n).padStart(2, "0")}`;

const sinTildes = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Las palabras que cuentan para casar dos nombres de equipo. */
const palabras = (s) =>
  sinTildes(s)
    .replace(/["'.]/g, " ")
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 2 && !["club", "de", "del", "la", "cf", "fc", "sad", "ud", "cd"].includes(p));

/** ¿Hablan del mismo equipo? Todas las palabras del nombre corto, en el largo. */
function mismoEquipo(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);

  if (!pa.length || !pb.length) return false;

  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];

  return corto.every((p) => largo.some((q) => q === p || q.startsWith(p) || p.startsWith(q)));
}

/* ------------------------------------------------------------------ */
/*  EL TIMELINE DE HUDL                                                */
/* ------------------------------------------------------------------ */

const NOSOTROS = "Real Madrid Castilla";

const codigo = (m) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
const uno = (m, k) => tag(m, k)[0] || "";

/**
 * El timeline leído y listo para preguntar.
 *
 * Dos sesiones de etiquetado: una **por equipo** (posesiones, «Throw ins»,
 * «Corners», «Free kicks», «Periods»…) y otra **por jugador** (cada acción con
 * tipo, tercio y carril). No se fía del orden: la de equipo es la que tiene
 * códigos «<equipo> - Possessions».
 */
function leeTimeline(carpeta) {
  const j = JSON.parse(fs.readFileSync(path.join(carpeta, "timeline-hudl.json"), "utf8"));

  const sesiones = j.data.taggingSessions.items;

  const EQUIPO =
    sesiones.find((s) => s.moments.items.some((m) => / - Possessions$/.test(codigo(m)))) || sesiones[0];

  const JUGADOR = sesiones.find((s) => s !== EQUIPO) || sesiones[1];

  const momentosEq = EQUIPO.moments.items;

  /* El rival, como lo llama Hudl: el otro prefijo de las posesiones. */
  const equipos = [
    ...new Set(
      momentosEq
        .map((m) => codigo(m))
        .filter((c) => / - Possessions$/.test(c))
        .map((c) => c.replace(/ - Possessions$/, "")),
    ),
  ];

  const rivalHudl = equipos.find((e) => e !== NOSOTROS) || "";

  /* De qué equipo es cada jugador: de todas las jugadas por equipo en que sale. */
  const equipoDe = {};

  for (const m of momentosEq) {
    const c = codigo(m);

    const pre = equipos.find((e) => c.startsWith(`${e} - `));

    if (!pre) continue;

    for (const p of tag(m, "09 - Players")) equipoDe[p] ??= pre;
  }

  const periodos = momentosEq
    .filter((m) => codigo(m) === "Periods")
    .map((m) => m.startTimeMs)
    .sort((a, b) => a - b);

  const inicioT1 = periodos[0] ?? 0;
  const inicioT2 = periodos[1] ?? Infinity;

  const tiempo = (ms) => (ms >= inicioT2 ? 2 : 1);

  /* El minuto que corre, como lo escribe la hoja (16:40 → 17). */
  const minuto = (ms) =>
    ms >= inicioT2 ? 45 + Math.floor((ms - inicioT2) / 60000) + 1 : Math.floor((ms - inicioT1) / 60000) + 1;

  const esNuestro = (jug) => equipoDe[jug] === NOSOTROS;

  const acciones = (JUGADOR ? JUGADOR.moments.items : [])
    .filter((m) => codigo(m) !== "Periods")
    .map((m) => ({ m, jug: codigo(m), t: m.startTimeMs, tipos: tag(m, "02 - Type") }))
    .sort((a, b) => a.t - b.t);

  /* Los códigos de equipo «<equipo> - <cosa>», contados: es la vara de medir. */
  const codigosEquipo = {};

  for (const m of momentosEq) {
    const c = codigo(m);

    const pre = equipos.find((e) => c.startsWith(`${e} - `));

    if (!pre) continue;

    const cosa = c.slice(pre.length + 3);

    const lado = pre === NOSOTROS ? "nuestro" : "rival";

    codigosEquipo[cosa] ??= { nuestro: [], rival: [] };
    codigosEquipo[cosa][lado].push(m);
  }

  return {
    EQUIPO,
    JUGADOR,
    momentosEq,
    acciones,
    equipos,
    rivalHudl,
    equipoDe,
    esNuestro,
    inicioT1,
    inicioT2,
    tiempo,
    minuto,
    codigosEquipo,
  };
}

/** «55:17» del vídeo de Hudl, para ir a la jugada. */
const reloj = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

const sinDorsal = (jug) => String(jug).replace(/^\d+\.\s*/, "");

/* ------------------------------------------------------------------ */
/*  FICHEROS                                                           */
/* ------------------------------------------------------------------ */

function leeTsv(fichero) {
  if (!fs.existsSync(fichero)) return [];

  const [cab, ...filas] = fs
    .readFileSync(fichero, "utf8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split("\t"));

  return filas.map((f) => Object.fromEntries(cab.map((c, i) => [c.trim(), (f[i] ?? "").trim()])));
}

const escribeTsv = (fichero, cab, filas) => {
  fs.mkdirSync(path.dirname(fichero), { recursive: true });

  fs.writeFileSync(
    fichero,
    [cab, ...filas.map((f) => cab.map((c) => String(f[c] ?? "").replace(/[\t\r\n]+/g, " ")))]
      .map((f) => f.join("\t"))
      .join("\r\n") + "\r\n",
    "utf8",
  );
};

module.exports = {
  REPO,
  CLUB,
  Papa,
  LIBRO_ABP,
  HOJAS,
  NOSOTROS,
  urlEscritura,
  espera,
  publicada,
  mandaHoja,
  leePartido,
  etiquetaJornada,
  sinTildes,
  palabras,
  mismoEquipo,
  codigo,
  tag,
  uno,
  leeTimeline,
  reloj,
  sinDorsal,
  leeTsv,
  escribeTsv,
};
