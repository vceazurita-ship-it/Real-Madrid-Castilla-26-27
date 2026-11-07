/*
|--------------------------------------------------------------------------
| SUBIR AL ALMACÉN SIN PASARSE DEL PLAN GRATIS (07/11/2026)
|--------------------------------------------------------------------------
|
| Lo usan todos los scripts que suben vídeo a Supabase (cortes de ABP, goles,
| banda, faltas, transiciones, entrenos, vídeo del informe):
|
|   const { subeAlmacen } = require("./almacen.cjs");
|   const { error } = await subeAlmacen(supabase, ruta, fichero, { contentType: "video/mp4", upsert: true });
|
| Antes de subir:
|   1. Los CORTES pesados (más de 2,5 Mb/s, carpetas `/clips/`) se recomprimen
|      con x264 «slow» y CRF 26: medido el 07/11/2026 con cortes de goles,
|      informe y ABP, un 40-50 % menos con SSIM 0,99 (no se distingue).
|   2. Se mide lo que ocupa el bucket (una vez por ejecución, luego se suma lo
|      subido). Si pasaría del 95 % de 1 GB, NO se sube y se devuelve un error
|      que el script ya pinta («no sube (…)»). `ALMACEN_SIN_FRENO=1` lo salta.
| La medida se guarda en el documento `almacen:ocupacion` (Ajustes y portada).
*/

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const BUCKET = "performance";
const TOPE_MB = 1024;
const FRENO = 0.95;
const CAUDAL_MAX = 2_500_000;

let FFMPEG = null;

try {
  FFMPEG = require("ffmpeg-static");
} catch {
  /* Sin ffmpeg se sube tal cual. */
}

let ocupadoMb = null;

async function recorre(sb, prefijo) {
  let mb = 0;
  let n = 0;

  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset: desde });

    if (error) throw new Error(error.message);

    for (const it of data ?? []) {
      if (it.id === null) {
        const sub = await recorre(sb, prefijo ? `${prefijo}/${it.name}` : it.name);

        mb += sub.mb;
        n += sub.n;
      } else {
        mb += Number(it.metadata?.size ?? 0) / 1048576;
        n += 1;
      }
    }

    if ((data ?? []).length < 1000) break;
  }

  return { mb, n };
}

/** Lo que ocupa el bucket ahora (MB); lo guarda en `almacen:ocupacion` con lo básico. */
async function mideOcupacion(sb) {
  const { mb, n } = await recorre(sb, "");
  const medido = new Date().toISOString();
  const { data: previo } = await sb.from("app_documents").select("data").eq("key", "almacen:ocupacion").maybeSingle();

  await sb
    .from("app_documents")
    .upsert({ key: "almacen:ocupacion", kind: "almacen", data: { ...(previo?.data ?? {}), mb: Math.round(mb * 10) / 10, tope: TOPE_MB, ficheros: n, medido }, updated_at: medido }, { onConflict: "key" });

  return mb;
}

const ejecuta = (args) =>
  new Promise((listo) => execFile(FFMPEG, args, { maxBuffer: 1 << 24 }, (error, _out, err) => listo({ error, err: String(err ?? "") })));

/** Los segundos de un vídeo, de lo que cuenta ffmpeg al abrirlo. */
async function duracion(fichero) {
  const { err } = await ejecuta(["-hide_banner", "-i", fichero]);
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);

  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** El corte, más ligero si merece la pena; si no, el mismo fichero. */
async function aligera(fichero) {
  if (!FFMPEG) return fichero;

  const bytes = fs.statSync(fichero).size;
  const segundos = await duracion(fichero);

  if (!segundos || (bytes * 8) / segundos <= CAUDAL_MAX) return fichero;

  const salida = path.join(os.tmpdir(), `ligero-${process.pid}-${Date.now()}-${path.basename(fichero)}`);
  const { error } = await ejecuta([
    "-hide_banner", "-loglevel", "error", "-y", "-i", fichero,
    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", salida,
  ]);

  if (error || !fs.existsSync(salida)) return fichero;

  /* Sólo si de verdad ahorra (un 15 % o más). */
  if (fs.statSync(salida).size > bytes * 0.85) {
    fs.rmSync(salida, { force: true });

    return fichero;
  }

  return salida;
}

/**
 * Sube `fichero` a `ruta` del bucket con el freno y, en los cortes, la
 * recompresión. Devuelve lo mismo que `storage.upload` (`{ data, error }`).
 */
async function subeAlmacen(sb, ruta, fichero, opciones = {}, { recomprime = /\/clips\//.test(ruta), soloSiAligera = false } = {}) {
  const usar = recomprime && /\.mp4$/i.test(fichero) ? await aligera(fichero) : fichero;

  /* Para recomprimir lo ya subido: si no gana peso, no se toca. */
  if (soloSiAligera && usar === fichero) return { data: null, error: null, ligero: 0 };
  const bytes = fs.statSync(usar).size;
  const mb = bytes / 1048576;

  try {
    if (ocupadoMb === null) ocupadoMb = await mideOcupacion(sb);
  } catch (error) {
    console.warn("[almacén] no se ha podido medir:", error.message);
    ocupadoMb = 0;
  }

  if (ocupadoMb + mb > TOPE_MB * FRENO && process.env.ALMACEN_SIN_FRENO !== "1") {
    if (usar !== fichero) fs.rmSync(usar, { force: true });

    return { data: null, error: { message: `almacén lleno (${Math.round(ocupadoMb)} de ${TOPE_MB} MB): libera espacio con node scripts/limpia-supabase.mjs` } };
  }

  const respuesta = await sb.storage.from(BUCKET).upload(ruta, fs.readFileSync(usar), opciones);

  if (!respuesta.error) ocupadoMb += mb;
  if (usar !== fichero) fs.rmSync(usar, { force: true });

  return { ...respuesta, ligero: usar !== fichero ? bytes : 0 };
}

module.exports = { subeAlmacen, mideOcupacion, aligera, TOPE_MB, FRENO };
