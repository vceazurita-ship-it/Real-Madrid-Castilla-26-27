/**
 * FOTOGRAMAS DE LA RETRANSMISIÓN DE HUDL, SIN BAJAR EL PARTIDO ENTERO.
 *
 *   node scripts/hudl-fotogramas.mjs --partido <carpeta> --trabajos <trabajos.json>
 *
 * `<carpeta>` es la que dejó `hudl-partido.mjs` (con `hls.json`). Cada trabajo
 * es `{ dir, desde, dura }` en segundos del vídeo de Hudl —los del timeline—:
 * se bajan sólo los trozos que cubren ese tramo, con las cookies de la sesión
 * (en memoria, nunca en disco), y ffmpeg saca un fotograma por segundo
 * apilado de dos en dos (`s_01.jpg` = segundos 0 y 1 del tramo…).
 *
 * Dos trampas del J5 que ya están resueltas aquí:
 *  - ffmpeg directo contra el m3u8 da 403, y los nombres de los trozos no son
 *    correlativos: se leen de `hls.json`.
 *  - Sin `-fps_mode passthrough`, `tile` duplica fotogramas y salen imágenes
 *    repetidas que nadie nota mirándolas.
 *
 * Un trabajo cuya carpeta ya tiene imágenes se salta. Un trozo que no baja
 * (hay alguno roto en Hudl) deja el trabajo sin imágenes y se dice al final.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { abreHudl, cabecerasPara } from "./hudl-chrome.mjs";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const PARTIDO = arg("partido");
const TRABAJOS = arg("trabajos");

if (!PARTIDO || !TRABAJOS) {
  console.error("Uso: node scripts/hudl-fotogramas.mjs --partido <carpeta con hls.json> --trabajos <trabajos.json>");
  process.exit(1);
}

const hls = JSON.parse(fs.readFileSync(path.join(PARTIDO, "hls.json"), "utf8"));

const trabajos = JSON.parse(fs.readFileSync(TRABAJOS, "utf8"));

/* Dónde empieza cada trozo, sumando duraciones (no todos miden lo mismo). */
const inicios = [];

hls.dur.reduce((t, d, i) => ((inicios[i] = t), t + d), 0);

const trozoDe = (segundo) => {
  let i = 0;

  while (i + 1 < inicios.length && inicios[i + 1] <= segundo) i += 1;

  return i;
};

const nav = await abreHudl();

const fallos = [];

try {
  const cab = await cabecerasPara(nav, hls.base + (hls.init ?? hls.segs[0]));

  const baja = async (nombre) => {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(hls.base + nombre, { headers: cab });

        if (r.ok) return Buffer.from(await r.arrayBuffer());
      } catch {
        /* reintento */
      }
    }

    throw new Error(`no baja ${nombre}`);
  };

  const init = hls.init ? await baja(hls.init) : Buffer.alloc(0);

  const tmp = path.join(PARTIDO, "tmp");

  fs.mkdirSync(tmp, { recursive: true });

  for (const t of trabajos) {
    if (fs.existsSync(t.dir) && fs.readdirSync(t.dir).some((f) => f.endsWith(".jpg"))) {
      console.log("ya", t.dir);

      continue;
    }

    const desde = Math.max(0, Number(t.desde));
    const dura = Math.max(1, Number(t.dura));

    const s0 = trozoDe(desde);
    const s1 = trozoDe(desde + dura);

    try {
      const partes = [init];

      for (let s = s0; s <= s1; s++) partes.push(await baja(hls.segs[s]));

      const clip = path.join(tmp, "clip.mp4");

      fs.writeFileSync(clip, Buffer.concat(partes));

      fs.mkdirSync(t.dir, { recursive: true });

      execFileSync(FFMPEG, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(desde - inicios[s0]),
        "-i",
        clip,
        "-t",
        String(dura),
        "-vf",
        "fps=1,scale=1280:-2,tile=1x2",
        "-fps_mode",
        "passthrough",
        "-q:v",
        "3",
        "-y",
        path.join(t.dir, "s_%02d.jpg"),
      ]);

      console.log("ok", t.dir, fs.readdirSync(t.dir).length);
    } catch (error) {
      fallos.push(`${t.dir}: ${error.message}`);

      console.log("FALLO", t.dir, error.message);
    }
  }
} finally {
  await nav.cierra();
}

console.log(`RESUMEN: ${trabajos.length - fallos.length} de ${trabajos.length} tramos con imágenes`);

process.exit(fallos.length && fallos.length === trabajos.length ? 1 : 0);
