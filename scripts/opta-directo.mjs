/**
 * OPTA EN DIRECTO, SIN EL ORDENADOR DEL CLUB (09/11/2026).
 *
 * Corre en GitHub Actions (`.github/workflows/opta-directo.yml`), que se lanza
 * desde Ajustes (/api/opta/directo) o a mano en la pestaña Actions. Entra en
 * Opta ProVision con usuario y contraseña de los SECRETOS de GitHub
 * (OPTA_USUARIO, OPTA_CLAVE: nunca en el código; el repositorio es público) y,
 * cada `INTERVALO_S` segundos durante `DURACION_MIN`, pide las cifras de cada
 * partido de Primera RFEF del día y las deja en Supabase:
 *
 *   opta:directo              índice: los partidos del día y cuándo se miró
 *   opta:directo:<partido>    { partido, fecha, estado, actualizado, equipos: {cols, filas} }
 *
 * PARTIDO (opcional) limita a un partido (id de Opta); si no, la jornada del día.
 * Con PARTIDO vale también un partido ya jugado (el repaso del día después):
 * se lee una vez y se acaba.
 *
 * Desde el 14/11/2026 cada partido lleva además, para los mapas de la
 * pantalla (calor, red de pases, remates, robos y pérdidas, ficha de cada
 * jugador):
 *
 *   eventos    { cols, filas } evento a evento, sin la fila repetida que da
 *              Opta (sale una por equipo), con el equipo del que lo hace
 *   jugadores  { cols, filas } cada jugador: minutos, titular, dorsal, puesto
 *              y sus cifras del partido
 *
 * --chrome: en vez de entrar con usuario y contraseña, pregunta desde el
 * Chrome de Opta del ordenador del club (perfil rmcf-opta, puerto 9335), como
 * opta-liga.mjs. Para probar y para el repaso sin GitHub.
 *
 * Los registros de Actions de un repo público se ven: aquí sólo se escriben
 * recuentos, nunca cifras ni credenciales.
 *
 * Lo que no se sabe todavía (comprobar en el primer directo): si Opta publica
 * en ProVision los partidos de Primera RFEF durante el juego o sólo al acabar.
 * Si sólo al acabar, el índice lo dirá («sin datos en juego») y el proceso
 * acaba solo en cuanto el partido aparece completo.
 */
import { createRequire as crearRequireDatos } from "node:module";
const { createClient } = crearRequireDatos(import.meta.url)("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const SITIO = "https://realmadrid.opta.trumediasports.com";
const LIGA = "Primera División RFEF";
/* Acotados aquí también: el workflow se puede lanzar a mano con cualquier
   texto, y un NaN dejaba el bucle sin vueltas (duración) o sin espera
   (intervalo: setTimeout(NaN) es 1 ms, una consulta tras otra a Opta). */
const numero = (v, porDefecto, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : porDefecto;
};
const DURACION_MIN = numero(process.env.DURACION_MIN, 150, 1, 300);
const INTERVALO_S = numero(process.env.INTERVALO_S, 60, 30, 600);
/* Tantas vueltas seguidas fallando y se para: mejor eso que cinco horas de error. */
const FALLOS_SEGUIDOS_MAX = 10;
const SOLO = (process.env.PARTIDO || "").trim();
const POR_CHROME = process.argv.includes("--chrome");
const PUERTO_CHROME = Number(process.env.OPTA_PUERTO ?? 9335);

const METRICAS = [
  "Goal", "ExpG", "ShtIncBl", "SOG", "Poss%", "PPDA", "PsAtt", "Pass%", "Ps%InA3rd", "TouchOpBox",
  "Chance", "Crosses", "Corners", "Recovery", "PosWonA3rd", "Duel%", "Aerial%", "FoulCom", "Yellow",
  "PossLost", "Sequences", "SeqEndInA3", "Saves", "PosWonM3rd", "LgBall", "AerialWon",
];

/* Cada jugador en el partido (la ficha de la pantalla). */
const METRICAS_JUGADOR = [
  "Min", "GS", "Touches", "PsAtt", "Pass%", "Chance", "KeyPass", "Ast", "xA", "Goal", "ExpG", "ShtIncBl", "SOG",
  "TouchOpBox", "Crosses", "Recovery", "PosWonA3rd", "Int", "Clrnce", "Duel%", "AerialWon", "Aerial%", "Tackle%",
  "PossLost", "Disposs", "FoulCom", "FoulSuf", "Yellow", "Saves",
];

/* Lo que no es una acción de un jugador (marcas del registro). */
const NO_ACCION = new Set(["Possession", "Sequence", "Out", "Booking", "SubstitutionOut", "SubstitutionIn", "ContentiousRefereeDecision", "Dismissal", "OffsideProvoked", "Error", "Start", "End", "FormationChange", "PlayerOff", "PlayerOn"]);

/**
 * Opta da cada evento dos veces (una por equipo, iguales salvo el equipo y
 * el xPV, que sólo trae una): se deja una, con el equipo del jugador que la
 * hace (de la consulta de jugadores) y el xPV que no es cero.
 * Salida: partido, teamId, parte, segundo, tipo, jugadorId, receptorId, x, y, finX, finY, ok, xG, xPV.
 */
function limpiaEventos(t, jugadores) {
  const c = (n) => t.cols.indexOf(n);
  const equipoDe = new Map(jugadores.filas.map((f) => [f[1], f[3]]));
  const vistos = new Map();
  const filas = [];
  const r1 = (v) => (typeof v === "number" ? Math.round(v * 10) / 10 : null);
  for (const f of t.filas) {
    const tipo = f[c("tipo")];
    const jugador = f[c("jugadorId")] || f[c("tocaId")];
    if (!tipo || !jugador || NO_ACCION.has(tipo)) continue;
    const x = f[c("EventX|EVENT")], y = f[c("EventY|EVENT")];
    const fx = f[c("PassEndX|EVENT")], fy = f[c("PassEndY|EVENT")];
    const clave = [f[c("partido")], f[c("parte")], f[c("segundo")], tipo, jugador, x, y, fx, fy].join("|");
    const xpv = typeof f[c("xPVAdded|EVENT")] === "number" ? f[c("xPVAdded|EVENT")] : 0;
    const ya = vistos.get(clave);
    if (ya) {
      if (Math.abs(xpv) > Math.abs(ya[13] ?? 0)) ya[13] = Math.round(xpv * 10000) / 10000;
      continue;
    }
    const conFin = tipo === "Pass" || tipo === "OffsidePass" || tipo === "BlockedPass";
    const fila = [
      f[c("partido")], equipoDe.get(jugador) ?? "", f[c("parte")], f[c("segundo")], tipo, jugador, f[c("receptorId")] || "",
      r1(x), r1(y), conFin ? r1(fx) : null, conFin ? r1(fy) : null, f[c("PsCompleted|EVENT")] === "Yes" ? 1 : 0,
      typeof f[c("xG|EVENT")] === "number" ? Math.round(f[c("xG|EVENT")] * 1000) / 1000 : null, Math.round(xpv * 10000) / 10000,
      /* Saque de banda o de puerta: Opta no los cuenta en «pases intentados». */
      f[c("banda")] === true ? "banda" : f[c("puerta")] === true ? "puerta" : "",
    ];
    vistos.set(clave, fila);
    filas.push(fila);
  }
  return { cols: ["partido", "teamId", "parte", "segundo", "tipo", "jugadorId", "receptorId", "x", "y", "finX", "finY", "ok", "xG", "xPV", "saque"], filas };
}

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* ------------------------------ sesión ------------------------------ */

let galletas = "";

function guardaGalletas(r) {
  const nuevas = r.headers.getSetCookie?.() ?? [];
  const tarro = new Map(galletas.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
  for (const c of nuevas) { const par = c.split(";")[0]; tarro.set(par.split("=")[0], par); }
  galletas = [...tarro.values()].join("; ");
}

/* El Chrome de Opta del club (--chrome): las consultas viajan desde la página con su cookie. */
let pagina = null;
async function enChrome(ruta, init) {
  if (!pagina) {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO_CHROME}/json/list`)).json();
    const p = lista.find((t) => t.type === "page" && t.url.includes("trumedia"));
    if (!p) throw new Error("No hay pestaña de Opta en el Chrome del club (puerto 9335).");
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
    let n = 0;
    const pendientes = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); pendientes.get(d.id)?.(d); pendientes.delete(d.id); };
    pagina = (expr) => new Promise((ok) => { const i = ++n; pendientes.set(i, ok); ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
    pagina.cierra = () => ws.close();
  }
  const d = await pagina(`fetch(${JSON.stringify(ruta)}, ${JSON.stringify({ method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body })}).then(async (r) => [r.status, r.headers.get("content-type") || "", await r.text()])`);
  const [status, tipo, texto] = d.result?.result?.value ?? [0, "", ""];
  return { status, ok: status >= 200 && status < 300, headers: { get: () => tipo }, json: async () => JSON.parse(texto) };
}

async function entra() {
  if (POR_CHROME) {
    const yo = await pide("/useraccount");
    if (!yo.ok) throw new Error("El Chrome de Opta del club no tiene la sesión abierta.");
    console.log("Dentro de Opta (Chrome del club).");
    return;
  }
  const usuario = process.env.OPTA_USUARIO;
  const clave = process.env.OPTA_CLAVE;
  if (!usuario || !clave) throw new Error("Faltan los secretos OPTA_USUARIO y OPTA_CLAVE en GitHub.");

  const r = await fetch(`${SITIO}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usuario, password: clave, pathSite: "soccer" }),
    redirect: "manual",
  });
  guardaGalletas(r);
  if (!r.ok && r.status !== 302) throw new Error(`Opta no deja entrar (${r.status}).`);

  const yo = await pide("/useraccount");
  if (!yo.ok) throw new Error("Opta no reconoce la sesión tras entrar.");
  console.log("Dentro de Opta.");
}

async function pide(ruta, init = {}) {
  if (POR_CHROME) return enChrome(ruta, init);
  const r = await fetch(`${SITIO}${ruta}`, { ...init, headers: { ...(init.headers ?? {}), cookie: galletas } });
  guardaGalletas(r);
  return r;
}

async function consulta(statement, f, tabla) {
  const descriptor = JSON.stringify({
    namespaces: ["f", "pc"], sport: "SOCCER", siteName: "realmadrid", f,
    pc: { sgbps: "totals", ssv: "totals", strp: "standard", stc: ["total"], pcspco: [] },
    queryByGameCheck: true, restrictiveEventCheck: true,
  });
  const r = await pide("/dp-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "MIXED", statement, descriptor, entityData: { modalIdClause: "TRUE", entityClause: "TRUE", entityTable: tabla }, site: "realmadrid" }),
  });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error("sesión caída"), { sesion: true });
  if (!r.ok) throw new Error(`Opta rechaza la consulta (${r.status}).`);
  /* Con la sesión caducada puede contestar 200 con la página de entrar. */
  if (!(r.headers.get("content-type") ?? "").includes("json")) throw Object.assign(new Error("sesión caída"), { sesion: true });
  const j = await r.json();
  const d = j._data ?? j;
  return { cols: d.header.map((h) => h.columnId), filas: d.rows.map((f) => f.map((v) => (Array.isArray(v) ? v[1] : v))) };
}

/* ------------------------------ supabase ------------------------------ */

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/* --fichero <carpeta>: en vez de la base de datos, un .json por documento (para probar). */
const A_FICHERO = process.argv.includes("--fichero") ? process.argv[process.argv.indexOf("--fichero") + 1] : null;

async function guarda(key, data) {
  if (A_FICHERO) {
    const fs = await import("node:fs");
    fs.mkdirSync(A_FICHERO, { recursive: true });
    fs.writeFileSync(`${A_FICHERO}/${key.replaceAll(":", "-")}.json`, JSON.stringify(data));
    return;
  }
  const { error } = await sb.from("app_documents").upsert({ key, kind: "opta", data, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/* ------------------------------ principal ------------------------------ */

const hoy = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);

async function temporada() {
  const r = await pide("/dp/descriptor/query?name=queryFindSeasons&isOpponent=false&reportType=summary&site=realmadrid");
  const filas = (await r.json())._data.rows;
  const t = filas.filter((x) => x[3] === LIGA).sort((a, b) => String(b[5]).localeCompare(String(a[5])))[0];
  if (!t) throw new Error(`No encuentro ${LIGA}.`);
  return t[0];
}

/* La lectura anterior de cada partido: la pantalla sólo da una alerta si ya
   lo era en la lectura de antes (que no parpadee con una jugada suelta). */
const anteriores = new Map();

async function vuelta(S) {
  const dia = hoy();
  const juegos = await consulta(
    `SELECT game.gameId, game.gameDate, game.status FROM game 'g' ${SOLO ? `WHERE game.gameId = '${SOLO.replace(/[^a-z0-9]/gi, "")}' ` : ""}ORDER BY game.gameDate DESC LIMIT 60`, S, "game g");
  /* Con PARTIDO, el que sea (también uno ya jugado); si no, los de hoy. */
  const delDia = juegos.filas.filter((g) => (SOLO ? g[0] === SOLO : String(g[1]).startsWith(dia)));

  const ids = delDia.map((g) => g[0]);
  let cifras = { cols: [], filas: [] };
  if (ids.length) {
    cifras = await consulta(
      `SELECT game.gameId as partido, teamId, fullName as equipo, newest(team.game.teamColor) as color, newest(team.game.homeAway) as campo, ${METRICAS.map((m) => `[${m}]`).join(",")} FROM team 't' BY game ${SOLO ? `WHERE game.gameId = '${SOLO.replace(/[^a-z0-9]/gi, "")}' ` : ""}ORDER BY game.gameDate DESC LIMIT 60`,
      /* El filtro por partido (smid) no lo coge el SSQL: se piden los últimos
         y se criban aquí. */
      S, "team t");
  }

  /* Los tramos de 5 minutos (para el «momento» y el minuto): la misma
     consulta que el momentum de opta-liga.mjs, sólo con los partidos de hoy.
     Si Opta no la acepta con el filtro, el directo sigue sin tramos. */
  let tramos = { cols: [], filas: [] };
  if (ids.length) {
    try {
      tramos = await consulta(
        `SELECT game.gameId as partido, teamId, newest(team.game.fullName) AS equipo, event.period as parte, floor(event.gameClock / 300) as tramo, [ExpG],[ShtIncBl],[TouchOpBox],[TchsA3],[PsAtt],[Poss%],[Recovery],[PosWonA3rd],[PossLost] FROM team BY event WHERE game.gameId IN (${ids.map((i) => `'${String(i).replace(/[^a-z0-9]/gi, "")}'`).join(",")}) GROUP BY game.gameId, teamId, event.period, floor(event.gameClock / 300) LIMIT 2000`,
        S, "team t");
    } catch (e) {
      if (e.sesion) throw e;
      console.log("Sin tramos de 5 minutos en esta vuelta.");
    }
  }

  /* Evento a evento y jugador a jugador (14/11/2026), para los mapas. Si
     Opta no los da en esta vuelta, el directo sigue con las cifras. */
  let eventos = { cols: [], filas: [] };
  let jugadores = { cols: [], filas: [] };
  if (ids.length) {
    try {
      jugadores = await consulta(
        `SELECT game.gameId as partido, playerId, fullName as jugador, newest(team.game.teamId) as teamId, newest(player.game.jerseyNum) as dorsal, newest(player.game.position) as puesto, ${METRICAS_JUGADOR.map((m) => `[${m}]`).join(",")} FROM player 'p' BY game ${SOLO ? `WHERE game.gameId = '${SOLO.replace(/[^a-z0-9]/gi, "")}' ` : ""}ORDER BY game.gameDate DESC LIMIT ${Math.max(120, ids.length * 60)}`,
        S, "player p");
      jugadores = { cols: jugadores.cols, filas: jugadores.filas.filter((f) => ids.includes(f[0])) };
      const crudos = await consulta(
        `SELECT game.gameId as partido, event.period as parte, event.gameClock as segundo, event.playType as tipo, event.primaryPlayerId AS jugadorId, event.toucherPlayerId AS tocaId, event.receiverPlayerId AS receptorId, [EventX|EVENT],[EventY|EVENT],[PassEndX|EVENT],[PassEndY|EVENT],[PsCompleted|EVENT],[xG|EVENT],[xPVAdded|EVENT], event.q107 AS banda, event.q124 AS puerta FROM team BY event WHERE game.gameId IN (${ids.map((i) => `'${String(i).replace(/[^a-z0-9]/gi, "")}'`).join(",")}) ORDER BY event.gameEventIndex DEFAULT LIMIT ${ids.length * 6000}`,
        S, "team t");
      eventos = limpiaEventos(crudos, jugadores);
    } catch (e) {
      if (e.sesion) throw e;
      console.log("Sin evento a evento en esta vuelta.");
    }
  }

  const ahora = new Date().toISOString();
  const indice = [];
  for (const [partido, fecha, estado] of delDia) {
    const filas = cifras.filas.filter((f) => f[0] === partido);
    /* Goles y xG en el índice (13/11/2026): la tira de la jornada de la pantalla, sin pedir cada partido. */
    const col = (m) => cifras.cols.indexOf(m);
    const cifra = (f, m) => (col(m) >= 0 && typeof f[col(m)] === "number" ? f[col(m)] : null);
    indice.push({ partido, fecha, estado, conDatos: filas.length > 0, equipos: filas.map((f) => f[2]), goles: filas.map((f) => cifra(f, "Goal")), xg: filas.map((f) => cifra(f, "ExpG")) });
    const suyos = tramos.filas.filter((f) => f[0] === partido);
    /* «anterior» = la última lectura con cifras distintas de las de ahora. */
    if (filas.length && JSON.stringify(filas) !== JSON.stringify(anteriores.get(`${partido}:ultimo`)?.filas)) {
      if (anteriores.has(`${partido}:ultimo`)) anteriores.set(partido, anteriores.get(`${partido}:ultimo`));
      anteriores.set(`${partido}:ultimo`, { cols: cifras.cols, filas });
    }
    if (filas.length) await guarda(`opta:directo:${partido}`, { partido, fecha, estado, actualizado: ahora, equipos: { cols: cifras.cols, filas }, anterior: anteriores.get(partido) ?? null, tramos: { cols: tramos.cols, filas: suyos }, eventos: { cols: eventos.cols, filas: eventos.filas.filter((f) => f[0] === partido) }, jugadores: { cols: jugadores.cols, filas: jugadores.filas.filter((f) => f[0] === partido) } });
  }
  /* SIN_INDICE (carga de la temporada): no se pisa el índice del directo del día. */
  if (!process.env.SIN_INDICE) await guarda("opta:directo", { dia: SOLO && delDia[0] ? String(delDia[0][1]).slice(0, 10) : dia, actualizado: ahora, hasta: new Date(fin).toISOString(), partidos: indice });

  /* EL ARCHIVO (14/11/2026): todos los partidos que ya tienen su documento, para el
     desplegable «Ver otro partido» de la pantalla (sólo salen los que tienen datos). */
  const conDocs = indice.filter((p) => p.conDatos);
  if (conDocs.length) {
    const previo = A_FICHERO ? null : (await sb.from("app_documents").select("data").eq("key", "opta:directo:archivo").maybeSingle()).data?.data;
    const lista = new Map((previo?.partidos ?? []).map((p) => [p.partido, p]));
    for (const p of conDocs) lista.set(p.partido, { partido: p.partido, fecha: String(p.fecha).slice(0, 10), equipos: p.equipos, goles: p.goles, estado: p.estado });
    await guarda("opta:directo:archivo", { actualizado: ahora, partidos: [...lista.values()].sort((x, y) => String(y.fecha).localeCompare(String(x.fecha))) });
  }

  console.log(`${ahora.slice(11, 19)} · ${delDia.length} partidos hoy, ${indice.filter((p) => p.conDatos).length} con datos, ${indice.filter((p) => /played|full/i.test(String(p.estado))).length} acabados.`);
  return indice;
}

const fin = Date.now() + DURACION_MIN * 60_000;

async function principal() {
  await entra();
  const S = { sseas: [await temporada()] };

  let fallos = 0;

  while (Date.now() < fin) {
    try {
      const indice = await vuelta(S);
      fallos = 0;
      if (!indice.length) {
        console.log("Hoy no hay partidos: fin.");
        break;
      }
      if (indice.length && indice.every((p) => p.conDatos && /played|full/i.test(String(p.estado)))) {
        console.log("Todos los partidos del día acabados: fin.");
        break;
      }
    } catch (e) {
      fallos += 1;
      if (e.sesion) {
        console.log("Sesión caída: vuelvo a entrar.");
        /* Si el re-login falla, se reintenta en la vuelta siguiente: antes
           el error salía del catch y tumbaba el directo entero. */
        await entra().catch((e2) => console.log(`No he podido volver a entrar: ${String(e2?.message ?? e2).slice(0, 120)}`));
      } else console.log(`Vuelta fallida: ${String(e?.message ?? e).slice(0, 120)}`);
      if (fallos >= FALLOS_SEGUIDOS_MAX) throw new Error(`${fallos} vueltas seguidas fallando: se para.`);
    }
    /* La última espera no pasa de la hora de acabar. */
    const queda = fin - Date.now();
    if (queda > 0) await espera(Math.min(INTERVALO_S * 1000, queda));
  }
}

principal().then(() => { pagina?.cierra?.(); process.exit(0); }).catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
