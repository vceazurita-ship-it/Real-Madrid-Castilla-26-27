/**
 * GUARDA UNA FOTO DE LO QUE LLEVAN LOS NUESTROS EN WYSCOUT.
 *
 * La descarga individual de Wyscout es acumulada: una fila por jugador con la
 * temporada entera. Guardando una foto cada semana, **la resta entre dos fotos
 * es lo que pasó en medio** —la jornada—, que es lo que esa descarga no da.
 * La resta vive en `lib/data-analisis/instantaneas.ts`; esto sólo toma la foto.
 *
 * Se ejecuta solo al final de `scripts/actualizar-wys.cmd`, después de releer
 * la carpeta, y **no tumba nada si falla**: bajar los datos es lo importante;
 * la foto se puede tomar otro día a mano.
 *
 *   node scripts/wyscout-instantanea.cjs            → la toma y la guarda
 *   node scripts/wyscout-instantanea.cjs --ver      → dice qué haría, sin tocar
 *   node scripts/wyscout-instantanea.cjs --nota J5  → le pone una nota
 *
 * Es idempotente: si nadie ha jugado desde la última foto —mismos minutos y
 * partidos para todos—, no guarda nada.
 */

const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/* El cargador de TypeScript del proyecto, que ya usan los otros arneses. */
require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

require("dotenv").config({ path: path.join(RAIZ, ".env.local"), quiet: true });

const { expandeIndice } = require(path.join(RAIZ, "lib/data-analisis/leer.ts"));
const {
  CLAVE_INSTANTANEAS,
  HISTORIAL_VACIO,
  instantaneaDe,
  mismaFoto,
  tramoEntre,
} = require(path.join(RAIZ, "lib/data-analisis/instantaneas.ts"));
const { VOLUMEN_DEL_PORCENTAJE } = require(path.join(RAIZ, "lib/data-analisis/individual.ts"));
const { readDoc, writeDoc } = require(path.join(RAIZ, "lib/docStore.ts"));

const soloVer = process.argv.includes("--ver");

const nota = (() => {
  const donde = process.argv.indexOf("--nota");

  return donde >= 0 ? process.argv[donde + 1] : undefined;
})();

async function main() {
  const indice = path.join(RAIZ, "public/data/analisis.json");

  if (!fs.existsSync(indice)) {
    console.error(
      "[instantanea] no está public/data/analisis.json. Pasa antes scripts/data-analisis-indice.cjs.",
    );

    process.exit(1);
  }

  const datos = expandeIndice(JSON.parse(fs.readFileSync(indice, "utf8")));

  const foto = instantaneaDe(datos.jugadores, new Date(), nota);

  if (foto.jugadores.length === 0) {
    console.error("[instantanea] la descarga no trae jugadores del Castilla de esta temporada.");

    process.exit(1);
  }

  const { data } = await readDoc(CLAVE_INSTANTANEAS);

  const historial = data && Array.isArray(data.fotos) ? data : HISTORIAL_VACIO;

  const ultima = historial.fotos[historial.fotos.length - 1];

  console.log(
    `[instantanea] ${foto.jugadores.length} jugadores · ${historial.fotos.length} foto(s) guardadas hasta ahora`,
  );

  if (ultima && mismaFoto(ultima, foto)) {
    console.log(
      `[instantanea] nadie ha jugado desde la del ${ultima.tomadaEn.slice(0, 10)}: no se guarda nada.`,
    );

    return;
  }

  if (ultima) {
    const tramos = tramoEntre(ultima, foto, VOLUMEN_DEL_PORCENTAJE);

    console.log(
      `[instantanea] entre las dos fotos han jugado ${tramos.length}: ${tramos
        .slice(0, 5)
        .map((uno) => `${uno.fila.jugador} ${uno.minutos}′`)
        .join(", ")}${tramos.length > 5 ? "…" : ""}`,
    );
  } else {
    console.log(
      "[instantanea] es la PRIMERA foto: sirve de punto de partida. La jornada que viene ya se podrá restar.",
    );
  }

  if (soloVer) {
    console.log("[instantanea] --ver: no se ha guardado nada.");

    return;
  }

  const actualizado = { fotos: [...historial.fotos, foto] };

  await writeDoc(CLAVE_INSTANTANEAS, "wyscout-instantaneas", actualizado);

  /* Releer: el `ok` de una escritura no es una comprobación. */
  const { data: despues } = await readDoc(CLAVE_INSTANTANEAS);

  console.log(
    `[instantanea] guardada. Ahora hay ${despues?.fotos?.length ?? 0} foto(s).`,
  );
}

main().catch((error) => {
  console.error("[instantanea]", error.message);

  process.exit(1);
});
