/**
 * EL INFORME EN UN SOLO PDF (16/10/2026).
 *
 * El cuerpo técnico pidió «un PDF y un vídeo, y desde el PDF que se enlace al
 * resto»: antes el correo del completo llevaba el PDF del completo, el del
 * resumen, el PowerPoint, la plantilla y el informe del rival y el vídeo, todo
 * suelto. Ahora va un PDF que junta las diapositivas del resumen (en
 * horizontal) y las hojas del completo (A4), y acaba en «Vídeo y documentos»:
 * el póster del vídeo en HD con su QR y una fila por documento, todo pulsable.
 * Lo único que viaja aparte es la copia ligera del vídeo.
 *
 * Se usa en el navegador.
 */

import { pdfDeHojas, type HojaPdf } from "@/lib/export/lienzos";
import { dibujaQr } from "@/lib/video-informe/portada-video";

const FONDO = "#08111F";
const ORO = "#C8A96B";

/** La página final, del tamaño de una diapositiva. */
const W = 1920;
const H = 1080;

export type EnlaceInforme = { nombre: string; url: string; /** «PowerPoint · 4,2 MB», «PDF de la plantilla»… */ detalle?: string };

export type VideoInforme = { url: string; poster: string | null; segundos: number };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function cargaImagen(src: string) {
  const img = new Image();

  img.src = src;
  await img.decode().catch(() => undefined);

  return img.width ? img : null;
}

/** «Vídeo y documentos»: la imagen y las zonas que se pueden pulsar (en fracciones). */
export async function paginaDeEnlaces(o: { titulo: string; video: VideoInforme | null; enlaces: EnlaceInforme[] }): Promise<{ imagen: string; enlaces: NonNullable<HojaPdf["enlaces"]> }> {
  const lienzo = document.createElement("canvas");

  lienzo.width = W;
  lienzo.height = H;

  const ctx = lienzo.getContext("2d")!;
  const zonas: NonNullable<HojaPdf["enlaces"]> = [];
  const zona = (x: number, y: number, w: number, h: number, url: string) => zonas.push({ x: x / W, y: y / H, w: w / W, h: h / H, url });

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = ORO;
  ctx.fillRect(96, 110, 60, 6);
  ctx.font = `700 30px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("REAL MADRID CASTILLA · VÍDEO Y DOCUMENTOS", 176, 122);
  ctx.font = `700 64px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(o.titulo.toUpperCase(), 96, 212);

  /* El vídeo: el póster (pulsable) y debajo el QR, para el que lo tenga impreso. */
  const conVideo = Boolean(o.video?.url);
  const xDocs = conVideo ? 1000 : 96;

  if (o.video?.url) {
    const poster = o.video.poster ? await cargaImagen(o.video.poster) : null;

    if (poster) ctx.drawImage(poster, 96, 270, 800, 450);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(96, 270, 800, 450);
    }

    ctx.strokeStyle = ORO;
    ctx.lineWidth = 3;
    ctx.strokeRect(96, 270, 800, 450);
    zona(96, 270, 800, 450, o.video.url);

    dibujaQr(ctx, o.video.url, 96, 750, 230);
    zona(96, 750, 230, 230, o.video.url);

    ctx.font = `700 40px "Barlow Condensed", Arial, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Ver el vídeo en HD · ${mmss(o.video.segundos)}`, 360, 830);
    ctx.font = `400 28px "Barlow Condensed", Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("Pulsa el póster o escanea el código.", 360, 874);
    zona(360, 790, 520, 60, o.video.url);
  }

  /* Los documentos, una fila por cada uno. */
  ctx.font = `700 26px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = ORO;
  ctx.fillText(o.enlaces.length ? "DOCUMENTOS" : "", xDocs, 290);

  const anchoFila = W - 96 - xDocs;

  o.enlaces.slice(0, 7).forEach((e, i) => {
    const y = 320 + i * 96;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(xDocs, y, anchoFila, 80);
    ctx.fillStyle = ORO;
    ctx.fillRect(xDocs, y, 6, 80);
    ctx.font = `700 30px "Barlow Condensed", Arial, sans-serif`;
    ctx.fillStyle = "#FFFFFF";

    let nombre = e.nombre;

    while (ctx.measureText(nombre).width > anchoFila - 200 && nombre.length > 10) nombre = `${nombre.slice(0, -2).trimEnd()}…`;

    ctx.fillText(nombre, xDocs + 28, y + 36);

    if (e.detalle) {
      ctx.font = `400 22px "Barlow Condensed", Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(e.detalle, xDocs + 28, y + 64);
    }

    ctx.font = `700 24px "Barlow Condensed", Arial, sans-serif`;
    ctx.fillStyle = ORO;
    ctx.textAlign = "right";
    ctx.fillText("ABRIR", xDocs + anchoFila - 28, y + 48);
    ctx.textAlign = "left";
    zona(xDocs, y, anchoFila, 80, e.url);
  });

  ctx.font = `400 22px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("Los enlaces se mantienen 30 días.", 96, H - 50);

  return { imagen: lienzo.toDataURL("image/jpeg", 0.88), enlaces: zonas };
}

/**
 * LA PRIMERA PÁGINA, EL VÍDEO (22/10/2026, crítica del productor de vídeo):
 * el PDF se abre con el póster grande (el del dato fuerte) y el QR, todo
 * pulsable. Lo primero que se ve al abrir el informe es la puerta al vídeo,
 * no la última página que nadie alcanza.
 */
export async function paginaDelVideo(o: { titulo: string; video: VideoInforme }): Promise<{ imagen: string; enlaces: NonNullable<HojaPdf["enlaces"]> }> {
  const lienzo = document.createElement("canvas");

  lienzo.width = W;
  lienzo.height = H;

  const ctx = lienzo.getContext("2d")!;
  const zonas: NonNullable<HojaPdf["enlaces"]> = [];
  const zona = (x: number, y: number, w: number, h: number) => zonas.push({ x: x / W, y: y / H, w: w / W, h: h / H, url: o.video.url });

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = ORO;
  ctx.fillRect(96, 92, 60, 6);
  ctx.font = `700 30px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("REAL MADRID CASTILLA · EMPIEZA POR EL VÍDEO", 176, 104);
  ctx.font = `700 60px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(o.titulo.toUpperCase(), 96, 186);

  /* El póster, a lo grande y pulsable (16:9). */
  const pw = 1200;
  const ph = 675;
  const poster = o.video.poster ? await cargaImagen(o.video.poster) : null;

  if (poster) ctx.drawImage(poster, 96, 250, pw, ph);
  else {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(96, 250, pw, ph);
  }

  ctx.strokeStyle = ORO;
  ctx.lineWidth = 3;
  ctx.strokeRect(96, 250, pw, ph);
  zona(96, 250, pw, ph);

  /* A la derecha, el QR para el que lo tenga impreso y la duración. */
  const xq = 96 + pw + 80;
  const lado = W - 96 - xq;

  dibujaQr(ctx, o.video.url, xq, 250, lado);
  zona(xq, 250, lado, lado);

  ctx.font = `700 40px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`Ver el vídeo en HD · ${mmss(o.video.segundos)}`, xq, 250 + lado + 64);
  ctx.font = `400 28px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("Pulsa el póster o escanea el código.", xq, 250 + lado + 108);
  zona(xq, 250 + lado + 20, lado, 100);

  return { imagen: lienzo.toDataURL("image/jpeg", 0.88), enlaces: zonas };
}

/**
 * Las diapositivas (1920×1080, horizontal), las hojas del completo (A4,
 * vertical) y la página de vídeo y documentos, en un PDF.
 */
export async function informeUnicoPdf(o: {
  titulo: string;
  diapos: string[];
  hojas?: { hojas: string[]; ancho: number; alto: number } | null;
  final?: { imagen: string; enlaces: NonNullable<HojaPdf["enlaces"]> } | null;
  /** La misma página de vídeo y documentos, pero DELANTE de todo (la de ABP desde el 18/10/2026). */
  inicio?: { imagen: string; enlaces: NonNullable<HojaPdf["enlaces"]> } | null;
}): Promise<Blob> {
  const paginas: HojaPdf[] = [
    ...(o.inicio ? [{ imagen: o.inicio.imagen, ancho: W, alto: H, orientacion: "landscape" as const, margen: 0, enlaces: o.inicio.enlaces }] : []),
    ...o.diapos.map((imagen) => ({ imagen, ancho: W, alto: H, orientacion: "landscape" as const, margen: 0 })),
    ...(o.hojas?.hojas ?? []).map((imagen) => ({ imagen, ancho: o.hojas!.ancho, alto: o.hojas!.alto, orientacion: "portrait" as const, margen: 0 })),
    ...(o.final ? [{ imagen: o.final.imagen, ancho: W, alto: H, orientacion: "landscape" as const, margen: 0, enlaces: o.final.enlaces }] : []),
  ];

  const pdf = await pdfDeHojas(paginas);

  (pdf as { setProperties?: (p: Record<string, string>) => void }).setProperties?.({
    title: `Real Madrid Castilla · ${o.titulo}`,
    author: "Real Madrid Castilla · Cuerpo técnico",
    creator: "Plataforma del Castilla",
  });

  return pdf.output("blob") as Blob;
}
