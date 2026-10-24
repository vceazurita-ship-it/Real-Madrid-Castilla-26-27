/**
 * SACAR LA JUGADA DEL LABORATORIO (24/10/2026): PNG, PDF, MP4 y GIF.
 *
 * Todo sale del mismo SVG de la pizarra (`Escena`), sin capturar el DOM:
 * se serializa, se pinta en un lienzo y encima va el rótulo tipo
 * retransmisión (nombre, señal, momento de la jugada y el xG del remate).
 * Reutiliza lo que ya hay: `pdfDeHojas` y `descarga` de `lib/export/lienzos`,
 * el `MuxorMp4` del coding y el códec de las láminas de la pizarra táctica.
 * El GIF lo monta `gif.ts`. No se sube nada a ningún sitio.
 */

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { descarga, pdfDeHojas } from "@/lib/export/lienzos";
import { indexa, montaGif, paletaDe } from "@/lib/abp-lab/gif";
import { codecLamina, puedeHacerVideo } from "@/lib/tactics/lamina";

export type Rotulo = {
  titulo: string;
  sub: string;
  /** «Movimientos previos», «Remate»… */
  momento?: string;
  /** «xG 0,18», cuando ya ha llegado el remate. */
  dato?: string;
  /** El color de fondo de la pizarra, para las bandas. */
  fondo: string;
};

/** Un nombre de fichero sin tildes ni espacios. */
export function nombreFichero(nombre: string) {
  return (
    (nombre || "rutina")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "rutina"
  );
}

/** El SVG de la pizarra como imagen, sin lo que sólo sirve en pantalla. */
export function imagenDeSvg(svg: SVGSVGElement, ancho: number): Promise<HTMLImageElement> {
  const clon = svg.cloneNode(true) as SVGSVGElement;

  clon.querySelectorAll("[data-solo-pantalla]").forEach((n) => n.remove());

  const [, , vw, vh] = (clon.getAttribute("viewBox") ?? "0 0 160 100").split(/\s+/).map(Number);

  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clon.setAttribute("width", String(ancho));
  clon.setAttribute("height", String(Math.round((ancho * vh) / vw)));
  clon.removeAttribute("style");

  const datos = new XMLSerializer().serializeToString(clon);

  return new Promise((listo, falla) => {
    const img = new Image();

    img.onload = () => listo(img);
    img.onerror = () => falla(new Error("No se ha podido dibujar la pizarra"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(datos)}`;
  });
}

/**
 * Un fotograma: la pizarra entera, centrada, con su banda de título arriba y
 * el rótulo del momento abajo a la izquierda, como en televisión.
 */
export function pintaCuadro(ctx: CanvasRenderingContext2D, W: number, H: number, img: HTMLImageElement, r: Rotulo, familia: string) {
  const banda = Math.round(H * 0.1);

  ctx.fillStyle = r.fondo;
  ctx.fillRect(0, 0, W, H);

  /* La pizarra, tan grande como quepa debajo de la banda. */
  const k = Math.min(W / img.width, (H - banda) / img.height);

  const w = img.width * k;
  const h = img.height * k;
  const x = (W - w) / 2;
  const y = banda + (H - banda - h) / 2;

  ctx.drawImage(img, x, y, w, h);

  /* La banda: nombre en grande y, debajo, el club y la señal en oro. */
  ctx.fillStyle = "#0B0F14";
  ctx.fillRect(0, 0, W, banda);
  ctx.fillStyle = "#C8A96B";
  ctx.fillRect(0, banda - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));

  const pad = W * 0.025;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${Math.round(banda * 0.44)}px ${familia}, Arial Narrow, Arial, sans-serif`;
  ctx.fillText(r.titulo.toUpperCase(), pad, banda * 0.52, W * 0.7);
  ctx.fillStyle = "#C8A96B";
  ctx.font = `600 ${Math.round(banda * 0.22)}px ${familia}, Arial Narrow, Arial, sans-serif`;
  ctx.fillText(r.sub.toUpperCase(), pad, banda * 0.84, W * 0.7);

  /* El escudo de texto a la derecha. */
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `600 ${Math.round(banda * 0.22)}px ${familia}, Arial Narrow, Arial, sans-serif`;
  ctx.fillText("LABORATORIO DE ABP", W - pad, banda * 0.58);

  if (!r.momento && !r.dato) return;

  /* El rótulo de abajo: el momento en tinta y el dato en oro. */
  const alto = Math.round(H * 0.07);

  const y0 = H - alto - H * 0.04;

  ctx.font = `700 ${Math.round(alto * 0.46)}px ${familia}, Arial Narrow, Arial, sans-serif`;

  const textoM = (r.momento ?? "").toUpperCase();

  const anchoM = textoM ? ctx.measureText(textoM).width + alto * 0.8 : 0;

  ctx.font = `800 ${Math.round(alto * 0.5)}px ${familia}, Arial Narrow, Arial, sans-serif`;

  const anchoD = r.dato ? ctx.measureText(r.dato).width + alto * 0.8 : 0;

  if (anchoM) {
    ctx.fillStyle = "rgba(11,15,20,0.88)";
    ctx.fillRect(pad, y0, anchoM, alto);
    ctx.fillStyle = "#C8A96B";
    ctx.fillRect(pad, y0, Math.max(3, alto * 0.08), alto);
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${Math.round(alto * 0.46)}px ${familia}, Arial Narrow, Arial, sans-serif`;
    ctx.fillText(textoM, pad + alto * 0.4, y0 + alto * 0.66);
  }

  if (anchoD) {
    ctx.fillStyle = "#C8A96B";
    ctx.fillRect(pad + anchoM, y0, anchoD, alto);
    ctx.fillStyle = "#0B0F14";
    ctx.textAlign = "left";
    ctx.font = `800 ${Math.round(alto * 0.5)}px ${familia}, Arial Narrow, Arial, sans-serif`;
    ctx.fillText(r.dato!, pad + anchoM + alto * 0.4, y0 + alto * 0.68);
  }
}

function lienzo(W: number, H: number) {
  const c = document.createElement("canvas");

  c.width = W;
  c.height = H;

  const ctx = c.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("El navegador no da un lienzo 2D");

  return { c, ctx };
}

/** Espera a que React pinte el instante pedido (dos fotogramas, como la pizarra de ABP). */
const pintado = () => new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())));

/** Lo que el exportador necesita de la pizarra: poner un instante y leer el SVG ya pintado. */
export type Rodaje = {
  pon: (t: number) => void;
  svg: () => SVGSVGElement | null;
  rotulo: (t: number) => Rotulo;
  familia: string;
};

async function fotograma(rodaje: Rodaje, t: number, ancho: number) {
  rodaje.pon(t);
  await pintado();

  const svg = rodaje.svg();

  if (!svg) throw new Error("No hay pizarra que exportar");

  return imagenDeSvg(svg, ancho);
}

/* ------------------------------------------------------------------ */
/*  PNG Y PDF                                                          */
/* ------------------------------------------------------------------ */

export async function exportaPng(rodaje: Rodaje, t: number, nombre: string) {
  const { c, ctx } = lienzo(1920, 1080);

  pintaCuadro(ctx, 1920, 1080, await fotograma(rodaje, t, 1800), rodaje.rotulo(t), rodaje.familia);

  const blob = await new Promise<Blob | null>((listo) => c.toBlob(listo, "image/png"));

  if (!blob) throw new Error("No se ha podido montar la imagen");

  descarga(blob, `${nombreFichero(nombre)}.png`);
}

/** Una hoja por momento: salida, golpeo, remate y final. */
export async function exportaPdf(rodaje: Rodaje, instantes: { t: number; label: string }[], nombre: string, pie: string) {
  const hojas = [];

  for (const [i, m] of instantes.entries()) {
    const { c, ctx } = lienzo(1920, 1080);

    const r = rodaje.rotulo(m.t);

    pintaCuadro(ctx, 1920, 1080, await fotograma(rodaje, m.t, 1800), { ...r, momento: `${i + 1} · ${m.label}` }, rodaje.familia);

    hojas.push({ imagen: c.toDataURL("image/jpeg", 0.9), ancho: 1920, alto: 1080, orientacion: "landscape" as const, pie: { izquierda: pie, derecha: `${i + 1} / ${instantes.length}` } });
  }

  const doc = await pdfDeHojas(hojas);

  descarga(doc.output("blob"), `${nombreFichero(nombre)}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  VÍDEO Y GIF                                                        */
/* ------------------------------------------------------------------ */

/**
 * El guion del vídeo: un segundo quieta, la jugada a cámara lenta suave
 * alrededor del remate y dos segundos quieta al final. Devuelve los
 * instantes de cada fotograma.
 */
export function guion(fps: number, velocidad = 0.8, remate = 0.76) {
  const instantes: number[] = [];

  for (let k = 0; k < fps; k++) instantes.push(0);

  let t = 0;

  const paso = 1 / ((3.6 / velocidad) * fps);

  while (t < 1) {
    /* Más despacio cerca del remate, para que se lea el duelo. */
    const lento = Math.abs(t - remate) < 0.08 ? 0.45 : 1;

    t = Math.min(1, t + paso * lento);
    instantes.push(t);
  }

  for (let k = 0; k < fps * 2; k++) instantes.push(1);

  return instantes;
}

function copia(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen) ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength) : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

export const sabeVideo = () => puedeHacerVideo() || typeof MediaRecorder !== "undefined";

/** MP4 con WebCodecs; si el navegador no sabe, WebM grabando el lienzo. */
export async function exportaVideo(rodaje: Rodaje, nombre: string, avance: (fraccion: number) => void, ancho = 1920, alto = 1080) {
  const fps = 30;

  const instantes = guion(fps);

  const { c, ctx } = lienzo(ancho, alto);

  const codec = puedeHacerVideo() ? await codecLamina(ancho, alto, 6_000_000) : null;

  /* Los fotogramas repetidos (quieta) no se vuelven a dibujar. */
  let ultimo = -1;

  const dibuja = async (t: number) => {
    if (t === ultimo) return;

    ultimo = t;

    pintaCuadro(ctx, ancho, alto, await fotograma(rodaje, t, Math.round(ancho * 0.94)), rodaje.rotulo(t), rodaje.familia);
  };

  if (codec) {
    const muxor = new MuxorMp4();

    let fallo: Error | null = null;

    const codificador = new VideoEncoder({
      output: (trozo, meta) => {
        const descripcion = meta?.decoderConfig?.description;

        if (descripcion) muxor.configuraVideo({ ancho, alto, descripcion: copia(descripcion) });

        const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

        trozo.copyTo(datos);
        muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / fps, trozo.type === "key");
      },
      error: (e) => {
        fallo = e instanceof Error ? e : new Error(String(e));
      },
    });

    try {
      codificador.configure({ codec, width: ancho, height: alto, bitrate: 6_000_000, framerate: fps, latencyMode: "quality", avc: { format: "avc" } });

      for (const [n, t] of instantes.entries()) {
        if (fallo) throw fallo;

        await dibuja(t);

        const cuadro = new VideoFrame(c, { timestamp: Math.round((n * 1_000_000) / fps), duration: Math.round(1_000_000 / fps) });

        codificador.encode(cuadro, { keyFrame: n % (fps * 2) === 0 });
        cuadro.close();

        while (codificador.encodeQueueSize > 6) await new Promise((listo) => setTimeout(listo, 5));

        avance((n + 1) / instantes.length);
      }

      await codificador.flush();

      if (fallo) throw fallo;

      const fichero = muxor.cierra();

      descarga(fichero, `${nombreFichero(nombre)}.mp4`);

      return { formato: "MP4", bytes: fichero.size, segundos: instantes.length / fps };
    } finally {
      if (codificador.state !== "closed") codificador.close();
    }
  }

  if (typeof MediaRecorder === "undefined") throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

  /* El respaldo: grabar el lienzo a su ritmo. */
  const flujo = c.captureStream(fps);

  const tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x)) ?? "video/webm";

  const grabadora = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 5_000_000 });

  const trozos: Blob[] = [];

  grabadora.ondataavailable = (e) => {
    if (e.data.size) trozos.push(e.data);
  };

  const acabado = new Promise<void>((listo) => {
    grabadora.onstop = () => listo();
  });

  await dibuja(0);

  grabadora.start();

  let antes = performance.now();

  for (const [n, t] of instantes.entries()) {
    await dibuja(t);

    const espera = 1000 / fps - (performance.now() - antes);

    if (espera > 0) await new Promise((listo) => setTimeout(listo, espera));

    antes = performance.now();

    avance((n + 1) / instantes.length);
  }

  grabadora.stop();

  await acabado;

  const fichero = new Blob(trozos, { type: "video/webm" });

  descarga(fichero, `${nombreFichero(nombre)}.webm`);

  return { formato: "WebM", bytes: fichero.size, segundos: instantes.length / fps };
}

/** El GIF: 720 de ancho a unos 12 fotogramas por segundo, con la paleta de la propia jugada. */
export async function exportaGif(rodaje: Rodaje, nombre: string, avance: (fraccion: number) => void) {
  const ancho = 720;

  const alto = 405;

  const fps = 12;

  const { ctx } = lienzo(ancho, alto);

  const instantes = guion(fps).filter((t, i, todos) => i === 0 || t !== todos[i - 1]);

  const crudos: { datos: Uint8ClampedArray; centesimas: number }[] = [];

  for (const [n, t] of instantes.entries()) {
    pintaCuadro(ctx, ancho, alto, await fotograma(rodaje, t, 680), rodaje.rotulo(t), rodaje.familia);

    const quieta = n === 0 ? 100 : n === instantes.length - 1 ? 220 : Math.round(100 / fps);

    crudos.push({ datos: ctx.getImageData(0, 0, ancho, alto).data, centesimas: quieta });

    avance(((n + 1) / instantes.length) * 0.85);
  }

  const { paleta, indice } = paletaDe([crudos[0].datos, crudos[Math.floor(crudos.length / 2)].datos, crudos.at(-1)!.datos]);

  const fotogramas = crudos.map((f) => ({ indices: indexa(f.datos, indice), centesimas: f.centesimas }));

  avance(0.95);

  const fichero = montaGif(ancho, alto, paleta, fotogramas);

  descarga(fichero, `${nombreFichero(nombre)}.gif`);

  avance(1);

  return { formato: "GIF", bytes: fichero.size, segundos: fotogramas.reduce((s, f) => s + f.centesimas, 0) / 100 };
}
