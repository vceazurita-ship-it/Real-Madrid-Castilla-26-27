/**
 * PASA A LÁMINAS LOS PDF QUE YA ESTÁN SUBIDOS DE UNA JORNADA DEL RIVAL.
 *
 *   node scripts/rival-pdf-laminas.mjs --equipo "Atlético Madrileño" --jornada J6 [--escribe]
 *
 * Es lo mismo que el botón «Pasar a láminas» de ABP del Rival / Área del Rival
 * (usa `lib/rivals/importa-pdf.ts`, el mismo lector), pero sin navegador: lee
 * los PDF de `rival-analisis-clips:<equipo>` de esa jornada, casa los nombres
 * con la plantilla del rival y añade a `rival-analisis:<equipo>` las láminas
 * que no estén ya (misma sección y mismo título). Sin `--escribe` sólo cuenta
 * lo que haría.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));
const { entorno } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));
const { analisisKey, clipsKey, normalizaAnalisis, normalizaClips, ANALISIS_KIND } = require(path.join(RAIZ, "lib/rivals/analisis.ts"));
const { importaPdfAnalisis } = require(path.join(RAIZ, "lib/rivals/importa-pdf.ts"));

const bandera = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const equipo = bandera("equipo");
const jornada = (bandera("jornada") || "").toUpperCase();
const escribe = process.argv.includes("--escribe");

if (!equipo || !/^J\d{1,2}$/.test(jornada)) {
  console.log("RESUMEN: faltan --equipo o --jornada (como J6)");
  process.exit(1);
}

const env = entorno();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const leeDoc = async (clave) => {
  const { data, error } = await supabase.from("app_documents").select("data").eq("key", clave).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data;
};

/* La plantilla del rival, del mismo sitio que la pantalla. */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";
/*
| El Apps Script tarda 30-70 s en despertar y a veces no contesta a la primera.
| Sin plantilla las láminas se escriben sin casar a nadie —sin fotos, pasó con
| la J6 del Atlético Madrileño—, así que se reintenta y, si no llega, NO se
| escribe nada.
*/
let filas = [];
for (let intento = 1; intento <= 4 && !filas.length; intento++) {
  const plantillaEntera = await fetch(`${APPS_SCRIPT_URL}?action=rivalesPlantillas`, { signal: AbortSignal.timeout(120000) })
    .then((r) => r.json())
    .catch(() => []);
  filas = (Array.isArray(plantillaEntera) ? plantillaEntera : plantillaEntera?.data ?? []).filter(
    (f) => String(f.NOMBRE_EQUIPO ?? "") === equipo,
  );
  if (!filas.length && intento < 4) await new Promise((r) => setTimeout(r, 15000));
}
if (!filas.length) {
  console.log(`RESUMEN: no ha llegado la plantilla de ${equipo} de la hoja de rivales: no se escriben láminas sin fotos. Vuelve a intentarlo.`);
  process.exit(1);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const clips = normalizaClips(await leeDoc(clipsKey(equipo)));
/*
| `--solo "origen1|origen2"`: sólo esos PDF (los que se acaban de subir). Sin
| él se miran todos los de la jornada; con él, recoger una carpeta nueva no
| vuelve a pasar los PDF de antes.
*/
const solo = (bandera("solo") || "").split("|").filter(Boolean);
const docs = (clips.jornadas[jornada]?.docs ?? [])
  .filter((d) => /\.pdf($|\?)/i.test(d.url))
  .filter((d) => !solo.length || solo.includes(d.origen));

const nuevas = [];
const analisisPrevio = normalizaAnalisis(await leeDoc(analisisKey(equipo)));

/* Las que ya están Y las que alguien quitó a propósito: ninguna vuelve. */
const yaHay = [
  ...(analisisPrevio.jornadas[jornada]?.laminas ?? []),
  ...(analisisPrevio.jornadas[jornada]?.quitadas ?? []).map((q) => q.lamina),
];

for (const d of docs) {
  const datos = new Uint8Array(await fetch(d.url).then((r) => r.arrayBuffer()));
  const { laminas, saltadas } = await importaPdfAnalisis(pdfjs, datos, filas, d.nombre || d.origen || "");
  const suyas = laminas
    .map((p) => p.lamina)
    .filter((l) => !yaHay.some((y) => y.seccion === l.seccion && y.titulo === l.titulo))
    .filter((l) => !nuevas.some((y) => y.seccion === l.seccion && y.titulo === l.titulo));
  console.log(`${d.nombre} (${d.ambito}): ${laminas.length} láminas, ${suyas.length} nuevas${saltadas.length ? ` · diapositivas sin lámina: ${saltadas.join(", ")}` : ""}`);
  for (const l of suyas) console.log(`   ${l.seccion.padEnd(12)} ${l.titulo}`);
  nuevas.push(...suyas);
}

if (!escribe || !nuevas.length) {
  console.log(`RESUMEN: ${nuevas.length} láminas nuevas para ${equipo} ${jornada}${escribe ? "" : " (sin escribir: añade --escribe)"}; plantilla con ${filas.length} jugadores`);
  process.exit(0);
}

/* Se relee justo antes de escribir para no pisar lo que alguien haya dibujado. */
const actual = normalizaAnalisis(await leeDoc(analisisKey(equipo)));
const previo = actual.jornadas[jornada] ?? { laminas: [] };
actual.jornadas[jornada] = { ...previo, laminas: [...(previo.laminas ?? []), ...nuevas] };

const { error } = await supabase
  .from("app_documents")
  .upsert({ key: analisisKey(equipo), kind: ANALISIS_KIND, data: actual, updated_at: new Date().toISOString() }, { onConflict: "key" });

if (error) {
  console.log(`RESUMEN: no se ha podido guardar: ${error.message}`);
  process.exit(1);
}

const comprobado = normalizaAnalisis(await leeDoc(analisisKey(equipo))).jornadas[jornada]?.laminas?.length ?? 0;
console.log(`RESUMEN: ${nuevas.length} láminas añadidas a ${equipo} ${jornada} (ahora hay ${comprobado})`);
process.exit(0);
