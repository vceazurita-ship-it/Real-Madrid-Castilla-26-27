/*
|--------------------------------------------------------------------------
| OCUPACIÓN DE SUPABASE FRENTE AL PLAN GRATIS (07/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/ocupacion-supabase.mjs          enseña lo que ocupa cada carpeta
|   node scripts/ocupacion-supabase.mjs --json   lo mismo en JSON (para el vigía)
|
| Sólo lee. Plan gratis: 1 GB de ficheros y 500 MB de base de datos. Avisa al
| pasar del 80 % (ver lib/supabase-ocupacion.ts, que hace la misma cuenta en la
| web y la enseña en Ajustes).
*/

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");
const { createClient } = require("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const BUCKET = "performance";
const TOPE_FICHEROS_MB = 1024;
const TOPE_BASE_MB = 500;
const env = entorno();

if (!env) throw new Error("Faltan las llaves de Supabase en .env.local");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function lista(prefijo) {
  const salida = [];

  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset: off });

    if (error) throw new Error(`${prefijo || "/"}: ${error.message}`);

    for (const it of data) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;

      if (it.id === null) salida.push(...(await lista(ruta)));
      else salida.push({ ruta, mb: (it.metadata?.size ?? 0) / 1048576, fecha: it.created_at });
    }

    if (data.length < 1000) break;
  }

  return salida;
}

const ficheros = await lista("");
const porCarpeta = new Map();

for (const f of ficheros) {
  const partes = f.ruta.split("/");
  const carpeta = partes.slice(0, Math.min(partes.length - 1, 3)).join("/") || "(raíz)";
  const c = porCarpeta.get(carpeta) ?? { mb: 0, n: 0 };

  c.mb += f.mb;
  c.n += 1;
  porCarpeta.set(carpeta, c);
}

/* La base: lo que pesan los documentos en JSON (la parte que crece). */
const docs = [];

for (let d = 0; ; d += 100) {
  const { data, error } = await sb.from("app_documents").select("key,data").range(d, d + 99);

  if (error) throw new Error(error.message);

  docs.push(...data.map((x) => ({ key: x.key, mb: Buffer.byteLength(JSON.stringify(x.data ?? null)) / 1048576 })));

  if (data.length < 100) break;
}

const totalFicheros = ficheros.reduce((s, f) => s + f.mb, 0);
const totalDocs = docs.reduce((s, d) => s + d.mb, 0);
const resultado = {
  ficheros: { mb: +totalFicheros.toFixed(1), tope: TOPE_FICHEROS_MB, n: ficheros.length },
  documentos: { mb: +totalDocs.toFixed(1), tope: TOPE_BASE_MB, n: docs.length },
  carpetas: [...porCarpeta.entries()].map(([carpeta, c]) => ({ carpeta, mb: +c.mb.toFixed(1), n: c.n })).sort((a, b) => b.mb - a.mb),
  grandes: ficheros.sort((a, b) => b.mb - a.mb).slice(0, 25).map((f) => ({ ruta: f.ruta, mb: +f.mb.toFixed(1), fecha: f.fecha?.slice(0, 10) })),
  docsGrandes: docs.sort((a, b) => b.mb - a.mb).slice(0, 15).map((d) => ({ key: d.key, mb: +d.mb.toFixed(2) })),
};

if (process.argv.includes("--json")) console.log(JSON.stringify(resultado));
else {
  console.log(`Ficheros: ${resultado.ficheros.mb} MB de ${TOPE_FICHEROS_MB} (${Math.round((totalFicheros / TOPE_FICHEROS_MB) * 100)} %) · ${ficheros.length} ficheros`);
  console.log(`Documentos: ${resultado.documentos.mb} MB de ${TOPE_BASE_MB} (${Math.round((totalDocs / TOPE_BASE_MB) * 100)} %) · ${docs.length}`);
  console.log("\nPor carpeta:");
  for (const c of resultado.carpetas) console.log(`  ${String(c.mb).padStart(7)} MB  ${String(c.n).padStart(4)}  ${c.carpeta}`);
  console.log("\nLos más grandes:");
  for (const f of resultado.grandes) console.log(`  ${String(f.mb).padStart(6)} MB  ${f.fecha}  ${f.ruta}`);
  console.log("\nDocumentos más grandes:");
  for (const d of resultado.docsGrandes) console.log(`  ${String(d.mb).padStart(6)} MB  ${d.key}`);
}
