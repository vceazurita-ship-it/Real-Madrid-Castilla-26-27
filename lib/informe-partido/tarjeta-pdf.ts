/*
|--------------------------------------------------------------------------
| LA TARJETA DE UN PDF ENVIADO (18/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el usuario: que el enlace del PDF, al mandarlo por WhatsApp o por
| correo, se vea con algo (los dos escudos, el icono de PDF) y con la jornada
| y el partido en el nombre. Un enlace directo al PDF del almacén no trae
| vista previa; por eso se manda `/pdf/<ruta>` (app/pdf/[...ruta]), una página
| que da a WhatsApp el título y ESTA imagen y lleva al PDF al abrirla.
|
| La imagen se pinta aquí, en el navegador (1200×630, la medida de Open
| Graph), y se sube al lado del PDF con su mismo nombre (`.jpg`).
*/

import { buscadorDeEscudos, traeEscudos } from "@/lib/data-analisis/escudos";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";

const W = 1200;
const H = 630;
const FONDO = "#08111F";
const ORO = "#C8A96B";

/** «J8 · RM Castilla - Antequera CF · ABP»: el nombre del PDF (y del enlace). */
export function nombrePartidoPdf(o: { jornada: number | null; local: string; visitante: string; sufijo: string; respaldo: string }) {
  const partido = o.local && o.visitante ? `${o.local} - ${o.visitante}` : o.respaldo;

  return [o.jornada ? `J${o.jornada}` : "", partido, o.sufijo].filter(Boolean).join(" · ");
}

async function cargaImagen(src: string | null) {
  if (!src) return null;

  try {
    const r = await fetch(src);

    if (!r.ok) return null;

    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}

function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Corta el texto a lo que cabe en `ancho`, con puntos suspensivos. */
function cabe(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  if (ctx.measureText(texto).width <= ancho) return texto;

  let t = texto;

  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);

  return `${t.trimEnd()}…`;
}

/** Pinta la tarjeta: los dos escudos, el partido, lo que es (ABP, previa/post) y el icono de PDF. */
export async function tarjetaPdf(o: { jornada: number | null; local: string; visitante: string; titulo: string; detalle: string; fuente?: string }): Promise<Blob> {
  const fuente = `${o.fuente ? `${o.fuente}, ` : ""}"Barlow Condensed", "Segoe UI", Arial, sans-serif`;
  const busca = buscadorDeEscudos(await traeEscudos());
  const esNuestro = (n: string) => /castilla/i.test(n);
  const escudo = (n: string) => (esNuestro(n) ? "/logo.png" : n ? busca(n) : null);
  const [izq, der] = await Promise.all([cargaImagen(escudo(o.local)), cargaImagen(escudo(o.visitante))]);

  const lienzo = document.createElement("canvas");

  lienzo.width = W;
  lienzo.height = H;

  const ctx = lienzo.getContext("2d")!;

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, W, H);

  const brillo = ctx.createRadialGradient(W * 0.82, 0, 0, W * 0.82, 0, 760);

  brillo.addColorStop(0, "rgba(200,169,107,0.22)");
  brillo.addColorStop(1, "rgba(200,169,107,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, W, H);

  /* Los dos escudos, enfrentados. */
  const lado = 190;
  const y = 92;
  const pinta = (img: ImageBitmap | null, cx: number, nombre: string) => {
    if (img) {
      const e = Math.min(lado / img.width, lado / img.height);

      ctx.drawImage(img, cx - (img.width * e) / 2, y + (lado - img.height * e) / 2, img.width * e, img.height * e);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(cx, y + lado / 2, lado / 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `700 64px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(nombre.slice(0, 2).toUpperCase(), cx, y + lado / 2 + 22);
    }
  };

  pinta(izq, 250, o.local);
  pinta(der, 650, o.visitante);

  ctx.textAlign = "center";
  ctx.fillStyle = ORO;
  ctx.font = `700 54px ${fuente}`;
  ctx.fillText(o.jornada ? `J${o.jornada}` : "VS", 450, y + lado / 2 + 18);

  /* El icono de PDF, a la derecha. */
  const px = 900;
  const py = 70;

  ctx.fillStyle = "#FFFFFF";
  caja(ctx, px, py, 200, 250, 18);
  ctx.fill();
  ctx.fillStyle = "#E8E2D4";
  ctx.beginPath();
  ctx.moveTo(px + 140, py);
  ctx.lineTo(px + 200, py + 60);
  ctx.lineTo(px + 140, py + 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(8,17,31,0.18)";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(px + 30, py + 90 + i * 22, i === 3 ? 90 : 140, 8);
  ctx.fillStyle = "#D93A3A";
  caja(ctx, px - 20, py + 180, 150, 64, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 46px ${fuente}`;
  ctx.fillText("PDF", px + 55, py + 229);

  /* El partido y lo que es. */
  ctx.textAlign = "left";
  ctx.fillStyle = ORO;
  ctx.fillRect(80, 392, 70, 6);
  ctx.font = `700 26px ${fuente}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(cabe(ctx, `REAL MADRID CASTILLA · ${o.detalle.toUpperCase()}`, W - 250), 170, 404);
  ctx.fillStyle = "#FFFFFF";

  /* El partido entero: la letra baja hasta que cabe (y sólo si ni así, puntos suspensivos). */
  let cuerpo = 76;

  ctx.font = `700 ${cuerpo}px ${fuente}`;

  while (cuerpo > 44 && ctx.measureText(o.titulo).width > W - 160) {
    cuerpo -= 2;
    ctx.font = `700 ${cuerpo}px ${fuente}`;
  }

  ctx.fillText(cabe(ctx, o.titulo, W - 160), 80, 490);
  ctx.font = `400 30px ${fuente}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("Toca para abrir el informe", 80, 548);

  return await new Promise<Blob>((resolve, reject) => lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error("No se ha podido pintar la tarjeta."))), "image/jpeg", 0.9));
}

/**
 * Sube la tarjeta al lado del PDF y devuelve el enlace bonito
 * (`<este sitio>/pdf/<ruta del PDF>`). Si la tarjeta no sale, el enlace vale
 * igual (sin imagen); si no hay ruta, el del almacén.
 */
export async function enlaceConTarjeta(pdf: { url: string; path: string }, tarjeta: Parameters<typeof tarjetaPdf>[0]) {
  if (!/^2026\/informes\//.test(pdf.path)) return pdf.url;

  try {
    const imagen = await tarjetaPdf(tarjeta);

    await subeAdjunto(new File([imagen], pdf.path.split("/").pop()!.replace(/\.pdf$/, ".jpg"), { type: "image/jpeg" }), undefined, { junto: pdf.path });
  } catch (error) {
    console.warn("[pdf] la tarjeta de vista previa no ha salido", error);
  }

  return `${window.location.origin}/pdf/${pdf.path}`;
}
