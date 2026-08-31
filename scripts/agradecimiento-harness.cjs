/*
 * Pinta la nota de agradecimiento del vestuario rival sin navegador y la deja
 * en dos PNG: el de la diapositiva 16:9 y el del A4 vertical.
 *
 *   node scripts/agradecimiento-harness.cjs <carpeta-o-prefijo>
 *
 * El módulo dibuja en `<canvas>` y descarga un `Blob`, dos cosas que en Node
 * no existen: aquí se le da `@napi-rs/canvas` con Barlow Condensed registrada
 * de `public/fuentes/`. Es la única forma de ver cómo queda la hoja —es un
 * documento de una sola pieza, sin datos— sin levantar la app.
 *
 * Vive dentro del repo a posta: fuera no resolvería `typescript` ni
 * `@napi-rs/canvas`.
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));
const { createCanvas, GlobalFonts } = require(
  path.join(ROOT, "node_modules/@napi-rs/canvas"),
);

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

    canvas.toDataURL = () =>
      `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;

    lienzos.push(canvas);

    return canvas;
  },
};

/* `descarga` y el PDF no se ejercitan: lo que se mira es el dibujo. */
require.cache[require.resolve(path.join(ROOT, "lib/export/lienzos.ts"))] = {
  id: "lienzos",
  filename: "lienzos",
  loaded: true,
  exports: {
    descarga: () => undefined,
    pdfDeLienzos: async () => ({ save: () => undefined }),
  },
};

const nota = require(path.join(ROOT, "lib/general/agradecimiento.ts"));

const PREFIJO = process.argv[2] ?? "agradecimiento";

(async () => {
  await nota.exportAgradecimientoPptx();
  await nota.exportAgradecimientoPdf();

  const [diapositiva, folio] = lienzos;

  fs.writeFileSync(`${PREFIJO}-16-9.png`, diapositiva.toBuffer("image/png"));
  fs.writeFileSync(`${PREFIJO}-a4.png`, folio.toBuffer("image/png"));

  console.log(`${PREFIJO}-16-9.png — ${diapositiva.width}×${diapositiva.height}`);
  console.log(`${PREFIJO}-a4.png — ${folio.width}×${folio.height}`);
})();
