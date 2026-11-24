/**
 * EL VÍDEO DE CADA GOL, SACADO DE OPTA (16/11/2026).
 *
 *   node scripts/opta-goles-video.mjs              los que faltan, por prioridad
 *   node scripts/opta-goles-video.mjs --max 40     como mucho 40 en esta pasada
 *   node scripts/opta-goles-video.mjs --otros      también el otro grupo
 *
 * ProVision sí tiene el vídeo de todos los partidos de Primera RFEF (probado
 * el 16/11 con un gol del Murcia en Alicante y uno nuestro al Antequera): su
 * reproductor pide `POST /vod-url` con el partido, la parte y el segundo y le
 * dan una lista HLS ya cortada (8 s antes y 8 después por defecto). Aquí se
 * pide igual, desde la pestaña de Opta del Chrome del club (puerto 9335, con
 * su sesión: no se teclea ninguna contraseña), se baja ese trozo con ffmpeg a
 * 720p (~2 MB) y se sube a B2. Así «Ver de seguido» lo reproduce en la app,
 * sin sesión de Opta y sin depender de que la RFEF suba resumen.
 *
 * Orden: el Castilla, el Murcia, los próximos rivales y el resto del grupo
 * (scripts/goles-prioridad.cjs); dentro, lo más reciente primero.
 *
 * Documento `opta:goles-video` → { clips: { "<partido>|<parte>|<segundo>":
 * { url, bytes, en } }, actualizado }.
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
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const b2 = require("./b2.cjs");
const { prioridades } = require("./goles-prioridad.cjs");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const PUERTO = 9335;
const CLAVE = "opta:goles-video";
const ANTES = 10;
const DESPUES = 6;

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};
const MAX = Number(arg("max") ?? 2000);
const OTROS = process.argv.includes("--otros");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!baseConfigurada()) await fin(1, "falta la base de datos (Supabase o DATOS_PG_URL)");
if (!b2.configurado()) await fin(1, "falta la llave de B2");

/* ---------- la pestaña de Opta ---------- */

const pestanas = await fetch(`http://127.0.0.1:${PUERTO}/json/list`)
  .then((r) => r.json())
  .catch(() => null);
const pestana = pestanas?.find((t) => t.type === "page" && /trumediasports\.com/.test(t.url));

if (!pestana) await fin(8, "no está abierto el Chrome de Opta del club (puerto 9335) con ProVision; se sigue en la próxima pasada");

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

/** Lo mismo que pide el reproductor de ProVision. */
async function urlDelGol(g) {
  const cuerpo = {
    period: g.parte,
    gameClock: g.segundo,
    gameDate: g.fecha,
    playType: "Goal",
    gameId: g.partido,
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
  if (v.s !== 200) return { error: `vod-url ${v.s}` };

  try {
    const j = JSON.parse(v.t);

    return j?.url ? { url: j.url } : { error: "sin vídeo" };
  } catch {
    return /login|sign in/i.test(v.t) ? { sesion: true } : { error: "respuesta rara" };
  }
}

function baja(hls, salida) {
  return new Promise((ok) => {
    const p = spawn(FFMPEG, ["-y", "-loglevel", "error", "-i", hls, "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", salida], { windowsHide: true });
    let err = "";

    p.stderr.on("data", (d) => (err += d));
    const reloj = setTimeout(() => p.kill(), 120_000);

    p.on("close", (c) => {
      clearTimeout(reloj);
      ok(c === 0 && fs.existsSync(salida) && fs.statSync(salida).size > 50_000 ? null : err.slice(0, 200) || `ffmpeg ${c}`);
    });
  });
}

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

const docs = Object.fromEntries(
  Object.entries(await leeDocs([CLAVE, "opta:remates", "castilla:calendario"])),
);
const remates = docs["opta:remates"];

if (!remates?.cols) await fin(1, "falta opta:remates");

const doc = docs[CLAVE] ?? { clips: {} };

doc.clips ??= {};

const c = Object.fromEntries(remates.cols.map((k, i) => [k, i]));
const { dePartido, proximos } = prioridades(docs["castilla:calendario"]?.partidos);

/* Un gol por partido, parte y segundo (opta:remates trae cada remate una vez por equipo de la tabla). */
const goles = new Map();

for (const f of remates.filas) {
  if (!/^(Goal|PenaltyGoal)$/.test(String(f[c.tipo]))) continue;

  const g = { partido: f[c.partido], fecha: String(f[c.fecha]).slice(0, 10), parte: Number(f[c.parte]), segundo: Number(f[c.segundo]), equipo: f[c.equipo], rival: f[c.rival], tirador: f[c.tirador] };
  const clave = `${g.partido}|${g.parte}|${g.segundo}`;

  if (!goles.has(clave)) goles.set(clave, { ...g, clave, prioridad: dePartido(g.equipo, g.rival) });
}

const pendientes = [...goles.values()]
  .filter((g) => !doc.clips[g.clave])
  .filter((g) => OTROS || g.prioridad < 99)
  .sort((a, b) => a.prioridad - b.prioridad || b.fecha.localeCompare(a.fecha) || a.parte - b.parte || a.segundo - b.segundo)
  .slice(0, MAX);

console.log(`Próximos rivales: ${proximos.join(", ")}. Goles pendientes: ${pendientes.length} (de ${goles.size}).`);

const guarda = async () => {
  doc.actualizado = new Date().toISOString();
  await guardaDoc(CLAVE, "opta", doc);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "opta-goles-"));
let hechos = 0;
let fallos = 0;

for (const g of pendientes) {
  const v = await urlDelGol(g);

  if (v.sesion) {
    await guarda();
    await fin(8, `la sesión de Opta ha caducado tras ${hechos} goles: entra en ProVision en el Chrome de Opta del club`);
  }

  if (!v.url) {
    fallos++;
    console.log(`  ${g.fecha} ${g.equipo} (${g.tirador}): ${v.error}`);
    continue;
  }

  const fichero = path.join(tmp, "gol.mp4");
  const error = await baja(v.url, fichero);

  if (error) {
    fallos++;
    console.log(`  ${g.fecha} ${g.equipo} (${g.tirador}): ${error}`);
    continue;
  }

  const datos = fs.readFileSync(fichero);
  const ruta = `opta/goles/${g.partido}/${g.parte}-${g.segundo}.mp4`;
  /* Un fallo de B2 no tumba la pasada: se cuenta y se sigue (17/11/2026). */
  let url;
  try {
    url = await b2.sube(ruta, datos, "video/mp4");
  } catch (e) {
    fallos++;
    console.log(`  ${g.fecha} ${g.equipo} (${g.tirador}): no se pudo subir a B2 (${e?.message || e})`);
    continue;
  }

  doc.clips[g.clave] = { url, bytes: datos.length, en: new Date().toISOString() };
  hechos++;
  console.log(`  [${g.prioridad}] ${g.fecha} ${g.equipo} - ${g.rival}: ${g.tirador} ${Math.floor(g.segundo / 60)}' (${(datos.length / 1e6).toFixed(1)} MB)`);

  if (hechos % 10 === 0) await guarda();
}

await guarda();
await sql.end();
ws.close();
fs.rmSync(tmp, { recursive: true, force: true });

const total = Object.keys(doc.clips).length;

await fin(0, `${hechos} goles nuevos en vídeo${fallos ? ` (${fallos} sin vídeo en Opta)` : ""}; en total ${total} de ${goles.size}`);


