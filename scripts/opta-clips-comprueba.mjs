/**
 * ¿FUNCIONAN LOS CLIPS DE OPTA? (18/11/2026) — sólo lectura.
 *
 * «Que todos los eventos de Opta que recogemos por toda la app tengan su
 * enlace al clip de Opta y revisemos que funciona.» Este script no sube, no
 * borra ni escribe nada:
 *
 *   1. Lee `opta:goles-video` y `opta:acciones-video` de la base (SELECT, la
 *      misma conexión DATOS_PG_URL que scripts/opta-goles-video.mjs).
 *   2. Lista el bucket de B2 (`b2_list_file_names`, sin bajar vídeos) y mira
 *      que cada corte está y pesa lo que dice el documento.
 *   3. Pide unos bytes (Range) de una muestra a /api/video/<ruta> del sitio
 *      publicado: tiene que contestar 200/206 tras la redirección a B2.
 *   4. Monta con lib/opta-video.ts (urlVideoOpta) el enlace a ProVision de una
 *      muestra de remates de `opta:remates` y comprueba el formato (parte,
 *      reloj en minutos, fecha, partido) y que el segundo 0 no da enlace.
 *      ProVision pide sesión: el enlace no se abre desde aquí.
 *
 *   node scripts/opta-clips-comprueba.mjs [--muestra 10] [--sin-web]
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { baseConfigurada, guardaDoc, leeDoc, leeDocs } from "./docs-base.mjs";

const require = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Las llaves: .env.local de la raíz; desde una copia de agente (.claude/worktrees/x), el del repo principal. */
function cargaEntorno() {
  const candidatos = [path.join(RAIZ, ".env.local"), path.join(RAIZ, "..", "..", "..", ".env.local")];
  const fichero = candidatos.find((f) => fs.existsSync(f));

  if (!fichero) return;
  for (const linea of fs.readFileSync(fichero, "utf8").split("\r").join("").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);

    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

cargaEntorno();

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};
const MUESTRA = Number(arg("muestra") ?? 10);
const SIN_WEB = process.argv.includes("--sin-web");
const SITIO = (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");

const b2 = require("./b2.cjs");

if (!baseConfigurada()) {
  console.log("RESUMEN: falta la base de datos (Supabase o DATOS_PG_URL)");
  process.exit(1);
}

/* ---------- 1. los documentos (SELECT) ---------- */

/* 24/11/2026: scripts/docs-base.mjs (Supabase o la reserva). */
const docs = await leeDocs(["opta:goles-video", "opta:acciones-video", "opta:remates"]);

/** La ruta del bucket de un enlace guardado (`…/api/video/<ruta>`); null si no es de B2. */
const rutaDe = (url) => {
  const i = String(url ?? "").indexOf("/api/video/");

  return i < 0 ? null : String(url).slice(i + "/api/video/".length).split("/").map(decodeURIComponent).join("/");
};

const clips = [];

for (const clave of ["opta:goles-video", "opta:acciones-video"]) {
  const doc = docs[clave];

  if (!doc) {
    console.log(`${clave}: no existe el documento`);
    continue;
  }
  const lista = Object.entries(doc.clips ?? {});

  console.log(`${clave}: ${lista.length} cortes (actualizado ${doc.actualizado ?? "?"})`);
  for (const [k, v] of lista) clips.push({ doc: clave, clave: k, url: v?.url, bytes: v?.bytes, ruta: rutaDe(v?.url) });
}

/* Claves bien formadas: partido|parte|segundo. */
const malClave = clips.filter((c) => !/^[^|]+\|[12345]\|\d+$/.test(c.clave));
const sinUrl = clips.filter((c) => !c.url);
const fueraB2 = clips.filter((c) => c.url && !c.ruta);

/* ---------- 2. ¿están en B2? (listado, sin bajar) ---------- */

let faltan = [];
let pesoMal = [];

if (b2.configurado()) {
  const bucket = await b2.lista("opta/");

  console.log(`B2: ${bucket.size} ficheros bajo opta/`);
  for (const c of clips) {
    if (!c.ruta) continue;
    if (!bucket.has(c.ruta)) faltan.push(c);
    else if (c.bytes && bucket.get(c.ruta) !== c.bytes) pesoMal.push({ ...c, enB2: bucket.get(c.ruta) });
  }
} else {
  console.log("B2: sin llave, no se comprueba el bucket");
}

/* ---------- 3. ¿responde la web? (unos bytes de una muestra) ---------- */

const enB2 = clips.filter((c) => c.ruta && !faltan.includes(c));
/* Muestra repartida: de los dos documentos y de todo el abanico. */
const muestra = [];
const paso = Math.max(1, Math.floor(enB2.length / MUESTRA));

for (let i = 0; i < enB2.length && muestra.length < MUESTRA; i += paso) muestra.push(enB2[i]);

const respuestas = [];

async function pideBytes(url, espera) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);

  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1023" }, redirect: "follow", signal: control.signal });
    const tipo = r.headers.get("content-type");
    const largo = r.headers.get("content-range") ?? r.headers.get("content-length");

    await r.body?.cancel().catch(() => {});

    return { estado: r.status, tipo, largo };
  } catch (e) {
    return { estado: 0, error: e.name === "AbortError" ? "sin respuesta" : e.message };
  } finally {
    clearTimeout(reloj);
  }
}

if (!SIN_WEB && muestra.length) {
  /* Render gratis duerme: la primera puede tardar casi un minuto. */
  for (const [i, c] of muestra.entries()) {
    const url = `${SITIO}/api/video/${c.ruta.split("/").map(encodeURIComponent).join("/")}`;
    const r = await pideBytes(url, i === 0 ? 120_000 : 30_000);

    respuestas.push({ ...c, ...r });
    console.log(`  ${r.estado === 206 || r.estado === 200 ? "ok " : "MAL"} ${r.estado} ${c.ruta}${r.error ? ` (${r.error})` : ""}${r.tipo ? ` · ${r.tipo}` : ""}`);
  }
}

/* ---------- 4. el enlace a ProVision ---------- */

require("./cargador-ts.cjs");
const { urlVideoOpta } = require(path.join(RAIZ, "lib", "opta-video.ts"));

const rem = docs["opta:remates"];
const malesOpta = [];
let probadosOpta = 0;

if (rem?.cols) {
  const c = Object.fromEntries(rem.cols.map((k, i) => [k, i]));
  const todos = rem.filas.filter((f) => Number(f[c.segundo]) > 0);
  const pasoO = Math.max(1, Math.floor(todos.length / MUESTRA));

  for (let i = 0; i < todos.length && probadosOpta < MUESTRA; i += pasoO) {
    const f = todos[i];
    const ev = { partido: String(f[c.partido]), fecha: String(f[c.fecha]).slice(0, 10), parte: Number(f[c.parte]), segundo: Number(f[c.segundo]) };
    const url = urlVideoOpta(ev, "shots");

    probadosOpta++;
    const fallos = [];

    if (!url) fallos.push("sin enlace");
    else {
      const u = new URL(url);
      const [, , , , fecha, partido] = u.pathname.split("/");
      const filtro = JSON.parse(u.searchParams.get("f") ?? "{}");
      const [desde, hasta] = (filtro.fsocgc ?? []).map(Number);

      if (u.origin !== "https://realmadrid.opta.trumediasports.com") fallos.push(`sitio ${u.origin}`);
      if (!u.pathname.startsWith("/soccer/match-event-log-in-possession/")) fallos.push("ruta");
      if (fecha !== ev.fecha) fallos.push(`fecha ${fecha}≠${ev.fecha}`);
      if (decodeURIComponent(partido ?? "") !== ev.partido) fallos.push("partido");
      if (String(filtro.sper?.[0]) !== String(ev.parte)) fallos.push(`parte ${filtro.sper?.[0]}≠${ev.parte}`);
      if (!(desde * 60 <= ev.segundo && ev.segundo <= hasta * 60 && hasta - desde < 0.05)) fallos.push(`reloj ${desde}-${hasta} min ≠ ${ev.segundo} s`);
      if (JSON.parse(u.searchParams.get("pc") ?? "{}").sgeipp !== "shots") fallos.push("tipo");
      /* La 2.ª parte empieza en 45:00: el reloj corrido no puede ser menor. */
      if (ev.parte === 2 && ev.segundo < 45 * 60) fallos.push("2.ª parte con reloj < 45:00");
    }
    if (fallos.length) malesOpta.push({ ev, fallos });
  }
  /* ¿Encuentra la pantalla el corte de cada gol? (lib/opta-cortes.ts, la misma búsqueda que el botón). */
  const { corteOpta } = require(path.join(RAIZ, "lib", "opta-cortes.ts"));
  const mapa = Object.fromEntries(clips.filter((x) => x.url).map((x) => [x.clave, x.url]));
  const golesVistos = new Set();

  for (const f of rem.filas) {
    if (!/^(Goal|PenaltyGoal)$/.test(String(f[c.tipo]))) continue;
    golesVistos.add(`${f[c.partido]}|${f[c.parte]}|${f[c.segundo]}`);
  }
  const conCorte = [...golesVistos].filter((k) => {
    const [partido, parte, segundo] = k.split("|");

    return corteOpta({ partido, parte: Number(parte), segundo: Number(segundo) }, mapa);
  }).length;

  console.log(`Goles de opta:remates: ${golesVistos.size}; con corte en B2 que encuentra la pantalla: ${conCorte} (los demás abren ProVision).`);
  /* Segundo 0 = sin reloj: sin enlace. */
  if (urlVideoOpta({ partido: "x", fecha: "2026-01-01", parte: 1, segundo: 0 }, "shots") !== null) malesOpta.push({ ev: "segundo 0", fallos: ["da enlace sin reloj"] });
  if (urlVideoOpta({ partido: "x", fecha: "", parte: 1, segundo: 100 }, "shots") !== null) malesOpta.push({ ev: "sin fecha", fallos: ["da enlace sin fecha"] });
} else {
  console.log("opta:remates: no está; no se prueba el enlace de ProVision");
}

/* ---------- resumen ---------- */

const bien = respuestas.filter((r) => r.estado === 200 || r.estado === 206).length;

console.log("");
for (const c of malClave.slice(0, 10)) console.log(`  clave rara: ${c.doc} ${c.clave}`);
for (const c of sinUrl.slice(0, 10)) console.log(`  sin enlace: ${c.doc} ${c.clave}`);
for (const c of fueraB2.slice(0, 10)) console.log(`  fuera de B2: ${c.doc} ${c.clave} → ${c.url}`);
for (const c of faltan.slice(0, 20)) console.log(`  FALTA EN B2: ${c.doc} ${c.clave} → ${c.ruta}`);
for (const c of pesoMal.slice(0, 20)) console.log(`  PESO DISTINTO: ${c.ruta} (doc ${c.bytes}, B2 ${c.enB2})`);
for (const m of malesOpta) console.log(`  PROVISION MAL: ${JSON.stringify(m.ev)} → ${m.fallos.join(", ")}`);

console.log(
  `RESUMEN: ${clips.length} cortes (${clips.filter((c) => c.doc === "opta:goles-video").length} goles, ${clips.filter((c) => c.doc === "opta:acciones-video").length} acciones); ` +
    `${faltan.length} faltan en B2, ${pesoMal.length} con otro peso, ${fueraB2.length} fuera de B2, ${malClave.length} claves raras; ` +
    `${SIN_WEB ? "web sin probar" : `web ${bien}/${respuestas.length} responden`}; ProVision ${probadosOpta - malesOpta.filter((m) => typeof m.ev === "object").length}/${probadosOpta} enlaces bien formados${malesOpta.some((m) => typeof m.ev === "string") ? " (FALLA el caso sin reloj/fecha)" : ", sin reloj o sin fecha no hay enlace"}.`,
);
process.exitCode = faltan.length || pesoMal.length || malesOpta.length || (respuestas.length && bien < respuestas.length) ? 1 : 0;
