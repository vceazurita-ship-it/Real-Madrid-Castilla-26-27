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
/* La carpeta de los partidos está dos niveles por encima del repo; desde una copia de trabajo (`.claude/worktrees/x`), cinco. */
const CASA = [path.join(RAIZ, "..", ".."), path.join(RAIZ, "..", "..", "..", "..", "..")].find((c) => fs.existsSync(path.join(c, "PARTIDOS"))) ?? path.join(RAIZ, "..", "..");
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

      /* `jugado` de BeSoccer no basta: una ficha sin marcador en su página pero con fecha pasada y goles
         numéricos (la J6, 3-2 al Atlético Madrileño) es un partido jugado y debe contar. */
      const hayMarcador = Number.isFinite(p.local?.goles) && Number.isFinite(p.visitante?.goles);
      const fechaPasada = Boolean(p.fecha) && Date.parse(String(p.fecha)) < Date.now();

      if (!(p.jugado || (hayMarcador && fechaPasada)) || !jornada) continue;

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
  const tecnico = {};
  const remates = {};
  const sinTimeline = [];

  /* Los cortes de vídeo de cada jornada (`informe-clips:jNN`), sólo para leer el del gol. */
  const { data: filasClips } = await supabase.from("app_documents").select("key,data").like("key", "informe-clips:%");
  const cortesDe = new Map((filasClips ?? []).map((f) => [Number(String(f.key).match(/j(\d+)$/)?.[1]), f.data?.cortes ?? []]));

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

          const ficha = fichaTecnica(t.T, mejor.m, lado, tipo, g.tipo === "propia");
          const video = videoDelGol(cortesDe.get(p.jornada), lado, g);

          if (video) ficha.video = video;
          if (Object.keys(ficha).length) tecnico[`${p.id}:${i}`] = ficha;
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
    tecnico,
    remates,
    sinTimeline,
  };

  /*
  | Control (24/10/2026): los partidos y los goles de cada equipo tienen que casar con la
  | clasificación de BeSoccer. Si no casan (un partido sin marcador en su ficha, como la
  | J6 del Castilla), se dice en el registro y el documento lleva `descuadre`: la pantalla
  | no compara con la media un total al que le falta un partido.
  */
  const tablaLiga = Object.values(informe.porId).find((e) => e?.clasificacion?.total?.length)?.clasificacion.total ?? [];
  const descuadre = [];

  for (const fila of tablaLiga) {
    const suyos = partidos.filter((p) => mismoEquipo(p.local, fila.equipo) || mismoEquipo(p.visitante, fila.equipo));
    const favor = suyos.reduce((s, p) => s + (mismoEquipo(p.local, fila.equipo) ? p.gl : p.gv), 0);
    const contra = suyos.reduce((s, p) => s + (mismoEquipo(p.local, fila.equipo) ? p.gv : p.gl), 0);

    if (suyos.length !== fila.jugados || favor !== fila.favor || contra !== fila.contra) {
      descuadre.push({ equipo: fila.equipo, partidos: suyos.length, favor, contra, claPartidos: fila.jugados, claFavor: fila.favor, claContra: fila.contra });
    }
  }

  if (descuadre.length) {
    doc.descuadre = descuadre;

    for (const d of descuadre) {
      console.log(`AVISO: ${d.equipo} no casa con la clasificación: ${d.partidos} partidos y ${d.favor}-${d.contra} goles frente a ${d.claPartidos} y ${d.claFavor}-${d.claContra}.`);
    }
  }

  const clasificados = Object.values(tipologia).filter((x) => x.tipo).length;

  console.log(`Hudl: timeline de ${Object.keys(remates).length} de ${nuestros.length} partidos nuestros; ${clasificados} de ${Object.keys(tipologia).length} goles clasificados.`);

  for (const p of nuestros) {
    p.goles.forEach((g, i) => {
      const x = tipologia[`${p.id}:${i}`];

      console.log(`  J${p.jornada} ${g.min}${g.extra ? `+${g.extra}` : ""}' ${g.jugador.padEnd(22)} ${String(x.tipo ?? "—").padEnd(15)} ${x.motivo}`);

      const f = tecnico[`${p.id}:${i}`];

      if (f) {
        const zona = f.zonaOrigen ? `${f.zonaOrigen.tercio}/${f.zonaOrigen.carril}` : "";
        const quienes = (f.implicados ?? []).map((m) => `${m.jugador} (${m.accion})`).join(", ");

        console.log(`      ficha: ${[f.fase, f.origen, f.campo, f.accion, zona && `zona ${zona}`, f.carril !== undefined && `carril ${f.carril}`, f.segundos !== undefined && `${f.segundos} s`, f.pases !== undefined && `${f.pases} pases`, f.video ? "vídeo" : ""].filter(Boolean).join(" · ")}`);
        console.log(`             ${f.motivo ?? ""}${quienes ? ` | ${quienes}` : ""}`);
      }
    });
  }

  console.log(`Ficha técnica: ${Object.keys(tecnico).length} goles con ficha, ${Object.values(tecnico).filter((f) => f.video).length} con su corte de vídeo.`);

  if (SOLO_VER) {
    console.log("RESUMEN: en seco, no se sube nada.");

    return;
  }

  const ahora = new Date().toISOString();
  const { error: e2 } = await supabase.from("app_documents").upsert({ key: DOC_GOLES, kind: "goles", data: doc, updated_at: ahora }, { onConflict: "key" });

  if (e2) throw new Error(`no se guarda en Supabase (${e2.message})`);

  console.log(`RESUMEN: ${partidos.length} partidos y ${partidos.reduce((s, p) => s + p.goles.length, 0)} goles de la liga; tipología de ${clasificados} goles de nuestros partidos.${descuadre.length ? ` OJO: ${descuadre.length} ${descuadre.length === 1 ? "equipo no casa" : "equipos no casan"} con la clasificación (${descuadre.map((d) => d.equipo).join(", ")}).` : ""}`);
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

/* ------------------------------------------------------------------ */
/*  La ficha técnica de cada gol, desde el Castilla (lib/goles/tecnico.ts) */
/* ------------------------------------------------------------------ */

/*
| Lo medido en los timelines de J06-J10 (03/11/2026) y en lo que se apoya esto:
|
|   - Zonas. «Location - Third/Flank» de una acción va en la referencia del
|     equipo del jugador: nuestro lateral derecho sale en «Right flank» y en su
|     duelo el extremo izquierdo de ellos sale en «Left flank / Own third»
|     cuando nosotros estamos en «Final third». Lo mismo con el «Location
|     third/flank» de las posesiones. Así que lo del rival se gira: tercio y
|     carril (2 − x).
|   - Tiempos. Las acciones normales empiezan ~2 s antes del toque y duran 4-10
|     s, y su orden es bueno. Los remates (y la propia puerta) son ventanas de
|     20 s (14 s si no son gol) que empiezan ~15 s (~5 s) antes del remate: por
|     eso se colocan con `instante` y el gol va siempre al final de la jugada.
|   - El gol: el momento «<Equipo> - Goals» es la última posesión, y su
|     «Duration» (en segundos) llega hasta el remate; el final del momento son
|     ~3 s más.
|   - Campo (mitad). Hudl sólo da tercios: el propio y el último dicen la mitad;
|     el del medio no (ni hay coordenadas). Sólo se pone `campo` cuando el tercio
|     lo dice o es un córner o un penalti.
*/

const TERCIO = { "Own third": 0, "Middle third": 1, "Final third": 2 };
const CARRIL = { "Left flank": 0, Center: 1, "Right flank": 2 };
const ABP = new Set(["penalti", "corner", "banda", "faltaDirecta", "faltaLateral"]);
const sinDorsal = (j) => String(j).replace(/^\d+\.\s*/, "");
const tiene = (a, ...tipos) => tipos.some((x) => a.tipos.includes(x));

/** Una celda en la referencia del Castilla; lo del rival se gira. */
function celda(tercio, flanco, delRival) {
  const t = TERCIO[tercio];
  const c = CARRIL[flanco];

  if (t === undefined || c === undefined) return undefined;

  return delRival ? { tercio: 2 - t, carril: 2 - c } : { tercio: t, carril: c };
}

const celdaAccion = (T, a) => celda(valor(a.m, "Location - Third"), valor(a.m, "Location - Flank"), !T.esNuestro(a.jug));
const celdaMomento = (m, delRival) => celda(valor(m, "Location third"), valor(m, "Location flank"), delRival);

/** Cuándo pasa de verdad una acción: los remates traen la ventana adelantada. */
function instante(a) {
  if (!tiene(a, "Shot", "Penalty", "Own goal")) return a.t;

  return a.m.endTimeMs - a.t >= 18_000 ? a.t + 15_000 : a.t + 5_000;
}

const esGol = (a) => tiene(a, "Goal", "Penalty goal") || valor(a.m, "Shot - Outcome") === "Goal";

/** Lo que hizo un jugador nuestro, en español. `null` si no cuenta para la jugada. */
function accionNuestra(a, aFavor) {
  const duelo = valor(a.m, "Ground duel - Duel type");

  if (tiene(a, "Own goal")) return "En propia puerta";

  if (tiene(a, "Shot", "Penalty")) {
    if (!esGol(a)) return aFavor ? "Primer remate" : null;

    return tiene(a, "Penalty") ? "Marca de penalti" : tiene(a, "Head shot") ? "Remata de cabeza" : "Remata";
  }

  if (tiene(a, "Penalty save")) return "Para el penalti";
  if (tiene(a, "Shot against")) return tiene(a, "Save") ? "Parada" : null;
  if (tiene(a, "Corner")) return "Saca el córner";
  if (tiene(a, "Free kick")) return "Saca la falta";
  if (tiene(a, "Throw in")) return "Saca de banda";
  if (tiene(a, "Assist")) return tiene(a, "Cross") ? "Centro de gol" : "Asiste";
  if (tiene(a, "Shot block")) return tiene(a, "Loss") ? "Bloquea y pierde el balón" : "Bloquea el remate";
  if (tiene(a, "Loss") && tiene(a, "Clearance", "Head pass")) return "Despeje fallido";
  if (tiene(a, "Loss")) return "Pierde el balón";
  if (tiene(a, "Clearance")) return "Despeje";
  if (tiene(a, "Second assist", "Key pass")) return "Pase clave";
  if (tiene(a, "Cross")) return "Centro";
  if (tiene(a, "Recovery", "Interception", "Counterpressing recovery")) return "Recupera";
  if (tiene(a, "Through pass", "Smart pass")) return "Pase al espacio";
  if (tiene(a, "Pass")) return "Pase";
  if (duelo === "Dribble" && valor(a.m, "Ground duel - In attack - Progress") === "Progressed with ball") return "Regate";
  if (duelo === "Dribbled past" || tiene(a, "Dribbled past attempt")) return "Le regatean";
  if (tiene(a, "Defensive duel") && valor(a.m, "Ground duel - In defense - Progress") === "Allowed progress") return "Duelo perdido";
  if (tiene(a, "Aerial duel") && valor(a.m, "Aerial duel - Outcome") === "Lost") return "Duelo aéreo perdido";
  if (tiene(a, "Foul")) return "Comete la falta";
  if (tiene(a, "Carry", "Progressive run")) return "Conduce";

  return null;
}

/* En un gol en contra sólo cuenta lo defensivo (y la pérdida que lo origina). */
const DEFENSIVAS = new Set(["En propia puerta", "Para el penalti", "Parada", "Bloquea el remate", "Bloquea y pierde el balón", "Despeje fallido", "Pierde el balón", "Recupera", "Despeje", "Le regatean", "Duelo perdido", "Duelo aéreo perdido", "Comete la falta"]);

const TXT_TERCIO = ["nuestro tercio", "zona media", "su tercio"];
const TXT_CARRIL = ["la izquierda", "el centro", "la derecha"];

/**
 * La ficha técnica de un gol (`FichaAuto`), desde el Castilla. `g` es el
 * momento «<Equipo> - Goals» de Hudl, `tipo` la tipología ya decidida (manda
 * en la fase, para que las dos lecturas no se contradigan) y `propia`, si
 * BeSoccer lo da en propia puerta. Lo que no se sabe no se pone.
 */
function fichaTecnica(T, g, lado, tipo, propia) {
  const aFavor = lado === "nuestro";
  const delQueMarca = (a) => T.esNuestro(a.jug) === aFavor;
  const prefijo = codigo(g).replace(/ - Goals$/, "");
  const duracion = Number(valor(g, "Duration"));
  const golT = Math.min(g.endTimeMs, Number.isFinite(duracion) && valor(g, "Duration") !== "" ? g.startTimeMs + duracion * 1000 : g.endTimeMs - 3000);
  const largo = (Number.isFinite(duracion) && duracion >= 15) || /10-14|15 or more/.test(valor(g, "Number of team events"));
  const inicio = valor(g, "Location third");
  const cerca = T.acciones.filter((a) => instante(a) >= g.startTimeMs - 25_000 && instante(a) <= g.endTimeMs + 2000);

  /* El remate del gol: el del equipo que marca más cercano al gol (o la propia puerta). */
  const remate = cerca
    .filter((a) => (delQueMarca(a) && tiene(a, "Shot", "Penalty") && esGol(a)) || tiene(a, "Own goal"))
    .sort((a, b) => Math.abs(instante(a) - golT) - Math.abs(instante(b) - golT))[0];

  /* Las posesiones de antes: ¿hubo un despeje corto del que defiende entre dos del que marca? */
  const posesiones = T.momentosEq.filter((m) => / - Possessions$/.test(codigo(m)) && m.endTimeMs <= g.startTimeMs + 100 && m.startTimeMs < g.startTimeMs).sort((a, b) => b.endTimeMs - a.endTimeMs);
  const [p1, p2] = posesiones;
  const delMarcador = (m) => codigo(m).startsWith(`${prefijo} - `);
  const rechaceCorto = p1 && p2 && !delMarcador(p1) && delMarcador(p2) && g.startTimeMs - p1.endTimeMs <= 1000 && p1.endTimeMs - p1.startTimeMs <= 4500 && p1.startTimeMs - p2.endTimeMs <= 1000 && valor(p1, "Location third") === "Own third";

  /* ¿La segunda jugada viene de un balón parado del que marca? */
  const deAbp = T.momentosEq.some((m) => /- (Set Pieces|Corners|Free kicks)$/.test(codigo(m)) && delMarcador(m) && m.endTimeMs >= g.startTimeMs - 15_000 && m.endTimeMs <= g.endTimeMs && m.endTimeMs - m.startTimeMs <= 15_000);

  const ficha = {};
  let origenT = g.startTimeMs;
  let clave = null; // la acción nuestra (o suya) que abre la jugada
  let zona;

  /* ---------------- origen y zona ---------------- */
  if (ABP.has(tipo) && !propia) {
    ficha.origen = "abp";

    const saque = T.momentosEq.filter((m) => delMarcador(m) && /- (Corners|Free kicks|Throw ins|Set Pieces)$/.test(codigo(m)) && m.startTimeMs <= g.endTimeMs && m.endTimeMs >= g.startTimeMs - 3000).sort((a, b) => a.startTimeMs - b.startTimeMs)[0];

    if (tipo === "penalti") zona = { tercio: aFavor ? 2 : 0, carril: 1 };
    else if (saque) zona = celdaMomento(saque, !aFavor);
    if (saque) origenT = saque.startTimeMs;
  } else if (aFavor) {
    const robo = T.acciones.find((a) => T.esNuestro(a.jug) && a.t >= g.startTimeMs - 5000 && a.t <= g.startTimeMs + 3000 && tiene(a, "Recovery", "Interception", "Counterpressing recovery"));
    const perdidaSuya = T.acciones.filter((a) => !T.esNuestro(a.jug) && tiene(a, "Loss") && a.t >= g.startTimeMs - 6000 && a.t <= g.startTimeMs + 1500).at(-1);

    if (tipo === "caida") {
      ficha.origen = "segundaJugada";
      zona = celdaMomento(g, false);
    } else if (tipo === "error") {
      ficha.origen = "errorRival";
      clave = perdidaSuya;
      zona = perdidaSuya ? celdaAccion(T, perdidaSuya) : celdaMomento(g, false);
      if (perdidaSuya) origenT = perdidaSuya.t;
    } else if (robo && !(Number.isFinite(duracion) && duracion > 20)) {
      zona = celdaAccion(T, robo);
      ficha.origen = ["roboBajo", "roboMedio", "roboAlto"][zona?.tercio ?? 1];
      clave = robo;
      origenT = robo.t;
    } else if (rechaceCorto && !robo) {
      ficha.origen = "segundaJugada";
      zona = celdaMomento(g, false);
    } else if (inicio === "Own third") {
      ficha.origen = "construccion";
      zona = celdaMomento(g, false);
    } else if (largo) {
      ficha.origen = "posesionLarga";
      zona = celdaMomento(g, false);
    } else if (perdidaSuya) {
      /* Sin robo nuestro etiquetado, el balón lo gana su pérdida: un robo en esa zona (o su error si es en su salida). */
      zona = celdaAccion(T, perdidaSuya);
      ficha.origen = zona?.tercio === 2 && !tiene(perdidaSuya, "Duel") ? "errorRival" : ["roboBajo", "roboMedio", "roboAlto"][zona?.tercio ?? 1];
      clave = perdidaSuya;
      origenT = perdidaSuya.t;
    }
  } else {
    const perdida = T.acciones.filter((a) => T.esNuestro(a.jug) && tiene(a, "Loss") && a.t >= g.startTimeMs - 7000 && a.t <= g.startTimeMs + 1500).at(-1);
    const despeje = rechaceCorto ? T.acciones.filter((a) => T.esNuestro(a.jug) && a.t >= p1.startTimeMs - 3500 && a.t <= g.startTimeMs + 500 && tiene(a, "Loss", "Clearance", "Shot block")).at(-1) : null;

    if (propia) {
      ficha.origen = "errorPropio";
      clave = perdida ?? null;
      zona = perdida ? celdaAccion(T, perdida) : undefined;
      if (perdida) origenT = perdida.t;
    } else if (tipo === "caida" || rechaceCorto) {
      ficha.origen = "segundaJugada";
      const ultimo = despeje ?? T.acciones.filter((a) => T.esNuestro(a.jug) && a.t >= g.startTimeMs - 5000 && a.t <= g.startTimeMs + 1000 && tiene(a, "Loss", "Clearance", "Shot block", "Save")).at(-1);

      clave = ultimo ?? null;
      zona = ultimo ? celdaAccion(T, ultimo) : celdaMomento(g, true);
      if (ultimo) origenT = ultimo.t;
    } else if (perdida && !(Number.isFinite(duracion) && duracion > 20)) {
      zona = celdaAccion(T, perdida);
      clave = perdida;
      origenT = perdida.t;
      ficha.origen = zona?.tercio === 0 && golT - perdida.t <= 10_000 ? "errorPropio" : ["perdidaSalida", "perdidaMedio", "perdidaAlta"][zona?.tercio ?? 1];
    } else if (largo) {
      ficha.origen = "defensaPosicional";
      zona = celdaMomento(g, true);
    }
  }

  if (zona) ficha.zonaOrigen = zona;

  /* ---------------- fase (de la tipología) ---------------- */
  const conPerdidaArriba = T.acciones.some((a) => T.esNuestro(a.jug) !== aFavor && tiene(a, "Loss") && a.t >= golT - 20_000 && a.t <= golT && (celdaAccion(T, a)?.tercio ?? 0) !== (aFavor ? 2 : 0));

  if (ABP.has(tipo) && !propia) ficha.fase = aFavor ? "abpOfensiva" : "abpDefensiva";
  else if (tipo === "transPropio" || tipo === "transContrario" || (tipo === "error" && !propia)) ficha.fase = aFavor ? "transicionOfensiva" : "transicionDefensiva";
  else if (tipo === "caida" && deAbp) ficha.fase = aFavor ? "abpOfensiva" : "abpDefensiva";
  else if (tipo === "caida" || propia) ficha.fase = conPerdidaArriba ? (aFavor ? "transicionOfensiva" : "transicionDefensiva") : aFavor ? "ataqueOrganizado" : "defensaOrganizada";
  else if (tipo) ficha.fase = aFavor ? "ataqueOrganizado" : "defensaOrganizada";

  /* ---------------- campo (mitad) ---------------- */
  if (tipo === "corner" || tipo === "penalti") ficha.campo = aFavor ? "contrario" : "propio";
  else if (zona?.tercio === 0) ficha.campo = "propio";
  else if (zona?.tercio === 2) ficha.campo = "contrario";

  /* ---------------- la jugada: pases, carril, segundos ---------------- */
  const jugada = T.acciones.filter((a) => instante(a) >= origenT - 500 && instante(a) <= golT + 500 && a !== remate);
  const pases = jugada.filter((a) => delQueMarca(a) && tiene(a, "Pass") && instante(a) <= golT);
  const asistencia = jugada.filter((a) => delQueMarca(a) && tiene(a, "Assist")).at(-1);
  const centro = jugada.filter((a) => delQueMarca(a) && tiene(a, "Cross") && !tiene(a, "Loss")).at(-1);
  const conduccion = remate ? jugada.filter((a) => a.jug === remate.jug && tiene(a, "Carry", "Dribble") && valor(a.m, "Location - Third") === "Final third").at(-1) : null;
  /* Por dónde llega al área: el pase de gol o el centro si salen del último tercio; si no, la conducción del que remata. */
  const enUltimo = (a) => a && valor(a.m, "Location - Third") === "Final third";
  const llega = [asistencia, centro].find(enUltimo) ?? conduccion ?? asistencia ?? centro;

  if (tipo !== "penalti" && llega) {
    const c = celdaAccion(T, llega);

    if (c) ficha.carril = c.carril;
  }

  ficha.segundos = Math.max(0, Math.round((golT - origenT) / 1000));
  if (tipo !== "penalti") ficha.pases = pases.length;

  /* ---------------- tipo de acción ---------------- */
  const direccion = asistencia ? valor(asistencia.m, "Pass - Direction") : "";
  const flancoAsist = asistencia ? valor(asistencia.m, "Location - Flank") : "";

  if (propia || (remate && tiene(remate, "Own goal"))) ficha.accion = "propiaPuerta";
  else if (tipo === "penalti") ficha.accion = "penalti";
  else if (tipo === "corner") ficha.accion = "corner";
  else if (tipo === "faltaDirecta") ficha.accion = "faltaDirecta";
  else if (tipo === "faltaLateral") ficha.accion = "faltaLateral";
  else if (tipo === "banda") ficha.accion = "saqueBanda";
  else if (tipo === "caida") ficha.accion = "rechace";
  else if (remate && valor(remate.m, "Shot - Location") === "Outside penalty area") ficha.accion = "remateLejano";
  else if (ficha.origen === "segundaJugada" && pases.length <= 1) ficha.accion = "rechace";
  else if (asistencia && tiene(asistencia, "Through pass", "Smart pass")) ficha.accion = "paseEspalda";
  else if (asistencia && tiene(asistencia, "Long pass") && tiene(asistencia, "Forward pass")) ficha.accion = "paseEspalda";
  else if (asistencia && direccion === "Back" && flancoAsist !== "Center") ficha.accion = "paseAtras";
  else if (asistencia && tiene(asistencia, "Cross")) ficha.accion = "centroLateral";
  else if (asistencia) ficha.accion = "combinacion";
  else if (remate && jugada.some((a) => a.jug === remate.jug && valor(a.m, "Ground duel - Duel type") === "Dribble")) ficha.accion = "jugadaIndividual";

  /* ---------------- los nuestros ---------------- */
  const desde = origenT - 3500 - (ficha.origen === "abp" && !aFavor ? 15_000 : 0);
  const nuestras = T.acciones
    /* A favor, la jugada empieza en el robo (lo de antes es otra posesión); en contra se mira algo antes (la falta, el despeje). */
    .filter((a) => T.esNuestro(a.jug) && instante(a) >= (aFavor && a !== clave ? origenT - 500 : desde) && instante(a) <= golT + 1000)
    .map((a) => ({ a, cuando: a === remate ? Infinity : instante(a), accion: accionNuestra(a, aFavor) }))
    .filter((x) => x.accion && (aFavor || DEFENSIVAS.has(x.accion)))
    .filter((x) => x.accion !== "Comete la falta" || (ficha.origen === "abp" && !aFavor))
    .sort((x, y) => x.cuando - y.cuando);

  const implicados = [];

  for (const x of nuestras) {
    const jugador = sinDorsal(x.a.jug);
    const ultimo = implicados.at(-1);

    if (ultimo && ultimo.jugador === jugador && ultimo.accion === x.accion) continue;

    implicados.push({ jugador, accion: x.accion });
  }

  /* Una posesión larga: el arranque y lo último (lo que acaba en gol). */
  const recorte = implicados.length > 8 ? [implicados[0], ...implicados.slice(-7)] : implicados;

  if (recorte.length) ficha.implicados = recorte;

  /* ---------------- la frase ---------------- */
  const nombre = (a) => (a ? sinDorsal(a.jug) : "");
  const goleador = remate && T.esNuestro(remate.jug) && aFavor ? nombre(remate) : "";
  const tras = `${ficha.segundos !== undefined ? ` a los ${ficha.segundos} s` : ""}${ficha.pases ? ` con ${ficha.pases} ${ficha.pases === 1 ? "pase" : "pases"}` : ""}`;
  const enZona = zona ? `${TXT_TERCIO[zona.tercio]}${zona.carril !== 1 ? ` por ${TXT_CARRIL[zona.carril]}` : ""}` : "";
  const quienAsiste = asistencia && aFavor ? `, asistencia de ${nombre(asistencia)}` : "";
  const marca = goleador ? `; marca ${goleador}` : "";
  const NOMBRE_ABP = { penalti: "Penalti", corner: "Córner", banda: "Saque de banda", faltaDirecta: "Falta directa", faltaLateral: "Falta lateral" };
  let motivo = "";

  if (ficha.origen === "abp") {
    const saca = aFavor ? T.acciones.find((a) => T.esNuestro(a.jug) && tiene(a, "Corner", "Free kick", "Throw in") && a.t >= origenT - 3000 && a.t <= golT) : null;

    motivo = aFavor ? `${NOMBRE_ABP[tipo]}${saca ? ` sacado por ${nombre(saca)}` : ""}${marca}.` : `${NOMBRE_ABP[tipo]} en contra${enZona && tipo !== "penalti" ? ` desde ${enZona}` : ""}.`;
  } else if (aFavor) {
    if (ficha.origen?.startsWith("robo")) motivo = `${clave && T.esNuestro(clave.jug) ? `Robo de ${nombre(clave)}` : "Balón ganado"} en ${enZona} y gol${tras}${marca}.`;
    else if (ficha.origen === "errorRival") motivo = `Error del rival en su salida${enZona ? ` (${enZona})` : ""} y gol${tras}${marca}.`;
    else if (ficha.origen === "construccion") motivo = `Construcción desde atrás y gol${tras}${quienAsiste}${marca}.`;
    else if (ficha.origen === "posesionLarga") motivo = `Posesión instalada y gol${tras}${quienAsiste}${marca}.`;
    else if (ficha.origen === "segundaJugada") motivo = `Segunda jugada: rechace aprovechado${goleador ? ` por ${goleador}` : ""}.`;
    else motivo = `Gol${tras}${quienAsiste}${marca}.`;
  } else {
    const deQuien = clave && T.esNuestro(clave.jug) ? ` de ${nombre(clave)}` : "";
    const fallos = implicados.filter((x) => x.accion === "Le regatean" || x.accion === "Duelo perdido" || x.accion === "Duelo aéreo perdido");
    const yFallos = fallos.length ? `; ${fallos.map((x) => `${x.accion.toLowerCase()} a ${x.jugador}`.replace("le regatean a", "regatean a").replace("duelo perdido a", "duelo perdido de").replace("duelo aéreo perdido a", "duelo aéreo perdido de")).join(", ")}` : "";
    const porCarril = ficha.carril !== undefined ? `; llega por ${TXT_CARRIL[ficha.carril]}` : "";

    if (propia) {
      const propio = remate && tiene(remate, "Own goal") ? nombre(remate) : "";

      motivo = `Gol en propia puerta${propio ? ` de ${propio}` : ""}${clave ? ` tras la pérdida de ${nombre(clave)} en ${enZona}` : ""}${clave ? `, a los ${ficha.segundos} s` : ""}.`;
    } else if (ficha.origen === "errorPropio") motivo = `Pérdida${deQuien} en ${enZona} y gol a los ${ficha.segundos} s${yFallos}.`;
    else if (ficha.origen?.startsWith("perdida")) motivo = `Pérdida${deQuien} en ${enZona}; gol${tras}${porCarril}${yFallos}.`;
    else if (ficha.origen === "segundaJugada") {
      const VERBO = { "Despeje fallido": "despeja mal", "Para el penalti": "para el penalti", Parada: "para el remate", "Bloquea y pierde el balón": "bloquea el remate pero pierde el balón", "Bloquea el remate": "bloquea el remate", "Pierde el balón": "pierde el balón", Despeje: "despeja" };
      const verbo = clave ? VERBO[accionNuestra(clave, false)] : "";

      motivo = `Segunda jugada en contra${verbo ? `: ${nombre(clave)} ${verbo}` : ""}${enZona ? ` en ${enZona}` : ""} y gol a los ${ficha.segundos} s.`;
    }
    else if (ficha.origen === "defensaPosicional") motivo = `Ataque posicional suyo desde ${enZona || "su campo"}; gol${tras}${porCarril}${yFallos}.`;
    else motivo = `Gol en contra${tras}${porCarril}${yFallos}.`;
  }

  if (motivo) ficha.motivo = motivo.replace(/\s+/g, " ");

  return ficha;
}

/** El corte del gol en `informe-clips:jNN`: el del lado y el minuto (±1). */
function videoDelGol(cortes, lado, g) {
  if (!Array.isArray(cortes)) return undefined;

  const tipoCorte = lado === "nuestro" ? "gol" : "gol-contra";
  const minuto = g.min + g.extra;
  const mejor = cortes
    .filter((c) => c?.tipo === tipoCorte && c.url)
    .map((c) => {
      const m = leeMinuto(c.minuto);

      return { c, d: Math.abs(m.min + m.extra - minuto) };
    })
    .filter((x) => x.d <= 1)
    .sort((a, b) => a.d - b.d)[0];

  return mejor?.c.url;
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
