/*
| EL VÍDEO DE CADA SAQUE DE BANDA (04/11/2026).
|
|   node scripts/banda-cortes.mjs            casa cada fila de las hojas de banda
|                                            con su saque del timeline de Hudl,
|                                            avisa de lo que no cuadra y publica
|                                            `banda:cortes` (con los cortes que
|                                            ya estén en el bucket)
|   node scripts/banda-cortes.mjs --cortes   y además saca del vídeo de Hudl los
|                                            cortes que falten (Chrome del club)
|   node scripts/banda-cortes.mjs --ver      en seco: no sube ni publica nada
|
| Las hojas mandan: aquí no se escribe en ellas. Cada fila se casa con su saque
| de Hudl (`casaSaques`: orden del partido, tiempo y minuto ±1, banda y
| sacador) y de ahí salen el segundo del vídeo («Abrir en Hudl · mm:ss») y el
| corte (3 s antes del saque, 9 después) en el bucket,
| `performance/2026/banda/clips/<jornada>-<of|def>-<segundo>.mp4`. El nombre
| va por el segundo de Hudl: volver a lanzarlo no repite ningún corte.
|
| La pantalla de banda lee `banda:cortes`: por cada fila (jornada, lado y su
| sitio entre las de esa jornada en la hoja) el enlace y el corte. Si una fila
| no casa, no lleva vídeo: nunca se le pone el de otro saque.
*/

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { entorno, salir } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { publicada, reloj } = require("./partido/comun.cjs");
const { partidosHudl, partidoDeJornada, saquesHudl, casaSaques, mismoJugador, minutoDeHoja, nombresEnBucket } = require("./partido/faltas-banda.cjs");

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOLO_VER = process.argv.includes("--ver");
const CORTAR = process.argv.includes("--cortes");

const { DOC_BANDA, claveBanda } = require("../lib/banda/cortes.ts");
const BUCKET = "performance";
const CARPETA_CORTES = "2026/banda/clips";
const ANTES = 3;
const DESPUES = 9;

const jornadaDe = (etiqueta) => Number(String(etiqueta ?? "").match(/^LIGA\s*0*(\d+)/i)?.[1] ?? 0);

async function principal(supabase) {
  /* Qué día se jugó cada jornada: del calendario de goles (BeSoccer). */
  const { data: filaGoles } = await supabase.from("app_documents").select("data").eq("key", "goles:analisis").maybeSingle();
  const fechaDeJornada = new Map();

  for (const p of filaGoles?.data?.partidos ?? []) {
    if (/castilla/i.test(`${p.local} ${p.visitante}`) && p.jornada && p.fecha) fechaDeJornada.set(Number(p.jornada), String(p.fecha).slice(0, 10));
  }

  const partidos = partidosHudl();
  const hojas = { of: await publicada("bandaOf"), def: await publicada("bandaDef") };

  const yaCortados = await nombresEnBucket(supabase, BUCKET, CARPETA_CORTES);
  const urlCorte = (nombre) => supabase.storage.from(BUCKET).getPublicUrl(`${CARPETA_CORTES}/${nombre}`).data.publicUrl;

  const acciones = {};
  const porCortar = [];
  const avisos = [];
  const resumen = [];

  const etiquetas = [...new Set([...hojas.of, ...hojas.def].map((f) => f.JORNADA).filter((j) => jornadaDe(j)))].sort((a, b) => jornadaDe(a) - jornadaDe(b));

  for (const etiqueta of etiquetas) {
    const n = jornadaDe(etiqueta);
    const rival = [...hojas.of, ...hojas.def].find((f) => f.JORNADA === etiqueta)?.Rival ?? "";
    const p = partidoDeJornada(partidos, { fecha: fechaDeJornada.get(n), rival });

    if (!p) {
      resumen.push(`${etiqueta}: sin timeline de Hudl`);
      continue;
    }

    const saques = saquesHudl(p.T);
    const slug = `j${String(n).padStart(2, "0")}`;

    for (const lado of ["of", "def"]) {
      /* `i` es su sitio en la hoja (la clave de la pantalla). Una fila añadida
         después queda al final de la hoja: si todas llevan parte y minuto, se
         casan en el orden del partido. */
      const enHoja = hojas[lado].filter((f) => f.JORNADA === etiqueta).map((f, i) => ({ f, i }));
      const clave = ({ f }) => [Number(String(f.Tiempo).match(/[12]/)?.[0]), minutoDeHoja(f.Minuto)];
      const ordenables = enHoja.every((x) => clave(x).every((v) => Number.isFinite(v)));
      const filasEnOrden = ordenables ? [...enHoja].sort((a, b) => clave(a)[0] - clave(b)[0] || clave(a)[1] - clave(b)[1] || a.i - b.i) : enHoja;
      const filas = filasEnOrden.map((x) => x.f);
      const suyos = saques.filter((s) => s.nuestro === (lado === "of"));
      const { pareja, sobran } = casaSaques(filas, suyos);
      let casadas = 0;

      filasEnOrden.forEach(({ f, i }, k) => {
        const s = pareja[k];

        if (!s) {
          avisos.push(`${etiqueta} ${lado} fila ${i + 1} (${f.Tiempo} ${f.Minuto} ${f.Perfil} ${f.Zona_Saque}): no casa con ningún saque de Hudl`);
          return;
        }

        casadas += 1;

        const seg = Math.round(s.t / 1000);
        const nombre = `${slug}-${lado}-${seg}.mp4`;
        const accion = { jornada: etiqueta, lado, fila: i, tiempo: s.Tiempo, minuto: s.Minuto };

        if (p.video?.url) accion.hudl = { url: p.video.url, seg };
        if (yaCortados.has(nombre)) accion.video = urlCorte(nombre);
        else if (p.conVideo) porCortar.push({ carpeta: p.carpeta, desde: s.t / 1000 - ANTES, dura: ANTES + DESPUES, nombre, accion });

        acciones[claveBanda(etiqueta, lado, i)] = accion;

        /* Lo que no cuadra con el dato, para mirarlo (la hoja manda). */
        const distinto = [];
        const tf = String(f.Tiempo).match(/[12]/)?.[0];
        const mf = minutoDeHoja(f.Minuto);

        if (!tf || !f.Minuto) distinto.push(`sin tiempo/minuto en la hoja (Hudl ${s.Tiempo} ${s.Minuto})`);
        else if (`T${tf}` !== s.Tiempo || (Math.abs(mf - Number(s.Minuto)) > 1 && !((mf === 45 || mf === 90) && Number(s.Minuto) >= mf))) distinto.push(`minuto ${f.Tiempo} ${f.Minuto} / Hudl ${s.Tiempo} ${s.Minuto}`);
        if (f.Perfil !== s.Perfil) distinto.push(`banda «${f.Perfil}» / Hudl «${s.Perfil}»`);
        if (f.Zona_Saque !== s.Zona_Saque) distinto.push(`zona «${f.Zona_Saque}» / Hudl «${s.Zona_Saque}»`);
        if (lado === "of" && f.Sacador && !mismoJugador(f.Sacador, s.sacador)) distinto.push(`sacador «${f.Sacador}» / Hudl «${s.sacador}»`);
        if (lado === "of" && !f.Sacador) distinto.push(`sin sacador (Hudl ${s.sacador})`);

        if (distinto.length) avisos.push(`${etiqueta} ${lado} fila ${i + 1} · Hudl ${reloj(s.t)}: ${distinto.join(" · ")}`);
      });

      for (const s of sobran) avisos.push(`${etiqueta} ${lado}: el saque de Hudl ${reloj(s.t)} (${s.Tiempo} ${s.Minuto}, ${s.sacador}, ${s.Perfil} ${s.Zona_Saque}) no está en la hoja`);

      resumen.push(`${etiqueta} ${lado}: ${casadas}/${filas.length} filas casadas (Hudl ${suyos.length})`);
    }
  }

  if (porCortar.length && CORTAR) await cortaLosQueFaltan(supabase, porCortar, urlCorte);
  else if (porCortar.length) console.log(`Cortes: faltan ${porCortar.length} en el bucket (se sacan con --cortes).`);

  for (const r of resumen) console.log(r);
  for (const a of avisos) console.log(`  AVISO ${a}`);

  const doc = { actualizado: new Date().toISOString(), acciones };
  const total = Object.keys(acciones).length;
  const conVideo = Object.values(acciones).filter((a) => a.video).length;

  if (SOLO_VER) {
    console.log(`RESUMEN: en seco · ${total} saques casados, ${conVideo} con corte; no se publica.`);
    return;
  }

  const { error } = await supabase.from("app_documents").upsert({ key: DOC_BANDA, kind: "banda", data: doc, updated_at: doc.actualizado }, { onConflict: "key" });

  if (error) throw new Error(`no se guarda en Supabase (${error.message})`);

  console.log(`RESUMEN: ${total} saques de banda casados con Hudl, ${conVideo} con su corte; ${avisos.length} avisos.`);
}

/** Saca del vídeo de Hudl los cortes que faltan, de uno en uno, y los sube. */
async function cortaLosQueFaltan(supabase, porCortar, urlCorte) {
  const { abreHudl } = await import("./hudl-chrome.mjs");
  const { preparaCortesLigeros } = await import("./hudl-corte.mjs");
  const carpetaLocal = path.join(RAIZ, ".cache", "banda", "cortes");
  let hechos = 0;

  console.log(`Cortes: ${porCortar.length} por sacar del vídeo de Hudl…`);

  let nav;

  /* Sin el Chrome del club se publica igual, con el enlace a Hudl; los cortes, otro día. */
  try {
    nav = await abreHudl();
  } catch (error) {
    console.log(`Cortes: no se pueden sacar ahora (${error?.message ?? error}).`);
    return;
  }

  try {
    const porCarpeta = new Map();

    for (const x of porCortar) porCarpeta.set(x.carpeta, [...(porCarpeta.get(x.carpeta) ?? []), x]);

    for (const [carpeta, lista] of porCarpeta) {
      let corta;

      try {
        ({ corta } = await preparaCortesLigeros(nav, carpeta));
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

        if (SOLO_VER) continue;

        const { error } = await supabase.storage.from(BUCKET).upload(`${CARPETA_CORTES}/${x.nombre}`, fs.readFileSync(fichero), { contentType: "video/mp4", upsert: true });

        if (error) {
          console.log(`  ${x.nombre}: no se sube (${error.message})`);
          continue;
        }

        x.accion.video = urlCorte(x.nombre);
        hechos += 1;
      }

      console.log(`  ${path.basename(carpeta)}: ${lista.filter((x) => x.accion.video).length} de ${lista.length}`);
    }
  } finally {
    await nav.cierra();
  }

  console.log(`Cortes: ${hechos} de ${porCortar.length} subidos.`);
}

const env = entorno();

if (!env) {
  console.log("RESUMEN: faltan las llaves de Supabase en .env.local");
  salir(1);
} else {
  try {
    await principal(createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }));
  } catch (e) {
    console.log(`RESUMEN: ha fallado (${e?.message ?? e})`);
    salir(1);
  }
}
