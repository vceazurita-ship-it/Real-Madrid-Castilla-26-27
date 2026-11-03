/*
|--------------------------------------------------------------------------
| LOS GOLES DE LA LIGA, CON SU MINUTO, Y LA TIPOLOGÍA DE LOS NUESTROS
|--------------------------------------------------------------------------
|
|   node scripts/goles-liga.mjs            arma `goles:analisis` y lo sube
|   node scripts/goles-liga.mjs --ver      sólo enseña lo que subiría
|   node scripts/goles-liga.mjs --hudl     antes, baja de Hudl el timeline de
|                                          nuestros partidos recientes que falten
|                                          (y saca los cortes de gol que falten)
|   node scripts/goles-liga.mjs --cortes   saca del vídeo de Hudl los cortes de gol
|                                          que falten y los sube al bucket
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
| Cada gol de BeSoccer se casa con su gol de Hudl por lado, orden y minuto
| (±2); la tipología y la ficha técnica salen de `analizaGol` y nuestras hojas
| de ABP mandan en el balón parado. Es una propuesta: en la pantalla se corrige
| gol a gol. El registro coteja cada gol con todas sus fuentes.
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
const { leeTimeline, publicada } = require("./partido/comun.cjs");
const { mismoEquipo: mismoNombre } = require("../lib/data-analisis/nombres.ts");
const { mismoClub } = require("../lib/rivals/mismoClub.ts");

/* Wyscout dice «Atlético Madrid B» y BeSoccer «Atlético Madrileño»: palabra a palabra no casan. */
const mismoEquipo = (a, b) => mismoNombre(a, b) || mismoClub(a, b);
const { DOC_GOLES, CASTILLA, leeMinuto } = require("../lib/goles/analisis.ts");
const { ejeDeTipologia, rotuloSegundo } = require("../lib/goles/tecnico.ts");
const { VISTO_EN_VIDEO } = require("../lib/goles/visto-en-video.ts");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
/* La carpeta de los partidos está dos niveles por encima del repo; desde una copia de trabajo (`.claude/worktrees/x`), cinco. */
const CASA = [path.join(RAIZ, "..", ".."), path.join(RAIZ, "..", "..", "..", "..", "..")].find((c) => fs.existsSync(path.join(c, "PARTIDOS"))) ?? path.join(RAIZ, "..", "..");
const CARPETAS_TIMELINE = [path.join(CASA, "PARTIDOS", "ANALISIS"), path.join(CASA, "ANALISIS TRANSICIONES"), path.join(CASA, "HUDL ALCORCON")];
const CARPETA_TACTICA = path.join(CASA, "ANALISIS TRANSICIONES");
const SOLO_VER = process.argv.includes("--ver");
const BAJAR_HUDL = process.argv.includes("--hudl");
/* Saca del vídeo de Hudl los cortes de gol que falten (necesita el Chrome del club); con --hudl también. */
const CORTAR = BAJAR_HUDL || process.argv.includes("--cortes");

/* Los cortes de cada gol: en el bucket, ~12 s antes del gol y ~5 s después (vistos en J06, J07 y J10). */
const BUCKET = "performance";
const CARPETA_CORTES = "2026/goles/clips";
const ANTES_DEL_GOL = 12;
const DESPUES_DEL_GOL = 5;

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

  /* ---------------- 3. Hudl, hojas de ABP y vídeo ---------------- */
  const nuestros = partidos.filter((p) => mismoEquipo(p.local, CASTILLA) || mismoEquipo(p.visitante, CASTILLA));

  if (BAJAR_HUDL) bajaTimelinesQueFaltan(nuestros);

  const timelines = buscaTimelines();
  const tacticas = leeTacticas();
  const hojasAbp = await leeHojasAbp();
  const tipologia = {};
  const tecnico = {};
  const remates = {};
  const sinTimeline = [];
  const cotejo = [];
  const porCortar = [];

  /* Los cortes de cada jornada (`informe-clips:jNN`): su texto se coteja con lo de Hudl y, si aún no hay corte propio del gol, se usa el suyo. */
  const { data: filasClips } = await supabase.from("app_documents").select("key,data").like("key", "informe-clips:%");
  const cortesDe = new Map((filasClips ?? []).map((f) => [Number(String(f.key).match(/j(\d+)$/)?.[1]), f.data?.cortes ?? []]));

  /* Los cortes de los goles que ya están en el bucket. */
  const { data: enBucket } = await supabase.storage.from(BUCKET).list(CARPETA_CORTES, { limit: 1000 });
  const yaCortados = new Set((enBucket ?? []).map((f) => f.name));
  const urlCorte = (nombre) => supabase.storage.from(BUCKET).getPublicUrl(`${CARPETA_CORTES}/${nombre}`).data.publicUrl;

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

    const casados = t ? casaGoles(t.T, p.goles, ladoNuestro) : new Map();
    const video = t ? leeVideo(t.carpeta) : null;

    p.goles.forEach((g, i) => {
      const lado = g.lado === ladoNuestro ? "nuestro" : "rival";
      const clave = `${p.id}:${i}`;
      const texto = textos[lado][cuenta[lado]++]?.texto;
      const filaAbp = filaAbpDelGol(hojasAbp, p.jornada, lado, g);
      const c = casados.get(i);
      const corte = cortePrevio(cortesDe.get(p.jornada), lado, g);
      const nota = { clave, jornada: p.jornada, minuto: `${g.min}${g.extra ? `+${g.extra}` : ""}'`, lado, jugador: g.jugador, tipoBs: g.tipo, asistente: g.asistente ?? "", casado: c ?? null, filaAbp, corteTexto: corte?.texto ?? "", avisos: [] };

      const r = c
        ? analizaGol(t.T, c, lado, { propia: g.tipo === "propia", filaAbp, visto: VISTO_EN_VIDEO[clave] })
        : sinHudl(lado, g, filaAbp, t ? "No casa con ningún gol de Hudl de ese lado y minuto (±2)." : "El partido no tiene timeline de Hudl.");

      /* BeSoccer y Hudl, de acuerdo en el autor; si no, se dice (el gol se casa por lado, orden y minuto, no por el nombre). */
      if (c && !c.autorCasa) nota.avisos.push(`autor: BeSoccer «${g.jugador}», Hudl «${c.autor || "sin rematador"}»`);
      if (g.tipo === "penalti" && r.tipo !== "penalti") nota.avisos.push("BeSoccer dice penalti y Hudl no lo ve");
      if (filaAbp?.esGol && r.fuenteTipo !== "hoja") nota.avisos.push(`la hoja de ABP lo da como ${filaAbp.accion} y la tipología sale ${r.tipo ?? "vacía"}`);
      if (r.tipo && ABP.has(r.tipo) && !filaAbp?.esGol && hojasAbp.length) nota.avisos.push("ABP en Hudl sin fila de gol en nuestras hojas de ABP");

      tipologia[clave] = { tipo: r.tipo, motivo: r.motivo, ...(texto ? { texto } : {}) };

      const ficha = r.ficha ?? {};

      /* De dónde sale el gol: BeSoccer y, si casa, su momento de Hudl. */
      ficha.fuentes = { ...(ficha.fuentes ?? {}), casado: `BeSoccer: ${nota.minuto} ${g.jugador}${g.tipo === "penalti" ? " de penalti" : g.tipo === "propia" ? " en propia puerta" : ""}${g.asistente ? `, asiste ${g.asistente}` : ""}.${c ? ` Hudl: «${codigo(c.m)}», gol en el ${rotuloSegundo(c.tGol / 1000)} del vídeo (minuto ${c.min})${c.autor ? `, remata ${c.autor}` : ""}.` : ""}` };

      /* El enlace al partido en Hudl y el corte del gol (el propio; si aún no está, el del informe del partido). */
      if (c && video?.url) ficha.hudl = { url: video.url, seg: Math.round(c.tGol / 1000) };

      const nombre = `${p.id}-${i}.mp4`;

      if (c && yaCortados.has(nombre)) ficha.video = urlCorte(nombre);
      else {
        if (corte?.url) ficha.video = corte.url;
        if (c && video?.hls) porCortar.push({ carpeta: t.carpeta, desde: c.tGol / 1000 - ANTES_DEL_GOL, dura: ANTES_DEL_GOL + DESPUES_DEL_GOL, nombre, ficha });
      }

      if (Object.keys(ficha).length) tecnico[clave] = ficha;

      nota.r = r;
      nota.ficha = ficha;
      cotejo.push(nota);
    });

    if (t) remates[p.id] = rematesDe(t.T);
  }

  /* Los cortes que faltan: se sacan del vídeo de Hudl con el Chrome del club (con --hudl o --cortes). */
  if (porCortar.length && CORTAR) await cortaLosQueFaltan(supabase, porCortar, urlCorte);
  else if (porCortar.length) console.log(`Cortes: faltan ${porCortar.length} en el bucket (se sacan con --cortes o --hudl).`);

  /* De dónde sale el vídeo, ya con los cortes hechos. */
  for (const f of Object.values(tecnico)) {
    if (!f.video) continue;

    const propio = f.video.includes(`/${CARPETA_CORTES}/`);

    f.fuentes = { ...(f.fuentes ?? {}), video: propio && f.hudl ? `Corte del vídeo de Hudl del partido, del ${rotuloSegundo(f.hudl.seg - ANTES_DEL_GOL)} al ${rotuloSegundo(f.hudl.seg + DESPUES_DEL_GOL)}.` : "Corte del vídeo del informe del partido." };
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

  /*
  | El cotejo gol a gol (03/11/2026): BeSoccer, Hudl, nuestras hojas de ABP y
  | el corte del informe, en una línea por fuente. Lo que no casa sale como
  | «OJO» y no se inventa: el gol se queda sin lo que no se ha podido casar.
  */
  for (const n of cotejo) {
    const f = n.ficha ?? {};
    const c = n.casado;

    console.log(`  J${n.jornada} ${n.minuto.padEnd(6)} ${n.lado === "nuestro" ? "a favor " : "en contra"} ${n.jugador}${n.tipoBs ? ` (${n.tipoBs})` : ""}${n.asistente ? `, asiste ${n.asistente}` : ""}`);
    console.log(`      Hudl:  ${c ? `${codigo(c.m)} · gol en el ${rotuloSegundo(c.tGol / 1000)} del vídeo (min ${c.min}) · remata ${c.autor || "?"}` : "sin casar"}`);
    if (n.filaAbp) console.log(`      Hoja:  ${nombreHoja(n.filaAbp)} · ${n.filaAbp.accion} ${n.filaAbp.minuto}' · ${n.filaAbp.esGol ? "Gol" : "gol del otro a la contra"}`);
    if (n.corteTexto) console.log(`      Corte: ${n.corteTexto}`);
    console.log(`      Tipo:  ${n.r.tipo ?? "(sin tipología)"} · ${n.r.motivo}`);
    console.log(`      Ficha: ${[f.fase, f.campo && `campo ${f.campo}`, f.accion, f.origen, f.segundos !== undefined && `${f.segundos} s`, f.pases !== undefined && `${f.pases} pases`, f.video ? (f.video.includes(CARPETA_CORTES) ? "corte propio" : "corte del informe") : "", f.hudl ? `Hudl ${rotuloSegundo(f.hudl.seg)}` : ""].filter(Boolean).join(" · ")}`);
    if (f.implicados?.length) console.log(`      Los nuestros: ${f.implicados.map((m) => `${m.jugador} (${m.accion})`).join(", ")}`);
    for (const a of n.avisos) console.log(`      OJO: ${a}`);
  }

  console.log(`Ficha técnica: ${Object.keys(tecnico).length} goles con ficha, ${Object.values(tecnico).filter((f) => f.video).length} con su corte de vídeo y ${Object.values(tecnico).filter((f) => f.hudl).length} con el enlace a Hudl.`);

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
/*  Casar cada gol de BeSoccer con su gol de Hudl                      */
/* ------------------------------------------------------------------ */

/*
| Revisado gol a gol el 03/11/2026 (24 goles, J2-J10) contra el vídeo de Hudl:
|
|   - El instante del gol. El evento «Shot against» del portero que encaja
|     (4 s) está centrado en el remate; si no lo hay, el inicio del momento
|     «<Equipo> - Goals» más su «Duration» (en segundos) llega al remate. Con
|     el reloj de la tele: J07 79' gol en el 80:41 del vídeo (portero 80:39-
|     80:43), J06 45+1 remate en el 45:08 y balón dentro en el 45:12, J10 12'
|     balón dentro en el 11:26.
|   - El casado. Por lado, en orden y con el minuto a ±2 (y la misma parte);
|     el que no casa se queda sin Hudl: no se busca «el más cercano». El autor
|     se coteja (BeSoccer abrevia: «Pau» es Pau Darbra, «Antal» es
|     Yaakobishvili) pero no decide.
*/

const normal = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^\d+\.\s*/, "");
const trozosNombre = (s) => normal(s).split(/[^a-z]+/).filter((x) => x.length >= 3);
const mismoJugador = (a, b) => trozosNombre(a).some((x) => trozosNombre(b).includes(x));

/** Cuándo entra el gol en el vídeo de Hudl (ms) y de dónde se ha sacado. */
function instanteDelGol(T, g, aFavor) {
  const portero = T.acciones.filter((a) => T.esNuestro(a.jug) !== aFavor && tiene(a, "Conceded goal") && a.t >= g.startTimeMs - 3000 && a.t <= g.endTimeMs + 4000).at(-1);

  if (portero) return (portero.t + portero.m.endTimeMs) / 2;

  const d = valor(g, "Duration");

  return d !== "" && Number.isFinite(Number(d)) ? g.startTimeMs + Number(d) * 1000 : g.endTimeMs - 3000;
}

/** El remate del gol: el del que marca (o la propia puerta del que defiende) más cerca del instante del gol. */
function remateDelGol(T, tGol, aFavor) {
  return T.acciones
    .filter((a) => Math.abs(instante(a) - tGol) <= 12_000 && ((T.esNuestro(a.jug) === aFavor && tiene(a, "Shot", "Penalty") && esGol(a)) || (T.esNuestro(a.jug) !== aFavor && tiene(a, "Own goal"))))
    .sort((a, b) => Math.abs(instante(a) - tGol) - Math.abs(instante(b) - tGol))[0];
}

/** Para cada gol de BeSoccer (por índice), su momento «Goals» de Hudl. */
function casaGoles(T, goles, ladoNuestro) {
  const salida = new Map();

  for (const lado of ["nuestro", "rival"]) {
    const aFavor = lado === "nuestro";
    const deBs = goles.map((g, i) => ({ g, i })).filter(({ g }) => (g.lado === ladoNuestro) === aFavor);
    const deHudl = (T.codigosEquipo.Goals?.[lado] ?? [])
      .slice()
      .sort((a, b) => a.startTimeMs - b.startTimeMs)
      .map((m) => {
        const tGol = instanteDelGol(T, m, aFavor);

        return { m, tGol, min: T.minuto(tGol), parte: T.tiempo(tGol) };
      });
    let j = 0;

    for (const { g, i } of deBs) {
      const objetivo = g.min + g.extra;
      let k = j;

      while (k < deHudl.length && (deHudl[k].parte < g.parte || (deHudl[k].parte === g.parte && deHudl[k].min < objetivo - 2))) k += 1;

      const h = deHudl[k];

      if (!h || h.parte !== g.parte || Math.abs(h.min - objetivo) > 2) continue;

      const remate = remateDelGol(T, h.tGol, aFavor);
      const autor = remate ? sinDorsal(remate.jug) : "";

      salida.set(i, { ...h, remate, autor, autorCasa: Boolean(autor) && mismoJugador(autor, g.jugador) });
      j = k + 1;
    }
  }

  return salida;
}

/** El vídeo del partido en Hudl (lo deja `hudl-partido.mjs` junto al timeline). */
function leeVideo(carpeta) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(carpeta, "video-hudl.json"), "utf8"));

    return v.url ? { url: v.url, hls: fs.existsSync(path.join(carpeta, "hls.json")) } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Nuestras hojas de ABP                                              */
/* ------------------------------------------------------------------ */

const tipoDeAccionAbp = (accion) => (/c[oó]rner/i.test(accion) ? "corner" : /penalti/i.test(accion) ? "penalti" : /directa/i.test(accion) ? "faltaDirecta" : /lateral|indirecta/i.test(accion) ? "faltaLateral" : null);

/**
 * Las filas de liga de las cuatro hojas de ABP que acaban en gol. «Gol» es
 * gol del que saca (en las de en contra, del rival); «Gol Rival» en las
 * nuestras y «Gol RMCF» en las suyas, gol del otro equipo a la contra.
 */
async function leeHojasAbp() {
  try {
    const filas = [];

    for (const [hoja, de, colMinuto] of [["piezasOf", "nuestro", "Minuto"], ["piezasDef", "rival", "MINUTO"], ["bandaOf", "nuestro", "Minuto"], ["bandaDef", "rival", "Minuto"]]) {
      for (const f of await publicada(hoja)) {
        const jornada = Number(String(f.JORNADA ?? "").match(/^LIGA\s*(\d+)/i)?.[1]);
        const resultado = String(f.Resultado_Final ?? "").trim();
        const esGol = /^gol$/i.test(resultado);
        const golDelOtro = /^gol (rival|rmcf)$/i.test(resultado);

        if (!jornada || (!esGol && !golDelOtro)) continue;

        const banda = hoja.startsWith("banda");
        const accion = banda ? "Saque de banda" : String(f.Tipo_Accion ?? "");

        filas.push({ hoja, jornada, de, parte: /2/.test(String(f.Tiempo ?? "")) ? 2 : 1, minuto: Number(f[colMinuto]) || null, esGol, golDelOtro, accion, tipo: banda ? "banda" : tipoDeAccionAbp(accion), sacador: String(f.Sacador ?? "") });
      }
    }

    console.log(`Hojas de ABP: ${filas.length} filas de liga acabadas en gol.`);

    return filas;
  } catch (e) {
    console.log(`Hojas de ABP: no se leen (${e?.message ?? e}); se sigue sin ellas.`);

    return [];
  }
}

/** La fila de ABP de un gol: misma jornada y parte, del que marca (o la suya a la contra) y de los 4 minutos antes al de después. */
function filaAbpDelGol(hojas, jornada, lado, g) {
  const min = g.min + g.extra;

  return hojas
    .filter((f) => f.jornada === jornada && f.parte === g.parte && f.minuto && f.minuto >= min - 4 && f.minuto <= min + 1 && ((f.esGol && f.de === lado) || (f.golDelOtro && f.de !== lado)))
    .sort((a, b) => Number(b.esGol) - Number(a.esGol) || Math.abs(a.minuto - min) - Math.abs(b.minuto - min))[0];
}

const nombreHoja = (f) => `hoja de ${f.hoja.startsWith("banda") ? "banda" : "ABP"} ${f.hoja.endsWith("Of") ? "ofensiva" : "defensiva"}`;

/* ------------------------------------------------------------------ */
/*  Hudl                                                               */
/* ------------------------------------------------------------------ */

const etiqueta = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
const codigo = (m) => etiqueta(m, "HUDL_CODE")[0] || "";
const valor = (m, sufijo) => {
  const t = m.tags.find((x) => x.key.replace(/^\d+ - /, "") === sufijo);

  return t ? t.values.join("/") : "";
};

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

        /* La misma copia en dos carpetas (la del análisis y la de transiciones) cuenta una vez: la primera, que es la que lleva el vídeo. */
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

/* ------------------------------------------------------------------ */
/*  Cada gol, desde el Castilla: tipología y ficha técnica             */
/* ------------------------------------------------------------------ */

/*
| Lo medido en los timelines de J03-J10 (03/11/2026) y en lo que se apoya esto:
|
|   - Zonas. «Location - Third/Flank» de una acción va en la referencia del
|     equipo del jugador, y el «Location third/flank» de una posesión, en la
|     del equipo que la tiene. Lo del rival se gira (tercio y carril, 2 − x)
|     para dejarlo todo en la del Castilla.
|   - Tiempos. Las acciones normales empiezan ~2 s antes del toque y duran 4-10
|     s. Los remates (y la propia puerta) son ventanas de 20 s (14 s si no son
|     gol) que empiezan ~15 s (~5 s) antes del remate: se colocan con `instante`.
|   - La jugada. El momento «Goals» es sólo la última posesión. Un toque suelto
|     del que defiende (un despeje, un bloqueo, una intercepción que no
|     controla: ≤ 4,5 s y sin un pase de verdad ni un remate) no corta la
|     jugada: el ataque sigue siendo el mismo (J09 63': centro, Fortea la toca
|     de cabeza y gol; J04 33': centro, Fortea la intercepta y la pierde, gol
|     de lejos). `cadena` junta esas posesiones.
|   - Transición: la jugada nace de un robo del que marca o de una pérdida de
|     verdad del otro y el gol llega en ≤ 15 s. No lo es si quien roba acababa
|     de perderla (≤ 7 s): es su mismo ataque que sigue (J04 16', J08 67').
|   - Campo (mitad). Hudl sólo da tercios: el propio y el último dicen la
|     mitad; el del medio no (ni hay coordenadas). Ahí el campo sólo se pone
|     si se ha visto en el vídeo (`VISTO_EN_VIDEO`, lib/goles/visto-en-video.ts).
*/

const TERCIO = { "Own third": 0, "Middle third": 1, "Final third": 2 };
const CARRIL = { "Left flank": 0, Center: 1, "Right flank": 2 };
const ABP = new Set(["penalti", "corner", "banda", "faltaDirecta", "faltaLateral"]);
const sinDorsal = (j) => String(j).replace(/^\d+\.\s*/, "");
const tiene = (a, ...tipos) => tipos.some((x) => a.tipos.includes(x));
const TOQUE = ["Interception", "Clearance", "Shot block", "Head pass", "Save"];

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

/** ¿Una posesión del que defiende es sólo un toque (un despeje, un bloqueo, una intercepción sin control)? */
function esToque(T, p, deNuestro) {
  if (p.endTimeMs - p.startTimeMs > 4500) return false;

  const suyas = T.acciones.filter((a) => T.esNuestro(a.jug) === deNuestro && a.m.endTimeMs >= p.startTimeMs && a.t >= p.startTimeMs - 4000 && a.t <= p.endTimeMs + 500 && !tiene(a, "Shot against"));

  return suyas.length > 0 && suyas.every((a) => !tiene(a, "Shot", "Penalty") && (tiene(a, ...TOQUE) || !tiene(a, "Pass", "Carry", "Progressive run", "Dribble", "Cross", "Goal kick", "Touch")));
}

/** La jugada del gol: la posesión del gol y las de antes del mismo equipo, saltando los toques sueltos del otro. */
function cadena(T, g, prefijo, marcaNuestro) {
  const pos = T.momentosEq.filter((m) => / - Possessions$/.test(codigo(m))).sort((a, b) => a.startTimeMs - b.startTimeMs || a.endTimeMs - b.endTimeMs);
  const delMarca = (m) => codigo(m).startsWith(`${prefijo} - `);
  const i = pos.findIndex((m) => delMarca(m) && Math.abs(m.startTimeMs - g.startTimeMs) <= 1500);

  if (i < 0) return { inicio: g.startTimeMs, primera: g, toques: [] };

  let k = i;
  const toques = [];

  while (k > 0) {
    const ant = pos[k - 1];

    if (pos[k].startTimeMs - ant.endTimeMs > 1500) break;

    if (delMarca(ant)) {
      k -= 1;
      continue;
    }

    const ant2 = pos[k - 2];

    if (!ant2 || !delMarca(ant2) || ant.startTimeMs - ant2.endTimeMs > 1500 || !esToque(T, ant, !marcaNuestro)) break;

    toques.push(ant);
    k -= 2;
  }

  return { inicio: pos[k].startTimeMs, primera: pos[k], toques };
}

/** Lo que hizo un jugador nuestro, en español. `null` si no cuenta para la jugada. */
function accionNuestra(a, aFavor) {
  const duelo = valor(a.m, "Ground duel - Duel type");

  if (tiene(a, "Own goal")) return "En propia puerta";

  if (tiene(a, "Shot", "Penalty")) {
    if (!esGol(a)) return aFavor ? "Primer remate" : null;

    return tiene(a, "Penalty") ? "Marca de penalti" : tiene(a, "Head shot") ? "Remata de cabeza" : "Remata";
  }

  if (tiene(a, "Penalty save")) return "Para el penalti";
  /* El pase al espacio que acaba en gol aunque lo toque un defensa (J10 12'): Hudl lo marca como pérdida. */
  if (aFavor && tiene(a, "Through pass", "Smart pass")) return "Pase al espacio";
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

const TXT_TERCIO = ["nuestro tercio", "la zona media", "su tercio"];
const TXT_CARRIL = ["la izquierda", "el centro", "la derecha"];
const NOMBRE_ABP = { penalti: "Penalti", corner: "Córner", banda: "Saque de banda", faltaDirecta: "Falta directa", faltaLateral: "Falta lateral" };
const enZona = (z) => (z ? `${TXT_TERCIO[z.tercio]}${z.carril !== 1 ? ` por ${TXT_CARRIL[z.carril]}` : ""}` : "");
/** El campo (mitad, desde el Castilla) de una celda: el tercio del medio no lo dice. */
const campoDeCelda = (z) => (z?.tercio === 0 ? "propio" : z?.tercio === 2 ? "contrario" : undefined);

/** Un gol sin timeline de Hudl: sólo lo que dicen nuestras hojas de ABP o BeSoccer. */
function sinHudl(lado, g, filaAbp, motivo) {
  const aFavor = lado === "nuestro";
  const tipo = filaAbp?.esGol && filaAbp.tipo ? filaAbp.tipo : g.tipo === "penalti" ? "penalti" : null;

  if (!tipo) return { tipo: null, motivo, ficha: null };

  const eje = ejeDeTipologia(tipo, aFavor);
  const de = filaAbp?.esGol ? `${nombreHoja(filaAbp)}: ${filaAbp.accion.toLowerCase()} del ${filaAbp.minuto}'${filaAbp.sacador ? ` (saca ${filaAbp.sacador})` : ""}, acabado en gol` : "BeSoccer: de penalti";
  const ficha = { fase: eje.fase, ...(eje.campo ? { campo: eje.campo } : {}), accion: eje.accion, origen: "abp", fuentes: { tipo: `${de[0].toUpperCase()}${de.slice(1)}.`, fase: "Sale de la tipología: balón parado.", ...(eje.campo ? { campo: `${NOMBRE_ABP[tipo]}: siempre en el campo del que defiende.` } : {}), accion: `${de[0].toUpperCase()}${de.slice(1)}.` } };

  return { tipo, motivo: `${NOMBRE_ABP[tipo]}${filaAbp?.sacador && aFavor ? ` sacado por ${filaAbp.sacador}` : ""}.`, ficha, fuenteTipo: filaAbp?.esGol ? "hoja" : "besoccer" };
}

/**
 * La tipología y la ficha técnica de un gol casado con Hudl. `c` es el casado
 * (`casaGoles`): el momento «Goals», el instante del gol y el remate.
 */
function analizaGol(T, c, lado, { propia, filaAbp, visto }) {
  const g = c.m;
  const aFavor = lado === "nuestro";
  const golT = c.tGol;
  const remate = c.remate;
  const delQueMarca = (a) => T.esNuestro(a.jug) === aFavor;
  const prefijo = codigo(g).replace(/ - Goals$/, "");
  const jugada = cadena(T, g, prefijo, aFavor);
  const desdeT = jugada.inicio;
  const delMarca = (m) => codigo(m).startsWith(`${prefijo} - `);
  const fuentes = {};
  const nombre = (a) => (a ? sinDorsal(a.jug) : "");

  /* ---------------- ¿balón parado? ---------------- */
  const conGol = (m) => etiqueta(m, "07 - Outcome").includes("Goal");
  const piezas = T.momentosEq.filter((m) => delMarca(m) && /- (Corners|Free kicks|Throw ins|Set Pieces)$/.test(codigo(m)));
  /* La jugada a balón parado que Hudl da por acabada en gol, o la que abre la jugada (córner, falta o penalti) si el gol llega en ≤ 20 s. */
  const piezaGol = piezas.filter((m) => conGol(m) && m.startTimeMs <= g.endTimeMs && m.endTimeMs >= g.endTimeMs - 3000);
  const piezaInicio = piezas.filter((m) => !/Throw ins$/.test(codigo(m)) && m.startTimeMs <= desdeT + 3000 && m.endTimeMs >= desdeT - 1000 && golT - m.startTimeMs <= 20_000);
  const piezasJugada = [...piezaGol, ...piezaInicio];
  const enJugada = (a) => instante(a) >= desdeT - 4000 && instante(a) <= golT + 1500;
  const penaltiJugada = T.acciones.find((a) => delQueMarca(a) && tiene(a, "Penalty") && enJugada(a));
  const remateOtros = T.acciones.filter((a) => delQueMarca(a) && a !== remate && tiene(a, "Shot", "Penalty") && instante(a) >= desdeT - 4000 && instante(a) <= golT - 500 && golT - instante(a) <= 15_000);
  const tiposRemate = remate?.tipos ?? [];
  let tipo = null;
  let motivo = "";
  let fuenteTipo = "hudl";
  let pieza = null;

  const de = (cosa) => piezasJugada.some((m) => codigo(m) === `${prefijo} - ${cosa}`);

  if (tiposRemate.includes("Penalty") || penaltiJugada) tipo = "penalti";
  else if (de("Corners") || tiposRemate.includes("Shot after corner")) tipo = "corner";
  else if (de("Free kicks") || tiposRemate.some((x) => /free kick/i.test(x))) tipo = tiposRemate.includes("Free kick shot") ? "faltaDirecta" : "faltaLateral";
  else if (piezaGol.some((m) => /Throw ins$/.test(codigo(m))) || tiposRemate.includes("Shot after throw in")) tipo = "banda";
  else if (piezasJugada.length) tipo = "faltaLateral";

  if (tipo) pieza = piezasJugada.sort((a, b) => a.startTimeMs - b.startTimeMs)[0] ?? null;

  /* Nuestra hoja de ABP manda en el tipo de balón parado (la rellena el cuerpo técnico). */
  if (filaAbp?.esGol && filaAbp.tipo) {
    if (tipo && tipo !== filaAbp.tipo) fuentes.tipo = `Hudl lo daba como ${NOMBRE_ABP[tipo]?.toLowerCase() ?? tipo}; manda la hoja.`;
    tipo = filaAbp.tipo;
    fuenteTipo = "hoja";
  }

  const esAbp = Boolean(tipo) && !propia;

  if (esAbp) {
    const rechace = (tipo === "penalti" && !tiposRemate.includes("Penalty")) || remateOtros.length;

    motivo = `${NOMBRE_ABP[tipo]}${rechace ? (tipo === "penalti" ? ": lo para el portero y gol al rechace" : " y gol en la segunda jugada") : ""}.`;
    fuentes.tipo = [filaAbp?.esGol ? `${nombreHoja(filaAbp)}: ${filaAbp.accion.toLowerCase()} del ${filaAbp.minuto}', acabado en gol` : "", pieza || penaltiJugada ? `Hudl: ${NOMBRE_ABP[tipo].toLowerCase()} ${aFavor ? "nuestro" : "suyo"} en la jugada del gol` : "", fuentes.tipo ?? ""].filter(Boolean).join(". ") + ".";
  } else if (propia && tipo) {
    tipo = null;
  }

  /* ---------------- ¿transición? ---------------- */
  const recupera = T.acciones.filter((a) => delQueMarca(a) && a.t >= desdeT - 3000 && a.t <= desdeT + 4000 && tiene(a, "Recovery", "Interception", "Counterpressing recovery")).sort((a, b) => a.t - b.t)[0];
  const perdidaOtro = T.acciones.filter((a) => !delQueMarca(a) && tiene(a, "Loss") && !tiene(a, ...TOQUE) && a.m.endTimeMs >= desdeT - 3000 && a.t <= desdeT + 1500).at(-1);
  const ref = recupera?.t ?? desdeT;
  const sigueSuAtaque = T.acciones.some((a) => delQueMarca(a) && tiene(a, "Loss") && a.t >= ref - 7000 && a.t <= ref - 300);
  const contraataque = T.momentosEq.some((m) => delMarca(m) && / - Counterattacks$/.test(codigo(m)) && m.endTimeMs >= desdeT && m.startTimeMs <= golT);
  const esTransicion = !esAbp && (contraataque || ((recupera || perdidaOtro) && !sigueSuAtaque && golT - desdeT <= 15_000));
  /* Dónde se gana el balón (en la referencia del Castilla): el robo del que marca o, si no, la pérdida del otro. */
  const clave = recupera ?? perdidaOtro ?? null;
  let zona;

  if (esAbp) zona = tipo === "penalti" ? { tercio: aFavor ? 2 : 0, carril: 1 } : pieza ? celdaMomento(pieza, !aFavor) : undefined;
  else if (esTransicion && clave) zona = celdaAccion(T, clave);
  else zona = celdaMomento(jugada.primera, !aFavor);

  let campo = esAbp ? (tipo === "corner" || tipo === "penalti" ? (aFavor ? "contrario" : "propio") : campoDeCelda(zona)) : campoDeCelda(zona);

  if (campo) fuentes.campo = esAbp && (tipo === "corner" || tipo === "penalti") ? `${NOMBRE_ABP[tipo]}: siempre en el campo del que defiende.` : `Hudl: ${esTransicion ? "se gana el balón" : esAbp ? "se saca" : "la jugada arranca"} en ${TXT_TERCIO[zona.tercio]}.`;
  else if (visto?.campo) {
    campo = visto.campo;
    fuentes.campo = `Visto en el vídeo de Hudl: ${visto.nota.charAt(0).toLowerCase()}${visto.nota.slice(1)}`;
  }

  /* El error: una pérdida de verdad (sin duelo) del otro en su propio tercio y gol en ≤ 10 s. */
  const errorOtro = esTransicion && perdidaOtro && !recupera?.tipos.includes("Defensive duel") && !tiene(perdidaOtro, "Duel") && celdaAccion(T, perdidaOtro)?.tercio === (aFavor ? 2 : 0) && golT - desdeT <= 10_000;

  if (!esAbp) {
    const quien = clave ? nombre(clave) : "";
    const seg = Math.max(0, Math.round((golT - (recupera ? recupera.t : perdidaOtro ? Math.max(perdidaOtro.t, desdeT - 2000) : desdeT)) / 1000));

    if (errorOtro) {
      tipo = "error";
      motivo = `Pérdida de ${quien} en su propio tercio y gol a los ${seg} s.`;
    } else if (esTransicion) {
      /* Desde quien marca: «campo propio» es su mitad. */
      const suMitad = campo ? (aFavor ? campo === "propio" : campo === "contrario") : null;

      tipo = suMitad === null ? null : suMitad ? "transPropio" : "transContrario";
      motivo = `${recupera ? `Robo de ${nombre(recupera)}` : `Pérdida de ${quien}`}${zona ? ` en ${enZona(zona)}` : ""} y gol a los ${seg} s${remateOtros.length ? ", al rechace" : ""}.`;
    } else if (remateOtros.length) {
      tipo = "caida";
      const previo = remateOtros.at(-1);

      motivo = `Segunda acción tras ${/Penalty/.test(previo.tipos.join()) ? "un penalti parado" : `un remate de ${nombre(previo)}`}.`;
    } else {
      /* Ataque organizado: por la última entrega. Si en medio hubo un toque nuestro (o suyo), manda el centro de antes. */
      /* `toques` va del más cercano al gol al más lejano: el primero de la jugada es el último. */
      const primerToque = jugada.toques.at(-1);
      const centroAntes = primerToque ? T.acciones.filter((a) => delQueMarca(a) && tiene(a, "Cross") && a.t >= Math.max(desdeT - 2000, primerToque.startTimeMs - 8000) && a.t <= primerToque.startTimeMs + 500).at(-1) : null;
      const asistencia = T.acciones.filter((a) => delQueMarca(a) && tiene(a, "Assist") && a.t >= desdeT - 2000 && a.t <= golT).at(-1);
      const pase = centroAntes ?? asistencia ?? T.acciones.filter((a) => delQueMarca(a) && a !== remate && tiene(a, "Pass") && a.t >= desdeT - 2000 && instante(a) <= instante(remate ?? { t: golT, tipos: [] })).at(-1);

      if (pase) {
        const flanco = valor(pase.m, "Location - Flank");
        const banda = flanco === "Right flank" ? "bandaD" : flanco === "Left flank" ? "bandaI" : null;
        const lado2 = banda === "bandaD" ? "derecha" : "izquierda";
        const tras = jugada.toques.length ? `; la toca ${aFavor ? "su" : "nuestra"} defensa y` : "";

        if (tiene(pase, "Cross") && banda) [tipo, motivo] = [banda, `Centro de ${nombre(pase)} desde la ${lado2}${tras ? `${tras} gol` : ""}.`];
        else if (tiene(pase, "Through pass", "Smart pass") || (tiene(pase, "Long pass") && tiene(pase, "Forward pass"))) [tipo, motivo] = ["espalda", `Pase a la espalda de ${nombre(pase)}.`];
        else if (banda && valor(pase.m, "Location - Third") === "Final third") [tipo, motivo] = [banda, `Pase de ${nombre(pase)} desde la ${lado2}${tras ? `${tras} gol` : ""}.`];
        else [tipo, motivo] = ["dentro", `Pase de ${nombre(pase)} por dentro.`];
      } else [tipo, motivo] = ["dentro", "Jugada individual, sin pase de gol."];
    }

    fuentes.tipo = `Hudl: ${esTransicion ? `la jugada nace de ${recupera ? "un robo" : "una pérdida"} y el gol llega en ${Math.round((golT - desdeT) / 1000)} s` : remateOtros.length ? "otro remate del mismo equipo justo antes" : "ataque organizado; manda la última entrega antes del gol"}${!campo && esTransicion ? " (el campo del robo no se sabe: es la zona media)" : ""}.`;
  }

  /* ---------------- la ficha ---------------- */
  const eje = tipo ? ejeDeTipologia(tipo, aFavor) : null;
  const ficha = {};

  ficha.fase = eje?.fase ?? (esTransicion ? (aFavor ? "transicionOfensiva" : "transicionDefensiva") : aFavor ? "ataqueOrganizado" : "defensaOrganizada");
  fuentes.fase = eje ? "Sale de la tipología." : "Hudl: transición sin campo decidido.";
  if (campo) ficha.campo = campo;
  if (zona) ficha.zonaOrigen = zona;

  /* Origen. */
  const dura = golT - desdeT;
  const enCelda = zona?.tercio ?? 1;

  if (esAbp) ficha.origen = "abp";
  else if (tipo === "caida") ficha.origen = "segundaJugada";
  else if (aFavor) {
    if (tipo === "error") ficha.origen = "errorRival";
    else if (esTransicion || (recupera && dura <= 20_000)) ficha.origen = ["roboBajo", "roboMedio", "roboAlto"][enCelda];
    else if (zona?.tercio === 0) ficha.origen = "construccion";
    else if (zona?.tercio === 2) ficha.origen = "posesionLarga";
  } else if (esTransicion) {
    ficha.origen = tipo === "error" || (zona?.tercio === 0 && perdidaOtro && !recupera && dura <= 10_000) ? "errorPropio" : ["perdidaSalida", "perdidaMedio", "perdidaAlta"][enCelda];
  } else ficha.origen = "defensaPosicional";

  /* Del origen al gol: pases, segundos y carril. */
  /* Una pérdida es un evento largo (un pase de 9 s en J09): se cuenta desde ~2 s antes de la posesión que la aprovecha. */
  const origenT = esAbp ? (pieza?.startTimeMs ?? penaltiJugada?.t ?? desdeT) : esTransicion && clave ? (clave === recupera ? clave.t : Math.max(clave.t, desdeT - 2000)) : desdeT;
  const enLaJugada = T.acciones.filter((a) => instante(a) >= origenT - 500 && instante(a) <= golT + 500 && a !== remate);
  const pases = enLaJugada.filter((a) => delQueMarca(a) && tiene(a, "Pass") && instante(a) <= golT);
  const asistencia = enLaJugada.filter((a) => delQueMarca(a) && tiene(a, "Assist")).at(-1);
  const ultimoPase = asistencia ?? pases.at(-1);
  const centro = enLaJugada.filter((a) => delQueMarca(a) && tiene(a, "Cross") && !tiene(a, "Loss")).at(-1);
  const enUltimo = (a) => a && valor(a.m, "Location - Third") === "Final third";
  const conduccion = remate ? enLaJugada.filter((a) => a.jug === remate.jug && tiene(a, "Carry", "Dribble") && enUltimo(a)).at(-1) : null;
  const llega = [asistencia, centro].find(enUltimo) ?? conduccion ?? asistencia ?? centro;

  if (tipo !== "penalti" && llega) {
    const cc = celdaAccion(T, llega);

    if (cc) ficha.carril = cc.carril;
  }

  ficha.segundos = Math.max(0, Math.round((golT - origenT) / 1000));
  if (tipo !== "penalti") ficha.pases = pases.length;

  /* ---------------- tipo de acción ---------------- */
  const regate = remate ? enLaJugada.some((a) => a.jug === remate.jug && tiene(a, "Dribble") && (!ultimoPase || a.t >= ultimoPase.t - 500)) : false;
  /* Remata justo después de un toque del que defiende, sin pase ni robo en medio: es un rechace (J09 63'). */
  const ultimoToque = jugada.toques[0];
  const trasToque = ultimoToque && golT - ultimoToque.endTimeMs <= 3500 && !pases.some((a) => a.t >= ultimoToque.startTimeMs) && !T.acciones.some((a) => delQueMarca(a) && tiene(a, "Recovery", "Interception") && a.t >= ultimoToque.startTimeMs - 1000 && a.t <= golT);

  if (propia || (remate && tiene(remate, "Own goal"))) [ficha.accion, fuentes.accion] = ["propiaPuerta", `BeSoccer y Hudl: en propia puerta${remate && tiene(remate, "Own goal") ? ` de ${nombre(remate)}` : ""}.`];
  else if (esAbp) {
    const rechace = (tipo === "penalti" && !tiposRemate.includes("Penalty")) || remateOtros.length;

    [ficha.accion, fuentes.accion] = rechace ? ["rechace", `Hudl: ${tipo === "penalti" ? "penalti parado y gol al rechace" : "otro remate justo antes del gol"}.`] : [eje.accion, `${fuenteTipo === "hoja" ? "Hoja de ABP" : "Hudl"}: ${NOMBRE_ABP[tipo].toLowerCase()}.`];
  } else if (remateOtros.length) [ficha.accion, fuentes.accion] = ["rechace", "Hudl: otro remate del mismo equipo justo antes del gol."];
  else if (remate && valor(remate.m, "Shot - Location") === "Outside penalty area") [ficha.accion, fuentes.accion] = ["remateLejano", "Hudl: remate desde fuera del área."];
  else if (ultimoPase && tiene(ultimoPase, "Through pass", "Smart pass")) [ficha.accion, fuentes.accion] = ["paseEspalda", `Hudl: pase al espacio de ${nombre(ultimoPase)}.`];
  else if (ultimoPase && tiene(ultimoPase, "Long pass") && tiene(ultimoPase, "Forward pass") && tiene(ultimoPase, "Assist")) [ficha.accion, fuentes.accion] = ["paseEspalda", `Hudl: pase largo hacia delante de ${nombre(ultimoPase)}.`];
  else if (trasToque) [ficha.accion, fuentes.accion] = ["rechace", `Hudl: remata justo después del toque de ${aFavor ? "su" : "nuestra"} defensa.`];
  else if (asistencia && tiene(asistencia, "Cross")) [ficha.accion, fuentes.accion] = ["centroLateral", `Hudl: centro de ${nombre(asistencia)}.`];
  else if (asistencia && valor(asistencia.m, "Pass - Direction") === "Back" && valor(asistencia.m, "Location - Flank") !== "Center") [ficha.accion, fuentes.accion] = ["paseAtras", `Hudl: pase atrás de ${nombre(asistencia)} desde la banda.`];
  else if (regate || (!ultimoPase && remate)) [ficha.accion, fuentes.accion] = ["jugadaIndividual", `Hudl: ${nombre(remate)} ${regate ? "regatea" : "conduce"} y remata.`];
  else if (asistencia) [ficha.accion, fuentes.accion] = ["combinacion", `Hudl: pase de gol de ${nombre(asistencia)}.`];

  if (tipo === "espalda" && !ficha.accion) ficha.accion = "paseEspalda";

  /* ---------------- los nuestros ---------------- */
  /* En una defensa organizada no cuenta lo de antes de su posesión (nuestra pérdida de 40 s antes es otra jugada). */
  const desde = !aFavor && !esAbp && !esTransicion ? origenT - 500 : origenT - 3500 - (esAbp && !aFavor ? 15_000 : 0);
  const nuestras = T.acciones
    /* A favor, la jugada empieza en el robo (lo de antes es otra posesión); en contra se mira algo antes (la falta, el despeje). */
    .filter((a) => T.esNuestro(a.jug) && (a === clave || (instante(a) >= (aFavor ? origenT - 500 : desde) && instante(a) <= golT + 1000)))
    .map((a) => ({ a, cuando: a === remate ? Infinity : instante(a), accion: accionNuestra(a, aFavor) }))
    .filter((x) => x.accion && (aFavor || DEFENSIVAS.has(x.accion)))
    .filter((x) => x.accion !== "Comete la falta" || (esAbp && !aFavor))
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

  if (recorte.length) {
    ficha.implicados = recorte;
    fuentes.implicados = "Hudl: las acciones por jugador (sesión de Wyscout) entre el origen y el gol.";
  }

  if (ficha.origen) fuentes.origen = ficha.origen === "abp" ? "Sale de la tipología." : `Hudl: ${esTransicion ? (recupera ? `robo de ${nombre(recupera)}` : `pérdida de ${nombre(perdidaOtro)}`) : "inicio de la posesión"}${zona ? ` en ${TXT_TERCIO[zona.tercio]}` : ""}.`;

  /* ---------------- la frase ---------------- */
  const goleador = remate && T.esNuestro(remate.jug) && aFavor ? nombre(remate) : "";
  const tras = `${ficha.segundos !== undefined ? ` a los ${ficha.segundos} s` : ""}${ficha.pases ? ` con ${ficha.pases} ${ficha.pases === 1 ? "pase" : "pases"}` : ""}`;
  const marca = goleador ? `; marca ${goleador}` : "";
  let frase;

  if (esAbp) frase = `${motivo.replace(/\.$/, "")}${aFavor ? marca : ""}.`;
  else if (propia) frase = `Gol en propia puerta${remate && tiene(remate, "Own goal") ? ` de ${nombre(remate)}` : ""}${clave && T.esNuestro(clave.jug) ? ` tras la pérdida de ${nombre(clave)}` : clave ? ` tras el robo de ${nombre(clave)}` : ""}${zona ? ` en ${enZona(zona)}` : ""}, a los ${ficha.segundos} s.`;
  else frase = `${motivo.replace(/\.$/, "")}${tras && !esTransicion && tipo !== "caida" ? `; gol${tras}` : ""}${marca}.`;

  ficha.motivo = frase.replace(/\s+/g, " ");
  ficha.fuentes = fuentes;

  return { tipo, motivo, ficha, fuenteTipo };
}

/** El corte del gol en `informe-clips:jNN` (el del vídeo del informe): el del lado y el minuto (±1). */
function cortePrevio(cortes, lado, g) {
  if (!Array.isArray(cortes)) return undefined;

  const tipoCorte = lado === "nuestro" ? "gol" : "gol-contra";
  const minuto = g.min + g.extra;

  return cortes
    .filter((c) => c?.tipo === tipoCorte && c.url)
    .map((c) => {
      const m = leeMinuto(c.minuto);

      return { c, d: Math.abs(m.min + m.extra - minuto) };
    })
    .filter((x) => x.d <= 1)
    .sort((a, b) => a.d - b.d)[0]?.c;
}

/** Saca del vídeo de Hudl los cortes de gol que faltan y los sube al bucket (`performance/2026/goles/clips`). */
async function cortaLosQueFaltan(supabase, porCortar, urlCorte) {
  const { abreHudl } = await import("./hudl-chrome.mjs");
  const { preparaCortes } = await import("./hudl-corte.mjs");
  const carpetaLocal = path.join(RAIZ, ".cache", "goles", "cortes");
  let hechos = 0;

  console.log(`Cortes: ${porCortar.length} por sacar del vídeo de Hudl…`);

  const nav = await abreHudl();

  try {
    const porCarpeta = new Map();

    for (const x of porCortar) porCarpeta.set(x.carpeta, [...(porCarpeta.get(x.carpeta) ?? []), x]);

    for (const [carpeta, lista] of porCarpeta) {
      let corta;

      try {
        ({ corta } = await preparaCortes(nav, carpeta));
      } catch (e) {
        console.log(`  ${path.basename(carpeta)}: no se puede abrir el vídeo (${e?.message ?? e})`);
        continue;
      }

      for (const x of lista) {
        const fichero = path.join(carpetaLocal, x.nombre);
        const bien = await corta(Math.max(0, x.desde), x.dura, fichero).catch(() => false);

        if (!bien) {
          console.log(`  ${x.nombre}: ROTO`);
          continue;
        }

        if (SOLO_VER) {
          console.log(`  ${x.nombre}: cortado (en seco, no se sube)`);
          continue;
        }

        const { error } = await supabase.storage.from(BUCKET).upload(`${CARPETA_CORTES}/${x.nombre}`, fs.readFileSync(fichero), { contentType: "video/mp4", upsert: true });

        if (error) {
          console.log(`  ${x.nombre}: no se sube (${error.message})`);
          continue;
        }

        x.ficha.video = urlCorte(x.nombre);
        hechos += 1;
      }
    }
  } finally {
    await nav.cierra();
  }

  console.log(`Cortes: ${hechos} de ${porCortar.length} subidos.`);
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
