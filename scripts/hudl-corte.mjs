/**
 * CORTAR UN TRAMO DEL VÍDEO DE HUDL (03/11/2026).
 *
 * Lo comparten el vídeo del informe (`partido/video-informe.mjs`) y los
 * cortes de cada gol (`goles-liga.mjs`). La retransmisión de Hudl va en HLS
 * con trozos de ~4 s cuyos nombres NO son correlativos: se leen de `hls.json`
 * (lo deja `hudl-partido.mjs` junto al timeline). Los trozos van firmados con
 * cookies de CloudFront: ffmpeg contra el m3u8 da 403, así que se bajan con
 * las cookies de la sesión de Chrome (`cabecerasPara`, sólo en memoria), se
 * pegan detrás del `init` y ffmpeg recorta y recodifica el tramo.
 *
 * Hudl a veces devuelve un trozo vacío o a medias: tres intentos, ampliando
 * un trozo por cada lado, y el corte sólo vale si tiene imagen y dura al
 * menos la mitad de lo pedido (`corteValido`).
 */

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { cabecerasPara } from "./hudl-chrome.mjs";

const ejecuta = promisify(execFile);
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const FFMPEG = path.join(REPO, "node_modules", "ffmpeg-static", "ffmpeg.exe");

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

/** ¿El corte sirve? Que tenga imagen y dure al menos la mitad de lo pedido (dos cortes de la J09 salieron rotos). */
export async function corteValido(fichero, dura) {
  if (!fs.existsSync(fichero) || fs.statSync(fichero).size < 100_000) return false;

  /* ffmpeg -i sin salida sale con error, pero lo que importa es lo que cuenta del fichero. */
  const info = await ejecuta(FFMPEG, ["-hide_banner", "-i", fichero]).then(
    (r) => r.stderr,
    (e) => String(e.stderr ?? ""),
  );
  const d = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const segundos = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;

  return /Stream #.*Video:/.test(info) && segundos >= Math.min(dura ?? 0, 30) * 0.5;
}

/**
 * Prepara el vídeo de un partido para cortar: lee `hls.json` de su carpeta y
 * devuelve `corta(desde, dura, fichero)`. `nav` es la pestaña de `abreHudl()`.
 */
export async function preparaCortes(nav, carpeta, { anchoMax = 1920 } = {}) {
  const hls = JSON.parse(fs.readFileSync(path.join(carpeta, "hls.json"), "utf8"));
  const acumulado = [0];

  for (const d of hls.dur) acumulado.push(acumulado[acumulado.length - 1] + d);

  const cab = await cabecerasPara(nav, hls.base + hls.segs[0]);
  const baja = async (f) => {
    for (let i = 0; i < 4; i += 1) {
      const r = await fetch(hls.base + f, { headers: cab }).catch(() => null);

      if (r?.ok) return Buffer.from(await r.arrayBuffer());

      await espera(800);
    }

    throw new Error(`no baja ${f}`);
  };

  const init = hls.init ? await baja(hls.init) : Buffer.alloc(0);

  /** Corta [desde, desde + dura] (segundos del vídeo de Hudl) en `fichero`. Devuelve si ha salido bien. */
  async function corta(desde, dura, fichero) {
    if (await corteValido(fichero, dura)) return true;

    fs.rmSync(fichero, { force: true });
    fs.mkdirSync(path.dirname(fichero), { recursive: true });

    const crudo = `${fichero}.crudo.mp4`;

    for (let intento = 0; intento < 3; intento += 1) {
      const s0 = Math.max(0, acumulado.findIndex((a) => a > desde) - 1 - intento);
      const fin = acumulado.findIndex((a) => a >= desde + dura + 0.5);
      const s1 = Math.min(hls.segs.length - 1, (fin < 0 ? hls.segs.length : fin) - 1 + intento);
      const trozos = [init];

      try {
        for (let s = s0; s <= (s1 < s0 ? s0 + 2 : s1); s += 1) trozos.push(await baja(hls.segs[s]));

        fs.writeFileSync(crudo, Buffer.concat(trozos));

        await ejecuta(FFMPEG, [
          "-y", "-loglevel", "error",
          "-ss", String(Math.max(0, desde - acumulado[s0])),
          "-i", crudo,
          "-t", String(dura),
          "-vf", `scale='min(${anchoMax},iw)':-2`,
          "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "96k", "-ac", "1",
          "-movflags", "+faststart",
          fichero,
        ]);
      } catch (error) {
        console.log(`  (intento ${intento + 1}: ${String(error.message).split("\n")[0].slice(0, 120)})`);
      }

      if (await corteValido(fichero, dura)) break;

      fs.rmSync(fichero, { force: true });
      await espera(1500);
    }

    fs.rmSync(crudo, { force: true });

    return fs.existsSync(fichero);
  }

  return { corta, hls };
}
