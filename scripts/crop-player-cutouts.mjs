/**
 * Convierte recortes sin fondo en los dos formatos que sirve la web.
 *
 *   node scripts/crop-player-cutouts.mjs <carpeta-de-recortes>
 *
 * Entrada: PNG con transparencia, uno por persona, llamados con el slug
 * (`javier-bailon.png`). Los originales de la sesión de fotos del club están
 * en `public/players/RMC/NOMBRE APELLIDO_JTxxxxx.jpg`, pero con fondo: hay que
 * quitárselo antes (Photoshop, el conector de Adobe, quitafondos…) y guardar
 * el resultado con el slug.
 *
 * Salida:
 *   public/players/cerca/<slug>.webp   400x500  (avatares y fichas pequeñas)
 *   public/players/lejos/<slug>.webp   620x797  (tarjetas y cabeceras)
 *
 * El encuadre se deduce de la silueta —dónde empieza la cabeza y cuánto mide—
 * para que todos los retratos queden alineados entre sí y con los que ya hay.
 *
 * Después hay que:
 *   1. añadir el slug a PLAYER_IMAGE_SLUGS y su ID a ID_TO_SLUG
 *      (lib/playerImages.ts);
 *   2. subir los dos .webp al bucket `performance` de Supabase, en
 *      `players/cerca` y `players/lejos`. Dejarlos sólo en /public no basta.
 *
 * sharp llega como dependencia de Next, no hace falta instalar nada.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const VARIANTS = {
  cerca: { width: 400, height: 500 },
  lejos: { width: 620, height: 797 },
};

const OUT = "public/players";

/**
 * Encuadres de referencia, medidos sobre los retratos que ya estaban en
 * producción: dónde cae la coronilla y dónde la barbilla dentro del recorte.
 */
const FRAMING = {
  cerca: { top: 0.04, chin: 0.74 },
  lejos: { top: 0.056, chin: 0.376 },
};

/** Alto de la cabeza respecto a su ancho en un retrato frontal. */
const HEAD_RATIO = 1.38;

/**
 * Lee la silueta del recorte: primera fila con sujeto, ancho de la cabeza y
 * su eje vertical. La cabeza se mide en el primer 20% de la persona, que es
 * donde todavía no aparecen los hombros.
 */
async function silueta(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels } = info;

  const filas = [];

  for (let y = 0; y < H; y++) {
    let min = -1;
    let max = -1;

    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * channels + 3] > 128) {
        if (min < 0) min = x;
        max = x;
      }
    }

    filas.push(min < 0 ? null : { ancho: max - min + 1, centro: (min + max) / 2 });
  }

  // Ignora motas sueltas del quitafondos: exigimos algo de anchura real.
  const top = filas.findIndex((f) => f && f.ancho > W * 0.02);

  if (top < 0) throw new Error(`Recorte vacío: ${file}`);

  const cabeza = filas
    .slice(top, top + Math.round((H - top) * 0.2))
    .filter(Boolean);

  return {
    W,
    H,
    top,
    ancho: Math.max(...cabeza.map((f) => f.ancho)),
    centro: cabeza[Math.round(cabeza.length / 2)].centro,
  };
}

/** Rectángulo de recorte, recortado a los límites de la imagen. */
function encuadre({ W, H, top, ancho, centro }, variante) {
  const { top: margen, chin } = FRAMING[variante];
  const { width, height } = VARIANTS[variante];

  const alto = (ancho * HEAD_RATIO) / (chin - margen);
  const anchoCaja = alto * (width / height);

  const left = Math.round(Math.max(0, Math.min(W - 1, centro - anchoCaja / 2)));
  const arriba = Math.round(Math.max(0, Math.min(H - 1, top - margen * alto)));

  return {
    left,
    top: arriba,
    width: Math.round(Math.min(anchoCaja, W - left)),
    height: Math.round(Math.min(alto, H - arriba)),
  };
}

const entrada = process.argv[2];

if (!entrada || !fs.existsSync(entrada)) {
  console.error("Uso: node scripts/crop-player-cutouts.mjs <carpeta-de-recortes>");
  process.exit(1);
}

const pngs = fs
  .readdirSync(entrada)
  .filter((f) => !f.startsWith("._") && /\.png$/i.test(f));

for (const variante of Object.keys(VARIANTS)) {
  fs.mkdirSync(path.join(OUT, variante), { recursive: true });
}

const hechos = [];

for (const file of pngs) {
  const slug = file.replace(/\.png$/i, "");
  const origen = path.join(entrada, file);
  const forma = await silueta(origen);

  for (const [variante, { width, height }] of Object.entries(VARIANTS)) {
    await sharp(origen)
      .extract(encuadre(forma, variante))
      .resize({ width, height, fit: "cover", position: "top" })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(path.join(OUT, variante, `${slug}.webp`));
  }

  hechos.push(slug);
}

console.log(`${hechos.length} personas -> ${OUT}/{cerca,lejos}\n`);
console.log("Slugs para PLAYER_IMAGE_SLUGS (lib/playerImages.ts):\n");
console.log(hechos.sort().map((s) => `  "${s}",`).join("\n"));
