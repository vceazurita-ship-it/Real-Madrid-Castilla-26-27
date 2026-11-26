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

/*
| LOS DATOS DE LA CARÁTULA DE UN RIVAL (26/11/2026), los mismos que la ficha de
| /rivals: la hoja RIVALES (foto, puesto, pie, altura, edad, peso, dorsal) y
| rivals:stats (escudo y números de la temporada). Se cruza por equipo y nombre;
| si no está en la hoja, lo que da Opta (nombre, puesto, edad).
*/
const stats = require(path.join(RAIZ, "lib/rivals/stats.ts"));
const { metricasDeTemporada } = require(path.join(RAIZ, "lib/rivals/portada.ts"));
const llano = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const texto = (v) => (v == null ? "" : String(v).trim());
const fotoGrande = (url) => (!url || !/cdn\.resfu\.com/.test(url) || /[?&]size=/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}size=500x&lossy=1`);
const temporadaCorta = (t) => {
  const m = String(t ?? "").match(/(\d{2})(\d{2})\/(\d{2})/);
  return m ? `${m[2]} / ${m[3]}` : "26 / 27";
};

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";
/** Las filas de la hoja RIVALES (30-70 s en frío: una vez por pasada). Lista vacía si falla. */
async function leeHojaRivales() {
  try {
    const r = await fetch(`${APPS_SCRIPT_URL}?action=rivalesPlantillas`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(120_000) });
    const filas = await r.json();
    return Array.isArray(filas) ? filas : [];
  } catch (e) {
    console.log(`(la hoja RIVALES no contesta: ${e?.message || e}; carátulas con lo de Opta)`);
    return [];
  }
}

/** Su fila de la hoja: mismo equipo y mismo nombre (deportivo, completo o todas las palabras del de Opta). */
function filaDe(hoja, statsDoc, equipo, nombre) {
  const club = stats.findTeam(statsDoc, equipo);
  const delEquipo = hoja.filter((f) => {
    const t = stats.findTeam(statsDoc, texto(f.NOMBRE_EQUIPO));
    return club && t ? t === club : llano(f.NOMBRE_EQUIPO) === llano(equipo);
  });
  const n = llano(nombre);
  const exactos = delEquipo.filter((f) => llano(f["NOMBRE DEPORTIVO"]) === n || llano(f.JUGADOR) === n);
  if (exactos.length === 1) return exactos[0];
  const palabras = n.split(" ").filter((p) => p.length > 1);
  const parecidos = delEquipo.filter((f) => {
    const suyas = new Set(`${llano(f.JUGADOR)} ${llano(f["NOMBRE DEPORTIVO"])}`.split(" "));
    return palabras.length && palabras.every((p) => suyas.has(p));
  });
  return parecidos.length === 1 ? parecidos[0] : null;
}

function datosRival({ hoja, statsDoc, equipo, nombre, rol, edad }) {
  const club = stats.findTeam(statsDoc, equipo);
  const f = filaDe(hoja, statsDoc, equipo, nombre);
  if (!f) {
    return { equipo, escudo: club?.escudo, temporada: temporadaCorta(statsDoc?.temporada), nombre, posicion: String(rol || "").toUpperCase(), edad: edad ? String(edad) : undefined, dorsal: "" };
  }
  const s = stats.findStats(statsDoc, f);
  const season = stats.highlightSeason(s?.temporadas ?? [], statsDoc?.temporada);
  return {
    equipo: texto(f.NOMBRE_EQUIPO) || equipo,
    escudo: club?.escudo,
    temporada: temporadaCorta(statsDoc?.temporada),
    nombre: texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR) || nombre,
    nombreCompleto: texto(f.JUGADOR),
    posicion: texto(f["POSICIÓN"]) || String(rol || "").toUpperCase(),
    pieDominante: texto(f["PIE DOMINANTE"]),
    altura: texto(f.ALTURA),
    edad: texto(f.EDAD) || (edad ? String(edad) : ""),
    peso: texto(f.PESO),
    dorsal: texto(f.DORSAL),
    foto: fotoGrande(texto(f.FOTO)) || undefined,
    contexto: season ? [season.temporada, season.equipos.join(" / ")].filter(Boolean).join(" · ") : undefined,
    metricas: season ? metricasDeTemporada(season, Boolean(s?.portero)) : undefined,
  };
}

module.exports = { caratulaJpeg, fotoDeCasa, leeHojaRivales, datosRival };
