/**
 * OPTA (TruMedia ProVision) → SUPABASE (09/11/2026).
 *
 *   node scripts/opta-liga.mjs              descarga todo y lo sube
 *   node scripts/opta-liga.mjs --en-seco    descarga y deja copia en .cache/opta, sin subir
 *   node scripts/opta-liga.mjs --sesion     sólo comprueba que la sesión sigue viva
 *
 * Cómo funciona: Opta ProVision es una web (realmadrid.opta.trumediasports.com)
 * que pide sus datos con POST /dp-proxy y un SQL propio («SSQL»):
 *
 *   SELECT teamId, fullName, [Goal],[ExpG] FROM team 't' BY game LIMIT 50
 *
 * Las métricas van entre corchetes con su abreviatura; el catálogo entero
 * (≈1.570) sale de /dp-proxy-show-stats-custom. El filtro de temporada y de
 * equipo va en el `descriptor` (`f.sseas`, `f.spot`). Las consultas se hacen
 * DESDE LA PÁGINA (Runtime.evaluate) para que viajen con su cookie: no hay
 * token que guardar ni contraseña en ningún sitio.
 *
 * La sesión vive en un Chrome propio con perfil `%LOCALAPPDATA%\rmcf-opta`
 * (puerto 9335), igual que Wyscout. La primera vez el analista entra a mano en
 * esa ventana; después la sesión se guarda en el perfil.
 *
 * Los datos son de pago (licencia del club): van a Supabase, NO al repositorio,
 * que es público. Documentos:
 *
 *   opta:meta              temporada, fecha y catálogo de las métricas usadas
 *   opta:equipos           los 40 equipos de Primera RFEF, TODAS las métricas de equipo
 *   opta:partidos          cada equipo en cada partido (selección de métricas)
 *   opta:jugadores         todos los jugadores de la categoría (selección)
 *   opta:castilla          los jugadores del Castilla, TODAS las métricas de jugador
 *   opta:castilla-partidos cada jugador del Castilla en cada partido (selección)
 *
 * Todas con la misma forma: { cols: string[], filas: (string|number|null)[][] }.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const RAIZ = process.cwd();
const CACHE = path.join(RAIZ, ".cache", "opta");
const SITIO = "https://realmadrid.opta.trumediasports.com";
const PUERTO = Number(process.env.OPTA_PUERTO ?? 9335);
const PERFIL = path.join(process.env.LOCALAPPDATA ?? os.homedir(), "rmcf-opta");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((r) => fs.existsSync(r));

/** Castilla en Opta: «Real Madrid II». */
export const CASTILLA_OPTA = "3kibouup3gxwnnxp3vhz83af7";
const LIGA = "Primera División RFEF";

const EN_SECO = process.argv.includes("--en-seco");
const SOLO_SESION = process.argv.includes("--sesion");

/* Partido a partido (equipos): lo que se mira de un partido. */
const POR_PARTIDO = [
  "Goal", "GA", "ExpG", "ExpGAg", "ShtIncBl", "SOG", "ShotsAg", "SOGAg", "Poss%", "PPDA",
  "PsAtt", "Pass%", "Ps%InA3rd", "TouchOpBox", "Chance", "KeyPass", "Crosses", "CrossCmp",
  "LgBall", "LgBallCp", "ThrghBalls", "Recovery", "PosWonA3rd", "PosWonM3rd", "PosWonD3rd",
  "Int", "Clrnce", "AerialWon", "Aerial%", "Duel%", "Tackle%", "FoulCom", "FoulSuf", "Yellow",
  "PossLost", "Disposs", "Sequences", "SeqEndInA3", "Seq9+Pass", "DirectSpeed",
  "Corners", "CrnrWon", "CrnrLost", "GoalCrnrs", "GoalDirFK", "GoalThr", "ShotDirFK",
  "ThrowIn", "ThrowInSc", "CrnrOnTgt", "CrnrOffTgt", "FKOnTgt", "FKOffTgt", "Saves",
];

/* La categoría entera (jugadores): para percentiles por puesto. */
const JUGADOR_CATEGORIA = [
  "GM", "Min", "Age", "Touches", "PsAtt", "Pass%", "Ps%InA3rd", "Chance", "KeyPass", "Ast", "xA",
  "Goal", "GoalExPn", "ExpG", "ShtIncBl", "SOG", "OnTarget%", "TouchOpBox", "TchsA3", "TchsM3", "TchsD3",
  "Crosses", "CrossCmp", "CrossOpen", "LgBall", "LgBallCp", "LongBall%", "ThrghBalls", "ThrghBlCmp",
  "1v1InBox", "Sc1v1InBox", "KPAf1v1", "Tackle%", "Duel%", "AerialWon", "Aerial%", "Arl%AH", "Arl%DH",
  "Recovery", "PosWonA3rd", "PosWonM3rd", "PosWonD3rd", "Int", "IntA3", "Clrnce", "CrossBlkd",
  "FoulCom", "FoulSuf", "Yellow", "PossLost", "PsLostA3", "PsLostM3", "PsLostD3", "Disposs",
  "Corners", "KeyPsCrn", "KeyPsFK", "AstCrnr", "AstFK", "GoalDirFK", "ShotDirFK", "CrossFK", "CrossCmpFK",
  "Saves", "SvInBox", "SvOutBox", "CrossClaim", "CrossPunch", "GAg", "ExpGAg", "GABA",
];

/* Cada jugador del Castilla en cada partido: la tendencia de la ficha. */
const JUGADOR_PARTIDO = [
  "Min", "Touches", "PsAtt", "Pass%", "Ps%InA3rd", "Chance", "KeyPass", "Ast", "xA", "Goal", "ExpG",
  "ShtIncBl", "SOG", "TouchOpBox", "Crosses", "CrossCmp", "LgBall", "LgBallCp", "1v1InBox", "Sc1v1InBox",
  "Tackle%", "Duel%", "AerialWon", "Aerial%", "Recovery", "PosWonA3rd", "Int", "Clrnce",
  "FoulCom", "FoulSuf", "PossLost", "Disposs", "Saves", "GAg",
];

/* ------------------------------------------------------------------ */
/*  CHROME                                                             */
/* ------------------------------------------------------------------ */

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function pestanas() {
  try {
    return await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
  } catch {
    return null;
  }
}

async function abreChrome() {
  if (await pestanas()) return;
  if (!CHROME) throw new Error("No encuentro Chrome en Program Files.");

  fs.mkdirSync(PERFIL, { recursive: true });
  spawn(
    CHROME,
    [
      `--remote-debugging-port=${PUERTO}`,
      `--user-data-dir=${PERFIL}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--restore-last-session",
      "--window-size=1500,950",
      `${SITIO}/soccer/league-tables`,
    ],
    { stdio: "ignore", detached: true },
  ).unref();

  for (let i = 0; i < 30 && !(await pestanas()); i++) await espera(1000);
  await espera(6000);
}

/** Abre un canal CDP con la pestaña de Opta y devuelve `evalua(js)`. */
async function conecta() {
  await abreChrome();

  let pag = (await pestanas()).find((p) => p.type === "page" && p.url.includes("trumedia"));

  if (!pag) {
    const nueva = await fetch(`http://127.0.0.1:${PUERTO}/json/new?${SITIO}/soccer/league-tables`, { method: "PUT" });
    pag = await nueva.json();
    await espera(8000);
  }

  const ws = new WebSocket(pag.webSocketDebuggerUrl);
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });

  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };

  const evalua = (expresion, plazo = 240_000) =>
    new Promise((ok, mal) => {
      const i = ++id;
      const t = setTimeout(() => { pend.delete(i); mal(new Error("Opta no contesta (plazo agotado).")); }, plazo);
      pend.set(i, (m) => {
        clearTimeout(t);
        const r = m.result;
        if (r?.exceptionDetails) mal(new Error(r.exceptionDetails.exception?.description ?? "Error en la página"));
        else ok(r?.result?.value);
      });
      ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression: expresion, awaitPromise: true, returnByValue: true } }));
    });

  return { evalua, cierra: () => ws.close() };
}

/* ------------------------------------------------------------------ */
/*  CONSULTAS                                                          */
/* ------------------------------------------------------------------ */

/** Lo que se ejecuta dentro de la página: una consulta SSQL con su cookie. */
const CONSULTA_EN_PAGINA = `async (statement, f, tabla) => {
  const descriptor = JSON.stringify({ namespaces: ["f", "pc"], sport: "SOCCER", siteName: "realmadrid", f,
    pc: { sgbps: "totals", ssv: "totals", strp: "standard", stc: ["total"], pcspco: [] },
    queryByGameCheck: true, restrictiveEventCheck: true });
  const r = await fetch("/dp-proxy", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "MIXED", statement, descriptor,
      entityData: { modalIdClause: "TRUE", entityClause: "TRUE", entityTable: tabla }, site: "realmadrid" }) });
  const t = await r.text();
  if (!r.ok) return { error: r.status + " " + t.slice(0, 300) };
  const j = JSON.parse(t); const d = j._data ?? j;
  return { cols: d.header.map((h) => h.columnId), filas: d.rows.map((f) => f.map((v) => Array.isArray(v) ? v[1] : v)) };
}`;

async function consulta(evalua, statement, f, tabla) {
  const r = await evalua(`(${CONSULTA_EN_PAGINA})(${JSON.stringify(statement)}, ${JSON.stringify(f)}, ${JSON.stringify(tabla)})`);
  if (!r || r.error) throw new Error(`Opta rechaza la consulta: ${r?.error ?? "sin respuesta"}\n${statement.slice(0, 200)}`);
  return r;
}

/**
 * Muchas métricas en trozos (el SSQL no traga mil columnas de golpe) y se
 * cosen por la clave de la fila (las primeras `nClave` columnas).
 */
async function porTrozos(evalua, { base, desde, sufijo, f, tabla, metricas, nClave, trozo = 90 }) {
  let cols = null;
  const filas = new Map();

  for (let i = 0; i < metricas.length; i += trozo) {
    const parte = metricas.slice(i, i + trozo);
    const r = await consulta(evalua, `SELECT ${base}, ${parte.map((m) => `[${m}]`).join(",")} FROM ${desde} ${sufijo}`, f, tabla);

    /* La consulta de jugadores añade una columna de rango delante. */
    const salto = r.cols[0] == null ? 1 : 0;
    const rcols = r.cols.slice(salto);

    if (!cols) cols = rcols.slice(0, nClave);
    cols.push(...rcols.slice(nClave));

    for (const fila of r.filas) {
      const v = fila.slice(salto);
      const clave = v.slice(0, nClave).join("|");
      if (!filas.has(clave)) filas.set(clave, v.slice(0, nClave));
      filas.get(clave).push(...v.slice(nClave));
    }

    process.stdout.write(`  ${Math.min(i + trozo, metricas.length)}/${metricas.length} métricas\r`);
  }

  process.stdout.write("\n");
  return { cols, filas: [...filas.values()] };
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

function leeEnv() {
  const env = {};
  if (fs.existsSync(".env.local")) {
    for (const linea of fs.readFileSync(".env.local", "utf8").split("\r").join("").split("\n")) {
      const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (process.env[k]) env[k] = process.env[k];
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  return env;
}

export async function subeDocs(docs) {
  const env = leeEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const ahora = new Date().toISOString();

  for (const [key, data] of Object.entries(docs)) {
    const { error } = await sb.from("app_documents").upsert({ key, kind: "opta", data, updated_at: ahora }, { onConflict: "key" });
    if (error) throw new Error(`Supabase (${key}): ${error.message}`);
    console.log(`Subido ${key}${data.filas ? ` (${data.filas.length} filas)` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

export async function sesionViva(evalua) {
  return evalua(`fetch("/useraccount").then((r) => r.ok && r.headers.get("content-type")?.includes("json"))`);
}

async function principal() {
  const { evalua, cierra } = await conecta();

  if (!(await sesionViva(evalua))) {
    throw new Error("La sesión de Opta ha caducado: entra a mano en la ventana de Opta (perfil rmcf-opta) y vuelve a lanzarlo.");
  }
  console.log("Sesión de Opta: viva.");
  if (SOLO_SESION) { cierra(); return; }

  /* Temporada: la más reciente de Primera RFEF. */
  const temporadas = await evalua(`fetch("/dp/descriptor/query?name=queryFindSeasons&isOpponent=false&reportType=summary&site=realmadrid").then((r) => r.json()).then((j) => j._data.rows)`);
  const rfef = temporadas.filter((t) => t[3] === LIGA).sort((a, b) => String(b[5]).localeCompare(String(a[5])))[0];
  if (!rfef) throw new Error(`No encuentro ${LIGA} en Opta.`);
  const S = { sseas: [rfef[0]] };
  console.log(`Temporada: ${rfef[1]} (último partido ${rfef[2]})`);

  /* Catálogo. */
  const catalogo = await evalua(`fetch("/dp-proxy-show-stats-custom?showTransforms=false&showEquations=true").then((r) => r.json()).then((j) => j.stats.filter((s) => s.abbrev).map((s) => ({ a: s.abbrev, n: s.name, c: s.context ?? [], f: s.format, d: s.desc ?? "", t: !!s.equations?.team, p: !!s.equations?.player })))`);
  const deEquipo = catalogo.filter((s) => s.t).map((s) => s.a);
  const deJugador = catalogo.filter((s) => s.p).map((s) => s.a);
  const existe = new Set(catalogo.map((s) => s.a));
  const solo = (lista) => lista.filter((a) => existe.has(a));
  console.log(`Catálogo: ${catalogo.length} métricas (${deEquipo.length} de equipo, ${deJugador.length} de jugador).`);

  const docs = {};

  console.log("Equipos (todas las métricas)…");
  docs["opta:equipos"] = await porTrozos(evalua, {
    base: "teamId, fullName as equipo, optaTeamId", desde: "team 't'", sufijo: "LIMIT 100",
    f: S, tabla: "team t", metricas: deEquipo, nClave: 3,
  });

  console.log("Partido a partido (equipos)…");
  docs["opta:partidos"] = await porTrozos(evalua, {
    base: "game.gameId as partido, game.gameDate as fecha, teamId, fullName as equipo", desde: "team 't'", sufijo: "BY game LIMIT 3000",
    f: S, tabla: "team t", metricas: solo(POR_PARTIDO), nClave: 4,
  });

  const basePlayer = "playerId, fullName as jugador, newest(team.game.teamId) as teamId, newest(team.game.fullName) as equipo, mode(game.gameDetailedPosition) as puesto";
  const sufPlayer = "WHERE (game.player) RANK order ORDER BY [Min] DESC LIMIT 3000";

  console.log("Jugadores de la categoría…");
  docs["opta:jugadores"] = await porTrozos(evalua, {
    base: basePlayer, desde: "player 'p'", sufijo: sufPlayer, f: S, tabla: "player p", metricas: solo(JUGADOR_CATEGORIA), nClave: 5,
  });

  const SC = { ...S, spot: [CASTILLA_OPTA] };

  console.log("Castilla (todas las métricas de jugador)…");
  docs["opta:castilla"] = await porTrozos(evalua, {
    base: basePlayer, desde: "player 'p'", sufijo: sufPlayer, f: SC, tabla: "player p", metricas: deJugador, nClave: 5,
  });

  console.log("Castilla partido a partido…");
  docs["opta:castilla-partidos"] = await porTrozos(evalua, {
    base: "game.gameId as partido, game.gameDate as fecha, playerId, fullName as jugador, opponent.game.fullName as rival",
    desde: "player 'p'", sufijo: "BY game LIMIT 3000", f: SC, tabla: "player p", metricas: solo(JUGADOR_PARTIDO), nClave: 5,
  });

  const usadas = new Set(Object.values(docs).flatMap((d) => d.cols));
  docs["opta:meta"] = {
    actualizado: new Date().toISOString(),
    temporada: { id: rfef[0], nombre: rfef[1], ultimoPartido: rfef[2] },
    castilla: CASTILLA_OPTA,
    catalogo: catalogo.filter((s) => usadas.has(s.a)).map(({ a, n, c, f, d }) => ({ a, n, c, f, d })),
  };

  cierra();

  fs.mkdirSync(CACHE, { recursive: true });
  for (const [k, v] of Object.entries(docs)) fs.writeFileSync(path.join(CACHE, `${k.replace(":", "-")}.json`), JSON.stringify(v));
  console.log(`Copia local en ${CACHE}`);

  if (EN_SECO) { console.log("En seco: no se sube nada."); return; }
  await subeDocs(docs);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("opta-liga.mjs")) {
  principal().then(() => process.exit(0)).catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
}
