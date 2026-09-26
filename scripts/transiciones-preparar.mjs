/**
 * PREPARA UN PARTIDO ENTERO PARA ETIQUETAR SUS ROBOS.
 *
 *   node scripts/transiciones-preparar.mjs --video "C:/.../SANT ANDREU - RM CASTILLA.mov" --partido sant-andreu
 *   node scripts/transiciones-preparar.mjs --video "..." --partido sant-andreu --cada 4
 *
 * Es el paso 1 de los robos y transiciones, el que hasta ahora se hacía a mano
 * con ffmpeg y había que recordar de memoria. Saca las imágenes del partido,
 * las apila de dos en dos, las reparte en bloques de cinco minutos y deja
 * preparada la carpeta del etiquetado con un CSV vacío por bloque.
 *
 * **Lo único que hay que decir es dónde está el vídeo.** Todo lo demás sale de
 * ahí: la duración se le pregunta al fichero y los bloques se cuentan solos.
 *
 * ## Por qué dos instantes en la misma imagen
 *
 * Un robo es un cambio de dueño del balón, y en una imagen quieta no se
 * distingue el balón de una mancha del césped ni de la marca del punto de
 * penalti. Con dos instantes apilados sí: lo que se mueve entre el panel de
 * arriba y el de abajo es el balón, y lo que no se mueve está pintado.
 *
 * ## `--fps_mode passthrough` no es opcional
 *
 * Con `--cada` mayor que 1 se usa `select` para saltarse imágenes, y sin esa
 * bandera ffmpeg las repone DUPLICANDO la anterior al volver a velocidad
 * constante: salen los ficheros que tocan y la mitad son copias, y eso no se
 * nota mirándolas. Costó medio partido de los robos del Águilas. Al final se
 * comprueba con md5 y se avisa.
 *
 * ## Lo que este script NO hace
 *
 * Etiquetar. Mirar el partido imagen a imagen es el trabajo caro y no lo hace
 * ninguna máquina: aquí sólo se deja todo listo para hacerlo. Y el coste está
 * medido, así que se imprime antes de empezar en vez de descubrirlo a mitad.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RAIZ = path.resolve(import.meta.dirname, "..");

const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const FFPROBE = path.join(RAIZ, "node_modules", "ffprobe-static", "bin", "win32", "x64", "ffprobe.exe");

/** Donde vive el etiquetado, el mismo sitio que lee `transiciones-datos.mjs`. */
const ORIGEN = "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES";

/** Cada bloque del etiquetado son cinco minutos de vídeo. */
const SEGUNDOS_BLOQUE = 300;

function bandera(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);

  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const VIDEO = bandera("video");
const PARTIDO = bandera("partido");

/**
 * Cada cuántos segundos se saca una imagen.
 *
 * 1 es el partido entero imagen a imagen, que es lo que se hizo con el J2 y lo
 * que da el número de robos de verdad. Subirlo abarata el trabajo y **pierde
 * robos**: los que empiezan y acaban entre dos imágenes no se ven, y encima el
 * sesgo no es sólo de cantidad —se ven sobre todo los que llevan a algo—, así
 * que el reparto entre «hacia delante» y «horizontal o atrás» tampoco es
 * comparable con un partido mirado del tirón. Eso hay que decirlo en la ficha
 * del partido, y por eso se imprime aquí.
 */
const CADA = Number(bandera("cada", "1"));

/** Ancho al que se guardan las imágenes. Menos de 1280 y el balón se pierde. */
const ANCHO = Number(bandera("ancho", "1280"));

const SALIDA = bandera("salida", path.join(RAIZ, ".cache", "transiciones", PARTIDO ?? "partido"));

if (!VIDEO || !PARTIDO) {
  console.error(
    "Faltan datos. Ejemplo:\n" +
      '  node scripts/transiciones-preparar.mjs --video "C:/.../SANT ANDREU - RM CASTILLA.mov" --partido sant-andreu',
  );

  process.exit(1);
}

if (!fs.existsSync(VIDEO)) {
  console.error(`No existe el vídeo: ${VIDEO}`);

  process.exit(1);
}

/* ------------------------------------------------ cuánto dura ---- */

function duracionSegundos(ruta) {
  const salida = execFileSync(
    FFPROBE,
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      ruta,
    ],
    { encoding: "utf8" },
  );

  const segundos = Number.parseFloat(salida.trim());

  return Number.isFinite(segundos) ? Math.floor(segundos) : 0;
}

const DURACION = duracionSegundos(VIDEO);

if (DURACION <= 0) {
  console.error("No se ha podido leer la duración del vídeo.");

  process.exit(1);
}

/*
| Cada imagen cubre dos instantes separados `CADA` segundos, así que avanza
| `CADA * 2` de vídeo. De ahí salen cuántas hay y cuántas caen en cada bloque.
*/
const PASO = CADA * 2;

const IMAGENES = Math.ceil(DURACION / PASO);
const BLOQUES = Math.ceil(DURACION / SEGUNDOS_BLOQUE);

const mm = (s) => `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}`;

console.log(`\n  ${path.basename(VIDEO)}`);
console.log(`  ${mm(DURACION)} de vídeo · ${(fs.statSync(VIDEO).size / 1e9).toFixed(1)} GB`);
console.log(`  una imagen cada ${PASO} s (dos instantes separados ${CADA} s)`);
console.log(`  ${IMAGENES} imágenes en ${BLOQUES} bloques de ${SEGUNDOS_BLOQUE / 60} min`);
console.log(`  salida: ${SALIDA}`);

if (CADA > 1) {
  console.log(
    `\n  OJO: con --cada ${CADA} los robos que se cuenten son un SUELO, no un total,\n` +
      "  y el reparto entre ADELANTE y HORIZONTAL_ATRAS no se puede comparar con un\n" +
      "  partido mirado imagen a imagen. Dilo en las notas del partido.",
  );
}

console.log("");

/* ------------------------------------------------ las imágenes --- */

const tmp = path.join(SALIDA, "_sueltas");

/*
| SE REANUDA, Y NO ES UN LUJO.
|
| Esto empezaba borrando la carpeta de salida. Decodificar seis gigas y medio
| tarda lo suyo y se corta por cosas que no tienen nada que ver con el vídeo
| —al Sant Andreu lo paró el sistema por falta de memoria con 650 de 740
| imágenes hechas—, y entonces relanzarlo tiraba las que ya estaban y volvía a
| empezar desde el minuto cero.
|
| Lo que hay en `_sueltas` se cuenta y se sigue desde donde se quedó: cada
| imagen cubre `PASO` segundos, así que con `hechas` imágenes el vídeo está
| visto hasta el segundo `hechas * PASO`. Desde ahí se le pide a ffmpeg con
| `-ss`, y la numeración sigue con `-start_number`.
|
| La cuenta cuadra porque el arranque cae SIEMPRE en un múltiplo de `PASO`: el
| `select` del filtro cuenta fotogramas desde donde empieza, y empezando en un
| múltiplo la rejilla de segundos es la misma que la del primer intento. Con
| `--desdeCero` se fuerza el borrado.
|
| La última imagen del intento anterior se tira antes de seguir: si el corte la
| pilló a medio escribir, es media imagen.
*/
const DESDE_CERO = process.argv.includes("--desdeCero");

if (DESDE_CERO) fs.rmSync(SALIDA, { recursive: true, force: true });

fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

const yaEstaban = fs.readdirSync(tmp).filter((f) => f.endsWith(".jpg")).sort();

if (yaEstaban.length > 0) {
  fs.rmSync(path.join(tmp, yaEstaban[yaEstaban.length - 1]), { force: true });
  yaEstaban.pop();
}

const hechas = yaEstaban.length;
const desde = hechas * PASO;

const filtros = [
  "fps=1",
  CADA > 1 ? `select='not(mod(n\\,${CADA}))'` : "",
  `scale=${ANCHO}:-2`,
  /* Dos instantes, uno encima del otro. */
  "tile=1x2",
].filter(Boolean);

if (hechas > 0) {
  console.log(
    `  Reanudando: ${hechas} imágenes ya estaban, el vídeo visto hasta ${mm(desde)}.`,
  );
}

if (desde >= DURACION) {
  console.log("  Las imágenes ya estaban todas: no hay nada que sacar.");
} else {
  console.log("  Sacando las imágenes… (esto tarda: son varios gigas)");

  execFileSync(
    FFMPEG,
    [
      "-v", "error",
      /* Delante de `-i`: así el salto es rápido y no decodifica lo de antes. */
      ...(desde > 0 ? ["-ss", String(desde)] : []),
      "-i", VIDEO,
      "-vf", filtros.join(","),
      /* Sin esto, lo que `select` tira vuelve duplicado. */
      "-fps_mode", "passthrough",
      "-q:v", "3",
      "-start_number", String(hechas),
      path.join(tmp, "o_%05d.jpg"),
      "-y",
    ],
    { stdio: "inherit" },
  );
}

/* ------------------------------------------- repartir en bloques - */

const sueltas = fs.readdirSync(tmp).filter((f) => f.endsWith(".jpg")).sort();

const huellas = new Map();

let repetidas = 0;

for (const [k, fichero] of sueltas.entries()) {
  const segundo = k * PASO;

  const bloque = `b${String(Math.floor(segundo / SEGUNDOS_BLOQUE) * SEGUNDOS_BLOQUE).padStart(5, "0")}`;

  const carpeta = path.join(SALIDA, bloque);

  fs.mkdirSync(carpeta, { recursive: true });

  const origen = path.join(tmp, fichero);

  /* La comprobación que habría ahorrado medio partido del Águilas. */
  const huella = crypto.createHash("md5").update(fs.readFileSync(origen)).digest("hex");

  if (huellas.has(huella)) repetidas += 1;
  else huellas.set(huella, segundo);

  fs.renameSync(origen, path.join(carpeta, `p_${String(segundo).padStart(5, "0")}.jpg`));
}

fs.rmSync(tmp, { recursive: true, force: true });

/* ------------------------------------- la carpeta del etiquetado - */

const destinoBloques = path.join(ORIGEN, PARTIDO, "bloques");

fs.mkdirSync(destinoBloques, { recursive: true });

const CABECERA =
  "# segundo;zona;carril;accion;desenlace;duracion;pases;detalle;confianza\n" +
  "# zona: campo propio · medio campo · campo rival\n" +
  "# accion: ADELANTE · HORIZONTAL_ATRAS · DESPEJE · PERDIDA\n" +
  "# desenlace: REMATE · AREA · ULTIMO_TERCIO · PERDIDA · FUERA · FALTA_CONTRA · FALTA_FAVOR · POSESION · ATRAS_PORTERO\n" +
  "# NADA de punto y coma dentro del detalle: es el separador.\n";

let creados = 0;

for (let i = 0; i < BLOQUES; i += 1) {
  const bloque = `b${String(i * SEGUNDOS_BLOQUE).padStart(5, "0")}`;

  const csv = path.join(destinoBloques, `${bloque}.csv`);

  /* Un bloque ya etiquetado no se pisa: esto se lanza también para rehacer las
     imágenes de un partido a medias. */
  if (fs.existsSync(csv)) continue;

  fs.writeFileSync(csv, CABECERA, "utf8");
  creados += 1;
}

/* ------------------------------------------------ el resumen ----- */

const porBloque = fs
  .readdirSync(SALIDA)
  .filter((f) => f.startsWith("b"))
  .sort()
  .map((b) => ({
    bloque: b,
    cuantas: fs.readdirSync(path.join(SALIDA, b)).length,
  }));

console.log(`\n  ${sueltas.length} imágenes repartidas en ${porBloque.length} bloques`);

console.log(
  repetidas > 0
    ? `  OJO: ${repetidas} imágenes repetidas. Revisa el filtro antes de mirar nada.`
    : "  Ninguna imagen repetida.",
);

console.log(`  ${creados} CSV vacíos en ${destinoBloques}`);

console.log(
  `\n  Ahora toca mirar. Un bloque son ${porBloque[0]?.cuantas ?? 0} imágenes y el criterio\n` +
    `  está en ${path.join(ORIGEN, "MANUAL_ETIQUETADO.md")}.\n` +
    "  Cuando estén los CSV: node scripts/transiciones-datos.mjs\n",
);
