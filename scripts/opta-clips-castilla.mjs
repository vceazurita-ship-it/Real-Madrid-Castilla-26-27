/**
 * LOS CLIPS DE NUESTROS JUGADORES, PARTIDO A PARTIDO, DE OPTA (26/11/2026).
 *
 * Petición del analista: «saca todos los clips de Cestero, Sergio, Rober y el
 * que juegue de 10 (el último partido fue Pol) de cada partido que vayamos
 * jugando… que se pueda ir pasando de clip y se puedan descargar todos o
 * algunos», con una carátula como la del coding «pero con sus estadísticas de
 * ese partido».
 *
 *   node scripts/opta-clips-castilla.mjs                    el último partido del Castilla en Opta
 *   node scripts/opta-clips-castilla.mjs --partido <gameId> uno en concreto
 *   node scripts/opta-clips-castilla.mjs --ver              dice qué haría, sin bajar nada
 *   node scripts/opta-clips-castilla.mjs --rehacer          vuelve a montar aunque ya esté
 *   node scripts/opta-clips-castilla.mjs --solo Cestero     sólo ese jugador (para probar)
 *   node scripts/opta-clips-castilla.mjs --recompone        rehace el documento con lo que ya hay en B2 (sin cortar)
 *
 * 1. QUIÉNES. Los fijos (FIJOS: Cestero, Sergio Martínez, Roberto Martín) y
 *    «el que juegue de 10»: el del Castilla con más acciones como mediapunta
 *    (Position de Opta «Attacking Midfielder», el del centro) en ese partido.
 *    Sólo los que jugaron.
 * 2. CLIPS. TODAS sus acciones del evento a evento de ProVision (pases,
 *    regates, remates, duelos, entradas, recuperaciones, intercepciones,
 *    despejes, pérdidas). Las que van seguidas (≤ 6 s entre una y otra) van en
 *    el mismo clip: 4 s antes de la primera y 3 s después de la última.
 *    Cada clip con su rótulo (jugador, qué hace, minuto) y su etiqueta
 *    (con balón · sin balón · pérdida) para filtrar en la página.
 * 3. CARÁTULA. La del club (lib/rivals/portada.ts, en Node con
 *    scripts/caratula-node.cjs): foto, puesto en ese partido y la franja con
 *    sus números del partido (opta:castilla-partidos).
 * 4. VÍDEO COMPLETO. Carátula (4 s) + todos los clips, sin recodificar.
 * 5. GUARDA. B2 en `privado/opta-castilla/<partido>/<jugador>/…` (sólo el
 *    administrador) y el documento `opta:clips-castilla` (vetado en /api/docs;
 *    se lee por /api/opta/clips-castilla). Se quedan los últimos
 *    PARTIDOS_GUARDADOS partidos: los de antes se borran de B2 y del documento.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 8 falta el Chrome de Opta o su
 * sesión · 1 fallo.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { baseConfigurada, guardaDoc, leeDocs } from "./docs-base.mjs";
import { abreChromeOpta, conectaOpta } from "./opta-ssql.mjs";
import { grupoDe } from "./opta-rasgos-jugador.mjs";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");
const { entorno } = require("./supabase-local.cjs");
for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const { PUESTO_OPTA } = require("../lib/opta.ts");
const b2 = require("./b2.cjs");
const { caratulaJpeg, fotoDeCasa } = require("./caratula-node.cjs");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const CLAVE = "opta:clips-castilla";
const CASTILLA = "3kibouup3gxwnnxp3vhz83af7";
/* Los fijos, por el nombre de Opta (sin tildes, en minúsculas). */
const FIJOS = ["cestero", "sergio martinez", "roberto martin"];
const PARTIDOS_GUARDADOS = 4;
const CARATULA_SEGUNDOS = 4;
const ANTES = 4;
const DESPUES = 3;
const JUNTA = 6;
const TOPE_CLIP = 16;
/* Sube cuando cambia la forma de los clips: se rehacen en la próxima pasada. */
const VERSION = "c1";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const PARTIDO = arg("partido");
const VER = process.argv.includes("--ver");
const REHACER = process.argv.includes("--rehacer");
const SOLO = arg("solo");
const RECOMPONE = process.argv.includes("--recompone");

const llano = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

let TMP = null;
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
/*  EL PARTIDO Y SUS NÚMEROS                                           */
/* ------------------------------------------------------------------ */

const docs = await leeDocs([CLAVE, "opta:partidos", "opta:jugadores", "opta:castilla-partidos"]);
const tabla = (t) => (t?.cols ? t.filas.map((f) => Object.fromEntries(t.cols.map((c, i) => [c, f[i]]))) : []);
const jugadoresOpta = tabla(docs["opta:jugadores"]);

await abreChromeOpta();
const opta = await conectaOpta();
if (!opta) await fin(8, "no está abierto el Chrome de Opta del club (puerto 9335) con ProVision; se sigue en la próxima pasada");

/*
| Los partidos y los números, PREGUNTADOS A OPTA (26/11/2026): opta:partidos y
| opta:castilla-partidos se bajan los lunes, y el analista quiere los clips la
| noche del partido (o a las 6:00). Si la pregunta falla, los documentos.
*/
let S;
let partidosOpta = [];
let numerosOpta = [];
try {
  S = { sseas: [await opta.temporada()] };
  const SC = { ...S, spot: [CASTILLA] };
  partidosOpta = tabla(await opta.consulta(`SELECT game.gameId as partido, format("date","yyyy-MM-dd",game.gameDate) as fecha, teamId, opponent.game.fullName as rival, [Goal],[GA] FROM team 't' BY game LIMIT 200`, SC, "team t"))
    .filter((f) => String(f.teamId) === CASTILLA);
  numerosOpta = tabla(await opta.consulta(`SELECT game.gameId as partido, playerId, fullName as jugador, [Min],[PsAtt],[Pass%],[Chance],[Goal],[Ast],[Recovery],[Duel%],[PossLost],[Saves],[GAg],[LgBall],[LgBallCp] FROM player 'p' BY game LIMIT 3000`, SC, "player p"));
} catch (e) {
  if (e.sesion) {
    opta.cierra();
    await fin(8, "la sesión de Opta ha caducado: entra en ProVision en el Chrome de Opta del club");
  }
  console.log(`(Opta no da la lista de partidos: ${e.message}; tiro de los documentos del lunes)`);
}
const filasPartidos = tabla(docs["opta:partidos"]);
const deDocs = filasPartidos.filter((f) => String(f.teamId) === CASTILLA).map((f) => ({
  partido: String(f.partido), fecha: String(f.fecha).slice(0, 10), rival: String(filasPartidos.find((g) => g.partido === f.partido && String(g.teamId) !== CASTILLA)?.equipo ?? ""), Goal: f.Goal, GA: f.GA,
}));
const nuestros = (partidosOpta.length ? partidosOpta : deDocs).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
const fila = PARTIDO ? nuestros.find((f) => f.partido === PARTIDO) : nuestros[0];
if (!fila) await fin(1, PARTIDO ? `no encuentro el partido ${PARTIDO} del Castilla en Opta` : "no hay partidos del Castilla en Opta");

const partido = {
  partido: String(fila.partido),
  fecha: String(fila.fecha).slice(0, 10),
  rival: String(fila.rival ?? ""),
  /* Goles del Castilla - goles del rival. */
  marcador: `${Number(fila.Goal) || 0}-${Number(fila.GA) || 0}`,
};
const fechaCorta = partido.fecha.split("-").reverse().slice(0, 2).join("/");
console.log(`Castilla vs ${partido.rival} · ${partido.fecha} · ${partido.marcador}`);

const numeros = numerosOpta.length ? numerosOpta : tabla(docs["opta:castilla-partidos"]);
const numerosDe = new Map(numeros.filter((f) => f.partido === partido.partido).map((f) => [String(f.playerId), f]));
/* Los nuestros: los de la temporada y los que salen en los números del partido (un fichaje nuevo). */
const delCastilla = new Map(jugadoresOpta.filter((f) => String(f.teamId) === CASTILLA).map((f) => [String(f.playerId), f]));
for (const [id, f] of numerosDe) if (!delCastilla.has(id) && f.jugador) delCastilla.set(id, { playerId: id, jugador: f.jugador });

/* ------------------------------------------------------------------ */
/*  OPTA: SUS ACCIONES                                                 */
/* ------------------------------------------------------------------ */

const TIPOS = ["PASS", "TAKEON", "AERIAL", "TACKLE", "CHALLENGE", "BALLRECOVERY", "INTERCEPTION", "CLEARANCE", "GOAL", "ATTEMPTSAVED", "MISS", "POST", "DISPOSSESSED", "BALLTOUCH", "SAVE", "CLAIM", "PUNCH"];
let eventos;
try {
  S ??= { sseas: [await opta.temporada()] };
  const t = await opta.consulta(
    `SELECT game.gameId as partido, event.period as parte, event.gameClock as segundo, event.gameEventIndex AS idx, event.playType as tipo, event.primaryPlayerId AS jugadorId, [EventX|EVENT],[PassEndX|EVENT],[PsCompleted|EVENT],[Chance|EVENT],[Position|EVENT], event.q1 AS largo, event.q2 AS centro, event.q5 AS falta, event.q6 AS corner FROM team BY event WHERE game.gameId IN ('${partido.partido.replace(/[^a-z0-9]/gi, "")}') AND event.playType IN (${TIPOS.map((x) => `'${x}'`).join(",")}) ORDER BY event.gameEventIndex DEFAULT LIMIT 9000`,
    S,
    "team t",
  );
  const vistos = new Map();
  for (const f of tabla(t)) {
    if (!f.jugadorId || f.parte > 2 || !delCastilla.has(String(f.jugadorId))) continue;
    const e = {
      parte: Number(f.parte), segundo: Number(f.segundo), idx: Number(f.idx) || 0, tipo: String(f.tipo), jugadorId: String(f.jugadorId),
      x: Number(f["EventX|EVENT"]) || 0, finX: f["PassEndX|EVENT"] == null ? null : Number(f["PassEndX|EVENT"]),
      ok: f["PsCompleted|EVENT"] === "Yes", ocasion: f["Chance|EVENT"] === "Yes", posicion: f["Position|EVENT"] ? String(f["Position|EVENT"]) : "",
      largo: f.largo === true, centro: f.centro === true, falta: f.falta === true, corner: f.corner === true,
    };
    const k = [e.idx, e.tipo, e.jugadorId].join("|");
    if (!vistos.has(k)) vistos.set(k, e);
  }
  eventos = [...vistos.values()].sort((a, b) => a.parte - b.parte || a.segundo - b.segundo || a.idx - b.idx);
} catch (e) {
  opta.cierra();
  await fin(e.sesion ? 8 : 1, e.sesion ? "la sesión de Opta ha caducado: entra en ProVision en el Chrome de Opta del club" : `Opta: ${e.message}`);
}
console.log(`${eventos.length} acciones del Castilla`);
/* La noche del partido Opta puede no tener aún el evento a evento: se vuelve a mirar a las 6:00. */
if (eventos.length < 150) {
  opta.cierra();
  await fin(0, `vs ${partido.rival} (${partido.fecha}): Opta aún no tiene el evento a evento (${eventos.length} acciones); se vuelve a mirar en la próxima pasada`);
}
/* --puestos: el puesto de cada uno en el partido (para comprobar quién hizo de 10). */
if (process.argv.includes("--puestos")) {
  const m = new Map();
  for (const e of eventos) {
    const k = `${delCastilla.get(e.jugadorId)?.jugador} · ${e.posicion}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...m].sort()) console.log(`  ${k}: ${n}`);
}

/* Su puesto en este partido: el más repetido en sus acciones. */
const puestoEn = new Map();
for (const e of eventos) {
  if (!e.posicion) continue;
  const m = puestoEn.get(e.jugadorId) ?? new Map();
  m.set(e.posicion, (m.get(e.posicion) ?? 0) + 1);
  puestoEn.set(e.jugadorId, m);
}
const puestoDe = (id) => [...(puestoEn.get(id) ?? new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

/* Quiénes: los fijos y el 10 (el de más acciones como mediapunta del centro). */
const accionesComo = (id, grupo) => eventos.filter((e) => e.jugadorId === id && grupoDe(e.posicion) === grupo).length;
/*
| Opta no siempre lo llama mediapunta: el 20/11/2026 Pol hizo de 10 y Opta lo
| dio como «Centre Forward» (dos puntas). Sin mediapunta del centro, el 10 es,
| en cada parte, la punta más retrasada (menor X media) de las que coinciden.
*/
function diezDelPartido() {
  const mp = [...delCastilla.keys()].map((id) => ({ id, n: accionesComo(id, "MP") })).filter((x) => x.n >= 8).sort((a, b) => b.n - a.n)[0];
  if (mp) return [mp.id];
  const credito = new Map();
  for (const parte of [1, 2]) {
    const puntas = new Map();
    for (const e of eventos) {
      if (e.parte !== parte || grupoDe(e.posicion) !== "DC") continue;
      const p = puntas.get(e.jugadorId) ?? { n: 0, x: 0 };
      p.n++;
      p.x += e.x;
      puntas.set(e.jugadorId, p);
    }
    const lista = [...puntas].filter(([, p]) => p.n >= 5).map(([id, p]) => ({ id, n: p.n, x: p.x / p.n })).sort((a, b) => a.x - b.x);
    if (process.argv.includes("--puestos")) console.log(`  parte ${parte}: ${lista.map((p) => `${delCastilla.get(p.id)?.jugador} x=${p.x.toFixed(1)} (${p.n})`).join(" · ")}`);
    if (lista.length >= 2) credito.set(lista[0].id, (credito.get(lista[0].id) ?? 0) + lista[0].n);
  }
  /* Todos los que hicieron de 10 en alguna parte (el 20/11: Pol la primera, Ciria la segunda). */
  return [...credito].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
const diez = new Set(arg("diez") ? [...delCastilla].filter(([, f]) => llano(f.jugador).includes(llano(arg("diez")))).map(([id]) => id) : diezDelPartido());
console.log(`El 10: ${[...diez].map((id) => delCastilla.get(id)?.jugador).join(" y ") || "nadie"}`);
const elegidos = [];
for (const [id, f] of delCastilla) {
  const nombre = String(f.jugador);
  const fijo = FIJOS.includes(llano(nombre));
  if (!fijo && !diez.has(id)) continue;
  if (SOLO && !llano(nombre).includes(llano(SOLO))) continue;
  if (!eventos.some((e) => e.jugadorId === id)) {
    console.log(`  · ${nombre}: no jugó`);
    continue;
  }
  elegidos.push({ id, nombre, diez: diez.has(id) && !fijo });
}
if (!elegidos.length) await fin(0, "ninguno de los elegidos jugó ese partido");

/* ------------------------------------------------------------------ */
/*  LOS CLIPS                                                          */
/* ------------------------------------------------------------------ */

const esPerdida = (e) => (e.tipo === "Pass" && !e.ok && !e.corner && !e.falta) || e.tipo === "Dispossessed" || (e.tipo === "TakeOn" && !e.ok) || (e.tipo === "BallTouch" && !e.ok);
const DEFENSIVAS = new Set(["Aerial", "Tackle", "Challenge", "BallRecovery", "Interception", "Clearance", "Save", "Claim", "Punch"]);

function etiqueta(e) {
  switch (e.tipo) {
    case "Pass":
      if (e.corner) return "Córner";
      if (e.falta) return "Falta sacada";
      if (e.centro) return e.ok ? "Centro" : "Centro fallado";
      if (!e.ok) return e.largo ? "Balón largo perdido" : "Pase fallado";
      if (e.ocasion) return "Pase de ocasión";
      if (e.finX != null && (e.finX - e.x >= 15 || (e.finX >= 83 && e.finX - e.x >= 8))) return e.largo ? "Balón largo que avanza" : "Pase que avanza";
      return e.largo ? "Balón largo" : "Pase";
    case "TakeOn": return e.ok ? "Regate" : "Regate fallido";
    case "Aerial": return e.ok ? "Duelo aéreo ganado" : "Duelo aéreo perdido";
    case "Tackle": return e.ok ? "Entrada ganada" : "Entrada";
    case "Challenge": return "Le superan";
    case "BallRecovery": return "Recuperación";
    case "Interception": return "Intercepción";
    case "Clearance": return "Despeje";
    case "Goal": return "Gol";
    case "AttemptSaved": return "Remate a puerta";
    case "Miss": return "Remate fuera";
    case "Post": return "Remate al palo";
    case "Dispossessed": return "Le roban";
    case "BallTouch": return "Mal control";
    case "Save": return "Parada";
    case "Claim": return "Blocaje";
    case "Punch": return "Despeje de puños";
    default: return e.tipo;
  }
}

/* Las acciones seguidas, en un clip; la etiqueta, la de lo más importante que pasa. */
const PESO = (e) => (e.tipo === "Goal" ? 9 : ["AttemptSaved", "Miss", "Post"].includes(e.tipo) ? 8 : e.ocasion ? 7 : esPerdida(e) ? 6 : e.tipo === "TakeOn" ? 5 : DEFENSIVAS.has(e.tipo) ? 4 : etiqueta(e) === "Pase" ? 1 : 3);
function clipsDe(id) {
  const suyas = eventos.filter((e) => e.jugadorId === id);
  const grupos = [];
  for (const e of suyas) {
    const g = grupos[grupos.length - 1];
    if (g && g[0].parte === e.parte && e.segundo - g[g.length - 1].segundo <= JUNTA && e.segundo - g[0].segundo <= TOPE_CLIP - ANTES - DESPUES) g.push(e);
    else grupos.push([e]);
  }
  return grupos.map((g) => {
    const orden = [...g].sort((a, b) => PESO(b) - PESO(a));
    const nombres = [...new Set(orden.map(etiqueta))];
    const cat = g.some(esPerdida) ? "perdida" : g.some((e) => !DEFENSIVAS.has(e.tipo)) ? (g.some((e) => DEFENSIVAS.has(e.tipo)) ? "mixta" : "balon") : "sinBalon";
    return {
      parte: g[0].parte, segundo: g[0].segundo, tipo: g[0].tipo,
      antes: ANTES, despues: g[g.length - 1].segundo - g[0].segundo + DESPUES,
      que: nombres.slice(0, 3).join(" · "), acciones: g.length, cat,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  EL VÍDEO                                                           */
/* ------------------------------------------------------------------ */

const FUENTE = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"].find((f) => fs.existsSync(f));
const ESCALA = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=25,setsar=1";
const SALIDA = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-maxrate", "450k", "-bufsize", "900k", "-pix_fmt", "yuv420p", "-video_track_timescale", "12800"];
const corta = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const texto = (fichero, x, y, tam, color, borde = 12) =>
  `drawtext=expansion=none:fontfile=fuente.ttf:textfile=${fichero}:x=${x}:y=${y}:fontsize=${tam}:fontcolor=${color}:box=1:boxcolor=0x0B0F14@0.72:boxborderw=${borde}`;
const minutoDe = (s) => `${Math.floor(s / 60) + 1}'`;

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
function duracion(dir, fichero) {
  return new Promise((ok) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-i", fichero], { cwd: dir, windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => {
      const m = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      ok(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null);
    });
  });
}

/* Los números del partido para la carátula (hasta 6; el portero, los suyos). */
function metricasDe(id, portero) {
  const f = numerosDe.get(id);
  if (!f) return [];
  const n = (k) => Number(f[k]) || 0;
  const pct = (k) => (f[k] == null ? null : `${Math.round(Number(f[k]) * 100)} %`);
  const pases = n("PsAtt") ? `${Math.round(n("PsAtt") * (Number(f["Pass%"]) || 0))}/${n("PsAtt")}` : "0";
  const lista = portero
    ? [["MINUTOS", `${n("Min")}'`], ["PARADAS", String(n("Saves"))], ["GOLES RECIBIDOS", String(n("GAg"))], ["PASES", pases], ["BALONES LARGOS", `${n("LgBallCp")}/${n("LgBall")}`], ["PÉRDIDAS", String(n("PossLost"))]]
    : [
        ["MINUTOS", `${n("Min")}'`],
        ["PASES", pases],
        ...(n("Goal") || n("Ast") ? [["GOLES · ASIST.", `${n("Goal")} · ${n("Ast")}`]] : [["OCASIONES", String(n("Chance"))]]),
        ["RECUPERACIONES", String(n("Recovery"))],
        ...(pct("Duel%") ? [["DUELOS GANADOS", pct("Duel%")]] : []),
        ["PÉRDIDAS", String(n("PossLost"))],
      ];
  return lista.slice(0, 6).map(([label, valor]) => ({ label, valor }));
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

const doc = docs[CLAVE] && typeof docs[CLAVE] === "object" ? docs[CLAVE] : {};
doc.partidos ??= {};
const guarda = async () => {
  doc.actualizado = new Date().toISOString();
  if (!VER) await guardaDoc(CLAVE, "opta", doc);
};

const previo = doc.partidos[partido.partido];
doc.partidos[partido.partido] = { ...partido, jugadores: previo?.jugadores ?? [] };
const ficha = doc.partidos[partido.partido];

TMP = fs.mkdtempSync(path.join(os.tmpdir(), "clips-castilla-"));
if (FUENTE) fs.copyFileSync(FUENTE, path.join(TMP, "fuente.ttf"));

let hechos = 0;
let clipsTotal = 0;
let bytesTotal = 0;
for (const j of elegidos) {
  const ya = ficha.jugadores.find((x) => x.playerId === j.id);
  if (ya && ya.version === VERSION && !REHACER) {
    console.log(`  · ${j.nombre}: ya está (${ya.clips.length} clips)`);
    continue;
  }
  const posicion = puestoDe(j.id);
  const portero = grupoDe(posicion) === "POR";
  /* El 10 que Opta da como punta se llama por lo que hizo. */
  const rol = j.diez ? "Mediapunta (10)" : (PUESTO_OPTA[posicion] ?? posicion);
  const clips = clipsDe(j.id);
  const min = Number(numerosDe.get(j.id)?.Min) || 0;
  console.log(`  · ${j.nombre}${j.diez ? " (el 10)" : ""} · ${rol} · ${min}' · ${clips.length} clips (${clips.reduce((s, c) => s + c.antes + c.despues, 0)} s)`);
  if (VER) {
    for (const c of clips.slice(0, 12)) console.log(`      ${minutoDe(c.segundo)} ${c.que} [${c.cat}]`);
    continue;
  }

  const carpeta = `privado/opta-castilla/${partido.partido}/${j.id}`;

  /*
  | --recompone (26/11/2026): el documento desde lo que ya hay en B2, sin cortar
  | otra vez. Lo pidió un fallo: la primera pasada subió los 143 clips pero
  | guardó el documento vacío. Sólo si hay en B2 tantos clips como salen ahora
  | (si no, la numeración no casaría y hay que volver a cortarlo).
  */
  if (RECOMPONE) {
    const hay = await b2.lista(`${carpeta}/`);
    const numerados = [...hay.keys()].filter((r) => /\/\d{3}\.mp4$/.test(r)).sort();
    if (numerados.length !== clips.length) {
      console.log(`      en B2 hay ${numerados.length} clips y salen ${clips.length}: hay que volver a cortarlo (sin --recompone)`);
      continue;
    }
    const subidos = clips.map((c, i) => ({ n: i + 1, url: b2.urlPublicaYa(numerados[i]), ruta: numerados[i], parte: c.parte, segundo: c.segundo, que: c.que, acciones: c.acciones, cat: c.cat, dura: c.antes + c.despues }));
    const rCar = `${carpeta}/caratula.jpg`;
    const rCom = `${carpeta}/completo.mp4`;
    const bytes = [...hay.values()].reduce((s, b) => s + (Number(b) || 0), 0);
    const entrada = {
      playerId: j.id, nombre: j.nombre, rol, diez: j.diez || undefined, minutos: min, version: VERSION, en: new Date().toISOString(),
      metricas: metricasDe(j.id, portero),
      caratula: hay.has(rCar) ? { url: b2.urlPublicaYa(rCar), ruta: rCar } : null,
      completo: hay.has(rCom) ? { url: b2.urlPublicaYa(rCom), ruta: rCom, bytes: Number(hay.get(rCom)) || 0, segundos: Math.round(CARATULA_SEGUNDOS + subidos.reduce((s, c) => s + c.dura, 0)) } : null,
      clips: subidos, bytes,
    };
    ficha.jugadores = [...ficha.jugadores.filter((x) => x.playerId !== j.id), entrada];
    hechos++;
    clipsTotal += subidos.length;
    bytesTotal += bytes;
    console.log(`      recompuesto desde B2: ${subidos.length} clips · ${(bytes / 1e6).toFixed(1)} MB`);
    continue;
  }

  for (const viejo of fs.readdirSync(TMP)) if (viejo !== "fuente.ttf") fs.rmSync(path.join(TMP, viejo), { force: true });
  const buenos = [];
  for (const [n, c] of clips.entries()) {
    const v = await opta.video({ partido: partido.partido, fecha: partido.fecha, parte: c.parte, segundo: c.segundo, tipo: c.tipo }, c.antes, c.despues);
    if (v.sesion) {
      await guarda();
      opta.cierra();
      await fin(8, `la sesión de Opta ha caducado tras ${hechos} jugadores: entra en ProVision en el Chrome de Opta del club`);
    }
    if (!v.url) continue;
    const k = String(n + 1).padStart(3, "0");
    fs.writeFileSync(path.join(TMP, `a${k}.txt`), corta(c.que, 46));
    fs.writeFileSync(path.join(TMP, `b${k}.txt`), corta(`${j.nombre} · vs ${partido.rival} · ${fechaCorta} · ${minutoDe(c.segundo)}`, 80));
    const vf = [ESCALA, texto(`a${k}.txt`, 36, "h-132", 36, "0xC8A96B", 14), texto(`b${k}.txt`, 36, "h-72", 24, "0xD7DEE6", 10)].join(",");
    const error = await ffmpeg(["-i", v.url, "-t", String(c.antes + c.despues), "-vf", vf, ...SALIDA, "-movflags", "+faststart", `k${k}.mp4`], TMP);
    if (error) {
      console.log(`      ${minutoDe(c.segundo)} ${c.que}: ${error.split("\n")[0]}`);
      continue;
    }
    const real = await duracion(TMP, `k${k}.mp4`);
    if (real != null && real < 1) continue;
    buenos.push({ ...c, fichero: `k${k}.mp4`, dura: real != null ? Math.round(real * 100) / 100 : c.antes + c.despues });
  }
  if (!buenos.length) {
    console.log("      sin vídeo en Opta");
    continue;
  }

  /* La carátula, con sus números del partido. */
  const jpeg = await caratulaJpeg({
    equipo: "RMCF Castilla",
    escudo: "/logo.png",
    temporada: "26 / 27",
    nombre: j.nombre,
    posicion: rol.toUpperCase(),
    dorsal: "",
    foto: fotoDeCasa(j.nombre),
    contexto: `vs ${partido.rival} · ${fechaCorta} · ${partido.marcador}`,
    metricas: metricasDe(j.id, portero),
    firma: `RMCF CASTILLA · VÍDEO DEL PARTIDO · VS ${partido.rival.toUpperCase()}`,
  });
  let caratula = null;
  const piezas = [];
  if (jpeg) {
    fs.writeFileSync(path.join(TMP, "caratula.jpg"), jpeg);
    const err = await ffmpeg(["-loop", "1", "-framerate", "25", "-i", "caratula.jpg", "-t", String(CARATULA_SEGUNDOS), "-vf", ESCALA, ...SALIDA, "c.mp4"], TMP);
    if (!err) piezas.push("c.mp4");
  }
  piezas.push(...buenos.map((c) => c.fichero));
  fs.writeFileSync(path.join(TMP, "lista.txt"), piezas.map((p) => `file '${p}'`).join("\n"));
  const errJunta = await ffmpeg(["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "-movflags", "+faststart", "completo.mp4"], TMP);

  /* Arriba: los clips, la carátula y el completo; lo de una pasada anterior que sobre, fuera. */
  const subidos = [];
  let bytes = 0;
  try {
    for (const [i, c] of buenos.entries()) {
      const datos = fs.readFileSync(path.join(TMP, c.fichero));
      const ruta = `${carpeta}/${String(i + 1).padStart(3, "0")}.mp4`;
      const url = await b2.sube(ruta, datos, "video/mp4");
      await b2.borraVersiones(ruta).catch(() => {});
      bytes += datos.length;
      subidos.push({ n: i + 1, url, ruta, parte: c.parte, segundo: c.segundo, que: c.que, acciones: c.acciones, cat: c.cat, dura: c.dura });
    }
    if (jpeg) {
      const ruta = `${carpeta}/caratula.jpg`;
      caratula = { url: await b2.sube(ruta, jpeg, "image/jpeg"), ruta };
      await b2.borraVersiones(ruta).catch(() => {});
    }
  } catch (e) {
    console.log(`      no se pudo subir a B2 (${e?.message || e})`);
    continue;
  }
  let completo = null;
  if (!errJunta) {
    const datos = fs.readFileSync(path.join(TMP, "completo.mp4"));
    const ruta = `${carpeta}/completo.mp4`;
    try {
      completo = { url: await b2.sube(ruta, datos, "video/mp4"), ruta, bytes: datos.length, segundos: Math.round((piezas[0] === "c.mp4" ? CARATULA_SEGUNDOS : 0) + buenos.reduce((s, c) => s + c.dura, 0)) };
      await b2.borraVersiones(ruta).catch(() => {});
      bytes += datos.length;
    } catch (e) {
      console.log(`      no se pudo subir el completo (${e?.message || e})`);
    }
  }
  for (const viejo of ya?.clips ?? []) if (viejo.n > subidos.length) await b2.borraVersiones(viejo.ruta, { todas: true }).catch(() => {});

  const entrada = {
    playerId: j.id, nombre: j.nombre, rol, diez: j.diez || undefined, minutos: min, version: VERSION, en: new Date().toISOString(),
    metricas: metricasDe(j.id, portero), caratula, completo, clips: subidos, bytes,
  };
  ficha.jugadores = [...ficha.jugadores.filter((x) => x.playerId !== j.id), entrada];
  hechos++;
  clipsTotal += subidos.length;
  bytesTotal += bytes;
  console.log(`      ${subidos.length} clips · ${(bytes / 1e6).toFixed(1)} MB${completo ? ` · completo ${completo.segundos} s` : ""}`);
  await guarda();
}
opta.cierra();

/* Los fijos primero, el 10 al final; dentro, por minutos. */
ficha.jugadores.sort((a, b) => Number(Boolean(a.diez)) - Number(Boolean(b.diez)) || b.minutos - a.minutos);

/* Sólo los últimos PARTIDOS_GUARDADOS partidos: lo de antes, fuera de B2 y del documento. */
let borrados = 0;
const quedan = Object.values(doc.partidos).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, PARTIDOS_GUARDADOS).map((p) => p.partido);
if (!VER) {
  for (const [id, p] of Object.entries(doc.partidos)) {
    if (quedan.includes(id)) continue;
    for (const j of p.jugadores ?? []) {
      for (const r of [...(j.clips ?? []).map((c) => c.ruta), j.caratula?.ruta, j.completo?.ruta].filter(Boolean)) {
        await b2.borraVersiones(r, { todas: true }).catch(() => {});
        borrados++;
      }
    }
    delete doc.partidos[id];
  }
}
await guarda();
await fin(0, `vs ${partido.rival} (${partido.fecha}): ${hechos} jugadores, ${clipsTotal} clips, ${(bytesTotal / 1e6).toFixed(1)} MB${borrados ? `; ${borrados} ficheros de partidos viejos borrados` : ""}`);
