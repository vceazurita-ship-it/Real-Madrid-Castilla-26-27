/*
|--------------------------------------------------------------------------
| COPIA DE LOS DATOS ENTRE POSTGRES (14/11/2026)
|--------------------------------------------------------------------------
|
| Para la reserva de lib/datos/cliente.cjs: copia app_documents,
| general_seasons y performance_seasons de un Postgres a otro.
|
|   node scripts/datos-copia.mjs --desde <url|fichero.json> --hacia <url> [--hacer]
|
| --desde  una URL postgres:// (Supabase directo) o un .json exportado del
|          SQL Editor ({ app_documents: [...], general_seasons: [...], ... }).
| --hacia  la URL del Postgres de destino. Crea las tablas si no están
|          (supabase/reserva-esquema.sql).
| --hacer  sin esto sólo cuenta lo que copiaría (en seco).
|
| Nunca borra en el destino: inserta y, si la fila ya está, se queda con la
| de updated_at más nuevo. Así sirve también para la vuelta a Supabase.
*/

import fs from "node:fs";
import postgres from "postgres";

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};
const DESDE = arg("--desde");
const HACIA = arg("--hacia");
const HACER = process.argv.includes("--hacer");
if (!DESDE || !HACIA) {
  console.error("Uso: node scripts/datos-copia.mjs --desde <url|fichero.json> --hacia <url> [--hacer]");
  process.exit(2);
}

const ssl = (u) => (/localhost|127\.0\.0\.1/.test(u) ? false : "require");
const abre = (u) => postgres(u, { max: 2, ssl: ssl(u), prepare: false, connect_timeout: 20, onnotice: () => {} });

const TABLAS = ["app_documents", "general_seasons", "performance_seasons"];

async function leeOrigen() {
  if (!/^postgres(ql)?:\/\//.test(DESDE)) {
    const j = JSON.parse(fs.readFileSync(DESDE, "utf8"));
    return Object.fromEntries(TABLAS.map((t) => [t, Array.isArray(j[t]) ? j[t] : []]));
  }
  const sql = abre(DESDE);
  const salida = {};
  for (const t of TABLAS) {
    try {
      salida[t] = [...(await sql.unsafe(`select * from public.${t}`))];
    } catch (e) {
      console.log(`  ${t}: no se puede leer (${e.message}); se salta`);
      salida[t] = [];
    }
  }
  await sql.end();
  return salida;
}

const origen = await leeOrigen();
for (const t of TABLAS) {
  const mb = Buffer.byteLength(JSON.stringify(origen[t])) / 1e6;
  console.log(`${t}: ${origen[t].length} filas (${mb.toFixed(1)} MB)`);
}
if (!HACER) {
  console.log("En seco: añade --hacer para copiar.");
  process.exit(0);
}

const destino = abre(HACIA);
await destino.unsafe(fs.readFileSync(new URL("../supabase/reserva-esquema.sql", import.meta.url), "utf8"));

const texto = (v) => (v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));
const fecha = (v) => (v ? new Date(v).toISOString() : null);

let docs = 0;
for (const f of origen.app_documents) {
  await destino.unsafe(
    `insert into app_documents (key, kind, data, updated_at) values ($1, $2, $3::text::jsonb, coalesce($4::timestamptz, now()))
     on conflict (key) do update set kind = excluded.kind, data = excluded.data, updated_at = excluded.updated_at
     where app_documents.updated_at <= excluded.updated_at`,
    [f.key, f.kind ?? "generic", texto(f.data) ?? "{}", fecha(f.updated_at)],
  );
  docs += 1;
  if (docs % 200 === 0) console.log(`  documentos: ${docs}`);
}

for (const t of ["general_seasons", "performance_seasons"]) {
  const ya = new Set([...(await destino.unsafe(`select season, updated_at from ${t}`))].map((r) => `${r.season}|${fecha(r.updated_at)}`));
  let n = 0;
  for (const f of origen[t]) {
    if (ya.has(`${f.season}|${fecha(f.updated_at)}`)) continue;
    await destino.unsafe(
      `insert into ${t} (season, data, created_at, updated_at) values ($1, $2::text::jsonb, coalesce($3::timestamptz, now()), $4::timestamptz)`,
      [f.season, texto(f.data) ?? "[]", fecha(f.created_at ?? f.updated_at), fecha(f.updated_at)],
    );
    n += 1;
  }
  console.log(`${t}: ${n} filas nuevas`);
}

const [{ n }] = await destino.unsafe("select count(*)::int as n from app_documents");
console.log(`Hecho: ${docs} documentos copiados; el destino tiene ${n}.`);
await destino.end();
