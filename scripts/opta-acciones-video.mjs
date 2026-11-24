/**
 * EL VÍDEO DE CADA ACCIÓN DE NUESTROS PARTIDOS, SACADO DE OPTA (17/11/2026).
 *
 *   node scripts/opta-acciones-video.mjs               los que faltan, del último partido hacia atrás
 *   node scripts/opta-acciones-video.mjs --max 40      como mucho 40 en esta pasada
 *   node scripts/opta-acciones-video.mjs --partidos 2  sólo los dos últimos partidos
 *   node scripts/opta-acciones-video.mjs --tope-gb 3   para cuando el documento pase de 3 GB (por defecto)
 *   node scripts/opta-acciones-video.mjs --ver         lista lo que bajaría, sin bajar nada
 *
 * El hermano de `opta-goles-video.mjs` para ABP, saques de banda, robos,
 * pérdidas y faltas: las acciones salen de la misma capa que pintan esas
 * pantallas (lib/opta-respaldo/calcula.ts, `accionesParaVideo`), así que el
 * corte casa con su fila por `partido|parte|segundo`. Mismo camino: `POST
 * /vod-url` desde la pestaña de ProVision del Chrome de Opta del club
 * (puerto 9335, con su sesión: no se teclea ninguna contraseña), ffmpeg a
 * 720p y a B2 (`opta/acciones/<partido>/<parte>-<segundo>.mp4`).
 *
 * Documento `opta:acciones-video` → { clips: { "<partido>|<parte>|<segundo>":
 * { url, bytes, en, que } }, actualizado }. Los goles ya bajados por
 * `opta-goles-video.mjs` no se repiten.
 *
 * Orden: el último partido del Castilla primero, y dentro por minuto. Un
 * corte son ~1,5 MB (6 s antes, 6 después): el partido entero (≈ 200
 * acciones) son ~300 MB, y B2 da 10 GB gratis; por eso el tope.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 8 falta el Chrome de Opta o su
 * sesión (se sigue en la próxima pasada) · 1 fallo.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { baseConfigurada, guardaDoc, leeDoc, leeDocs } from "./docs-base.mjs";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const { calculaRespaldo, accionesParaVideo, claveVideo } = require("../lib/opta-respaldo/calcula.ts");
const b2 = require("./b2.cjs");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const PUERTO = 9335;
const CLAVE = "opta:acciones-video";
const ANTES = 6;
const DESPUES = 6;
const CASTILLA = "3kibouup3gxwnnxp3vhz83af7";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};
const MAX = Number(arg("max") ?? 250);
const PARTIDOS = Number(arg("partidos") ?? 0);
const TOPE = Number(arg("tope-gb") ?? 3) * 1e9;
const VER = process.argv.includes("--ver");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!baseConfigurada()) await fin(1, "falta la base de datos (Supabase o DATOS_PG_URL)");
if (!VER && !b2.configurado()) await fin(1, "falta la llave de B2");

/* ---------- datos ---------- */

/* 24/11/2026: ya no se habla con el Postgres directamente: scripts/docs-base.mjs (Supabase o la reserva). */
const sql = { end: async () => {} };

async function conReintento(fn) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (e) {
      if (n >= 3) throw e;
      console.log(`  (base: ${e.code ?? e.message}; reintento ${n})`);
      await espera(5000 * n);
    }
  }
}


const docs = await leeDocs([CLAVE, "opta:goles-video", "opta:partidos", "opta:abp-eventos", "opta:remates", "opta:jugadores", "opta:castilla"]);
const partidos = docs["opta:partidos"];

if (!partidos?.cols) await fin(1, "falta opta:partidos");

const iT = partidos.cols.indexOf("teamId");
const iP = partidos.cols.indexOf("partido");
const ids = [...new Set(partidos.filas.filter((f) => f[iT] === CASTILLA).map((f) => String(f[iP])))];
const directos = await leeDocs(ids.map((id) => `opta:directo:${id}`));

const respaldo = calculaRespaldo({
  partidos,
  abpEventos: docs["opta:abp-eventos"] ?? null,
  remates: docs["opta:remates"] ?? null,
  jugadores: [docs["opta:jugadores"], docs["opta:castilla"]].filter((t) => t?.cols),
  directos: Object.fromEntries(ids.map((id) => [id, directos[`opta:directo:${id}`] ?? null])),
  clips: {},
});

const doc = docs[CLAVE] ?? { clips: {} };

doc.clips ??= {};
const goles = docs["opta:goles-video"]?.clips ?? {};

/* Del último partido hacia atrás; con --partidos, sólo esos. */
const orden = [...respaldo.partidos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((p) => p.partido);
const elegidos = new Set(PARTIDOS > 0 ? orden.slice(0, PARTIDOS) : orden);
const puesto = new Map(orden.map((p, i) => [p, i]));

const pendientes = accionesParaVideo(respaldo)
  .filter((a) => elegidos.has(a.partido))
  .filter((a) => {
    const k = claveVideo(a.partido, a.parte, a.segundo);

    return !doc.clips[k] && !goles[k];
  })
  .sort((a, b) => (puesto.get(a.partido) ?? 99) - (puesto.get(b.partido) ?? 99) || a.parte - b.parte || a.segundo - b.segundo)
  .slice(0, MAX);

const ocupado = () => Object.values(doc.clips).reduce((s, c) => s + (c?.bytes ?? 0), 0);

console.log(`Acciones pendientes en esta pasada: ${pendientes.length}. Ocupado: ${(ocupado() / 1e9).toFixed(2)} GB de ${(TOPE / 1e9).toFixed(1)}.`);

if (VER) {
  for (const a of pendientes) console.log(`  ${a.fecha} ${a.que} ${a.parte}T ${Math.floor(a.segundo / 60)}'${String(Math.round(a.segundo % 60)).padStart(2, "0")}`);
  await sql.end();
  await fin(0, `${pendientes.length} acciones por bajar (no se ha bajado nada: --ver)`);
}

if (!pendientes.length) {
  await sql.end();
  await fin(0, "no falta ninguna acción");
}

if (ocupado() >= TOPE) {
  await sql.end();
  await fin(0, `el vídeo de acciones ya ocupa ${(ocupado() / 1e9).toFixed(2)} GB (tope ${(TOPE / 1e9).toFixed(1)}): no se baja más`);
}

/* ---------- la pestaña de Opta ---------- */

const pestanas = await fetch(`http://127.0.0.1:${PUERTO}/json/list`)
  .then((r) => r.json())
  .catch(() => null);
const pestana = pestanas?.find((t) => t.type === "page" && /trumediasports\.com/.test(t.url));

if (!pestana) {
  await sql.end();
  await fin(8, "no está abierto el Chrome de Opta del club (puerto 9335) con ProVision; se sigue en la próxima pasada");
}

const ws = new WebSocket(pestana.webSocketDebuggerUrl);
let idMsg = 0;
const pendientesCdp = new Map();

ws.onmessage = (m) => {
  const d = JSON.parse(m.data);

  if (d.id && pendientesCdp.has(d.id)) {
    pendientesCdp.get(d.id)(d.result ?? { error: d.error });
    pendientesCdp.delete(d.id);
  }
};
await new Promise((ok, mal) => ((ws.onopen = ok), (ws.onerror = mal)));

const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++idMsg;

    pendientesCdp.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

/** Lo mismo que pide el reproductor de ProVision. Si no acepta el tipo de jugada, se prueba con «Pass». */
async function urlDe(a, playType = a.tipo) {
  const cuerpo = {
    period: a.parte,
    gameClock: a.segundo,
    gameDate: a.fecha,
    playType,
    gameId: a.partido,
    numberOfPeriods: 2,
    periodLength: 45,
    preEventOffset: -ANTES,
    postEventOffset: DESPUES,
    eventMetaData: {},
  };
  const r = await cdp("Runtime.evaluate", {
    expression: `fetch("/vod-url",{method:"POST",headers:{"content-type":"application/json"},body:${JSON.stringify(JSON.stringify(cuerpo))}}).then(async r=>({s:r.status,t:await r.text()})).catch(e=>({s:0,t:String(e)}))`,
    returnByValue: true,
    awaitPromise: true,
  });
  const v = r?.result?.value;

  if (!v) return { error: "sin respuesta de la pestaña" };
  if (v.s === 401 || v.s === 403) return { sesion: true };
  if (v.s !== 200) return playType !== "Pass" ? urlDe(a, "Pass") : { error: `vod-url ${v.s}` };

  try {
    const j = JSON.parse(v.t);

    if (j?.url) return { url: j.url };

    return playType !== "Pass" ? urlDe(a, "Pass") : { error: "sin vídeo" };
  } catch {
    return /login|sign in/i.test(v.t) ? { sesion: true } : { error: "respuesta rara" };
  }
}

function baja(hls, salida) {
  return new Promise((ok) => {
    const p = spawn(FFMPEG, ["-y", "-loglevel", "error", "-i", hls, "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", salida], { windowsHide: true });
    let err = "";

    p.stderr.on("data", (d) => (err += d));
    const reloj = setTimeout(() => p.kill(), 120_000);

    p.on("close", (c) => {
      clearTimeout(reloj);
      ok(c === 0 && fs.existsSync(salida) && fs.statSync(salida).size > 30_000 ? null : err.slice(0, 200) || `ffmpeg ${c}`);
    });
  });
}

const guarda = async () => {
  doc.actualizado = new Date().toISOString();
  await guardaDoc(CLAVE, "opta", doc);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "opta-acciones-"));
let hechos = 0;
let fallos = 0;

for (const a of pendientes) {
  if (ocupado() >= TOPE) break;

  const v = await urlDe(a);

  if (v.sesion) {
    await guarda();
    await fin(8, `la sesión de Opta ha caducado tras ${hechos} acciones: entra en ProVision en el Chrome de Opta del club`);
  }

  if (!v.url) {
    fallos++;
    console.log(`  ${a.fecha} ${a.que} ${Math.floor(a.segundo / 60)}': ${v.error}`);
    continue;
  }

  const fichero = path.join(tmp, "accion.mp4");
  const error = await baja(v.url, fichero);

  if (error) {
    fallos++;
    console.log(`  ${a.fecha} ${a.que} ${Math.floor(a.segundo / 60)}': ${error}`);
    continue;
  }

  const datos = fs.readFileSync(fichero);
  const ruta = `opta/acciones/${a.partido}/${a.parte}-${Math.round(a.segundo)}.mp4`;
  /* Un fallo de B2 no tumba la pasada: se cuenta y se sigue (17/11/2026). */
  let url;
  try {
    url = await b2.sube(ruta, datos, "video/mp4");
  } catch (e) {
    fallos++;
    console.log(`  ${a.fecha} ${a.que} ${Math.floor(a.segundo / 60)}': no se pudo subir a B2 (${e?.message || e})`);
    continue;
  }

  doc.clips[claveVideo(a.partido, a.parte, a.segundo)] = { url, bytes: datos.length, en: new Date().toISOString(), que: a.que };
  hechos++;
  console.log(`  ${a.fecha} ${a.que} ${a.parte}T ${Math.floor(a.segundo / 60)}' (${(datos.length / 1e6).toFixed(1)} MB)`);

  if (hechos % 10 === 0) await guarda();
}

await guarda();
await sql.end();
ws.close();
fs.rmSync(tmp, { recursive: true, force: true });

await fin(0, `${hechos} acciones nuevas en vídeo${fallos ? ` (${fallos} sin vídeo en Opta)` : ""}; en total ${Object.keys(doc.clips).length} (${(ocupado() / 1e9).toFixed(2)} GB)`);
