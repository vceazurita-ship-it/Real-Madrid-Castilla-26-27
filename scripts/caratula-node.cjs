/*
 * LA CARÁTULA DEL CLUB, PINTADA EN NODE (26/11/2026).
 *
 * La misma diapositiva que abre los vídeos unificados del coding
 * (lib/rivals/portada.ts → pintaPortada): papel blanco, escudo, cara, nombre a
 * toda página y la franja de números. Aquí sin navegador, para los vídeos que
 * monta el ordenador del club por la noche (scripts/opta-clips-castilla.mjs y
 * scripts/opta-clips-jugador.mjs). Es el arnés de scripts/alineacion-pptx-harness.cjs:
 * `@napi-rs/canvas` con Barlow Condensed de public/fuentes y un `document`
 * de pega; las imágenes se leen de disco (rutas de public/) o de la red.
 *
 *   const { caratulaJpeg } = require("./caratula-node.cjs");
 *   const jpeg = await caratulaJpeg({ equipo, escudo, temporada, nombre, posicion, dorsal, foto, contexto, metricas, firma });
 *
 * Devuelve un JPEG de 1920×1080 (Buffer) o null si no se ha podido.
 */

const fs = require("fs");
const path = require("path");

require("./cargador-ts.cjs");

const RAIZ = path.join(__dirname, "..");
const { createCanvas, GlobalFonts, loadImage } = require(path.join(RAIZ, "node_modules/@napi-rs/canvas"));

for (const fichero of fs.readdirSync(path.join(RAIZ, "public/fuentes"))) {
  if (fichero.endsWith(".ttf")) GlobalFonts.registerFromPath(path.join(RAIZ, "public/fuentes", fichero), "Barlow Condensed");
}

/* La fuente de la portada viene de next/font: aquí ya está registrada. */
require.cache[require.resolve(path.join(RAIZ, "lib/rivals/portada-font.ts"))] = {
  id: "portada-font",
  filename: "portada-font",
  loaded: true,
  exports: { FAMILIA_PORTADA: '"Barlow Condensed", sans-serif', esperaFuentePortada: async () => undefined },
};

if (!globalThis.document) {
  globalThis.document = {
    createElement(etiqueta) {
      if (etiqueta !== "canvas") throw new Error(`No sé hacer un <${etiqueta}>`);
      return createCanvas(1, 1);
    },
  };
}

/* Las imágenes: «/players/…» de public/, o http(s). Con loadImage (con new Image() napi pinta en blanco). */
const lienzoClub = require(path.join(RAIZ, "lib/rivals/lienzo-club.ts"));
lienzoClub.cargaImagen = async (url) => {
  try {
    if (!url) return null;
    if (url.startsWith("/")) {
      const local = path.join(RAIZ, "public", url);
      return fs.existsSync(local) ? await loadImage(fs.readFileSync(local)) : null;
    }
    const r = await fetch(url);
    return r.ok ? await loadImage(Buffer.from(await r.arrayBuffer())) : null;
  } catch {
    return null;
  }
};

const { pintaPortada } = require(path.join(RAIZ, "lib/rivals/portada.ts"));

async function caratulaJpeg(datos, ancho = 1920) {
  try {
    const lienzo = await pintaPortada(datos);
    const reducido = createCanvas(ancho, Math.round((lienzo.height * ancho) / lienzo.width));
    reducido.getContext("2d").drawImage(lienzo, 0, 0, reducido.width, reducido.height);
    return reducido.toBuffer("image/jpeg", 90);
  } catch (e) {
    console.log(`      (carátula: ${e?.message || e})`);
    return null;
  }
}

/* La foto de un jugador nuestro por su nombre de Opta («Cestero» → jorge-cestero). */
function fotoDeCasa(nombre) {
  const llano = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = llano(nombre);
  const carpeta = path.join(RAIZ, "public/players/cerca");
  if (!fs.existsSync(carpeta)) return undefined;
  const todos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
  const exacto = todos.find((s) => s === slug);
  if (exacto) return `/players/cerca/${exacto}.webp`;
  const partes = slug.split("-");
  const contiene = todos.filter((s) => partes.every((p) => s.split("-").includes(p)));
  return contiene.length === 1 ? `/players/cerca/${contiene[0]}.webp` : undefined;
}

module.exports = { caratulaJpeg, fotoDeCasa };
