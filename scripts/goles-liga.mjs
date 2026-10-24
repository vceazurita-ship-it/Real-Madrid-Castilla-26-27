/*
|--------------------------------------------------------------------------
| LOS GOLES DE LA LIGA, CON SU MINUTO, Y LA TIPOLOGÍA DE LOS NUESTROS
|--------------------------------------------------------------------------
|
|   node scripts/goles-liga.mjs            arma `goles:analisis` y lo sube
|   node scripts/goles-liga.mjs --ver      sólo enseña lo que subiría
|   node scripts/goles-liga.mjs --hudl     antes, baja de Hudl el timeline de
|                                          nuestros partidos recientes que falten
|
| Lo lanza cada noche `jornada-nocturna.cmd`, después del informe de rivales
| (de ahí salen los goles). Junta tres fuentes (`lib/goles/analisis.ts`):
|
|   1. BeSoccer (`rivals:informe`): todos los partidos de liga con cada gol,
|      su minuto, el autor y si fue de penalti o en propia puerta.
|   2. Wyscout (`public/data/analisis.json`): remates, a puerta y xG de cada
|      equipo y partido. Se baja una vez por semana (`wyscout-semanal.cmd`).
|   3. Hudl (el timeline de cada partido nuestro, `timeline-hudl.json`): de
|      dónde viene cada gol nuestro y de nuestros rivales, y los remates con
|      su minuto. Los timelines están en las carpetas del análisis de vídeo;
|      con `--hudl` se bajan los que falten de los partidos de las dos últimas
|      semanas (Hudl los cuelga uno o dos días después del partido).
|
| La tipología se decide con lo etiquetado (ver `clasifica`): es una
| propuesta, y en la pantalla se corrige gol a gol.
*/

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { entorno, salir } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { leeTimeline } = require("./partido/comun.cjs");
const { mismoEquipo: mismoNombre } = require("../lib/data-analisis/nombres.ts");
const { mismoClub } = require("../lib/rivals/mismoClub.ts");

/* Wyscout dice «Atlético Madrid B» y BeSoccer «Atlético Madrileño»: palabra a palabra no casan. */
const mismoEquipo = (a, b) => mismoNombre(a, b) || mismoClub(a, b);
const { DOC_GOLES, CASTILLA, leeMinuto } = require("../lib/goles/analisis.ts");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASA = path.join(RAIZ, "..", "..");
const CARPETAS_TIMELINE = [path.join(CASA, "PARTIDOS", "ANALISIS"), path.join(CASA, "ANALISIS TRANSICIONES"), path.join(CASA, "HUDL ALCORCON")];
const CARPETA_TACTICA = path.join(CASA, "ANALISIS TRANSICIONES");
const SOLO_VER = process.argv.includes("--ver");
const BAJAR_HUDL = process.argv.includes("--hudl");

async function principal() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  /* ---------------- 1. BeSoccer ---------------- */
  const { data: fila, error } = await supabase.from("app_documents").select("data").eq("key", "rivals:informe").single();

  if (error || !fila?.data?.porId) throw new Error(`no se puede leer rivals:informe (${error?.message ?? "vacío"})`);

  const informe = fila.data;
  const porId = new Map();

  for (const equipo of Object.values(informe.porId)) {
    for (const p of equipo.partidos ?? []) {
      /* «Primera Federación. Jornada 6», con o sin punto y con cualquier espacio
         (un partido con otra escritura se quedaba fuera y descuadraba los totales);
         copas y amistosos no llevan «Primera Federación» y siguen fuera. */
      const competicion = String(p.competicion ?? "");
      const jornada = /Primera Federaci[oó]n/i.test(competicion)
        ? Number(competicion.match(/Jornada\s*(\d+)/i)?.[1])
        : 0;

      if (!p.jugado || !jornada) continue;

      /* Un partido jugado sin goles detallados también cuenta (con la lista vacía y marcado como incompleto). */
      const lista = Array.isArray(p.goles) ? p.goles : [];

      const total = (p.local?.goles ?? 0) + (p.visitante?.goles ?? 0);

      /* Cada partido sale una vez por equipo: se queda la copia con más goles detallados.
         Si ninguna los trae todos, el partido se guarda igual (cuenta en partidos y en
         goles a favor y en contra) con los que sí tienen minuto, marcado como incompleto. */
      const previo = porId.get(p.id);

      if (previo && previo.goles.length >= lista.length) continue;

      /* Si BeSoccer trae más goles que el marcador (uno anulado o repetido) se quitan los repetidos
         (mismo minuto, jugador y lado); si aun así sobran, el partido NO se tira: se guarda con su
         resultado y sin goles detallados, marcado como incompleto. */
      const vistos = new Set();
      let detalle = lista.filter((g) => {
        const clave = `${g.minuto}|${g.jugador ?? ""}|${g.propio ? 1 : 0}`;

        if (vistos.has(clave)) return false;

        vistos.add(clave);

        return true;
      });

      if (detalle.length > total) detalle = [];

      const ladoFicha = p.enCasa ? "local" : "visitante";
      const otro = ladoFicha === "local" ? "visitante" : "local";
      const goles = detalle
        .map((g) => ({ ...leeMinuto(g.minuto), lado: g.propio ? ladoFicha : otro, tipo: g.tipo === "penalti" || g.tipo === "propia" ? g.tipo : "", jugador: g.jugador ?? "", asistente: g.asistente || undefined }))
        .map((g, i) => ({ g, i }))
        .sort((a, b) => a.g.parte - b.g.parte || a.g.min - b.g.min || a.g.extra - b.g.extra || a.i - b.i)
        .map(({ g }) => g);

      porId.set(p.id, {
        id: String(p.id),
        jornada,
        fecha: String(p.fecha).slice(0, 10),
        local: p.local.nombre,
        visitante: p.visitante.nombre,
        escudoLocal: p.local.escudo,
        escudoVisitante: p.visitante.escudo,
        gl: p.local.goles,
        gv: p.visitante.goles,
        goles,
        ...(goles.length < total ? { golesIncompletos: true } : {}),
      });
    }
  }

  const partidos = [...porId.values()].sort((a, b) => a.jornada - b.jornada || a.fecha.localeCompare(b.fecha));

  console.log(`BeSoccer: ${partidos.length} partidos de liga con sus goles (hasta la jornada ${partidos.at(-1)?.jornada ?? "?"}).`);

  /* ---------------- 2. Wyscout ---------------- */
  const indice = path.join(RAIZ, "public", "data", "analisis.json");
  let conWys = 0;

  if (fs.existsSync(indice)) {
    const filas = JSON.parse(fs.readFileSync(indice, "utf8")).partidos.filter((f) => f.fecha >= "2026-07-01" && /Primera Division RFEF/i.test(f.competicion));

    for (const f of filas) {
      const d = f.datos ?? {};
      const p = partidos.find((x) => Math.abs(Date.parse(x.fecha) - Date.parse(f.fecha)) <= 2 * 86_400_000 && (mismoEquipo(x.local, f.equipo) || mismoEquipo(x.visitante, f.equipo)) && (mismoEquipo(x.local, f.rival) || mismoEquipo(x.visitante, f.rival)));

      if (!p) continue;

      const lado = mismoEquipo(p.local, f.equipo) ? "local" : "visitante";
      const otro = lado === "local" ? "visitante" : "local";
      const n = (k) => (Number.isFinite(Number(d[k])) ? Number(d[k]) : 0);

      p.wys ??= {};
      p.wys[lado] = {
        goles: n("Goles"),
        tiros: n("Tiros"),
        aPuerta: n("Tiros · a la portería"),
        xg: n("xG"),
        fuera: n("Tiros de fuera del área"),
        posicional: n("Ataques posicionales · con remate"),
        contra: n("Contraataques · con remate"),
        abp: n("Jugadas a balón parado · con remate"),
      };

      /* El fichero de un equipo trae también lo del rival «en contra»: rellena el otro lado si falta. */
      if (!p.wys[otro] && d["Tiros en contra"] !== undefined) {
        p.wys[otro] = { goles: n("Goles recibidos"), tiros: n("Tiros en contra"), aPuerta: n("Tiros en contra · a la portería"), xg: n("xG en contra"), fuera: 0, posicional: 0, contra: 0, abp: 0, soloEnContra: true };
      }
    }

    for (const p of partidos) {
      for (const lado of ["local", "visitante"]) if (p.wys?.[lado]?.soloEnContra) delete p.wys[lado].soloEnContra;

      if (p.wys?.local && p.wys?.visitante) conWys += 1;
    }
  }

  console.log(`Wyscout: remates de ${conWys} de ${partidos.length} partidos.`);

  /* ---------------- 3. Hudl ---------------- */
  const nuestros = partidos.filter((p) => mismoEquipo(p.local, CASTILLA) || mismoEquipo(p.visitante, CASTILLA));

  if (BAJAR_HUDL) bajaTimelinesQueFaltan(nuestros);

  const timelines = buscaTimelines();
  const tacticas = leeTacticas();
  const tipologia = {};
  const remates = {};
  const sinTimeline = [];

  for (const p of nuestros) {
    const ladoNuestro = mismoEquipo(p.local, CASTILLA) ? "local" : "visitante";
    const rival = ladoNuestro === "local" ? p.visitante : p.local;
    const golesNuestros = p.goles.filter((g) => g.lado === ladoNuestro).length;
    const golesSuyos = p.goles.length - golesNuestros;
    const t = timelines.find((x) => !x.usado && (x.fecha ? Math.abs(Date.parse(x.fecha) - Date.parse(p.fecha)) <= 2 * 86_400_000 : mismoEquipo(x.T.rivalHudl, rival) && x.goles.nuestro.length === golesNuestros && x.goles.rival.length === golesSuyos));

    /* La grabación táctica: el texto de cada gol, por orden y por lado. */
    const tactica = tacticas.find((x) => Math.abs(Date.parse(x.fecha) - Date.parse(p.fecha)) <= 2 * 86_400_000);
    const textos = { nuestro: (tactica?.goles ?? []).filter((g) => g.de === "castilla"), rival: (tactica?.goles ?? []).filter((g) => g.de !== "castilla") };
    const cuenta = { nuestro: 0, rival: 0 };

    /* Un 0-0 sin timeline no deja nada por clasificar: no se lista. */
    if (!t && p.goles.length) sinTimeline.push(`J${p.jornada} ${p.local} - ${p.visitante}`);
    if (t) t.usado = true;

    const usadosHudl = new Set();

    p.goles.forEach((g, i) => {
      const lado = g.lado === ladoNuestro ? "nuestro" : "rival";
      const n = cuenta[lado]++;
      const texto = textos[lado][n]?.texto;
      let tipo = null;
      let motivo = t ? "No se encuentra el gol en el timeline de Hudl." : "El partido no tiene timeline de Hudl.";

      if (g.tipo === "penalti") {
        tipo = "penalti";
        motivo = "Penalti (BeSoccer).";
      } else if (g.tipo === "propia") {
        tipo = "error";
        motivo = "En propia puerta (BeSoccer).";
      }

      if (t) {
        /* El gol de Hudl de ese lado más cercano en el minuto (y que no esté ya cogido). */
        const candidatos = t.goles[lado].filter((m) => !usadosHudl.has(m)).map((m) => ({ m, d: Math.abs(minutoAbsoluto(t.T, m.endTimeMs) - (g.min + g.extra)) }));
        const mejor = candidatos.sort((a, b) => a.d - b.d)[0];

        if (mejor && mejor.d <= 8) {
          usadosHudl.add(mejor.m);

          const c = clasifica(t.T, mejor.m, lado);

          if (!tipo || tipo === "penalti") {
            tipo = c.tipo ?? tipo;
            motivo = c.motivo;
          }
        }
      }

      tipologia[`${p.id}:${i}`] = { tipo, motivo, ...(texto ? { texto } : {}) };
    });

    if (t) remates[p.id] = rematesDe(t.T);
  }

  const doc = {
    actualizado: new Date().toISOString(),
    temporada: informe.temporada ?? "",
    partidos,
    tipologia,
    remates,
    sinTimeline,
  };

  const clasificados = Object.values(tipologia).filter((x) => x.tipo).length;

  console.log(`Hudl: timeline de ${Object.keys(remates).length} de ${nuestros.length} partidos nuestros; ${clasificados} de ${Object.keys(tipologia).length} goles clasificados.`);

  for (const p of nuestros) {
    p.goles.forEach((g, i) => {
      const x = tipologia[`${p.id}:${i}`];

      console.log(`  J${p.jornada} ${g.min}${g.extra ? `+${g.extra}` : ""}' ${g.jugador.padEnd(22)} ${String(x.tipo ?? "—").padEnd(15)} ${x.motivo}`);
    });
  }

  if (SOLO_VER) {
    console.log("RESUMEN: en seco, no se sube nada.");

    return;
  }

  const ahora = new Date().toISOString();
  const { error: e2 } = await supabase.from("app_documents").upsert({ key: DOC_GOLES, kind: "goles", data: doc, updated_at: ahora }, { onConflict: "key" });

  if (e2) throw new Error(`no se guarda en Supabase (${e2.message})`);

  console.log(`RESUMEN: ${partidos.length} partidos y ${partidos.reduce((s, p) => s + p.goles.length, 0)} goles de la liga; tipología de ${clasificados} goles de nuestros partidos.`);
}

/* ------------------------------------------------------------------ */
/*  Hudl                                                               */
/* ------------------------------------------------------------------ */

const etiqueta = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
const codigo = (m) => etiqueta(m, "HUDL_CODE")[0] || "";
const valor = (m, sufijo) => {
  const t = m.tags.find((x) => x.key.replace(/^\d+ - /, "") === sufijo);

  return t ? t.values.join("/") : "";
};

/** El minuto de juego seguido (45+2 → 47 en la primera parte, 90+3 → 93). */
function minutoAbsoluto(T, ms) {
  return T.minuto(ms);
}

function partirMinuto(T, ms) {
  const parte = T.tiempo(ms);
  const m = T.minuto(ms);
  const tope = parte === 1 ? 45 : 90;

  return m > tope ? { min: tope, extra: m - tope, parte } : { min: m, extra: 0, parte };
}

function buscaTimelines() {
  const salida = [];
  const vistos = new Set();

  const mira = (carpeta, hondo) => {
    if (!fs.existsSync(carpeta)) return;

    const fichero = path.join(carpeta, "timeline-hudl.json");

    if (fs.existsSync(fichero)) {
      const tam = fs.statSync(fichero).size;

      try {
        const T = leeTimeline(carpeta);
        const goles = T.codigosEquipo.Goals ?? { nuestro: [], rival: [] };
        const fecha = fechaDeCarpeta(carpeta);
        const firma = `${T.rivalHudl}|${goles.nuestro.length}|${goles.rival.length}|${tam}`;

        /* La misma copia en dos carpetas (la del análisis y la de transiciones) cuenta una vez. */
        if (T.rivalHudl && !vistos.has(firma)) {
          vistos.add(firma);
          salida.push({ carpeta, T, goles, fecha, usado: false });
        }
      } catch {
        /* Un timeline vacío o roto: como si no estuviera. */
      }
    }

    if (hondo > 0) for (const d of fs.readdirSync(carpeta, { withFileTypes: true })) if (d.isDirectory()) mira(path.join(carpeta, d.name), hondo - 1);
  };

  for (const c of CARPETAS_TIMELINE) mira(c, 2);

  return salida;
}

/** La fecha del partido de una carpeta: del vídeo de Hudl, del partido.json o del nombre. */
function fechaDeCarpeta(carpeta) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(carpeta, "video-hudl.json"), "utf8"));
    const f = String(v.titulo ?? v.title ?? v.nombre ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0];

    if (f) return f;
  } catch {
    /* sigue */
  }

  try {
    const p = JSON.parse(fs.readFileSync(path.join(carpeta, "partido.json"), "utf8"));

    if (/^\d{4}-\d{2}-\d{2}/.test(p.fecha ?? "")) return p.fecha.slice(0, 10);
  } catch {
    /* sigue */
  }

  return path.basename(carpeta).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function leeTacticas() {
  if (!fs.existsSync(CARPETA_TACTICA)) return [];

  return fs
    .readdirSync(CARPETA_TACTICA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(CARPETA_TACTICA, d.name, "partido.json"), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((p) => p?.fecha && Array.isArray(p.goles));
}

/** Los remates de los dos equipos, con su minuto, de las acciones por jugador. */
function rematesDe(T) {
  return T.acciones
    .filter((a) => a.tipos.includes("Shot") || a.tipos.includes("Penalty"))
    .map((a) => {
      const resultado = valor(a.m, "Shot - Outcome");

      return { ...partirMinuto(T, a.t), nuestro: T.esNuestro(a.jug), aPuerta: /Goal|save/i.test(resultado), gol: /^Goal$/.test(resultado) || a.tipos.includes("Goal") };
    });
}

/**
 * De dónde viene un gol, con lo etiquetado en Hudl. `g` es el momento
 * «<Equipo> - Goals» (la posesión entera que acaba en gol). Por orden:
 *
 *   1. ABP: penalti, córner, saque de banda o falta (directa si el remate es
 *      el lanzamiento de la falta; si no, lateral), cuando la jugada a balón
 *      parado de ese equipo acaba en gol.
 *   2. Caída / 2ª acción: hubo otro remate del mismo equipo justo antes (el
 *      rechace de un penalti parado, de un remate al palo o al portero).
 *   3. Tras error: la posesión empieza en el último tercio y justo antes el
 *      rival la perdió en su tercio (una salida mal dada, un pase atrás).
 *   4. Transición: contraataque etiquetado, o posesión corta (≤ 12 s) que
 *      nace de un robo fuera del último tercio. Campo propio si empieza en su
 *      tercio o en el del medio; campo contrario si empieza en el último.
 *   5. Ataque organizado: por el pase de gol. Centro o pase desde la banda →
 *      banda D o I (vista del que ataca); pase al espacio o en largo → espalda;
 *      y si no, dentro.
 */
function clasifica(T, g, lado) {
  const prefijo = codigo(g).replace(/ - Goals$/, "");
  const fin = g.endTimeMs;
  const solapan = T.momentosEq.filter((m) => m !== g && codigo(m).startsWith(`${prefijo} - `) && m.startTimeMs <= fin && m.endTimeMs >= fin - 3000);
  const deGol = (m) => etiqueta(m, "07 - Outcome").includes("Goal");
  const hay = (cosa, soloGol = true) => solapan.some((m) => codigo(m) === `${prefijo} - ${cosa}` && (!soloGol || deGol(m)));
  const esNuestro = lado === "nuestro";
  const delEquipo = (a) => T.esNuestro(a.jug) === esNuestro;
  const cerca = T.acciones.filter((a) => a.t >= fin - 40_000 && a.t <= fin + 3000);
  const remates = cerca.filter((a) => delEquipo(a) && (a.tipos.includes("Shot") || a.tipos.includes("Penalty")));
  const remate = remates.find((a) => a.tipos.includes("Goal") || a.tipos.includes("Penalty goal")) ?? remates.at(-1);
  const tiposRemate = remate?.tipos ?? [];
  const inicio = valor(g, "Location third");
  const duracion = Number(valor(g, "Duration")) || 0;

  if (tiposRemate.includes("Penalty")) return { tipo: "penalti", motivo: "Penalti." };
  if (hay("Corners") || tiposRemate.includes("Shot after corner")) return { tipo: "corner", motivo: "Córner." };
  if (hay("Throw ins") || tiposRemate.includes("Shot after throw in")) return { tipo: "banda", motivo: "Saque de banda." };

  if (hay("Free kicks") || tiposRemate.some((t) => /free kick/i.test(t))) {
    return tiposRemate.includes("Free kick shot") ? { tipo: "faltaDirecta", motivo: "Falta directa a puerta." } : { tipo: "faltaLateral", motivo: "Falta botada al área." };
  }

  if (hay("Set Pieces")) return { tipo: "faltaLateral", motivo: "Jugada a balón parado." };

  const otrosRemates = remates.filter((a) => a !== remate && a.t >= fin - 30_000);

  if (otrosRemates.length) {
    const previo = otrosRemates.at(-1);
    const fue = /Penalty/.test(previo.tipos.join()) ? "un penalti parado" : `un remate de ${previo.jug.replace(/^\d+\.\s*/, "")}`;

    return { tipo: "caida", motivo: `Rechace: segunda acción tras ${fue}.` };
  }

  const perdidaRival = cerca.find((a) => !delEquipo(a) && a.tipos.includes("Loss") && valor(a.m, "Location - Third") === "Own third" && a.t >= fin - 25_000);

  if (inicio === "Final third" && perdidaRival) return { tipo: "error", motivo: `Pérdida de ${perdidaRival.jug.replace(/^\d+\.\s*/, "")} en su propio tercio.` };

  const robo = T.acciones.find((a) => delEquipo(a) && a.t >= g.startTimeMs - 2000 && a.t <= g.startTimeMs + 4000 && (a.tipos.includes("Recovery") || a.tipos.includes("Interception")));
  const transicion = hay("Counterattacks", false) || (duracion > 0 && duracion <= 12 && inicio !== "Final third" && robo);

  if (transicion) {
    const propio = inicio !== "Final third";

    return { tipo: propio ? "transPropio" : "transContrario", motivo: `Transición tras robo en el tercio ${inicio === "Own third" ? "propio" : inicio === "Middle third" ? "medio" : "final"} y gol a los ${duracion} s.` };
  }

  if (inicio === "Final third" && duracion <= 8 && robo) return { tipo: "transContrario", motivo: `Robo en el último tercio y gol a los ${duracion} s.` };

  const pase = cerca.filter((a) => delEquipo(a) && a.tipos.includes("Assist")).at(-1);

  if (pase) {
    const flanco = valor(pase.m, "Location - Flank");
    const de = pase.jug.replace(/^\d+\.\s*/, "");
    const banda = flanco === "Right flank" ? "bandaD" : flanco === "Left flank" ? "bandaI" : null;

    if (pase.tipos.includes("Cross") && banda) return { tipo: banda, motivo: `Centro de ${de} desde la ${banda === "bandaD" ? "derecha" : "izquierda"}.` };
    if (pase.tipos.includes("Through pass") || (pase.tipos.includes("Long pass") && pase.tipos.includes("Forward pass"))) return { tipo: "espalda", motivo: `Pase a la espalda de ${de}.` };
    if (banda && valor(pase.m, "Location - Third") === "Final third") return { tipo: banda, motivo: `Pase de ${de} desde la ${banda === "bandaD" ? "derecha" : "izquierda"}.` };

    return { tipo: "dentro", motivo: `Pase de ${de} por dentro.` };
  }

  return { tipo: "dentro", motivo: "Jugada individual, sin pase de gol." };
}

/** Los timelines de nuestros partidos de las dos últimas semanas que no estén ya bajados. */
function bajaTimelinesQueFaltan(nuestros) {
  const hay = buscaTimelines();
  const hoy = Date.now();

  for (const p of nuestros) {
    const edad = (hoy - Date.parse(p.fecha)) / 86_400_000;

    if (edad < 1 || edad > 14) continue;
    if (hay.some((t) => t.fecha && Math.abs(Date.parse(t.fecha) - Date.parse(p.fecha)) <= 2 * 86_400_000)) continue;

    const salida = path.join(CASA, "PARTIDOS", "ANALISIS", `HUDL ${p.fecha}`);

    console.log(`Hudl: bajando el timeline del ${p.fecha} (${p.local} - ${p.visitante})…`);

    const r = spawnSync(process.execPath, [path.join(RAIZ, "scripts", "hudl-partido.mjs"), "--fecha", p.fecha, "--salida", salida], { encoding: "utf8", timeout: 6 * 60_000 });
    const linea = String(r.stdout ?? "").split("\n").filter((l) => l.startsWith("RESUMEN")).at(-1);

    console.log(`  ${linea ?? `terminó con ${r.status}`}`);

    /* Una carpeta sin timeline (aún sin etiquetar) no se queda: confundiría la búsqueda. */
    if (r.status !== 0 && fs.existsSync(path.join(salida, "timeline-hudl.json"))) {
      try {
        fs.renameSync(path.join(salida, "timeline-hudl.json"), path.join(salida, "timeline-hudl.vacio.json"));
      } catch {
        /* nada */
      }
    }
  }
}

const env = entorno();

if (!env) {
  console.log("RESUMEN: faltan las llaves de Supabase en .env.local");
  salir(1);
} else {
  try {
    await principal();
  } catch (e) {
    console.log(`RESUMEN: ha fallado (${e?.message ?? e})`);
    salir(1);
  }
}
