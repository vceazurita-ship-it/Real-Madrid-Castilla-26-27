/**
 * EL VÍDEO DE CADA JUGADOR RIVAL POR SUS FORTALEZAS, DE OPTA (24/11/2026).
 *
 * Petición del analista: «la descarga con los cortes de Opta de los clips
 * individuales, de manera automática, de los jugadores de equipos rivales en
 * base a sus fortalezas, que el vídeo como tope tenga 2 min y sus cortes sean
 * de sus últimos partidos… en una sección que sólo vea yo».
 *
 *   node scripts/opta-clips-jugador.mjs                 el próximo rival (calendario de BeSoccer)
 *   node scripts/opta-clips-jugador.mjs --rivales 2     los dos próximos
 *   node scripts/opta-clips-jugador.mjs --lunes         la jornada nocturna: sólo la noche del lunes
 *                                                       (o para acabar uno que el tope dejó a medias)
 *   node scripts/opta-clips-jugador.mjs --equipo "Real Jaén"
 *   node scripts/opta-clips-jugador.mjs --jugadores 3   como mucho 3 vídeos en esta pasada (para probar)
 *   node scripts/opta-clips-jugador.mjs --ver           dice qué haría, sin bajar nada
 *   node scripts/opta-clips-jugador.mjs --rehacer       vuelve a montar aunque no haya cortes nuevos
 *
 * 1. FORTALEZAS. De Opta, la temporada de los 1.100 jugadores de la categoría:
 *    cada métrica por 90', en percentil contra los de su misma línea (portero,
 *    defensa, medio, delantero) con 360' o más. Fortaleza = percentil ≥ 70;
 *    se quedan las tres mejores (con dos acciones o más que enseñar).
 * 2. CORTES. Las acciones de sus últimos 5 partidos (evento a evento de
 *    ProVision) que enseñan esa fortaleza: sus remates (los goles primero, luego
 *    por xG), sus regates buenos, sus pases que dan ocasión, sus centros buenos,
 *    sus pases que más valor suman (xPV), sus duelos aéreos ganados, sus
 *    recuperaciones (las más altas primero), sus entradas ganadas, sus
 *    despejes en el área o las paradas del portero. Del más reciente hacia atrás.
 * 3. VÍDEO. Cada corte de /vod-url (lo mismo que el reproductor de ProVision,
 *    desde el Chrome de Opta del club, puerto 9335, con su sesión), a 720p con
 *    su rótulo (fortaleza, rival y minuto) y una portada de 3 s con el nombre y
 *    sus fortalezas. Todo junto NUNCA pasa de 120 s. Sin sonido (los cortes de
 *    Opta no siempre lo traen y así se pegan sin saltos).
 * 4. GUARDA. B2 en `privado/opta-jugador/<equipo>/<jugador>.mp4` (la ruta
 *    /api/video sólo sirve `privado/` al administrador) y el documento
 *    `opta:clips-jugador` (vetado en /api/docs; se lee por
 *    /api/opta/clips-jugador, sólo el administrador).
 *
 * Si los cortes elegidos no cambian (el rival no ha jugado), no se rehace. Los
 * equipos que ya no son próximo rival se borran pasados 10 días.
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
import { baseConfigurada, guardaDoc, leeDocs } from "./docs-base.mjs";
import { abreChromeOpta, conectaOpta } from "./opta-ssql.mjs";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const { casaEquipo } = require("../lib/opta-eventos.ts");
const { PUESTO_OPTA } = require("../lib/opta.ts");
const b2 = require("./b2.cjs");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const CLAVE = "opta:clips-jugador";
const CASTILLA = "3kibouup3gxwnnxp3vhz83af7";
const TOPE_SEGUNDOS = 120;
const PORTADA = 3;
const PARTIDOS = 5;
const MIN_MINUTOS = 360;
const PERCENTIL_FORTALEZA = 70;

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : null;
};
/* 24/11/2026, el analista: «los rivales hay que hacerlos los lunes, los del rival de esa próxima jornada». */
const RIVALES = Number(arg("rivales") ?? 1);
const LUNES = process.argv.includes("--lunes");
const EQUIPO = arg("equipo");
const MAX_JUGADORES = Number(arg("jugadores") ?? 60);
const VER = process.argv.includes("--ver");
const REHACER = process.argv.includes("--rehacer");


/* La carpeta de trabajo: se borra también si se sale antes de tiempo (revisión 24/11/2026). */
let TMP = null;
const INICIO = Date.now();
const TOPE_MIN = Number(arg("minutos") ?? 100);

async function fin(codigo, texto) {
  if (TMP) fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!baseConfigurada()) await fin(1, "falta la base de datos (Supabase o DATOS_PG_URL)");
if (!VER && !b2.configurado()) await fin(1, "falta la llave de B2");

/* ------------------------------------------------------------------ */
/*  LAS FORTALEZAS                                                     */
/* ------------------------------------------------------------------ */

/*
| Cada fortaleza: qué métricas de temporada la miden (por 90'), en qué líneas
| tiene sentido, qué acciones del evento a evento la enseñan (y cuál primero)
| y cuánto dura su corte (antes y después del momento de la acción).
*/
const ES_REMATE = new Set(["Goal", "AttemptSaved", "Miss", "Post"]);
const FORTALEZAS = [
  {
    clave: "remate", nombre: "Remate", metricas: ["ExpG", "ShtIncBl"], lineas: ["DEF", "MED", "DEL"], antes: 6, despues: 3,
    elige: (e) => ES_REMATE.has(e.tipo), valor: (e) => (e.tipo === "Goal" ? 10 : 0) + (e.xG ?? 0),
    rotulo: (e) => (e.tipo === "Goal" ? "GOL" : e.tipo === "Post" ? "AL PALO" : e.tipo === "AttemptSaved" ? "REMATE A PUERTA" : "REMATE"),
  },
  {
    clave: "regate", nombre: "Regate y 1 contra 1", metricas: ["TakeOn", "xPVTakeOns"], lineas: ["DEF", "MED", "DEL"], antes: 3, despues: 4,
    elige: (e) => e.tipo === "TakeOn" && e.ok, valor: (e) => e.x / 100 + e.xPV * 20,
  },
  {
    clave: "ultimoPase", nombre: "Último pase", metricas: ["Chance", "xA"], lineas: ["DEF", "MED", "DEL"], antes: 5, despues: 3,
    elige: (e) => e.tipo === "Pass" && e.ocasion, valor: (e) => e.xPV * 10 + (e.finX ?? 0) / 100,
  },
  {
    clave: "centro", nombre: "Centro", metricas: ["CrossCmp"], lineas: ["DEF", "MED", "DEL"], antes: 4, despues: 3,
    elige: (e) => e.tipo === "Pass" && e.ok && e.centro, valor: (e) => (e.ocasion ? 5 : 0) + e.xPV * 10,
  },
  {
    clave: "progresion", nombre: "Pase que rompe líneas", metricas: ["ProgPass", "PsIntoA3rd"], lineas: ["DEF", "MED", "DEL"], antes: 4, despues: 3,
    elige: (e) => e.tipo === "Pass" && e.ok && !e.ocasion && !e.centro && (e.finX ?? 0) - e.x >= 15 && (e.finX ?? 0) >= 60, valor: (e) => e.xPV,
  },
  {
    clave: "aereo", nombre: "Juego aéreo", metricas: ["AerialWon"], lineas: ["DEF", "MED", "DEL"], antes: 3, despues: 3,
    elige: (e) => e.tipo === "Aerial" && e.ok, valor: (e) => Math.abs(e.x - 50) / 50,
  },
  {
    clave: "recuperacion", nombre: "Recuperación", metricas: ["Recovery", "RcvryA3", "Int"], lineas: ["DEF", "MED", "DEL"], antes: 3, despues: 4,
    elige: (e) => e.tipo === "BallRecovery" || e.tipo === "Interception", valor: (e) => e.x / 100,
  },
  {
    clave: "entrada", nombre: "Entrada", metricas: ["SucflTkls"], lineas: ["DEF", "MED", "DEL"], antes: 3, despues: 3,
    elige: (e) => e.tipo === "Tackle" && e.ok, valor: (e) => 1 + e.x / 200,
  },
  {
    clave: "despeje", nombre: "Despeje", metricas: ["Clrnce"], lineas: ["DEF"], antes: 3, despues: 3,
    elige: (e) => e.tipo === "Clearance", valor: (e) => (e.x < 17 ? 1 : 0) + (100 - e.x) / 200,
  },
  {
    clave: "paradas", nombre: "Paradas", metricas: ["Saves"], lineas: ["POR"], antes: 5, despues: 3,
    elige: (e) => e.tipo === "Save", valor: () => 1,
  },
];

const METRICAS = [...new Set(["Min", ...FORTALEZAS.flatMap((f) => f.metricas)])];

function lineaDe(puesto = "") {
  if (/Goalkeeper/i.test(puesto)) return "POR";
  if (/Back|Defender/i.test(puesto)) return "DEF";
  if (/Winger|Forward|Striker/i.test(puesto)) return "DEL";
  return "MED";
}

/** Percentil (0-100) de `v` en `muestra`: la parte de la muestra que queda por debajo (los empates, a medias). */
function percentil(v, muestra) {
  if (!muestra.length) return 0;
  let menos = 0;
  let iguales = 0;
  for (const m of muestra) {
    if (m < v) menos++;
    else if (m === v) iguales++;
  }
  return Math.round(((menos + iguales / 2) / muestra.length) * 100);
}

/* ------------------------------------------------------------------ */
/*  DATOS QUE YA HAY                                                   */
/* ------------------------------------------------------------------ */

const docs = await leeDocs([CLAVE, "opta:partidos", "opta:equipos", "opta:jugadores", "castilla:calendario"]);
const tabla = (t) => (t?.cols ? t.filas.map((f) => Object.fromEntries(t.cols.map((c, i) => [c, f[i]]))) : []);
const filasPartidos = tabla(docs["opta:partidos"]);
const equiposOpta = tabla(docs["opta:equipos"]).map((f) => ({ teamId: String(f.teamId), equipo: String(f.equipo) }));
const jugadoresOpta = tabla(docs["opta:jugadores"]);

if (!filasPartidos.length || !equiposOpta.length) await fin(1, "faltan opta:partidos u opta:equipos (la descarga de Opta de los lunes)");

/* Los rivales: --equipo, o los próximos del calendario de BeSoccer. */
const hoy = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);
const nombresRival = EQUIPO
  ? [EQUIPO]
  : (docs["castilla:calendario"]?.partidos ?? [])
      .filter((p) => String(p.cuando ?? "").slice(0, 10) >= hoy && p.golesLocal == null)
      .sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)))
      .slice(0, RIVALES)
      .map((p) => (/castilla/i.test(p.local) ? p.visitante : p.local));

const rivales = nombresRival
  .map((nombre) => ({ nombre, teamId: casaEquipo(nombre, equiposOpta) }))
  .filter((r) => r.teamId && r.teamId !== CASTILLA);

if (!rivales.length) await fin(0, `no hay rival que casar con Opta (${nombresRival.join(", ") || "sin próximos partidos"})`);

for (const r of rivales) {
  r.equipo = equiposOpta.find((e) => e.teamId === r.teamId)?.equipo ?? r.nombre;
  /* Sus últimos partidos, con el rival de cada uno. */
  r.partidos = filasPartidos
    .filter((f) => String(f.teamId) === r.teamId)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, PARTIDOS)
    .map((f) => ({
      partido: String(f.partido),
      fecha: String(f.fecha).slice(0, 10),
      rival: String(filasPartidos.find((g) => g.partido === f.partido && String(g.teamId) !== r.teamId)?.equipo ?? ""),
    }));
  console.log(`${r.equipo}: últimos ${r.partidos.length} partidos (${r.partidos.map((p) => p.fecha).join(", ")})`);
}

/* ------------------------------------------------------------------ */
/*  OPTA                                                               */
/* ------------------------------------------------------------------ */

await abreChromeOpta();
const opta = await conectaOpta();
if (!opta) await fin(8, "no está abierto el Chrome de Opta del club (puerto 9335) con ProVision; se sigue en la próxima pasada");

let S;
let temporada;
try {
  S = { sseas: [await opta.temporada()] };
  console.log("Temporada de los jugadores de la categoría…");
  temporada = tabla(await opta.consulta(`SELECT playerId, ${METRICAS.map((m) => `[${m}]`).join(",")} FROM player 'p' LIMIT 6000`, S, "player p"));
} catch (e) {
  opta.cierra();
  await fin(e.sesion ? 8 : 1, e.sesion ? "la sesión de Opta ha caducado: entra en ProVision en el Chrome de Opta del club" : `Opta: ${e.message}`);
}

/* Puesto y equipo, de opta:jugadores; las métricas, de la consulta. */
const infoJugador = new Map(jugadoresOpta.map((f) => [String(f.playerId), f]));
const temporadaDe = new Map(temporada.map((f) => [String(f.playerId), f]));
const per90 = (f, m) => ((Number(f?.Min) || 0) > 0 ? ((Number(f[m]) || 0) / Number(f.Min)) * 90 : 0);

/* La muestra de cada línea: los de la categoría con 360' o más. */
const muestras = new Map();
for (const f of temporada) {
  const info = infoJugador.get(String(f.playerId));
  if (!info || (Number(f.Min) || 0) < MIN_MINUTOS) continue;
  const linea = lineaDe(String(info.puesto ?? ""));
  if (!muestras.has(linea)) muestras.set(linea, Object.fromEntries(METRICAS.map((m) => [m, []])));
  for (const m of METRICAS) muestras.get(linea)[m].push(per90(f, m));
}

function fortalezasDe(playerId) {
  const f = temporadaDe.get(playerId);
  const info = infoJugador.get(playerId);
  if (!f || !info) return [];
  const linea = lineaDe(String(info.puesto ?? ""));
  const muestra = muestras.get(linea);
  if (!muestra) return [];
  const todas = FORTALEZAS.filter((F) => F.lineas.includes(linea))
    .map((F) => {
      const ps = F.metricas.map((m) => percentil(per90(f, m), muestra[m]));
      return { F, percentil: Math.round(ps.reduce((s, p) => s + p, 0) / ps.length), por90: Math.round(per90(f, F.metricas[0]) * 100) / 100, relativa: false };
    })
    .sort((a, b) => b.percentil - a.percentil);
  const fuertes = todas.filter((x) => x.percentil >= PERCENTIL_FORTALEZA);
  /* Sin nada en el 30 % mejor: lo mejor que tiene (percentil 50 o más), marcado como «relativa». */
  return fuertes.length ? fuertes : todas.filter((x) => x.percentil >= 50).slice(0, 2).map((x) => ({ ...x, relativa: true }));
}

/** Las acciones de los partidos de un equipo, de una en una (Opta da cada evento dos veces). */
async function eventosDe(partidos) {
  const lista = partidos.map((p) => `'${p.partido.replace(/[^a-z0-9]/gi, "")}'`).join(",");
  const t = await opta.consulta(
    `SELECT game.gameId as partido, event.period as parte, event.gameClock as segundo, event.playType as tipo, event.primaryPlayerId AS jugadorId, [EventX|EVENT],[PassEndX|EVENT],[PsCompleted|EVENT],[Chance|EVENT],[xG|EVENT],[xPVAdded|EVENT], event.q2 AS centro FROM team BY event WHERE game.gameId IN (${lista}) AND event.playType IN ('PASS','TAKEON','AERIAL','TACKLE','BALLRECOVERY','INTERCEPTION','CLEARANCE','SAVE','GOAL','ATTEMPTSAVED','MISS','POST') ORDER BY event.gameEventIndex DEFAULT LIMIT ${partidos.length * 9000}`,
    S,
    "team t",
  );
  const vistos = new Map();
  for (const f of tabla(t)) {
    if (!f.jugadorId || f.parte > 2) continue;
    const e = {
      partido: String(f.partido), parte: Number(f.parte), segundo: Number(f.segundo), tipo: String(f.tipo), jugadorId: String(f.jugadorId),
      x: Number(f["EventX|EVENT"]) || 0, finX: f["PassEndX|EVENT"] == null ? null : Number(f["PassEndX|EVENT"]),
      ok: f["PsCompleted|EVENT"] === "Yes", ocasion: f["Chance|EVENT"] === "Yes", xG: typeof f["xG|EVENT"] === "number" ? f["xG|EVENT"] : null,
      xPV: typeof f["xPVAdded|EVENT"] === "number" ? f["xPVAdded|EVENT"] : 0, centro: f.centro === true,
    };
    const k = [e.partido, e.parte, e.segundo, e.tipo, e.jugadorId, e.x].join("|");
    const ya = vistos.get(k);
    if (ya) {
      if (Math.abs(e.xPV) > Math.abs(ya.xPV)) ya.xPV = e.xPV;
      continue;
    }
    vistos.set(k, e);
  }
  return [...vistos.values()];
}

/* ------------------------------------------------------------------ */
/*  LA SELECCIÓN DE CORTES                                             */
/* ------------------------------------------------------------------ */

/** Hasta 120 s (con la portada): por turnos entre sus fortalezas, lo mejor y más reciente primero. */
function cortesDe(fortalezas, eventos, partidos) {
  const reciente = new Map(partidos.map((p, i) => [p.partido, i]));
  const colas = fortalezas
    .map(({ F }) => {
      const suyos = eventos
        .filter((e) => F.elige(e))
        .sort((a, b) => F.valor(b) - F.valor(a) || (reciente.get(a.partido) ?? 9) - (reciente.get(b.partido) ?? 9));
      return { F, suyos };
    })
    .filter((c) => c.suyos.length >= 2)
    .slice(0, 3);
  const elegidos = [];
  let total = PORTADA;
  const pisa = (e) => elegidos.some((c) => c.partido === e.partido && c.parte === e.parte && Math.abs(c.segundo - e.segundo) < 10);
  for (let ronda = 0; ronda < 8; ronda++) {
    let alguno = false;
    for (const { F, suyos } of colas) {
      const e = suyos.find((x) => !x.usado && !pisa(x));
      if (!e) continue;
      const dura = F.antes + F.despues;
      if (total + dura > TOPE_SEGUNDOS) continue;
      e.usado = true;
      elegidos.push({ ...e, fortaleza: F.clave, antes: F.antes, despues: F.despues, rotulo: F.rotulo?.(e) ?? F.nombre.toUpperCase() });
      total += dura;
      alguno = true;
    }
    if (!alguno) break;
  }
  /* En el vídeo, por fortaleza (en su orden) y dentro del más reciente al más antiguo. */
  const orden = new Map(colas.map((c, i) => [c.F.clave, i]));
  elegidos.sort((a, b) => orden.get(a.fortaleza) - orden.get(b.fortaleza) || (reciente.get(a.partido) ?? 9) - (reciente.get(b.partido) ?? 9) || a.parte - b.parte || a.segundo - b.segundo);
  return { cortes: elegidos, fortalezas: colas.map((c) => c.F.clave) };
}

/* ------------------------------------------------------------------ */
/*  EL VÍDEO                                                           */
/* ------------------------------------------------------------------ */

const FUENTE = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"].find((f) => fs.existsSync(f));

function ffmpeg(args, cwd, tope = 180_000) {
  return new Promise((ok) => {
    const p = spawn(FFMPEG, ["-y", "-loglevel", "error", ...args], { cwd, windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    const reloj = setTimeout(() => p.kill(), tope);
    p.on("close", (c) => {
      clearTimeout(reloj);
      ok(c === 0 ? null : err.slice(0, 300) || `ffmpeg ${c}`);
    });
  });
}

/* Los rótulos van en ficheros de texto (textfile): así no hay que escapar tildes, comillas ni dos puntos. */
const ESCALA = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=25,setsar=1";
const SALIDA = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-video_track_timescale", "12800"];
const texto = (fichero, x, y, tam, color, borde = 12) =>
  `drawtext=expansion=none:fontfile=fuente.ttf:textfile=${fichero}:x=${x}:y=${y}:fontsize=${tam}:fontcolor=${color}:box=1:boxcolor=0x0B0F14@0.72:boxborderw=${borde}`;

async function portada(dir, jugador, equipo, lineas, relativa = false) {
  fs.writeFileSync(path.join(dir, "p1.txt"), jugador.toUpperCase());
  fs.writeFileSync(path.join(dir, "p2.txt"), equipo);
  fs.writeFileSync(path.join(dir, "p0.txt"), relativa ? "LO MEJOR QUE TIENE (NADA EN EL 30 % MEJOR DE SU LÍNEA)" : "SUS FORTALEZAS");
  lineas.forEach((l, i) => fs.writeFileSync(path.join(dir, `p${3 + i}.txt`), `${i + 1}.  ${l}`));
  const vf = [
    "drawbox=x=0:y=0:w=14:h=ih:color=0xC8A96B:t=fill",
    "drawtext=expansion=none:fontfile=fuente.ttf:textfile=p1.txt:x=80:y=200:fontsize=64:fontcolor=white",
    "drawtext=expansion=none:fontfile=fuente.ttf:textfile=p2.txt:x=80:y=288:fontsize=30:fontcolor=0xC8A96B",
    "drawbox=x=80:y=352:w=120:h=3:color=0xC8A96B:t=fill",
    "drawtext=expansion=none:fontfile=fuente.ttf:textfile=p0.txt:x=80:y=378:fontsize=20:fontcolor=0x8A96A3",
    ...lineas.map((_, i) => `drawtext=expansion=none:fontfile=fuente.ttf:textfile=p${3 + i}.txt:x=80:y=${418 + i * 46}:fontsize=30:fontcolor=0xE6EBF0`),
  ].join(",");
  return ffmpeg(["-f", "lavfi", "-i", `color=c=0x0B0F14:s=1280x720:d=${PORTADA}:r=25`, "-vf", vf, ...SALIDA, "-t", String(PORTADA), "p.mp4"], dir);
}

async function corte(dir, n, hls, c, jugador, contra) {
  const min = `${Math.floor(c.segundo / 60) + 1}'`;
  fs.writeFileSync(path.join(dir, `a${n}.txt`), c.rotulo);
  fs.writeFileSync(path.join(dir, `b${n}.txt`), `${contra ? `vs ${contra} · ` : ""}${c.fecha.split("-").reverse().slice(0, 2).join("/")} · ${min}`);
  fs.writeFileSync(path.join(dir, `c${n}.txt`), jugador);
  const vf = [ESCALA, texto(`c${n}.txt`, 36, "h-200", 26, "white", 10), texto(`a${n}.txt`, 36, "h-142", 40, "0xC8A96B", 14), texto(`b${n}.txt`, 36, "h-76", 26, "0xD7DEE6", 10)].join(",");
  return ffmpeg(["-i", hls, "-t", String(c.antes + c.despues), "-vf", vf, ...SALIDA, `k${n}.mp4`], dir);
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

const doc = docs[CLAVE] ?? {};

/*
| --lunes (la jornada nocturna): el vídeo se hace la noche del lunes, con el
| Opta de la semana ya bajado (lunes 7:30), lunes o martes de madrugada. Otro
| día sólo se sigue con un rival que el tope de tiempo dejó a medias.
*/
if (LUNES && !EQUIPO) {
  const madrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const nocheDelLunes = madrid.getDay() === 1 || (madrid.getDay() === 2 && madrid.getHours() < 8);
  const aMedias = rivales.filter((r) => doc.equipos?.[r.teamId]?.completo === false);
  if (!nocheDelLunes && !aMedias.length) await fin(0, `hoy no toca: el vídeo de los jugadores rivales se hace la noche del lunes (${rivales.map((r) => r.equipo).join(", ")})`);
  if (!nocheDelLunes) rivales.splice(0, rivales.length, ...aMedias);
}
doc.equipos ??= {};
doc.jugadores ??= {};

const guarda = async () => {
  doc.actualizado = new Date().toISOString();
  await guardaDoc(CLAVE, "opta", doc);
};

const tmp = (TMP = fs.mkdtempSync(path.join(os.tmpdir(), "opta-jugador-")));
if (FUENTE) fs.copyFileSync(FUENTE, path.join(tmp, "fuente.ttf"));

let hechos = 0;
let iguales = 0;
let fallos = 0;
let sinFortaleza = 0;

for (const r of rivales) {
  let eventos;
  try {
    console.log(`\n${r.equipo}: acciones de sus últimos ${r.partidos.length} partidos…`);
    eventos = await eventosDe(r.partidos);
  } catch (e) {
    if (e.sesion) {
      await guarda();
      opta.cierra();
      await fin(8, "la sesión de Opta ha caducado: entra en ProVision en el Chrome de Opta del club");
    }
    console.log(`  no se han podido leer: ${e.message}`);
    fallos++;
    continue;
  }

  /* Sus jugadores: de su equipo en Opta, con 360' o más y alguna acción en esos partidos. Por minutos. */
  const conAcciones = new Set(eventos.map((e) => e.jugadorId));
  const suyos = jugadoresOpta
    .filter((f) => String(f.teamId) === r.teamId && conAcciones.has(String(f.playerId)) && (Number(temporadaDe.get(String(f.playerId))?.Min) || 0) >= MIN_MINUTOS)
    .sort((a, b) => (Number(temporadaDe.get(String(b.playerId))?.Min) || 0) - (Number(temporadaDe.get(String(a.playerId))?.Min) || 0));

  /* completo: false hasta pasar por todos; si el tope corta, la noche siguiente sigue con él (--lunes). */
  doc.equipos[r.teamId] = { nombre: r.equipo, partidos: r.partidos, revisado: new Date().toISOString(), jugadores: suyos.map((f) => String(f.playerId)), completo: false };
  let cortado = false;
  console.log(`  ${eventos.length} acciones; ${suyos.length} jugadores con ${MIN_MINUTOS}' o más`);

  for (const f of suyos) {
    if (hechos >= MAX_JUGADORES) {
      cortado = true;
      break;
    }
    /* Tope de tiempo por noche (--minutos, 100 por defecto): lo que falte, la noche siguiente. */
    if (Date.now() - INICIO > TOPE_MIN * 60_000) {
      console.log(`  (tope de ${TOPE_MIN} min: lo que falta, la próxima pasada)`);
      cortado = true;
      break;
    }
    const id = String(f.playerId);
    const nombre = String(f.jugador);
    const fortalezas = fortalezasDe(id);
    const { cortes, fortalezas: usadas } = cortesDe(fortalezas, eventos.filter((e) => e.jugadorId === id).map((e) => ({ ...e, usado: false })), r.partidos);
    const ficha = {
      nombre, teamId: r.teamId, equipo: r.equipo, puesto: PUESTO_OPTA[String(f.puesto ?? "")] ?? String(f.puesto ?? ""), minutos: Number(temporadaDe.get(id)?.Min) || 0,
      fortalezas: fortalezas.slice(0, 5).map((x) => ({ clave: x.F.clave, nombre: x.F.nombre, percentil: x.percentil, por90: x.por90, relativa: x.relativa, enVideo: usadas.includes(x.F.clave) })),
    };

    if (cortes.length < 3) {
      sinFortaleza++;
      doc.jugadores[id] = { ...doc.jugadores[id], ...ficha, sinVideo: fortalezas.length ? "pocas acciones de sus fortalezas en sus últimos partidos" : "ninguna métrica en la mitad mejor de su línea" };
      console.log(`  · ${nombre}: sin vídeo (${doc.jugadores[id].sinVideo})`);
      continue;
    }

    const firma = cortes.map((c) => `${c.partido}|${c.parte}|${c.segundo}|${c.fortaleza}`).join(";");
    const previo = doc.jugadores[id];
    if (!REHACER && previo?.firma === firma && previo?.url) {
      doc.jugadores[id] = { ...previo, ...ficha };
      iguales++;
      continue;
    }

    const segundos = PORTADA + cortes.reduce((s, c) => s + c.antes + c.despues, 0);
    console.log(`  · ${nombre}: ${usadas.map((k) => FORTALEZAS.find((F) => F.clave === k).nombre).join(", ")} · ${cortes.length} cortes, ${segundos} s`);
    if (VER) continue;

    /* Corte a corte. */
    for (const viejo of fs.readdirSync(tmp)) if (viejo !== "fuente.ttf") fs.rmSync(path.join(tmp, viejo), { force: true });
    const piezas = [];
    const buenos = [];
    for (const [n, c] of cortes.entries()) {
      const partido = r.partidos.find((p) => p.partido === c.partido);
      const v = await opta.video({ partido: c.partido, fecha: partido?.fecha, parte: c.parte, segundo: c.segundo, tipo: c.tipo }, c.antes, c.despues);
      if (v.sesion) {
        await guarda();
        opta.cierra();
        await fin(8, `la sesión de Opta ha caducado tras ${hechos} vídeos: entra en ProVision en el Chrome de Opta del club`);
      }
      if (!v.url) continue;
      const error = await corte(tmp, n, v.url, { ...c, fecha: partido?.fecha ?? "" }, nombre, partido?.rival ?? "");
      if (error) {
        console.log(`      ${c.rotulo} ${Math.floor(c.segundo / 60) + 1}': ${error.split("\n")[0]}`);
        continue;
      }
      piezas.push(`k${n}.mp4`);
      buenos.push({ partido: c.partido, fecha: partido?.fecha ?? "", rival: partido?.rival ?? "", parte: c.parte, segundo: c.segundo, fortaleza: c.fortaleza, que: c.rotulo, dura: c.antes + c.despues });
    }

    if (buenos.length < 3) {
      fallos++;
      console.log(`      sin vídeo bastante en Opta (${buenos.length} cortes)`);
      continue;
    }

    /* En la portada, cada fortaleza con su percentil en su línea («Juego aéreo · mejor que el 85 %»). */
    const nombresF = usadas.map((k) => {
      const x = fortalezas.find((y) => y.F.clave === k);
      return `${x.F.nombre} (mejor que el ${x.percentil} %)`;
    });
    const errPortada = await portada(tmp, nombre, `${r.equipo} · ${ficha.puesto ? ficha.puesto + " · " : ""}sus últimos ${r.partidos.length} partidos`, nombresF, fortalezas.every((x) => x.relativa));
    const lista = [...(errPortada ? [] : ["p.mp4"]), ...piezas].map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(path.join(tmp, "lista.txt"), lista);
    const errJunta = await ffmpeg(["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "-movflags", "+faststart", "final.mp4"], tmp);
    if (errJunta) {
      fallos++;
      console.log(`      no se ha podido juntar: ${errJunta.split("\n")[0]}`);
      continue;
    }

    const datos = fs.readFileSync(path.join(tmp, "final.mp4"));
    const ruta = `privado/opta-jugador/${r.teamId}/${id}.mp4`;
    let url;
    try {
      url = await b2.sube(ruta, datos, "video/mp4");
    } catch (e) {
      fallos++;
      console.log(`      no se pudo subir a B2 (${e?.message || e})`);
      continue;
    }

    doc.jugadores[id] = {
      ...ficha, url, ruta, bytes: datos.length, firma, en: new Date().toISOString(),
      segundos: (errPortada ? 0 : PORTADA) + buenos.reduce((s, c) => s + c.dura, 0), cortes: buenos,
    };
    delete doc.jugadores[id].sinVideo;
    hechos++;
    console.log(`      ${(datos.length / 1e6).toFixed(1)} MB, ${doc.jugadores[id].segundos} s`);
    await guarda();
  }
  doc.equipos[r.teamId].completo = !cortado;
}

/* Los equipos que ya no son próximo rival, fuera a los 10 días (vídeo incluido). */
const vigentes = new Set(rivales.map((r) => r.teamId));
const hace10 = Date.now() - 10 * 864e5;
let borrados = 0;
if (!VER && !EQUIPO) {
  for (const [teamId, e] of Object.entries(doc.equipos)) {
    if (vigentes.has(teamId) || Date.parse(e.revisado ?? 0) > hace10) continue;
    for (const [id, j] of Object.entries(doc.jugadores)) {
      if (j.teamId !== teamId) continue;
      if (j.ruta) await b2.oculta(j.ruta).catch(() => {});
      delete doc.jugadores[id];
      borrados++;
    }
    delete doc.equipos[teamId];
  }
}

if (!VER) await guarda();
opta.cierra();
fs.rmSync(tmp, { recursive: true, force: true });

await fin(
  fallos && !hechos && !iguales ? 1 : 0,
  `${VER ? "(--ver, sin bajar nada) " : ""}${rivales.map((r) => r.equipo).join(" y ")}: ${hechos} vídeos nuevos, ${iguales} sin cambios, ${sinFortaleza} sin vídeo${fallos ? `, ${fallos} fallos` : ""}${borrados ? `; ${borrados} de rivales pasados borrados` : ""}`,
);
