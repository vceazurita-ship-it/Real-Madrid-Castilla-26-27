/*
 * Monta el .pptx del informe del rival sin navegador y deja cada diapositiva
 * en un PNG que se pueda mirar.
 *
 *   node scripts/informe-harness.cjs [slug] [carpeta-de-salida]
 *   node scripts/informe-harness.cjs teruel .cache/informe-preview
 *
 * Los datos son los de verdad: se leen de `.cache/rivals-informe/<slug>.json`,
 * que es lo que deja `scripts/rivals-informe.mjs`. Las imágenes también, con
 * su propia caché en `.cache/informe-preview/img` para no pedir dos veces el
 * mismo escudo.
 *
 * Es el mismo montaje que `alineacion-pptx-harness.cjs` —`@napi-rs/canvas` con
 * Barlow Condensed registrada, un `document.createElement` de pega y un
 * `descarga` que escribe el fichero—, y está aquí por lo mismo: el dibujo se
 * revisa mirándolo, y abrir un navegador para cada retoque de una tabla es
 * media hora por cada dos píxeles.
 *
 * Vive dentro del repo a propósito: fuera no resolvería `typescript` ni
 * `@napi-rs/canvas`.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));
const {
  createCanvas,
  GlobalFonts,
  loadImage,
} = require(path.join(ROOT, "node_modules/@napi-rs/canvas"));

const SLUG = process.argv[2] ?? "teruel";
const SALIDA = process.argv[3] ?? ".cache/informe-preview";

const IMG_CACHE = path.join(SALIDA, "img");

fs.mkdirSync(IMG_CACHE, { recursive: true });

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

/* Cada lienzo que pide el módulo, en orden: son las diapositivas. */
const lienzos = [];

globalThis.document = {
  createElement(etiqueta) {
    if (etiqueta !== "canvas") throw new Error(`No sé hacer un <${etiqueta}>`);

    const canvas = createCanvas(1, 1);

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

/* ---- Las imágenes, de verdad y cacheadas ---- */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function bajaImagen(url) {
  const nombre = crypto.createHash("md5").update(url).digest("hex");

  const destino = path.join(IMG_CACHE, nombre);

  if (!fs.existsSync(destino)) {
    execFileSync("curl", [
      "-s",
      "--compressed",
      "--max-time",
      "30",
      "-H",
      `User-Agent: ${UA}`,
      "-o",
      destino,
      url,
    ]);
  }

  const bytes = fs.readFileSync(destino);

  /* Una descarga fallida deja un fichero minúsculo o una página de error: se
     descarta para que no reviente `loadImage` y el hueco quede vacío, que es
     lo mismo que hace la app cuando el proxy no contesta. */
  return bytes.length > 512 ? bytes : null;
}

const lienzoClub = require(path.join(ROOT, "lib/rivals/lienzo-club.ts"));

lienzoClub.cargaImagen = async (url) => {
  try {
    const bytes = bajaImagen(url);

    return bytes ? await loadImage(bytes) : null;
  } catch (error) {
    console.warn(`  imagen que no se ha podido cargar: ${url}`, error.message);

    return null;
  }
};

/* ---- `descarga` de pega ---- */

require.cache[require.resolve(path.join(ROOT, "lib/export/lienzos.ts"))] = {
  id: "lienzos",
  filename: "lienzos",
  loaded: true,
  exports: {
    descarga: async (blob, nombre) => {
      const bytes = Buffer.from(await blob.arrayBuffer());

      const destino = path.join(SALIDA, nombre);

      fs.writeFileSync(destino, bytes);

      console.log(`\n${destino} — ${(bytes.length / 1024).toFixed(0)} KB`);
    },
  },
};

const { exportInformePptx } = require(path.join(ROOT, "lib/rivals/informe-ppt.ts"));

/* ---- Los datos, los de verdad ---- */

const CACHE = path.join(ROOT, ".cache/rivals-informe", `${SLUG}.json`);

if (!fs.existsSync(CACHE)) {
  console.error(
    `No hay datos de "${SLUG}". Córrelo primero:\n` +
      `  node scripts/rivals-informe.mjs ${SLUG}`,
  );

  process.exit(1);
}

const informe = JSON.parse(fs.readFileSync(CACHE, "utf8"));

informe.nombre ||= informe.nombreLargo;

console.log(
  `${informe.nombreLargo}: ${informe.partidos.length} partidos ` +
    `(${informe.partidos.filter((p) => p.jugado).length} jugados), ` +
    `${informe.onces.length} alineaciones, ` +
    `${informe.clasificacion.total.length} en la tabla, ` +
    `${informe.goleadores.length} goleadores`,
);

exportInformePptx({
  informe,
  jornada: "1",
  fecha: "2026-08-31",
  enSuCampo: true,
  temporada: "26 / 27",
  competicion: "Primera Federación · Grupo 2",
})
  .then(() => {
    /* Cada lienzo de 3840×2160 es una diapositiva: se guardan en orden para
       poder mirarlas una a una. */
    lienzos
      .filter((canvas) => canvas.width > 1000)
      .forEach((canvas, indice) => {
        const destino = path.join(SALIDA, `hoja-${String(indice + 1).padStart(2, "0")}.png`);

        fs.writeFileSync(destino, canvas.toBuffer("image/png"));

        console.log(`  ${destino}`);
      });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
