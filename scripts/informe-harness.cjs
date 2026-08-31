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

/*
| Ya no se guardan los lienzos que se van pidiendo: desde que el informe va en
| piezas sueltas se hacen cientos por hoja —dos por pieza, el de pintar y el
| recortado— y tenerlos todos vivos hasta el final era memoria a cambio de
| nada. Lo que se mira ahora es la hoja recompuesta, más abajo.
*/
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

const {
  construyeHojasInforme,
  exportaHojasInforme,
} = require(path.join(ROOT, "lib/rivals/informe-ppt.ts"));

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

/*
| La plantilla y el once probable **no salen de BeSoccer**: los pone la
| pantalla de `/rivals` con lo que hay en la hoja RIVALES. Aquí se fabrican con
| los jugadores del último once bajado —cara de BeSoccer, dorsal y puesto— para
| poder mirar las dos hojas de campograma sin levantar la app.
|
| Lo que se ve aquí es el dibujo, no los datos: el pie dominante y el peso se
| inventan, y en la app son los de la hoja.
*/
const { reparteCampo } = require(path.join(ROOT, "lib/rivals/once-campo.ts"));

const SLOT_POR_PUESTO = [
  "por",
  "li",
  "dfc",
  "dfc",
  "ld",
  "mcd",
  "mc",
  "mc",
  "ei",
  "dc",
  "ed",
];

const LADO_POR_SLOT = { li: -1, ei: -1, ld: 1, ed: 1 };

const LINEA_POR_SLOT = {
  por: "portero",
  li: "defensa",
  ld: "defensa",
  dfc: "defensa",
  mcd: "medio",
  mc: "medio",
  ei: "ataque",
  ed: "ataque",
  dc: "ataque",
};

const plantilla = (informe.onces[0]?.jugadores ?? []).map((jugador, indice) => {
  const slot = SLOT_POR_PUESTO[indice % SLOT_POR_PUESTO.length];

  return {
    clave: `p${indice}`,
    dorsal: jugador.dorsal,
    nombre: jugador.nombre,
    slot,
    lado: LADO_POR_SLOT[slot] ?? 0,
    edad: String(20 + (indice % 12)),
    pie: indice % 3 === 0 ? "Zurdo" : "Diestro",
    altura: 175 + (indice % 15),
    peso: 68 + (indice % 12),
    foto: jugador.foto,
    estado: indice === 4 ? "LESIONADO" : "",
    portero: slot === "por",
    titular: 10 - (indice % 6),
    goles: indice % 4,
    encajados: slot === "por" ? 7 : null,
  };
});

const sitios = reparteCampo(
  plantilla.map((jugador) => ({
    clave: jugador.clave,
    posCode: jugador.slot.toUpperCase(),
    linea: LINEA_POR_SLOT[jugador.slot] ?? "medio",
  })),
);

const onceProbable = plantilla.flatMap((jugador, indice) => {
  const sitio = sitios.get(jugador.clave);

  return sitio
    ? [
        {
          clave: jugador.clave,
          x: sitio.x,
          y: sitio.y,
          estado: indice === 9 ? "duda" : "titular",
        },
      ]
    : [];
});

const DATOS = {
  informe,
  jornada: "1",
  fecha: "2026-08-31",
  enSuCampo: true,
  temporada: "26 / 27",
  competicion: "Primera Federación · Grupo 2",
  plantilla,
  onceProbable,
};

/**
 * Cada hoja se **recompone** aquí: el papel de fondo y encima cada pieza en su
 * caja, que es exactamente lo que hace PowerPoint al abrir el `.pptx`.
 *
 * Es la comprobación que importa desde que el informe va en piezas sueltas: si
 * una caja se calculó mal, el PNG lo enseña —una ficha desplazada, un panel
 * recortado— sin tener que abrir Office.
 */
async function componer(hoja) {
  const canvas = createCanvas(1920 * 2, 1080 * 2);
  const ctx = canvas.getContext("2d");

  ctx.scale(2, 2);

  const desdeDataUrl = (dataUrl) =>
    loadImage(Buffer.from(dataUrl.split(",")[1], "base64"));

  ctx.drawImage(await desdeDataUrl(hoja.fondo), 0, 0, 1920, 1080);

  for (const pieza of hoja.elementos) {
    ctx.drawImage(
      await desdeDataUrl(pieza.imagen),
      pieza.x,
      pieza.y,
      pieza.w,
      pieza.h,
    );
  }

  return canvas;
}

construyeHojasInforme(DATOS)
  .then(async (hojas) => {
    for (const [indice, hoja] of hojas.entries()) {
      const numero = String(indice + 1).padStart(2, "0");

      const canvas = await componer(hoja);

      const destino = path.join(SALIDA, `hoja-${numero}.png`);

      fs.writeFileSync(destino, canvas.toBuffer("image/png"));

      const fuera = hoja.elementos.filter(
        (pieza) =>
          pieza.x < -4 ||
          pieza.y < -4 ||
          pieza.x + pieza.w > 1924 ||
          pieza.y + pieza.h > 1084,
      );

      console.log(
        `  ${destino} — ${hoja.titulo} · ${hoja.elementos.length} piezas` +
          (fuera.length > 0
            ? ` · ¡${fuera.length} fuera de la hoja: ${fuera
                .map((pieza) => pieza.nombre)
                .slice(0, 4)
                .join(", ")}!`
            : ""),
      );
    }

    await exportaHojasInforme(hojas, DATOS);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
