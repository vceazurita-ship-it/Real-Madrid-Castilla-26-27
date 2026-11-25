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
 * 5. RASGOS DE SU PUESTO (25/11/2026, el analista: «no solo de sus mayores
 *    fortalezas sino también de cosas específicas de posición»). Del evento a
 *    evento de esos 5 partidos, según su puesto en ellos (portero, central,
 *    lateral, mediocentro, mediapunta, extremo, delantero centro): hacia dónde
 *    regatea, desde dónde centra, cómo remata, cómo progresa, qué hace tras
 *    robo, si arriesga en su campo, cómo sale el central o el portero… cada uno
 *    con sus cifras (scripts/opta-rasgos-jugador.mjs, que dice también lo que
 *    Opta NO da). El vídeo va por capítulos (fortalezas y rasgos, por peso),
 *    con el capítulo en el rótulo dorado y la portada de 5 s con las dos cosas.
 *
 * Si los cortes elegidos no cambian (el rival no ha jugado), no se rehace. Los
 * equipos que ya no son próximo rival se borran pasados 10 días.
 *
 * ALMACÉN (25/11/2026, «que luego no tengamos problemas de almacenamiento»):
 * al resubir un vídeo se borran sus versiones viejas de B2 (borraVersiones), y
 * lo que se deja de usar se borra entero; el vídeo va topado a ~400 kb/s
 * (≤ 6 MB los 2 minutos). El documento sólo lleva lo que pinta la página: los
 * cortes sin fecha ni rival (salen de los partidos del equipo) y la firma en
 * hash; se guarda cada 4 vídeos y al final, no tras cada uno.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 8 falta el Chrome de Opta o su
 * sesión (se sigue en la próxima pasada) · 1 fallo.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { baseConfigurada, guardaDoc, leeDocs } from "./docs-base.mjs";
import { abreChromeOpta, conectaOpta } from "./opta-ssql.mjs";
import { contexto, NOMBRE_GRUPO, rasgosDe } from "./opta-rasgos-jugador.mjs";

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
const PORTADA = 5;
const PARTIDOS = 5;
/* Sube cuando cambia la forma del vídeo: todos se rehacen la próxima pasada. */
const VERSION = "v2-rasgos";
const MAX_CAPITULOS = 6;
const MAX_POR_CAPITULO = 4;
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
    rotulo: (e) => (e.tipo === "Goal" ? "Gol" : e.tipo === "Post" ? "Al palo" : e.tipo === "AttemptSaved" ? "Remate a puerta" : "Remate"),
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
  temporada = tabla(await opta.consulta(`SELECT playerId, [PrefFoot], ${METRICAS.map((m) => `[${m}]`).join(",")} FROM player 'p' LIMIT 6000`, S, "player p"));
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

/*
| Las acciones de los partidos de un equipo (de los DOS equipos: los rasgos
| comparan con los de su puesto en esos partidos), de una en una: Opta da cada
| evento dos veces (una por equipo, con las mismas coordenadas). Los campos,
| mirados el 25/11/2026 (ver scripts/opta-rasgos-jugador.mjs).
*/
const TIPOS = ["PASS", "TAKEON", "AERIAL", "TACKLE", "CHALLENGE", "BALLRECOVERY", "INTERCEPTION", "CLEARANCE", "SAVE", "CLAIM", "PUNCH", "SWEEPER", "GOAL", "ATTEMPTSAVED", "MISS", "POST", "DISPOSSESSED", "BALLTOUCH"];
async function eventosDe(partidos) {
  const lista = partidos.map((p) => `'${p.partido.replace(/[^a-z0-9]/gi, "")}'`).join(",");
  const t = await opta.consulta(
    `SELECT game.gameId as partido, event.period as parte, event.gameClock as segundo, event.gameEventIndex AS idx, event.playType as tipo, event.primaryPlayerId AS jugadorId, event.receiverPlayerId AS receptorId, [EventX|EVENT],[EventY|EVENT],[PassEndX|EVENT],[PassEndY|EVENT],[CarryX|EVENT],[CarryY|EVENT],[PsCompleted|EVENT],[Chance|EVENT],[xG|EVENT],[xPVAdded|EVENT],[Position|EVENT],[ShotPlayStyle|EVENT], event.q1 AS largo, event.q2 AS centro, event.q4 AS hueco, event.q5 AS falta, event.q6 AS corner, event.q15 AS cabeza, event.q20 AS der, event.q72 AS izq, event.q23 AS contra, event.q328 AS primerToque, event.q196 AS cambio, event.q124 AS saquePuerta, event.q179 AS estirada FROM team BY event WHERE game.gameId IN (${lista}) AND event.playType IN (${TIPOS.map((x) => `'${x}'`).join(",")}) ORDER BY event.gameEventIndex DEFAULT LIMIT ${partidos.length * 9000}`,
    S,
    "team t",
  );
  const num = (v) => (v == null || v === "" ? null : Number(v));
  const vistos = new Map();
  for (const f of tabla(t)) {
    if (!f.jugadorId || f.parte > 2) continue;
    const e = {
      partido: String(f.partido), parte: Number(f.parte), segundo: Number(f.segundo), idx: Number(f.idx) || 0, tipo: String(f.tipo), jugadorId: String(f.jugadorId),
      receptorId: f.receptorId ? String(f.receptorId) : null,
      x: Number(f["EventX|EVENT"]) || 0, y: num(f["EventY|EVENT"]) ?? 50, finX: num(f["PassEndX|EVENT"]), finY: num(f["PassEndY|EVENT"]),
      cx: num(f["CarryX|EVENT"]), cy: num(f["CarryY|EVENT"]),
      ok: f["PsCompleted|EVENT"] === "Yes", ocasion: f["Chance|EVENT"] === "Yes", xG: typeof f["xG|EVENT"] === "number" ? f["xG|EVENT"] : null,
      xPV: typeof f["xPVAdded|EVENT"] === "number" ? f["xPVAdded|EVENT"] : 0,
      posicion: f["Position|EVENT"] ? String(f["Position|EVENT"]) : "", estilo: f["ShotPlayStyle|EVENT"] ? String(f["ShotPlayStyle|EVENT"]) : "",
      largo: f.largo === true, centro: f.centro === true, hueco: f.hueco === true, falta: f.falta === true, corner: f.corner === true,
      cabeza: f.cabeza === true, der: f.der === true, izq: f.izq === true, contra: f.contra === true || f["ShotPlayStyle|EVENT"] === "Fastbreak/Counter",
      primerToque: f.primerToque === true, cambio: f.cambio === true, saquePuerta: f.saquePuerta === true, estirada: f.estirada === true,
    };
    const k = [e.partido, e.idx, e.tipo, e.jugadorId].join("|");
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

/*
| Los capítulos del vídeo: sus fortalezas (hasta 3, con 2 acciones o más) y
| los rasgos de su puesto con cortes, por peso (el percentil de la fortaleza o
| lo claro que es el rasgo). Si un rasgo cuenta lo mismo que una fortaleza
| (regate → hacia dónde regatea), se queda el rasgo con el peso de la
| fortaleza. Como mucho 6 capítulos, al menos 2 de rasgos si los hay.
| Los cortes, por turnos entre capítulos (lo mejor primero) hasta 120 s con la
| portada: antes menos cortes por capítulo que pasarse.
*/
function cortesDe(fortalezas, rasgos, eventos, partidos) {
  const reciente = new Map(partidos.map((p, i) => [p.partido, i]));
  const conCortes = rasgos.filter((r) => r.cortes.length);
  const temas = new Set(conCortes.map((r) => r.tema).filter(Boolean));
  const pesoTema = new Map(fortalezas.map((x) => [x.F.clave, x.percentil]));
  const deFortaleza = fortalezas
    .filter((x) => !temas.has(x.F.clave))
    .map(({ F, percentil }) => ({
      clave: F.clave, titulo: F.nombre, peso: percentil * 0.9, fortaleza: true,
      cola: eventos
        .filter((e) => F.elige(e))
        .sort((a, b) => F.valor(b) - F.valor(a) || (reciente.get(a.partido) ?? 9) - (reciente.get(b.partido) ?? 9))
        .map((e) => ({ e, que: F.rotulo?.(e) ?? "", antes: F.antes, despues: F.despues })),
    }))
    .filter((c) => c.cola.length >= 2)
    .slice(0, 3);
  const deRasgo = conCortes.map((r) => ({ clave: r.clave, titulo: r.titulo, peso: Math.max(r.peso, pesoTema.get(r.tema) ?? 0), cola: r.cortes, tema: r.tema }));
  const minRasgos = Math.min(2, deRasgo.length);
  const capitulos = [];
  for (const c of [...deFortaleza, ...deRasgo].sort((a, b) => b.peso - a.peso)) {
    if (capitulos.length >= MAX_CAPITULOS) break;
    const rasgosYa = capitulos.filter((x) => !x.fortaleza).length;
    if (c.fortaleza && MAX_CAPITULOS - capitulos.length <= minRasgos - rasgosYa) continue;
    capitulos.push(c);
  }

  const elegidos = [];
  const usados = new Set();
  let total = PORTADA;
  const pisa = (e) => elegidos.some((c) => c.partido === e.partido && c.parte === e.parte && Math.abs(c.segundo - e.segundo) < 10);
  for (let ronda = 0; ronda < MAX_POR_CAPITULO; ronda++) {
    let alguno = false;
    for (const cap of capitulos) {
      const x = cap.cola.find((y) => !usados.has(y) && !pisa(y.e));
      if (!x) continue;
      const dura = x.antes + x.despues;
      if (total + dura > TOPE_SEGUNDOS) continue;
      usados.add(x);
      elegidos.push({ partido: x.e.partido, parte: x.e.parte, segundo: x.e.segundo, tipo: x.e.tipo, fortaleza: cap.clave, titulo: cap.titulo, que: x.que, antes: x.antes, despues: x.despues });
      total += dura;
      alguno = true;
    }
    if (!alguno) break;
  }
  /* En el vídeo, por capítulo (en su orden) y dentro del más reciente al más antiguo. */
  const enUso = capitulos.filter((c) => elegidos.some((e) => e.fortaleza === c.clave));
  const orden = new Map(enUso.map((c, i) => [c.clave, i]));
  elegidos.sort((a, b) => orden.get(a.fortaleza) - orden.get(b.fortaleza) || (reciente.get(a.partido) ?? 9) - (reciente.get(b.partido) ?? 9) || a.parte - b.parte || a.segundo - b.segundo);
  return { cortes: elegidos, capitulos: enUso.map((c) => ({ clave: c.clave, titulo: c.titulo, tema: c.tema, fortaleza: Boolean(c.fortaleza) })) };
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
/* Topado a ~400 kb/s (25/11/2026): 2 minutos ≈ 6 MB como mucho, para no llenar los 10 GB de B2. */
const SALIDA = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "29", "-maxrate", "400k", "-bufsize", "800k", "-pix_fmt", "yuv420p", "-video_track_timescale", "12800"];
const corta = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const texto = (fichero, x, y, tam, color, borde = 12) =>
  `drawtext=expansion=none:fontfile=fuente.ttf:textfile=${fichero}:x=${x}:y=${y}:fontsize=${tam}:fontcolor=${color}:box=1:boxcolor=0x0B0F14@0.72:boxborderw=${borde}`;

/*
| Portada de 5 s: nombre, equipo y puesto; a la izquierda sus fortalezas (con
| su percentil), a la derecha los rasgos de su puesto (lo que cuenta el vídeo).
*/
async function portada(dir, jugador, equipo, fuertes, rasgos, relativa = false) {
  const t = (n, s) => fs.writeFileSync(path.join(dir, `${n}.txt`), s);
  const dt = (n, x, y, tam, color) => `drawtext=expansion=none:fontfile=fuente.ttf:textfile=${n}.txt:x=${x}:y=${y}:fontsize=${tam}:fontcolor=${color}`;
  t("p1", corta(jugador.toUpperCase(), 30));
  t("p2", corta(equipo, 70));
  t("p0", relativa ? "LO MEJOR QUE TIENE" : "SUS FORTALEZAS");
  t("q0", "RASGOS DE SU PUESTO");
  const vf = ["drawbox=x=0:y=0:w=14:h=ih:color=0xC8A96B:t=fill", dt("p1", 80, 96, 60, "white"), dt("p2", 80, 176, 28, "0xC8A96B"), "drawbox=x=80:y=238:w=1120:h=2:color=0xC8A96B@0.6:t=fill"];
  if (fuertes.length) vf.push(dt("p0", 80, 270, 20, "0x8A96A3"));
  fuertes.slice(0, 3).forEach((f, i) => {
    t(`f${i}`, corta(f.nombre, 30));
    t(`g${i}`, relativa ? `la mitad mejor de su línea (${f.percentil} %)` : `mejor que el ${f.percentil} % de su línea`);
    vf.push(dt(`f${i}`, 80, 312 + i * 84, 30, "0xE6EBF0"), dt(`g${i}`, 80, 350 + i * 84, 19, "0x8A96A3"));
  });
  const x2 = fuertes.length ? 660 : 80;
  if (rasgos.length) vf.push(dt("q0", x2, 270, 20, "0x8A96A3"));
  rasgos.slice(0, 5).forEach((r, i) => {
    t(`r${i}`, corta(r, fuertes.length ? 38 : 70));
    vf.push(`drawbox=x=${x2}:y=${318 + i * 56}:w=8:h=8:color=0xC8A96B:t=fill`, dt(`r${i}`, x2 + 22, 310 + i * 56, 25, "0xE6EBF0"));
  });
  return ffmpeg(["-f", "lavfi", "-i", `color=c=0x0B0F14:s=1280x720:d=${PORTADA}:r=25`, "-vf", vf.join(","), ...SALIDA, "-t", String(PORTADA), "p.mp4"], dir);
}

/* Cada corte: el nombre, el capítulo en dorado y debajo qué es, el rival, la fecha y el minuto. */
async function corte(dir, n, hls, c, jugador, contra) {
  const min = `${Math.floor(c.segundo / 60) + 1}'`;
  fs.writeFileSync(path.join(dir, `a${n}.txt`), corta(c.titulo.toUpperCase(), 44));
  fs.writeFileSync(path.join(dir, `b${n}.txt`), corta(`${c.que ? `${c.que} · ` : ""}${contra ? `vs ${contra} · ` : ""}${c.fecha.split("-").reverse().slice(0, 2).join("/")} · ${min}`, 80));
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
| Opta de la semana ya bajado (lunes 7:30): del lunes a las 8:00 al martes. Otro
| día sólo se sigue con un rival que el tope de tiempo dejó a medias.
*/
if (LUNES && !EQUIPO) {
  const madrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  /* Desde el lunes a las 8:00 (la pasada de las 00:00 del lunes es la noche del DOMINGO, con el Opta viejo) hasta el martes entero (si el ordenador estaba apagado). */
  const dia = madrid.getDay();
  const nocheDelLunes = (dia === 1 && madrid.getHours() >= 8) || dia === 2;
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
let borrados = 0;
let liberados = 0;

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
  const delEquipo = new Set(jugadoresOpta.filter((f) => String(f.teamId) === r.teamId).map((f) => String(f.playerId)));
  const suyos = jugadoresOpta
    .filter((f) => String(f.teamId) === r.teamId && conAcciones.has(String(f.playerId)) && (Number(temporadaDe.get(String(f.playerId))?.Min) || 0) >= MIN_MINUTOS)
    .sort((a, b) => (Number(temporadaDe.get(String(b.playerId))?.Min) || 0) - (Number(temporadaDe.get(String(a.playerId))?.Min) || 0));
  const ctx = contexto(eventos, delEquipo);

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
    const pie = { right: "derecho", left: "izquierdo", both: "los dos" }[String(temporadaDe.get(id)?.PrefFoot ?? "").toLowerCase()] ?? null;
    const { grupo, posicion, rasgos } = rasgosDe(id, ctx, pie === "los dos" ? null : pie);
    const { cortes, capitulos } = cortesDe(fortalezas, rasgos, eventos.filter((e) => e.jugadorId === id), r.partidos);
    const enVideo = new Set(capitulos.flatMap((c) => [c.clave, c.tema].filter(Boolean)));
    const ficha = {
      nombre, teamId: r.teamId, equipo: r.equipo, puesto: PUESTO_OPTA[String(f.puesto ?? "")] ?? String(f.puesto ?? ""), minutos: Number(temporadaDe.get(id)?.Min) || 0,
      /* El puesto en sus últimos partidos (el que manda en los rasgos), si no es el de la temporada. */
      rol: PUESTO_OPTA[posicion] ?? NOMBRE_GRUPO[grupo],
      fortalezas: fortalezas.slice(0, 5).map((x) => ({ clave: x.F.clave, nombre: x.F.nombre, percentil: x.percentil, por90: x.por90, relativa: x.relativa, enVideo: enVideo.has(x.F.clave) })),
      rasgos: rasgos.slice(0, 6).map((x) => ({ clave: x.clave, titulo: x.titulo, texto: x.texto, enVideo: enVideo.has(x.clave) })),
    };

    if (cortes.length < 3) {
      sinFortaleza++;
      const { cortes: _c, url: _u, ...resto } = doc.jugadores[id] ?? {};
      void _c;
      void _u;
      doc.jugadores[id] = { ...resto, ...ficha, sinVideo: fortalezas.length || rasgos.length ? "pocas acciones que enseñar en sus últimos partidos" : "ninguna métrica en la mitad mejor de su línea ni rasgo con muestra" };
      if (resto.ruta && !VER) await b2.borraVersiones(resto.ruta, { todas: true }).catch(() => {});
      delete doc.jugadores[id].ruta;
      console.log(`  · ${nombre}: sin vídeo (${doc.jugadores[id].sinVideo})`);
      continue;
    }

    /* La firma, en hash corto: la versión del montaje y los cortes elegidos. */
    const firma = crypto.createHash("sha1").update(`${VERSION};${cortes.map((c) => `${c.partido}|${c.parte}|${c.segundo}|${c.fortaleza}|${c.que}`).join(";")}`).digest("hex").slice(0, 16);
    const previo = doc.jugadores[id];
    if (!REHACER && previo?.firma === firma && previo?.url) {
      doc.jugadores[id] = { ...previo, ...ficha };
      iguales++;
      continue;
    }

    const segundos = PORTADA + cortes.reduce((s, c) => s + c.antes + c.despues, 0);
    console.log(`  · ${nombre} (${ficha.rol}): ${capitulos.map((c) => c.titulo).join(" | ")} · ${cortes.length} cortes, ${segundos} s`);
    if (VER) {
      for (const x of rasgos) console.log(`      - ${x.titulo}: ${x.texto}`);
      continue;
    }

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
        console.log(`      ${c.titulo} ${Math.floor(c.segundo / 60) + 1}': ${error.split("\n")[0]}`);
        continue;
      }
      piezas.push(`k${n}.mp4`);
      /* Sin fecha ni rival: salen de los partidos del equipo (normalizaClipsJugador los repone). */
      buenos.push({ partido: c.partido, parte: c.parte, segundo: c.segundo, fortaleza: c.fortaleza, que: c.que, dura: c.antes + c.despues });
    }

    if (buenos.length < 3) {
      fallos++;
      console.log(`      sin vídeo bastante en Opta (${buenos.length} cortes)`);
      continue;
    }

    /* La portada: sus fortalezas con su percentil y los rasgos (primero los que salen en el vídeo). */
    const fuertes = fortalezas.slice(0, 3).map((x) => ({ nombre: x.F.nombre, percentil: x.percentil }));
    const lineas = [...rasgos.filter((x) => enVideo.has(x.clave)), ...rasgos.filter((x) => !enVideo.has(x.clave))].map((x) => x.titulo);
    const errPortada = await portada(tmp, nombre, `${r.equipo} · ${ficha.rol || ficha.puesto} · sus últimos ${r.partidos.length} partidos`, fuertes, lineas, fortalezas.length > 0 && fortalezas.every((x) => x.relativa));
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
    /* La versión anterior de este vídeo, fuera ya (no esperar a la regla del bucket). */
    const viejas = await b2.borraVersiones(ruta).catch((e) => (console.log(`      (no se han podido borrar las versiones viejas: ${e.message})`), { borradas: 0, bytes: 0 }));
    liberados += viejas.bytes;

    doc.jugadores[id] = {
      ...ficha, url, ruta, bytes: datos.length, firma, en: new Date().toISOString(), portada: errPortada ? 0 : PORTADA,
      segundos: (errPortada ? 0 : PORTADA) + buenos.reduce((s, c) => s + c.dura, 0), cortes: buenos,
    };
    hechos++;
    console.log(`      ${(datos.length / 1e6).toFixed(1)} MB, ${doc.jugadores[id].segundos} s${viejas.borradas ? ` (${viejas.borradas > 1 ? `borradas ${viejas.borradas} versiones viejas` : "borrada 1 versión vieja"}, ${(viejas.bytes / 1e6).toFixed(1)} MB)` : ""}`);
    /* Al documento cada 4 vídeos (y al final): no reescribirlo entero tras cada uno. */
    if (hechos % 4 === 0) await guarda();
  }
  doc.equipos[r.teamId].completo = !cortado;

  /* Los que ya no están en su lista (bajas, menos de 360'), fuera con su vídeo. */
  if (!cortado && !VER) {
    const siguen = new Set(doc.equipos[r.teamId].jugadores);
    for (const [id, j] of Object.entries(doc.jugadores)) {
      if (j.teamId !== r.teamId || siguen.has(id)) continue;
      if (j.ruta) liberados += (await b2.borraVersiones(j.ruta, { todas: true }).catch(() => ({ bytes: 0 }))).bytes;
      delete doc.jugadores[id];
      borrados++;
    }
  }
}

/* Los equipos que ya no son próximo rival, fuera a los 10 días (vídeo incluido, todas sus versiones). */
const vigentes = new Set(rivales.map((r) => r.teamId));
const hace10 = Date.now() - 10 * 864e5;
if (!VER && !EQUIPO) {
  for (const [teamId, e] of Object.entries(doc.equipos)) {
    if (vigentes.has(teamId) || Date.parse(e.revisado ?? 0) > hace10) continue;
    for (const [id, j] of Object.entries(doc.jugadores)) {
      if (j.teamId !== teamId) continue;
      if (j.ruta) liberados += (await b2.borraVersiones(j.ruta, { todas: true }).catch(() => ({ bytes: 0 }))).bytes;
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
  `${VER ? "(--ver, sin bajar nada) " : ""}${rivales.map((r) => r.equipo).join(" y ")}: ${hechos} vídeos nuevos, ${iguales} sin cambios, ${sinFortaleza} sin vídeo${fallos ? `, ${fallos} fallos` : ""}${borrados ? `; ${borrados} jugadores que ya no tocan borrados` : ""}${liberados ? `; ${(liberados / 1e6).toFixed(1)} MB liberados en B2` : ""}; documento de ${(JSON.stringify(doc).length / 1024).toFixed(0)} KB`,
);
