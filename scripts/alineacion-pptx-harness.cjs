/*
 * Monta el .pptx de día de partido sin navegador y lo deja en un archivo.
 *
 * El módulo dibuja en `<canvas>` y descarga un `Blob`, dos cosas que en Node no
 * existen: aquí se le da `@napi-rs/canvas` —el mismo que ya rasteriza el PDF
 * del once— con Barlow Condensed registrada de `public/fuentes/`, y un
 * `descarga` de pega que escribe el fichero. Las fotos son de mentira (un
 * degradado), así que no se toca la red.
 *
 *   node scripts/alineacion-pptx-harness.cjs <salida.pptx> [cuantos]
 *
 * Además de armar el paquete, saca a su lado:
 *   <salida>.campo.png   — el fondo, para mirar el campo y la cabecera
 *   <salida>.ficha.png   — una ficha suelta a tamaño real
 *
 * Vive dentro del repo a propósito: fuera no resolvería `typescript` ni
 * `@napi-rs/canvas`.
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));
const {
  createCanvas,
  GlobalFonts,
  loadImage,
} = require(path.join(ROOT, "node_modules/@napi-rs/canvas"));

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
        esModuleInterop: true,
      },
      fileName: archivo,
    }).outputText,
    archivo,
  );

Module._extensions[".ts"] = compila;
Module._extensions[".tsx"] = compila;

/* ---- Barlow Condensed, la de la plantilla ---- */

for (const fichero of fs.readdirSync(path.join(ROOT, "public/fuentes"))) {
  if (fichero.endsWith(".ttf")) {
    GlobalFonts.registerFromPath(
      path.join(ROOT, "public/fuentes", fichero),
      "Barlow Condensed",
    );
  }
}

require.cache[require.resolve(path.join(ROOT, "lib/rivals/portada-font.ts"))] = {
  id: "portada-font",
  filename: "portada-font",
  loaded: true,
  exports: {
    FAMILIA_PORTADA: '"Barlow Condensed", sans-serif',
    esperaFuentePortada: async () => undefined,
  },
};

/* ---- El navegador de pega ---- */

const lienzos = [];

globalThis.document = {
  createElement(etiqueta) {
    if (etiqueta !== "canvas") throw new Error(`No sé hacer un <${etiqueta}>`);

    const canvas = createCanvas(1, 1);

    /*
     * `toDataURL` de napi-rs existe pero ignora el tipo: se envuelve para que
     * `image/jpeg` salga en JPEG de verdad, que es la mitad del peso del .pptx.
     */
    canvas.toDataURL = (tipo, calidad) =>
      tipo === "image/jpeg"
        ? `data:image/jpeg;base64,${canvas
            .toBuffer("image/jpeg", Math.round((calidad ?? 0.92) * 100))
            .toString("base64")}`
        : `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;

    lienzos.push(canvas);

    return canvas;
  },
};

/* Un retrato de mentira: un degradado con una silueta, para ver el encuadre. */
function retratoFalso() {
  const canvas = createCanvas(500, 500);
  const ctx = canvas.getContext("2d");

  const cielo = ctx.createLinearGradient(0, 0, 0, 500);

  cielo.addColorStop(0, "#c9d4dd");
  cielo.addColorStop(1, "#8fa2b3");

  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, 500, 500);

  ctx.fillStyle = "#33414f";
  ctx.beginPath();
  ctx.arc(250, 175, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(80, 500);
  ctx.quadraticCurveTo(250, 260, 420, 500);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

const RETRATO = retratoFalso();

/*
 * `cargaImagen` va por `fetch` + `new Image()` + object URL, tres cosas que
 * aquí no existen. En vez de imitarlas se sustituye la función entera en el
 * módulo ya cargado: lo que se está comprobando es el dibujo, no la descarga.
 *
 * Tiene que ser `loadImage` y no `new Image()`: en `@napi-rs/canvas`, una
 * imagen construida a mano y con `src` a un Buffer decodifica —dice el ancho
 * correcto— pero `drawImage` la pinta en blanco.
 */
const lienzoClub = require(path.join(ROOT, "lib/rivals/lienzo-club.ts"));

let retratoDecodificado = null;

lienzoClub.cargaImagen = async () => {
  retratoDecodificado ??= await loadImage(RETRATO);

  return retratoDecodificado;
};

/* ---- `descarga` de pega ---- */

const SALIDA = process.argv[2] ?? "alineacion.pptx";

require.cache[require.resolve(path.join(ROOT, "lib/export/lienzos.ts"))] = {
  id: "lienzos",
  filename: "lienzos",
  loaded: true,
  exports: {
    descarga: async (blob, nombre) => {
      const bytes = Buffer.from(await blob.arrayBuffer());

      fs.writeFileSync(SALIDA, bytes);

      console.log(`${SALIDA} — ${nombre} — ${(bytes.length / 1024).toFixed(0)} KB`);
    },
  },
};

const { exportAlineacionPptx } = require(
  path.join(ROOT, "lib/rivals/alineacion-ppt.ts"),
);

/* ---- La plantilla de mentira ---- */

const NOMBRES = [
  "SOTO",
  "J. RUIZ",
  "MARC VIDAL",
  "ADRIÁN LEÓN",
  "OUMAR NDIAYE",
  "PABLO",
  "GORKA",
  "T. IBÁÑEZ",
  "CRIS MONTES",
  "IKER",
  "MAMADOU",
  "BORJA S.",
  "N. FERNÁNDEZ",
  "ÁLEX",
  "H. CAMARA",
  "JUANJO",
  "TONI",
  "R. DE LA FUENTE",
  "EDU",
  "SAMU",
  "LUCAS",
  "M. BALDE",
  "GERARD",
  "ROBERTO",
  "ANDER",
];

const RECETA = [
  ["por", 3, 0],
  ["li", 2, 0],
  ["dfc", 4, 0],
  ["ld", 2, 0],
  ["mcd", 2, 0],
  ["mc", 3, 0],
  ["mp", 1, 0],
  ["ei", 2, 0],
  ["dc", 3, 0],
  ["ed", 3, 0],
];

const cuantos = Number(process.argv[3] ?? 25);

let indice = 0;

const jugadores = [];

for (const [slot, total, lado] of RECETA) {
  for (let i = 0; i < total && jugadores.length < cuantos; i += 1) {
    indice += 1;

    jugadores.push({
      clave: `p${indice}`,
      dorsal: String(indice),
      nombre: NOMBRES[(indice - 1) % NOMBRES.length],
      slot,
      lado,
      edad: String(19 + ((indice * 3) % 15)),
      pie: indice % 4 === 0 ? "IZDO" : "DCHO",
      altura: indice % 3 === 0 ? "185" : "1,78",
      peso: String(68 + (indice % 14)),
      /* Uno de cada seis sin foto: es lo que enseña la inicial de respaldo. */
      foto: indice % 6 === 0 ? "" : `https://cdn.resfu.com/falso/${indice}.jpg`,
      estado: indice === 4 ? "LESIONADO" : indice === 9 ? "SANCIONADO" : "",
      portero: slot === "por",
      titular: (indice * 7) % 23,
      goles: slot === "dc" ? (indice * 3) % 11 : (indice % 5) - 1,
      encajados: slot === "por" ? (indice * 5) % 30 : null,
    });
  }
}

exportAlineacionPptx({
  equipo: "CD Teruel",
  escudo: "",
  temporada: "26 / 27",
  jugadores,
})
  .then(() => {
    /* El primer lienzo es el campo; el segundo, la primera ficha. */
    const campo = lienzos.find((uno) => uno.width > 2000);
    const ficha = lienzos.find((uno) => uno.width < 2000 && uno.width > 100);

    if (campo) {
      fs.writeFileSync(`${SALIDA}.campo.png`, campo.toBuffer("image/png"));
      console.log(`${SALIDA}.campo.png — ${campo.width}×${campo.height}`);
    }

    if (ficha) {
      fs.writeFileSync(`${SALIDA}.ficha.png`, ficha.toBuffer("image/png"));
      console.log(`${SALIDA}.ficha.png — ${ficha.width}×${ficha.height}`);
    }

    console.log(`${jugadores.length} jugadores colocados.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
