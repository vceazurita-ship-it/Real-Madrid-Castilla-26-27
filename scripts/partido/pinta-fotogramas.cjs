/**
 * UN HILO QUE PINTA FOTOGRAMAS DEL VÍDEO DEL INFORME (16/10/2026).
 *
 * `video-informe.mjs` pintaba los ~4 000 fotogramas de un vídeo de 2 minutos
 * de uno en uno, en un solo núcleo: 11 minutos en el ordenador del club. Ahora
 * reparte tandas de fotogramas entre varios hilos como éste; cada uno tiene su
 * lienzo de 1920×1080, sus escudos y sus fotogramas de los cortes, y devuelve
 * los píxeles de cada fotograma (RGBA) para que el principal se los pase a
 * ffmpeg en orden.
 *
 * Lo que recibe al nacer (`workerData`): el guion repartido (`escenas`, sin la
 * voz), dónde empieza cada escena, las imágenes por ruta y los cortes por su
 * carpeta de fotogramas. Luego, mensajes `{ desde, hasta }` (fotogramas
 * globales); contesta uno por fotograma `{ n, datos }` y `{ hecho: true }`.
 */

const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");

require("../cargador-ts.cjs");

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { ANCHO_HD, ALTO_HD, FPS, corteEn, pintaFotograma, rellenaGrano } = require("../../lib/video-informe/dibujo.ts");

const { escenas, arranques, tramos, total, titulo, fuente, imagenes, cortes, fuentes } = workerData;

for (const ruta of fuentes) if (fs.existsSync(ruta)) GlobalFonts.registerFromPath(ruta, "Barlow Condensed");

const lienzo = createCanvas(ANCHO_HD, ALTO_HD);
const ctx = lienzo.getContext("2d");
const grano = createCanvas(256, 256);

rellenaGrano(grano.getContext("2d"));

const totalFotogramas = Math.round(total * FPS);
const marcas = arranques.slice(1).map((a) => a / total);
const cortesPorClave = new Map(cortes);

let rec = null;
let ultimoCuadro = { ruta: "", img: null };

async function recursos() {
  if (rec) return rec;

  rec = { imagenes: new Map() };

  for (const [clave, src] of imagenes) {
    try {
      rec.imagenes.set(clave, src ? await loadImage(src) : null);
    } catch {
      rec.imagenes.set(clave, null);
    }
  }

  return rec;
}

/** La escena y el fotograma dentro de ella de un fotograma global. */
function dondeCae(n) {
  let k = tramos.findIndex((t) => n < t.desde + t.cuantos);

  if (k < 0) k = tramos.length - 1;

  return { k, i: n - tramos[k].desde, cuantos: tramos[k].cuantos };
}

async function pinta(n) {
  const r = await recursos();
  const { k, i, cuantos } = dondeCae(n);
  const x = escenas[k];
  const e = x.escena;
  const t = i / FPS;
  let cuadro = null;

  if (e.tipo === "clips") {
    const { k: c, tv } = corteEn(e, t, x.segundos);
    const corte = cortesPorClave.get(`${e.id}:${c}`);

    if (corte) {
      /* Desde dónde y a qué velocidad: la repetición vuelve al remate a media velocidad. */
      const enFichero = (corte.desdeFichero ?? 0) + tv * (corte.velocidad ?? 1);
      const ruta = path.join(corte.dir, `f_${String(Math.min(Math.round(enFichero * FPS) + 1, 9999)).padStart(4, "0")}.jpg`);

      if (ruta !== ultimoCuadro.ruta) {
        try {
          ultimoCuadro = { ruta, img: fs.existsSync(ruta) ? await loadImage(ruta) : ultimoCuadro.img };
        } catch {
          ultimoCuadro = { ruta, img: ultimoCuadro.img };
        }
      }

      cuadro = ultimoCuadro.img;
    }
  }

  pintaFotograma(ctx, grano, fuente, titulo, r, { medida: x, t, global: arranques[k] + t, progreso: n / totalFotogramas, restante: (cuantos - i) / FPS, cuadro, marcas });

  /* Una copia propia de los píxeles, para pasársela al principal sin copiarla otra vez. */
  const datos = new Uint8Array(lienzo.data());

  parentPort.postMessage({ n, datos }, [datos.buffer]);
}

parentPort.on("message", async ({ desde, hasta }) => {
  try {
    for (let n = desde; n < hasta; n += 1) await pinta(n);

    parentPort.postMessage({ hecho: true, desde });
  } catch (error) {
    parentPort.postMessage({ error: String(error?.stack ?? error) });
  }
});
