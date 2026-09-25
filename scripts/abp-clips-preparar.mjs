/**
 * PREPARA UNA CARPETA DE CLIPS PARA MIRARLA IMAGEN A IMAGEN.
 *
 *   node scripts/abp-clips-preparar.mjs --carpeta "C:/.../FALTA OF" --salida .cache/clips/falta-of
 *   node scripts/abp-clips-preparar.mjs --carpeta "C:/.../SDB DEF" --salida .cache/clips/sdb-def --cada 4
 *
 * Saca un fotograma por segundo de cada clip y los apila de dos en dos, que es
 * como se distingue el balón: a resolución casi nativa y con dos instantes en
 * la misma imagen se ve qué se mueve y qué es una mancha del césped.
 *
 * **`--fps-mode passthrough` no es opcional.** Con `--cada` se usa `select`
 * para saltarse fotogramas, y sin esa bandera ffmpeg los repone duplicando al
 * pasar a velocidad constante: salen las imágenes que tocan pero la mitad son
 * copias de la anterior, y eso no se nota mirándolas. Costó medio partido de
 * los robos del Águilas. Al final se comprueba con md5 y se avisa.
 *
 * Es el mismo preparado para faltas y para saques de banda, y por eso la
 * carpeta se pasa por parámetro: cada semana los clips salen del coding con
 * otra ruta.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RAIZ = path.resolve(import.meta.dirname, "..");

const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");

function bandera(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);

  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const CARPETA = bandera("carpeta");
const SALIDA = bandera("salida", path.join(RAIZ, ".cache", "clips"));

/** Cuántos segundos de vídeo cubre cada imagen. 2 = un par por segundo. */
const CADA = Number(bandera("cada", "2"));

/** Recorte, para quitar la grada del primer plano de algunos estadios. */
const RECORTE = bandera("recorte", "");

if (!CARPETA) {
  console.error(
    "Falta --carpeta. Ejemplo:\n" +
      '  node scripts/abp-clips-preparar.mjs --carpeta "C:/.../FALTA OF" --salida .cache/clips/falta-of',
  );

  process.exit(1);
}

if (!fs.existsSync(CARPETA)) {
  console.error(`No existe la carpeta: ${CARPETA}`);

  process.exit(1);
}

const VIDEOS = fs
  .readdirSync(CARPETA)
  /*
  | Los `._algo` son la basura que deja macOS al copiar a un disco de Windows:
  | cuatro kilobytes que no son vídeo y con los que ffmpeg revienta. Los clips
  | vienen de un Mac, así que aparecen siempre y además descuadran la
  | numeración de los clips.
  */
  .filter((f) => !f.startsWith("._"))
  .filter((f) => /\.(mov|mp4|m4v|mkv)$/i.test(f))
  /* Los clips salen numerados del coding: 1, 2, 10… y no 1, 10, 2. */
  .sort((a, b) => {
    const na = Number((a.match(/(\d+)(?=\.\w+$)/) || [])[1] ?? 0);
    const nb = Number((b.match(/(\d+)(?=\.\w+$)/) || [])[1] ?? 0);

    return na - nb || a.localeCompare(b, "es");
  });

if (VIDEOS.length === 0) {
  console.error(`En ${CARPETA} no hay ningún vídeo.`);

  process.exit(1);
}

console.log(`\n  ${VIDEOS.length} clips en ${CARPETA}`);
console.log(`  una imagen por cada ${CADA * 2} s (dos instantes separados ${CADA} s)`);
console.log(`  salida: ${SALIDA}\n`);

fs.mkdirSync(SALIDA, { recursive: true });

let avisos = 0;

for (const [indice, video] of VIDEOS.entries()) {
  const nombre = `c${String(indice + 1).padStart(2, "0")}`;

  const destino = path.join(SALIDA, nombre);

  const tmp = path.join(SALIDA, `_tmp_${nombre}`);

  fs.rmSync(destino, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(destino, { recursive: true });

  const filtros = [
    RECORTE ? `crop=${RECORTE}` : "",
    "fps=1",
    CADA > 1 ? `select='not(mod(n\\,${CADA}))'` : "",
    "tile=1x2",
  ].filter(Boolean);

  try {
    execFileSync(
      FFMPEG,
      [
        "-v", "error",
        "-i", path.join(CARPETA, video),
        "-vf", filtros.join(","),
        /* Sin esto, lo que `select` tira vuelve duplicado. */
        "-fps_mode", "passthrough",
        "-q:v", "3",
        "-start_number", "0",
        path.join(tmp, "o_%03d.jpg"),
        "-y",
      ],
      { stdio: "pipe" },
    );
  } catch (error) {
    console.log(`  ${nombre} · ${video}: ffmpeg ha fallado (${error.message.slice(0, 60)})`);

    continue;
  }

  const sueltas = fs.readdirSync(tmp).sort();

  sueltas.forEach((f, k) => {
    const segundo = k * CADA * 2;

    fs.renameSync(
      path.join(tmp, f),
      path.join(destino, `s_${String(segundo).padStart(3, "0")}.jpg`),
    );
  });

  fs.rmSync(tmp, { recursive: true, force: true });

  /* La comprobación que habría ahorrado medio partido. */
  const huellas = new Set(
    fs
      .readdirSync(destino)
      .map((f) =>
        crypto.createHash("md5").update(fs.readFileSync(path.join(destino, f))).digest("hex"),
      ),
  );

  const repes = sueltas.length - huellas.size;

  if (repes > 0) avisos += 1;

  console.log(
    `  ${nombre} · ${video}: ${sueltas.length} imágenes` +
      (repes > 0 ? `  ¡${repes} REPETIDAS!` : ""),
  );
}

console.log(
  avisos > 0
    ? `\n  OJO: ${avisos} clips con imágenes repetidas. Revisa el filtro antes de mirar nada.\n`
    : "\n  Listo. Ninguna imagen repetida.\n",
);
