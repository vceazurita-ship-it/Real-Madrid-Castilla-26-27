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
 *
 * Los registros de Actions de un repo público se ven: aquí sólo se escriben
 * recuentos, nunca cifras ni credenciales.
 *
 * Lo que no se sabe todavía (comprobar en el primer directo): si Opta publica
 * en ProVision los partidos de Primera RFEF durante el juego o sólo al acabar.
 * Si sólo al acabar, el índice lo dirá («sin datos en juego») y el proceso
 * acaba solo en cuanto el partido aparece completo.
 */
import { createClient } from "@supabase/supabase-js";

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

const METRICAS = [
  "Goal", "ExpG", "ShtIncBl", "SOG", "Poss%", "PPDA", "PsAtt", "Pass%", "Ps%InA3rd", "TouchOpBox",
  "Chance", "Crosses", "Corners", "Recovery", "PosWonA3rd", "Duel%", "Aerial%", "FoulCom", "Yellow",
  "PossLost", "Sequences", "SeqEndInA3", "Saves", "PosWonM3rd", "LgBall", "AerialWon",
];

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* ------------------------------ sesión ------------------------------ */

let galletas = "";

function guardaGalletas(r) {
  const nuevas = r.headers.getSetCookie?.() ?? [];
  const tarro = new Map(galletas.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
  for (const c of nuevas) { const par = c.split(";")[0]; tarro.set(par.split("=")[0], par); }
  galletas = [...tarro.values()].join("; ");
}

async function entra() {
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

async function guarda(key, data) {
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
    "SELECT game.gameId, game.gameDate, game.status FROM game 'g' ORDER BY game.gameDate DESC LIMIT 60", S, "game g");
  const delDia = juegos.filas.filter((g) => String(g[1]).startsWith(dia) && (!SOLO || g[0] === SOLO));

  const ids = delDia.map((g) => g[0]);
  let cifras = { cols: [], filas: [] };
  if (ids.length) {
    cifras = await consulta(
      `SELECT game.gameId as partido, teamId, fullName as equipo, ${METRICAS.map((m) => `[${m}]`).join(",")} FROM team 't' BY game ORDER BY game.gameDate DESC LIMIT 60`,
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
    if (filas.length) await guarda(`opta:directo:${partido}`, { partido, fecha, estado, actualizado: ahora, equipos: { cols: cifras.cols, filas }, anterior: anteriores.get(partido) ?? null, tramos: { cols: tramos.cols, filas: suyos } });
  }
  await guarda("opta:directo", { dia, actualizado: ahora, hasta: new Date(fin).toISOString(), partidos: indice });

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

principal().then(() => process.exit(0)).catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
