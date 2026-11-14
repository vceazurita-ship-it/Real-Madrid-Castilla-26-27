/*
|--------------------------------------------------------------------------
| LIMPIEZA DE SUPABASE: LO QUE YA NO USA NADIE
|--------------------------------------------------------------------------
|
|   node scripts/limpia-supabase.mjs           enseña lo que borraría
|   node scripts/limpia-supabase.mjs --hacer   lo borra
|   node scripts/limpia-supabase.mjs --hacer --aligerar
|                                             además recomprime los cortes
|                                             pesados ya subidos (ver abajo)
|
| Sólo toca lo que se puede demostrar que sobra (13/10/2026):
|   - FICHEROS HUÉRFANOS en las carpetas que llevan sus documentos
|     (`2026/informes/clips|video`, `2026/rivales/`, `2026/rivales-docs/`):
|     los que no aparecen en ningún documento. Al remontar los cortes de un
|     partido con otros nombres, los viejos se quedaban.
|   - DOCUMENTOS DE PRUEBA (`prueba:*`) y sesiones vacías: coding sin un solo
|     clip, pizarras de sesión sin jugadores, pizarras tácticas sin nada
|     dibujado.
|   - ADJUNTOS DE CORREO REPETIDOS (07/11/2026) en `2026/informes/<día>/`:
|     cada reenvío subía otra copia entera con otro prefijo al azar. Del mismo
|     nombre se queda la más reciente. Y los días de hace más de 30 (los
|     enlaces de los correos ya han caducado).
|   - Con --aligerar: los cortes de `/clips/` de más de 2,5 Mb/s se
|     recomprimen (x264 slow, CRF 26: un 40-50 % menos, SSIM 0,99) y se
|     vuelven a subir EN LA MISMA RUTA; el original queda en
|     .cache/almacen-originales/ por si hubiera que devolverlo.
| No toca las semanas, ni los desplazamientos, ni las cachés de la hoja.
| Para ver lo que ocupa cada carpeta: node scripts/ocupacion-supabase.mjs
*/

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");
const { createClient } = require("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const HACER = process.argv.includes("--hacer");
const ALIGERAR = process.argv.includes("--aligerar");
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

/* ---- los adjuntos de correo repetidos o caducados ---- */
const corte = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const { data: dias } = await sb.storage.from(BUCKET).list("2026/informes", { limit: 1000 });
const adjuntos = [];

for (const dia of (dias ?? []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.name))) {
  const { data } = await sb.storage.from(BUCKET).list(`2026/informes/${dia.name}`, { limit: 1000 });

  for (const a of data ?? []) adjuntos.push({ ruta: `2026/informes/${dia.name}/${a.name}`, base: a.name.replace(/^[a-z0-9]{8}-/, ""), mb: (a.metadata?.size ?? 0) / 1048576, creado: a.created_at ?? "", viejo: dia.name < corte });
}

const porBase = new Map();

for (const a of adjuntos.filter((x) => !x.viejo)) porBase.set(a.base, [...(porBase.get(a.base) ?? []), a]);

const repetidos = [...porBase.values()].flatMap((l) => l.sort((a, b) => b.creado.localeCompare(a.creado)).slice(1));
const caducados = adjuntos.filter((x) => x.viejo);
const fueraAdjuntos = [...repetidos, ...caducados];

console.log(`Ficheros huérfanos: ${huerfanos.length} · ${huerfanos.reduce((s, f) => s + f.mb, 0).toFixed(1)} MB`);
for (const f of huerfanos) console.log(`  ${f.mb.toFixed(1).padStart(5)} MB  ${f.ruta}`);
console.log(`Documentos que sobran: ${sobran.length}`);
for (const d of sobran) console.log(`  ${d.key} (${d.motivo})`);
console.log(`Adjuntos de correo repetidos: ${repetidos.length} · ${repetidos.reduce((s, f) => s + f.mb, 0).toFixed(1)} MB`);
console.log(`Adjuntos de correo de hace más de 30 días: ${caducados.length} · ${caducados.reduce((s, f) => s + f.mb, 0).toFixed(1)} MB`);

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

  for (let i = 0; i < fueraAdjuntos.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET).remove(fueraAdjuntos.slice(i, i + 100).map((f) => f.ruta));

    if (error) throw new Error(error.message);
  }

  console.log(`RESUMEN: borrados ${huerfanos.length + fueraAdjuntos.length} ficheros (${[...huerfanos, ...fueraAdjuntos].reduce((s, f) => s + f.mb, 0).toFixed(1)} MB) y ${sobran.length} documentos`);
}

/* ---- con --aligerar: los cortes pesados, recomprimidos en su misma ruta ---- */
/* Sólo con --hacer: sin él, «--aligerar» no sube nada. */
if (ALIGERAR && !HACER) console.log("--aligerar sólo actúa junto a --hacer");

if (ALIGERAR && HACER) {
  const fsx = await import("node:fs");
  const pathx = await import("node:path");
  const { subeAlmacen } = require("./almacen.cjs");
  const { fileURLToPath } = await import("node:url");
  const raiz = pathx.resolve(pathx.dirname(fileURLToPath(import.meta.url)), "..");
  const copia = pathx.join(raiz, ".cache", "almacen-originales");
  const todos = [];

  async function recorre(prefijo) {
    const { data } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000 });

    for (const it of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;

      if (it.id === null) await recorre(ruta);
      else if (/\/clips\/.+\.mp4$/i.test(ruta)) todos.push({ ruta, bytes: Number(it.metadata?.size ?? 0) });
    }
  }

  await recorre("2026");

  /* De más de 1,5 MB: los pequeños ya van ligeros (banda, pérdidas, robos). */
  const candidatos = todos.filter((f) => f.bytes > 1.5 * 1048576);
  let antes = 0;
  let despues = 0;

  console.log(`Cortes candidatos a aligerar: ${candidatos.length} · ${(candidatos.reduce((s, f) => s + f.bytes, 0) / 1048576).toFixed(0)} MB`);

  for (const [i, f] of candidatos.entries()) {
    const local = pathx.join(copia, f.ruta);

    fsx.mkdirSync(pathx.dirname(local), { recursive: true });

    if (!fsx.existsSync(local)) {
      const { data, error } = await sb.storage.from(BUCKET).download(f.ruta);

      if (error) {
        console.log(`  ${f.ruta}: no se baja (${error.message})`);
        continue;
      }

      fsx.writeFileSync(local, Buffer.from(await data.arrayBuffer()));
    }

    /* Sin freno: se sustituye un fichero por otro más pequeño. */
    delete process.env.ALMACEN_FRENO;

    const tam = fsx.statSync(local).size;
    const { error, ligero } = await subeAlmacen(sb, f.ruta, local, { contentType: "video/mp4", upsert: true }, { recomprime: true, soloSiAligera: true });

    if (error) console.log(`  ${f.ruta}: no se sube (${error.message})`);
    else if (ligero) {
      antes += tam;
      despues += ligero;
      console.log(`  ${i + 1}/${candidatos.length} ${f.ruta}: ${(tam / 1048576).toFixed(1)} → ${(ligero / 1048576).toFixed(1)} MB`);
    }
  }

  console.log(`RESUMEN aligerar: ${(antes / 1048576).toFixed(0)} → ${(despues / 1048576).toFixed(0)} MB; originales en ${copia}`);
}
