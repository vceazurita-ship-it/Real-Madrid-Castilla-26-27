/*
|--------------------------------------------------------------------------
| LIMPIEZA DE SUPABASE: LO QUE YA NO USA NADIE
|--------------------------------------------------------------------------
|
|   node scripts/limpia-supabase.mjs           enseña lo que borraría
|   node scripts/limpia-supabase.mjs --hacer   lo borra
|
| Sólo toca lo que se puede demostrar que sobra (13/10/2026):
|   - FICHEROS HUÉRFANOS en las carpetas que llevan sus documentos
|     (`2026/informes/clips|video`, `2026/rivales/`, `2026/rivales-docs/`):
|     los que no aparecen en ningún documento. Al remontar los cortes de un
|     partido con otros nombres, los viejos se quedaban.
|   - DOCUMENTOS DE PRUEBA (`prueba:*`) y sesiones vacías: coding sin un solo
|     clip, pizarras de sesión sin jugadores, pizarras tácticas sin nada
|     dibujado.
| No toca `2026/informes/<día>/` (los adjuntos de los correos: los enlaces
| duran 30 días y los barre la subida, ver app/api/informe/subida), ni las
| semanas, ni los desplazamientos, ni las cachés de la hoja.
*/

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");

const HACER = process.argv.includes("--hacer");
const BUCKET = "performance";
const CARPETAS = ["2026/informes/clips", "2026/informes/video", "2026/rivales", "2026/rivales-docs"];

const env = entorno();

if (!env) throw new Error("Faltan las llaves de Supabase en .env.local");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---- los documentos, enteros ---- */
const docs = [];

for (let d = 0; ; d += 100) {
  const { data, error } = await sb.from("app_documents").select("key,data").range(d, d + 99);

  if (error) throw new Error(error.message);

  docs.push(...data);

  if (data.length < 100) break;
}

const texto = docs.map((x) => JSON.stringify(x.data)).join("\n");
let textoDecodificado = texto;

try {
  textoDecodificado = decodeURIComponent(texto.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
} catch {
  /* Con el texto tal cual vale. */
}

const usado = (ruta) => texto.includes(ruta) || textoDecodificado.includes(ruta);

/* ---- los ficheros de las carpetas con documento ---- */
async function lista(prefijo) {
  const salida = [];

  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset: off });

    if (error) throw new Error(`${prefijo}: ${error.message}`);

    for (const it of data) {
      const ruta = `${prefijo}/${it.name}`;

      if (it.id === null) salida.push(...(await lista(ruta)));
      else salida.push({ ruta, mb: (it.metadata?.size ?? 0) / 1048576 });
    }

    if (data.length < 1000) break;
  }

  return salida;
}

const ficheros = (await Promise.all(CARPETAS.map(lista))).flat();
/* El póster va con su vídeo: si el vídeo se usa, su .jpg también. */
const huerfanos = ficheros.filter((f) => !usado(f.ruta) && !(f.ruta.endsWith(".jpg") && usado(f.ruta.replace(/\.jpg$/, ".mp4"))));

/* ---- los documentos que sobran ---- */
const vacio = (d) => {
  const x = d.data ?? {};

  if (d.key.startsWith("prueba:")) return "documento de prueba";
  if (d.key.startsWith("coding:partido:") || (d.key.startsWith("coding:rival:") && d.key !== "coding:rivales")) return Array.isArray(x.clips) && x.clips.length === 0 && !(x.escenas ?? []).length ? "coding sin clips" : null;
  if (d.key.startsWith("session-board:")) return (x.tasks ?? []).every((t) => (t.teams ?? []).every((e) => !(e.playerIds ?? []).length)) ? "sesión sin jugadores" : null;
  if (d.key.startsWith("tactics:rival:") || d.key.startsWith("tactics:board:")) return (x.scenes ?? []).every((s) => !(s.shapes ?? []).length && !(s.tokens ?? []).length) ? "pizarra sin nada dibujado" : null;

  return null;
};

const sobran = docs.map((d) => ({ key: d.key, motivo: vacio(d) })).filter((d) => d.motivo);

console.log(`Ficheros huérfanos: ${huerfanos.length} · ${huerfanos.reduce((s, f) => s + f.mb, 0).toFixed(1)} MB`);
for (const f of huerfanos) console.log(`  ${f.mb.toFixed(1).padStart(5)} MB  ${f.ruta}`);
console.log(`Documentos que sobran: ${sobran.length}`);
for (const d of sobran) console.log(`  ${d.key} (${d.motivo})`);

if (!HACER) {
  console.log("RESUMEN: sólo se enseña; para borrar, --hacer");
} else {
  for (let i = 0; i < huerfanos.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET).remove(huerfanos.slice(i, i + 100).map((f) => f.ruta));

    if (error) throw new Error(error.message);
  }

  if (sobran.length) {
    const { error } = await sb.from("app_documents").delete().in("key", sobran.map((d) => d.key));

    if (error) throw new Error(error.message);
  }

  console.log(`RESUMEN: borrados ${huerfanos.length} ficheros (${huerfanos.reduce((s, f) => s + f.mb, 0).toFixed(1)} MB) y ${sobran.length} documentos`);
}
