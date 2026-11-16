/*
|--------------------------------------------------------------------------
| COPIA DE LOS DATOS ENTRE POSTGRES (14/11/2026)
|--------------------------------------------------------------------------
|
| Para la reserva de lib/datos/cliente.cjs: copia app_documents,
| general_seasons, performance_seasons y match_ratings de un Postgres a otro.
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
import zlib from "node:zlib";
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

const TABLAS = ["app_documents", "general_seasons", "performance_seasons", "match_ratings"];

async function leeOrigen() {
  if (!/^postgres(ql)?:\/\//.test(DESDE)) {
    /* Vale también la copia de cada noche (.cache/copias/datos-AAAA-MM-DD.json.gz, salud-datos.mjs). */
    const crudo = fs.readFileSync(DESDE);
    const j = JSON.parse((DESDE.endsWith(".gz") ? zlib.gunzipSync(crudo) : crudo).toString("utf8"));
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
    `insert into app_documents (key, kind, data, updated_at) values ($1, $2, $3::text::jsonb, date_trunc('milliseconds', coalesce($4::timestamptz, now())))
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
      `insert into ${t} (season, data, created_at, updated_at) values ($1, $2::text::jsonb, date_trunc('milliseconds', coalesce($3::timestamptz, now())), $4::timestamptz)`,
      [f.season, texto(f.data) ?? "[]", fecha(f.created_at ?? f.updated_at), fecha(f.updated_at)],
    );
    n += 1;
  }
  console.log(`${t}: ${n} filas nuevas`);
}

let notas = 0;
for (const f of origen.match_ratings) {
  await destino.unsafe(
    `insert into match_ratings (season, data, updated_at) values ($1, $2::text::jsonb, date_trunc('milliseconds', coalesce($3::timestamptz, now())))
     on conflict (season) do update set data = excluded.data, updated_at = excluded.updated_at
     where match_ratings.updated_at <= excluded.updated_at`,
    [f.season, texto(f.data) ?? "{}", fecha(f.updated_at)],
  );
  notas += 1;
}
console.log(`match_ratings: ${notas} temporadas`);

const [{ n }] = await destino.unsafe("select count(*)::int as n from app_documents");
console.log(`Hecho: ${docs} documentos copiados; el destino tiene ${n}.`);
await destino.end();
