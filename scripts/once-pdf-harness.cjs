/*
 * Monta el PDF del once probable sin navegador y lo deja en un archivo.
 *
 * Transpila `lib/rivals/once-pdf.ts` con el `typescript` del proyecto y le da
 * un `require` que entiende los alias `@/`. Los jugadores son de mentira y sin
 * foto, así que no se toca la red para nada excepto para las tipografías, que
 * se leen de `public/fuentes/` con un `fetch` de pega.
 *
 *   node scripts/once-pdf-harness.cjs <salida.pdf> [light|dark]
 *
 * Vive dentro del repo a propósito: si estuviera en el scratchpad no
 * resolvería `typescript` ni `jspdf`.
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));

/* ---- Cargador de .ts y de los alias @/ ---- */

const resolveOriginal = Module._resolveFilename;

Module._resolveFilename = function (peticion, ...resto) {
  if (peticion.startsWith("@/")) {
    return resolveOriginal.call(this, path.join(ROOT, peticion.slice(2)), ...resto);
  }

  return resolveOriginal.call(this, peticion, ...resto);
};

const compila = (modulo, archivo) =>
  modulo._compile(
    ts.transpileModule(fs.readFileSync(archivo, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        // Sin esto, `import Papa from "papaparse"` compila a undefined.
        esModuleInterop: true,
      },
      fileName: archivo,
    }).outputText,
    archivo,
  );

Module._extensions[".ts"] = compila;
Module._extensions[".tsx"] = compila;

/* ---- `fetch` de pega: las tipografías salen de public/fuentes ---- */

const fetchReal = globalThis.fetch;

globalThis.fetch = async (url, ...resto) => {
  if (typeof url === "string" && url.startsWith("/fuentes/")) {
    const archivo = path.join(ROOT, "public", url);

    if (!fs.existsSync(archivo)) {
      return { ok: false, status: 404 };
    }

    const buf = fs.readFileSync(archivo);

    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  }

  return fetchReal(url, ...resto);
};

/* `btoa` no existe en Node como global de navegador en todas las versiones. */
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (binario) => Buffer.from(binario, "binary").toString("base64");
}

/* ---- Jugadores de mentira ---- */

const LINEAS = [
  ["portero", "POR", "Portero"],
  ["defensa", "LD", "Lateral derecho"],
  ["defensa", "DFC", "Central"],
  ["defensa", "DFC", "Central"],
  ["defensa", "LI", "Lateral izquierdo"],
  ["medio", "MCD", "Mediocentro defensivo"],
  ["medio", "MC", "Mediocentro"],
  ["medio", "MP", "Mediapunta"],
  ["ataque", "ED", "Extremo derecho"],
  ["ataque", "DC", "Delantero centro"],
  ["ataque", "EI", "Extremo izquierdo"],
];

const NOMBRES = [
  "Íñigo Ferreras",
  "Rubén Cadenas",
  "Aitor Salguero",
  "Nacho Villaverde",
  "Marc Sedano",
  "Pablo Iriarte",
  "Dani Colomer",
  "Óscar Bermejo",
  "Hugo Larrea",
  "Iván Quintanilla",
  "Sergio Alfaro",
];

const COLOR_LINEA = { portero: "#FBBF24", defensa: "#38BDF8", medio: "#34D399", ataque: "#F87171" };

const TEXTO_LARGO =
  "Juega entre líneas y pide el balón de espaldas. Cuando el rival salta al lateral " +
  "aparece por dentro y gira con la cadera abierta. Le cuesta el partido cuando el " +
  "juego se va lejos de la banda y tiene que correr hacia atrás.";

function jugador(i) {
  const [linea, posCode, posicion] = LINEAS[i];

  return {
    clave: `jug-${i}`,
    dorsal: String(i + 1),
    nombre: NOMBRES[i],
    nombreCompleto: `${NOMBRES[i]} de la Fuente`,
    posCode,
    posicion,
    segunda: i % 3 === 0 ? "2ª MC" : "",
    rol: i % 4 === 0 ? "Capitán" : "",
    linea,
    color: COLOR_LINEA[linea],
    estado: i === 9 ? "duda" : "titular",
    enCampo: true,
    foto: "",
    datos: [
      { label: "Edad", valor: `${20 + (i % 12)}` },
      { label: "Altura", valor: "1,82 m" },
      { label: "Peso", valor: "76 kg" },
      { label: "Pie", valor: i % 2 ? "Izquierdo" : "Derecho" },
    ],
    slot: null,
    side: 0,
    portero: linea === "portero",
    temporadas: [],
    tags: [
      { label: "Conducción", tone: "fortaleza" },
      { label: "Golpeo lejano", tone: "fortaleza" },
      { label: "Duelos aéreos", tone: "debilidad" },
      { label: "Repliegue", tone: "debilidad" },
    ],
    caracteristicas: TEXTO_LARGO,
    fortalezas: TEXTO_LARGO,
    debilidades: TEXTO_LARGO,
    observaciones: TEXTO_LARGO,
    ficha: "https://example.invalid/ficha",
    video: i % 2 === 0 ? "https://youtu.be/xxxxxxxxxxx" : "",
    enlaces: [],
  };
}

(async () => {
  const [, , salida = "once.pdf", tema = "light"] = process.argv;

  const { buildOncePdf } = require(path.join(ROOT, "lib/rivals/once-pdf.ts"));

  const { doc } = await buildOncePdf({
    equipo: "CD Teruel",
    escudo: "",
    fecha: "Sábado 6 de septiembre · 18:00",
    tema,
    jugadores: Array.from({ length: 11 }, (_, i) => jugador(i)),
    campo: {},
  });

  const buf = Buffer.from(doc.output("arraybuffer"));

  fs.writeFileSync(salida, buf);
  console.log("ok", salida, buf.length, "bytes");
})().catch((e) => {
  console.error("FALLO:", e && e.stack ? e.stack : e);
  process.exit(1);
});
