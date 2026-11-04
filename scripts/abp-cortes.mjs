/**
 * EL VÍDEO DE CADA ACCIÓN A BALÓN PARADO Y LA REVISIÓN DE LAS HOJAS (04/11/2026).
 *
 *   node scripts/abp-cortes.mjs [--jornada N] [--cortes] [--en-seco]
 *
 * Para cada partido de liga con timeline de Hudl (`PARTIDOS/ANALISIS/J.. ` o
 * `HUDL <fecha>`): las filas de nuestras hojas de ABP (piezas ofensivo y
 * defensivo: córners, faltas y penaltis) casadas con su momento de Hudl
 * (`lib/abp/cortes-abp.ts`). De cada una sale el segundo del vídeo de Hudl
 * («Abrir en Hudl · mm:ss») y su corte: el de `informe-clips:jNN` → `abp` si
 * ya estaba y, si no, uno propio en `performance/2026/abp/clips/jNN/` (con
 * `--cortes`, de uno en uno, con el Chrome del club; lo ya subido no se
 * rehace). Todo va al documento `abp:cortes`, que leen /setpieces y
 * /setpieces_def.
 *
 * Además REVISA las hojas contra Hudl y BeSoccer y lo dice en el registro
 * (no escribe en ellas): filas sin momento, córners y penaltis de Hudl sin
 * fila, goles a balón parado que la hoja no recoge, marcador que no cuadra
 * con los goles del partido y celdas incoherentes (remate «No» con tipo de
 * remate, minuto imposible para su parte…).
 *
 * `--en-seco`: revisa y cuenta, sin cortar ni escribir nada.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { publicada } = require("./partido/comun.cjs");
const { entorno, salir } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { filasAbpDelPartido, momentosAbpDeHudl, casaConHudl, minutoDeJuego, clavesEnOrden, esGolDeLaAccion, DOC_CORTES_ABP } = require("../lib/abp/cortes-abp.ts");

const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

const SOLO = Number(valor("--jornada")) || null;
const CORTAR = bandera("--cortes");
const EN_SECO = bandera("--en-seco");
const BUCKET = "performance";
const CARPETA_BUCKET = "2026/abp/clips";
const CACHE = path.join(REPO, ".cache", "abp", "cortes");

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** La carpeta de los análisis de partido, se ejecute desde donde se ejecute (también desde un worktree). */
function carpetaAnalisis() {
  for (let d = REPO, i = 0; i < 6; i += 1, d = path.dirname(d)) {
    const c = path.join(d, "..", "..", "PARTIDOS", "ANALISIS");

    if (fs.existsSync(c)) return c;
  }

  return null;
}

/** Las llaves de Supabase: `.env.local` del repo o, si no está (un worktree), la del repo de arriba. */
function llaves() {
  const env = entorno();

  if (env) return env;

  for (let d = path.dirname(REPO), i = 0; i < 5; i += 1, d = path.dirname(d)) {
    const f = path.join(d, ".env.local");

    if (!fs.existsSync(f)) continue;

    const e = {};

    for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);

      if (m) e[m[1]] = m[2].trim();
    }

    if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) return e;
  }

  return null;
}

/** Los partidos con timeline: carpeta, jornada y vídeo de Hudl. La fecha del título de Hudl casa con el partido de BeSoccer (±2 días). */
function partidosConTimeline(analisis, nuestros) {
  const salida = new Map();

  for (const d of fs.readdirSync(analisis, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;

    const carpeta = path.join(analisis, d.name);

    if (!fs.existsSync(path.join(carpeta, "timeline-hudl.json")) || !fs.existsSync(path.join(carpeta, "video-hudl.json"))) continue;

    const video = JSON.parse(fs.readFileSync(path.join(carpeta, "video-hudl.json"), "utf8"));
    const fecha = String(video.titulo ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const partidoJson = path.join(carpeta, "partido.json");
    const jornada = fs.existsSync(partidoJson)
      ? JSON.parse(fs.readFileSync(partidoJson, "utf8")).jornada
      : nuestros.find((p) => fecha && Math.abs(Date.parse(p.fecha) - Date.parse(fecha)) <= 2 * 86_400_000)?.jornada;

    if (!jornada) continue;

    /* La carpeta del análisis («J10 …») manda sobre la copia suelta «HUDL <fecha>» del mismo partido. */
    if (salida.has(jornada) && !/^J\d/.test(d.name)) continue;

    salida.set(jornada, { jornada, carpeta, video, tieneHls: fs.existsSync(path.join(carpeta, "hls.json")) });
  }

  return [...salida.values()].sort((a, b) => a.jornada - b.jornada);
}

/* ------------------------------ la revisión ------------------------------ */

function revisa(j, crudas, filas, momentos, periodos, cortadas, sinCorte, partido) {
  const avisos = [];
  const di = (t) => avisos.push(t);
  const usados = new Set(cortadas.map((c) => c.ini));

  for (const f of sinCorte) di(`fila sin momento en Hudl: ${f.lado === "favor" ? "a favor" : "en contra"} ${f.parte}.ª ${f.minuto}' ${f.accion}`);

  for (const m of momentos) {
    if (usados.has(m.ini)) continue;

    const jm = minutoDeJuego(m.ini, periodos);
    const quien = m.propio ? "a favor" : "en contra";

    if (/Corners$/.test(m.codigo)) di(`córner de Hudl sin fila: ${quien} ${jm.parte}.ª ${jm.minuto}' (vídeo ${reloj(m.ini)})`);
    else if (m.penalti) di(`penalti de Hudl sin fila: ${quien} ${jm.parte}.ª ${jm.minuto}' (vídeo ${reloj(m.ini)})`);
    else if (/Free kicks$/.test(m.codigo) && m.tercio === "Final third") di(`falta al área en Hudl sin fila (puede ser de fuera de Z1-Z6): ${quien} ${jm.parte}.ª ${jm.minuto}' (vídeo ${reloj(m.ini)})`);
  }

  /* Goles: los de la hoja contra los de BeSoccer. */
  if (partido) {
    const somosLocal = /castilla/i.test(partido.local);
    const golesHoja = filas.filter((f) => esGolDeLaAccion(f));

    for (const f of golesHoja) {
      const hay = partido.goles.some((g) => (g.lado === "local") === somosLocal === (f.lado === "favor") && Math.abs(g.min + (g.extra || 0) - f.minuto) <= 4);

      if (!hay) di(`la hoja da gol (${f.lado === "favor" ? "a favor" : "en contra"} ${f.minuto}' ${f.accion}) y BeSoccer no tiene ese gol`);
    }

    for (const g of partido.goles.filter((x) => x.tipo === "penalti")) {
      const nuestro = (g.lado === "local") === somosLocal;
      const min = g.min + (g.extra || 0);

      if (!filas.some((f) => f.clase === "penalti" && (f.lado === "favor") === nuestro && Math.abs(f.minuto - min) <= 3)) di(`gol de penalti de BeSoccer sin fila: ${nuestro ? "a favor" : "en contra"} ${min}' ${g.jugador}`);
    }

    /* El marcador de la hoja ofensiva, contra los goles anteriores a la acción. */
    for (const f of crudas.favor) {
      const min = Number(f.Minuto);

      if (!min || f["Resultado RMC"] === undefined || f["Resultado RMC"] === "") continue;

      const parte = min > 50 ? 2 : /2/.test(f.Tiempo) ? 2 : 1;
      const antes = partido.goles.filter((g) => g.parte < parte || (g.parte === parte && g.min + (g.extra || 0) < min));
      const gf = antes.filter((g) => (g.lado === "local") === somosLocal).length;

      if (Number(f["Resultado RMC"]) !== gf || Number(f["Resultado RIVAL"]) !== antes.length - gf) di(`marcador: ${min}' ${f.Tipo_Accion} lleva ${f["Resultado RMC"]}-${f["Resultado RIVAL"]} y por los goles iba ${gf}-${antes.length - gf}`);
    }
  }

  /* Celdas que no casan entre sí. */
  for (const [lado, lista] of Object.entries(crudas)) {
    for (const f of lista) {
      const min = Number(f.Minuto || f.MINUTO);
      const id = `${lado === "favor" ? "a favor" : "en contra"} ${f.Tiempo} ${f.Minuto || f.MINUTO || "sin minuto"}' ${f.Tipo_Accion}`;
      const remate = /^s/i.test(f.Remate ?? "");
      const tipo = /limpio|forzado/i.test(f.Tipo_Remate ?? "");

      if (!f.Minuto && !f.MINUTO) di(`sin minuto: ${id}`);
      if (/1/.test(f.Tiempo ?? "") && min > 60) di(`minuto imposible para la 1.ª parte: ${id}`);
      if (/2/.test(f.Tiempo ?? "") && min && min < 46) di(`minuto imposible para la 2.ª parte: ${id}`);
      if (remate !== tipo) di(`remate «${f.Remate}» con tipo de remate «${f.Tipo_Remate || "vacío"}»: ${id}`);
      if (/^no$/i.test(f.Remate ?? "") && Number(String(f.xG).replace(",", ".")) > 0) di(`xG ${f.xG} sin remate: ${id}`);
    }
  }

  return avisos;
}

/* ------------------------------ el vídeo ------------------------------ */

const nombreCorte = (a) => `${a.lado}-${String(a.minuto).padStart(3, "0")}-${sinTildes(a.accion).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${a.clave.split("#")[1]}.mp4`;

async function main() {
  const env = llaves();
  const analisis = carpetaAnalisis();

  if (!env) return fin(2, "faltan las claves de Supabase en .env.local");
  if (!analisis) return fin(2, "no encuentro PARTIDOS/ANALISIS");

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const [of, def] = [await publicada("piezasOf"), await publicada("piezasDef")];
  const { data: golesDoc } = await supabase.from("app_documents").select("data").eq("key", "goles:analisis").maybeSingle();
  const nuestros = (golesDoc?.data?.partidos ?? []).filter((p) => /castilla/i.test(`${p.local} ${p.visitante}`));
  const { data: clipsDocs } = await supabase.from("app_documents").select("key,data").like("key", "informe-clips:%");
  const clipsDe = new Map((clipsDocs ?? []).map((d) => [Number(String(d.key).match(/j(\d+)$/)?.[1]), d.data?.abp ?? []]));
  const { data: previo } = await supabase.from("app_documents").select("data").eq("key", DOC_CORTES_ABP).maybeSingle();
  const doc = { actualizado: new Date().toISOString(), jornadas: { ...(previo?.data?.jornadas ?? {}) }, revision: { ...(previo?.data?.revision ?? {}) } };
  const porCortar = [];
  const tabla = [];

  for (const p of partidosConTimeline(analisis, nuestros)) {
    if (SOLO && p.jornada !== SOLO) continue;

    const j = p.jornada;
    const clave = `j${String(j).padStart(2, "0")}`;
    const etiqueta = `LIGA ${String(j).padStart(2, "0")}`;
    const timeline = JSON.parse(fs.readFileSync(path.join(p.carpeta, "timeline-hudl.json"), "utf8"));
    const filas = filasAbpDelPartido(of, def, j);
    const { momentos, periodos } = momentosAbpDeHudl(timeline);
    const { cortadas, sinCorte } = casaConHudl(filas, momentos, periodos);
    const crudas = { favor: of.filter((f) => f.JORNADA === etiqueta), contra: def.filter((f) => f.JORNADA === etiqueta) };
    const partido = nuestros.find((x) => x.jornada === j);
    const avisos = revisa(j, crudas, filas, momentos, periodos, cortadas, sinCorte, partido);

    /* Las claves, en el orden de la hoja (como las calcula la pantalla). */
    const enOrden = [...filas].sort((a, b) => (a.lado === b.lado ? a.orden - b.orden : a.lado === "favor" ? -1 : 1));
    const claves = new Map(clavesEnOrden(enOrden, (f) => ({ lado: f.lado, jornada: j, minuto: f.minuto, accion: f.accion })).map((k, i) => [enOrden[i], k]));

    /* Los cortes del informe del partido, si ya están: por lado, minuto y acción, una vez cada uno. */
    const delInforme = [...(clipsDe.get(j) ?? [])];
    const { data: enBucket } = await supabase.storage.from(BUCKET).list(`${CARPETA_BUCKET}/${clave}`, { limit: 1000 });
    const yaSubidos = new Set((enBucket ?? []).map((f) => f.name));
    const urlDe = (nombre) => supabase.storage.from(BUCKET).getPublicUrl(`${CARPETA_BUCKET}/${clave}/${nombre}`).data.publicUrl;

    const acciones = cortadas.map((f) => {
      const a = { clave: claves.get(filas.find((x) => x.lado === f.lado && x.orden === f.orden)), lado: f.lado, parte: f.parte, minuto: f.minuto, accion: f.accion, seg: Math.max(0, Math.round(f.ini - 1)) };
      const i = delInforme.findIndex((c) => c.url && (c.de === "nosotros") === (f.lado === "favor") && c.minuto === `${f.minuto}'` && sinTildes(c.accion) === sinTildes(f.accion));
      const nombre = nombreCorte(a);

      if (i >= 0) a.video = delInforme.splice(i, 1)[0].url;
      else if (yaSubidos.has(nombre)) a.video = urlDe(nombre);
      else if (p.tieneHls) porCortar.push({ a, carpeta: p.carpeta, clave, nombre, desde: Math.max(0, f.ini - 1), dura: f.remate ? 10 : Math.min(10, Math.max(8, f.fin - f.ini + 3)) });

      return a;
    });

    doc.jornadas[String(j)] = { jornada: j, rival: partido ? (/castilla/i.test(partido.local) ? partido.visitante : partido.local) : "", hudl: p.video.url, acciones };
    doc.revision[String(j)] = avisos;
    tabla.push({ j, filas: filas.length, casadas: cortadas.length, conVideo: acciones.filter((a) => a.video).length, avisos: avisos.length });

    console.log(`\nJ${j} (${path.basename(p.carpeta)}): ${filas.length} filas, ${cortadas.length} con su momento de Hudl, ${acciones.filter((a) => a.video).length} ya con corte`);
    for (const a of avisos) console.log(`  · ${a}`);
  }

  /* Los cortes que faltan, de uno en uno. */
  if (porCortar.length && CORTAR && !EN_SECO) {
    const { abreHudl } = await import("./hudl-chrome.mjs");
    const { preparaCortes } = await import("./hudl-corte.mjs");
    const nav = await abreHudl();

    try {
      const porCarpeta = new Map();

      for (const x of porCortar) porCarpeta.set(x.carpeta, [...(porCarpeta.get(x.carpeta) ?? []), x]);

      for (const [carpeta, lista] of porCarpeta) {
        let corta;

        try {
          ({ corta } = await preparaCortes(nav, carpeta, { anchoMax: 1280 }));
        } catch (e) {
          console.log(`  ${path.basename(carpeta)}: no se abre el vídeo (${String(e?.message ?? e).slice(0, 100)})`);
          continue;
        }

        for (const x of lista) {
          const fichero = path.join(CACHE, x.clave, x.nombre);
          const bien = await corta(x.desde, x.dura, fichero).catch(() => false);

          if (!bien) {
            console.log(`  ${x.clave}/${x.nombre}: ROTO`);
            continue;
          }

          const { error } = await supabase.storage.from(BUCKET).upload(`${CARPETA_BUCKET}/${x.clave}/${x.nombre}`, fs.readFileSync(fichero), { contentType: "video/mp4", upsert: true });

          if (error) {
            console.log(`  ${x.clave}/${x.nombre}: no sube (${error.message})`);
            continue;
          }

          x.a.video = supabase.storage.from(BUCKET).getPublicUrl(`${CARPETA_BUCKET}/${x.clave}/${x.nombre}`).data.publicUrl;
          console.log(`  ${x.clave}/${x.nombre}: cortado y subido`);
        }
      }
    } finally {
      await nav.cierra();
    }
  } else if (porCortar.length) console.log(`\nCortes: faltan ${porCortar.length} (se sacan con --cortes).`);

  console.log("\nJornada · filas · con momento de Hudl · con corte · avisos");
  for (const t of tabla) console.log(`J${t.j} · ${t.filas} · ${t.casadas} · ${doc.jornadas[String(t.j)].acciones.filter((a) => a.video).length} · ${t.avisos}`);

  if (EN_SECO) return fin(0, `en seco: ${tabla.length} partidos revisados, nada escrito`);

  const { error } = await supabase.from("app_documents").upsert({ key: DOC_CORTES_ABP, kind: "abp", data: doc, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return fin(1, `no se escribe ${DOC_CORTES_ABP}: ${error.message}`);

  const total = Object.values(doc.jornadas).reduce((n, x) => n + x.acciones.length, 0);
  const conVideo = Object.values(doc.jornadas).reduce((n, x) => n + x.acciones.filter((a) => a.video).length, 0);

  return fin(0, `${total} acciones a balón parado con su minuto de Hudl, ${conVideo} con su corte, en ${DOC_CORTES_ABP}`);
}

function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  salir(codigo);
}

main().catch((e) => fin(1, String(e?.stack ?? e).slice(0, 400)));
