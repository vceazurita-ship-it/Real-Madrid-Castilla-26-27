/*
|--------------------------------------------------------------------------
| LLEVAR LOS VÍDEOS DE SUPABASE A BACKBLAZE B2 (11/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/migra-videos-b2.mjs            enseña qué movería y cuánto libera
|   node scripts/migra-videos-b2.mjs --copiar   copia a B2 y comprueba cada copia
|   node scripts/migra-videos-b2.mjs --enlaces  cambia los enlaces (documentos de
|                                               Supabase y ficheros del repo) a
|                                               /api/video/…, SÓLO si la web ya
|                                               sirve un vídeo por esa ruta
|   node scripts/migra-videos-b2.mjs --borrar   borra de Supabase SÓLO lo que ya
|                                               está en B2 con el mismo tamaño y
|                                               ningún documento ni fichero cita
|                                               ya por su enlace de Supabase
|
| Entran los vídeos de: cortes (`/clips/`), vídeo del informe
| (`2026/informes/video`), ABP para jugadores (`abp/video-jugadores`) y
| entrenos. NO entran los adjuntos de correo (`2026/informes/<día>/`: los
| enlaces de los correos ya enviados se romperían; caducan solos a los 30
| días) ni los vídeos de las carpetas de rivales (las lista su pantalla).
| Se puede repetir: lo que ya está en B2 no se vuelve a subir.
*/

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const b2 = require("./b2.cjs");

const COPIAR = process.argv.includes("--copiar");
const BORRAR = process.argv.includes("--borrar");
const ENLACES = process.argv.includes("--enlaces");
const BUCKET = "performance";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = entorno();

if (!env) throw new Error("Faltan las llaves de Supabase en .env.local");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/`;

const entra = (ruta) =>
  b2.esVideo(ruta) && (/\/clips\//.test(ruta) || ruta.startsWith("2026/informes/video/") || ruta.startsWith("abp/video-jugadores/") || ruta.startsWith("2026/entrenos/"));

/* ---- lo que hay en Supabase ---- */
const ficheros = [];

async function recorre(prefijo) {
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset: desde });

    if (error) throw new Error(error.message);

    for (const it of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;

      if (it.id === null) await recorre(ruta);
      else ficheros.push({ ruta, bytes: Number(it.metadata?.size ?? 0), tipo: it.metadata?.mimetype ?? "video/mp4" });
    }

    if ((data ?? []).length < 1000) break;
  }
}

await recorre("");

const mover = ficheros.filter((f) => entra(f.ruta));
const mb = (b) => (b / 1048576).toFixed(1);
const total = ficheros.reduce((s, f) => s + f.bytes, 0);
const deMover = mover.reduce((s, f) => s + f.bytes, 0);

console.log(`Supabase: ${mb(total)} MB en ${ficheros.length} ficheros`);
console.log(`A Backblaze: ${mover.length} vídeos · ${mb(deMover)} MB → quedaría ${mb(total - deMover)} MB`);

if (!COPIAR && !BORRAR && !ENLACES) {
  console.log("Sólo se enseña. Fases: --copiar, luego --enlaces, luego --borrar");
  process.exit(0);
}

if (!b2.configurado()) throw new Error("Faltan B2_KEY_ID, B2_APP_KEY y B2_BUCKET en .env.local");

const enB2 = await b2.lista();

/* Las dos formas en que puede estar escrito el enlace de Supabase. */
const enlacesDe = (ruta) => [...new Set([BASE + ruta, BASE + encodeURI(ruta), BASE + ruta.split("/").map(encodeURIComponent).join("/")])];

/* ---- copiar ---- */
const mapa = new Map();
let copiados = 0;
let fallos = 0;

for (const f of mover) {
  const nueva = await b2.urlPublica(f.ruta);

  if (COPIAR && enB2.get(f.ruta) !== f.bytes) {
    const { data, error } = await sb.storage.from(BUCKET).download(f.ruta);

    if (error) {
      fallos += 1;
      console.warn(`  no baja ${f.ruta}: ${error.message}`);
      continue;
    }

    try {
      await b2.sube(f.ruta, Buffer.from(await data.arrayBuffer()), f.tipo);
    } catch (error) {
      fallos += 1;
      console.warn(`  no sube ${f.ruta}: ${error.message}`);
      continue;
    }

    /* La copia se comprueba en B2: existe y pesa lo mismo. */
    if (!(await b2.comprueba(f.ruta, f.bytes))) {
      fallos += 1;
      console.warn(`  copia mala ${f.ruta}`);
      continue;
    }

    enB2.set(f.ruta, f.bytes);
    copiados += 1;
    if (copiados % 25 === 0) console.log(`  ${copiados} copiados…`);
  }

  if (enB2.get(f.ruta) === f.bytes) for (const vieja of enlacesDe(f.ruta)) mapa.set(vieja, nueva);
}

console.log(`Copiados ahora: ${copiados} · fallos: ${fallos} · en B2 con su tamaño: ${mover.filter((f) => enB2.get(f.ruta) === f.bytes).length}/${mover.length}`);

const cambia = (texto) => {
  let n = 0;
  const salida = texto.replace(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/performance\/[^"'\s)\\<>]+/g, (url) => {
    const nueva = mapa.get(url);

    if (!nueva) return url;
    n += 1;

    return nueva;
  });

  return { salida, n };
};

/* ---- los documentos de Supabase ---- */
const docs = [];

for (let d = 0; ; d += 100) {
  const { data, error } = await sb.from("app_documents").select("key,data,updated_at").range(d, d + 99);

  if (error) throw new Error(error.message);
  docs.push(...data);
  if (data.length < 100) break;
}

/* ---- los ficheros del repo que llevan enlaces ---- */
const delRepo = execFileSync("git", ["grep", "-l", "supabase.co/storage/v1/object/public/performance/", "--", "lib", "app", "components", "public", "scripts"], { cwd: RAIZ, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !f.endsWith("migra-videos-b2.mjs") && !f.endsWith("sw-harness.mjs"));

if (ENLACES) {
  /* La web tiene que servir ya los vídeos por la ruta nueva (Render con las llaves de B2). */
  const prueba = mover.find((f) => enB2.get(f.ruta) === f.bytes);
  const r = prueba ? await fetch(await b2.urlPublica(prueba.ruta), { method: "HEAD", redirect: "follow" }) : null;

  if (!r?.ok || Number(r.headers.get("content-length")) !== prueba.bytes) {
    console.error(`La web aún no sirve los vídeos de B2 (${r?.status ?? "sin copias"}): pon B2_KEY_ID, B2_APP_KEY y B2_BUCKET en Render y espera al despliegue. No se cambia nada.`);
    process.exit(1);
  }
}

if (ENLACES) {
  let docsCambiados = 0;
  let enlaces = 0;

  for (const doc of docs) {
    const { salida, n } = cambia(JSON.stringify(doc.data));

    if (!n) continue;

    /* Sólo si nadie lo ha tocado entre medias. */
    const { error, count } = await sb
      .from("app_documents")
      .update({ data: JSON.parse(salida), updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("key", doc.key)
      .eq("updated_at", doc.updated_at);

    if (error || !count) console.warn(`  ${doc.key}: no se ha cambiado (${error?.message ?? "lo han tocado entre medias; repite"})`);
    else {
      docsCambiados += 1;
      enlaces += n;
    }
  }

  let ficherosCambiados = 0;

  for (const rel of delRepo) {
    const fichero = path.join(RAIZ, rel);
    const { salida, n } = cambia(fs.readFileSync(fichero, "utf8"));

    if (!n) continue;
    fs.writeFileSync(fichero, salida);
    ficherosCambiados += 1;
    enlaces += n;
  }

  console.log(`Enlaces cambiados: ${enlaces} (${docsCambiados} documentos, ${ficherosCambiados} ficheros del repo)`);
}

if (BORRAR) {
  /* Se vuelve a leer todo: nada se borra si algo aún cita el enlace de Supabase. */
  const citado = new Set();
  const textos = [...docs.map((d) => JSON.stringify(d.data)), ...delRepo.map((rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8"))];

  for (const f of mover) if (textos.some((t) => enlacesDe(f.ruta).some((e) => t.includes(e)))) citado.add(f.ruta);

  const borrables = mover.filter((f) => enB2.get(f.ruta) === f.bytes && !citado.has(f.ruta)).map((f) => f.ruta);

  console.log(`Se pueden borrar de Supabase: ${borrables.length} · aún citados por su enlace viejo: ${citado.size}`);

  for (let i = 0; i < borrables.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET).remove(borrables.slice(i, i + 100));

    if (error) throw new Error(error.message);
  }

  console.log(`Borrados: ${borrables.length}`);
}
