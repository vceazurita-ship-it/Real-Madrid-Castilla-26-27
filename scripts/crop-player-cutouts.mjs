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
 * A dónde tiene que llegar el recorte, medido sobre los 62 retratos que ya
 * estaban en producción (mediana): cuánto ocupa la cabeza de ancho y dónde
 * cae la coronilla.
 *
 * Son objetivos, no una fórmula, y el recorte **itera hasta cumplirlos**
 * (`recorta`). Antes se deducía la caja de una regla fija —alto de cabeza =
 * 1,38 × su ancho— y eso vale mientras todas las fotos vengan de la misma
 * sesión: en cuanto llega una de prensa, o un peinado ancho como las rastas de
 * Naasei, la regla mide de más y la cara sale un 20% más pequeña que la de sus
 * compañeros. Con el objetivo medido, cualquier foto acaba encajando igual.
 */
const OBJETIVO = {
  cerca: { ancho: 0.635, top: 0.036 },
  lejos: { ancho: 0.368, top: 0.034 },
};

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

/**
 * Rectángulo de recorte, en coordenadas de la imagen. **Puede salirse.**
 *
 * Y tiene que poder: el encuadre se calcula desde la cabeza, así que en un
 * retrato donde la persona no llega abajo —una foto de prensa recortada, no la
 * sesión del club— la caja buena se sale por abajo. Recortarla a los límites
 * de la imagen, que es lo que hacía antes, movía la cara de sitio y la dejaba
 * más pequeña que la de los demás. Lo que se hace ahora es rellenar con
 * transparencia lo que falte (`conMargen`), que en un recorte sin fondo no se
 * nota: sigue siendo el mismo hueco vacío que ya tenía la foto.
 */
function encuadre({ top, centro }, ancho, variante) {
  const objetivo = OBJETIVO[variante];
  const { width, height } = VARIANTS[variante];

  const anchoCaja = ancho / objetivo.ancho;
  const alto = anchoCaja * (height / width);

  return {
    left: Math.round(centro - anchoCaja / 2),
    top: Math.round(top - objetivo.top * alto),
    width: Math.round(anchoCaja),
    height: Math.round(alto),
  };
}

/**
 * Estira el lienzo con transparencia hasta que la caja quepa entera.
 *
 * Devuelve la imagen ya estirada y la caja movida a las coordenadas nuevas.
 * Con las fotos del club no estira nada —la caja siempre cabe— y el resultado
 * es byte a byte el de antes.
 */
async function conMargen(origen, caja, { W, H }) {
  const izquierda = Math.max(0, -caja.left);
  const arriba = Math.max(0, -caja.top);
  const derecha = Math.max(0, caja.left + caja.width - W);
  const abajo = Math.max(0, caja.top + caja.height - H);

  if (!izquierda && !arriba && !derecha && !abajo) return { fuente: origen, caja };

  /*
  | El estirado va en dos pasos y no en uno: sharp aplica `extend` **después**
  | de recortar, pase en el orden que pase, así que encadenarlos deja el
  | recorte fuera de la imagen ("bad extract area").
  */
  const estirada = await sharp(origen)
    .ensureAlpha()
    .extend({
      left: izquierda,
      top: arriba,
      right: derecha,
      bottom: abajo,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return {
    fuente: estirada,
    caja: { ...caja, left: caja.left + izquierda, top: caja.top + arriba },
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
    const objetivo = OBJETIVO[variante];

    /*
    | Se recorta, se mide lo que ha salido y se corrige. Dos vueltas bastan.
    |
    | La medida de la cabeza en el original y en el recorte no miran la misma
    | franja —«el primer 20% de la persona» es otra cosa en una foto de cuerpo
    | entero que en un primer plano—, así que a la primera se queda cerca pero
    | no encima. Comprobar el resultado es además lo único que garantiza que
    | una foto nueva quede como las que ya están.
    */
    let ancho = forma.ancho;
    let mejor = null;

    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      const { fuente, caja } = await conMargen(
        origen,
        encuadre(forma, ancho, variante),
        forma,
      );

      /*
      | Un pelín de enfoque, y sólo si hay que agrandar.
      |
      | Los retratos del club son de 4000 px y el recorte los reduce; una foto
      | de prensa como la de Naasei es de 383 y hay que estirarla al doble, y
      | ahí el reescalado deja la cara blanda.
      */
      let salida = sharp(fuente)
        .extract(caja)
        .resize({ width, height, fit: "cover", position: "top" });

      if (width / caja.width > 1.2) salida = salida.sharpen({ sigma: 0.7 });

      mejor = await salida.webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();

      const conseguido = (await silueta(mejor)).ancho / width;

      if (Math.abs(conseguido - objetivo.ancho) < 0.005) break;

      ancho *= conseguido / objetivo.ancho;
    }

    fs.writeFileSync(path.join(OUT, variante, `${slug}.webp`), mejor);
  }

  hechos.push(slug);
}

console.log(`${hechos.length} personas -> ${OUT}/{cerca,lejos}\n`);
console.log("Slugs para PLAYER_IMAGE_SLUGS (lib/playerImages.ts):\n");
console.log(hechos.sort().map((s) => `  "${s}",`).join("\n"));
