/**
 * LAS PIZARRAS TAL CUAL (13/11/2026, petición urgente del analista).
 *
 * «Que saque exactamente las pizarras que pinto, que no las manipule»: aquí
 * no se vuelve a dibujar nada. Se fotografía la lámina de la pantalla (el
 * mismo nodo en el que se pinta) una a una, y cada foto va:
 *
 * - al PDF, una hoja por pizarra, del tamaño de la foto (sin recortar ni
 *   estirar);
 * - al PowerPoint, una diapositiva 16:9 por pizarra, con la foto centrada
 *   entera (si no es 16:9 quedan márgenes del color del fondo; nunca se
 *   deforma).
 *
 * Quien llama se encarga de ir poniendo cada pizarra en pantalla (`ponPizarra`)
 * y de volver a la que estaba.
 */

import { capturaNodo } from "@/lib/export/captura";
import { descarga, esperaFotos, pintado } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";

export type Foto = { dataUrl: string; ancho: number; alto: number };

const ANCHO_PPT = 1920;
const ALTO_PPT = 1080;
const FONDO = "#0F2036";

const espera = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

/** Fotografía cada pizarra tal y como está en la pantalla. */
export async function fotografiaPizarras(
  total: number,
  ponPizarra: (indice: number) => void,
  nodo: () => HTMLElement | null,
  alAvanzar?: (hecho: number, total: number) => void,
): Promise<Foto[]> {
  const fotos: Foto[] = [];
  for (let i = 0; i < total; i++) {
    ponPizarra(i);
    /* Que React pinte la pizarra nueva y carguen sus fotos. */
    await espera(150);
    await pintado();
    await pintado();
    const el = nodo();
    if (!el) throw new Error("No encuentro la pizarra en la pantalla.");
    await esperaFotos(el);
    const c = await capturaNodo(el, {
      formato: "png",
      pixelRatio: 2,
      /* Sólo se deja fuera el botón «ampliar» del móvil, que no es de la pizarra. */
      filter: (n) => !(n instanceof HTMLElement && n.dataset.fueraDeExportar === "si"),
    });
    fotos.push({ dataUrl: c.dataUrl, ancho: c.ancho, alto: c.alto });
    alAvanzar?.(i + 1, total);
  }
  return fotos;
}

function cargaImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se ha podido leer la foto de la pizarra."));
    img.src = src;
  });
}

/** La foto entera, centrada en 1920 × 1080, sin deformar. */
async function en16x9(foto: Foto): Promise<string> {
  const img = await cargaImagen(foto.dataUrl);
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO_PPT;
  lienzo.height = ALTO_PPT;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return foto.dataUrl;
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO_PPT, ALTO_PPT);
  const escala = Math.min(ANCHO_PPT / img.naturalWidth, ALTO_PPT / img.naturalHeight);
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (ANCHO_PPT - w) / 2, (ALTO_PPT - h) / 2, w, h);
  return lienzo.toDataURL("image/png");
}

export async function pptTalCual(fotos: Foto[], titulos: string[], nombre: string, titulo: string) {
  const diapositivas = [];
  for (let i = 0; i < fotos.length; i++) diapositivas.push({ titulo: titulos[i] ?? `Pizarra ${i + 1}`, imagen: await en16x9(fotos[i]) });
  const blob = creaPptx(diapositivas, { titulo, aplicacion: "Pizarra ABP · tal cual" });
  descarga(blob, `${nombre}.pptx`);
}

export async function pdfTalCual(fotos: Foto[], nombre: string) {
  const { jsPDF } = await import("jspdf");
  let doc: InstanceType<typeof jsPDF> | null = null;
  for (const f of fotos) {
    /* La hoja mide lo que la foto (en puntos, a 96 ppp): ni recorte ni estirado. */
    const w = (f.ancho * 72) / 96;
    const h = (f.alto * 72) / 96;
    const orientacion = w >= h ? "landscape" : "portrait";
    if (!doc) doc = new jsPDF({ orientation: orientacion, unit: "pt", format: [w, h], compress: true });
    else doc.addPage([w, h], orientacion);
    doc.addImage(f.dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
  }
  if (!doc) return;
  descarga(doc.output("blob"), `${nombre}.pdf`);
}
