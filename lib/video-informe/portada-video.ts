/*
|--------------------------------------------------------------------------
| LA PUERTA DEL VÍDEO EN EL CORREO Y EN EL PDF
|--------------------------------------------------------------------------
|
| Un correo no reproduce vídeo y un PDF impreso tampoco: lo que hace que el
| vídeo se vea es una buena puerta. Aquí están las tres:
|   - el PÓSTER: un fotograma de la portada del vídeo con el botón de
|     reproducir y la duración, que va en el cuerpo del correo (por cid)
|     enlazado al vídeo;
|   - la DIAPOSITIVA del vídeo: la última página del PDF del resumen, con el
|     póster, un código QR y el enlace, para abrirlo desde el papel o el móvil;
|   - el BLOQUE HTML del correo.
| Sólo necesitan un contexto 2D (navegador). El QR lo da `qrcode-generator`.
*/

import qrcode from "qrcode-generator";

const ORO = "#C8A96B";
const FONDO = "#08111F";

/** Pinta un QR en el contexto: cuadrado de `lado` px con su margen blanco. */
export function dibujaQr(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, lado: number) {
  const qr = qrcode(0, "M");

  qr.addData(texto);
  qr.make();

  const n = qr.getModuleCount();
  const margen = 4;
  const celda = lado / (n + margen * 2);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = "#0B0F14";

  for (let f = 0; f < n; f += 1) {
    for (let c = 0; c < n; c += 1) {
      if (qr.isDark(f, c)) ctx.fillRect(x + (c + margen) * celda, y + (f + margen) * celda, Math.ceil(celda), Math.ceil(celda));
    }
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** El botón de reproducir: círculo oro con el triángulo. */
function boton(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "rgba(8,17,31,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ORO;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0B0F14";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.32, cy - r * 0.45);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.lineTo(cx - r * 0.32, cy + r * 0.45);
  ctx.closePath();
  ctx.fill();
}

/**
 * El póster (1280×720, JPEG en data URL): el fotograma de la portada con un
 * velo, el botón y la duración. Sin fotograma, sobre el fondo de la casa.
 */
export async function posterDeVideo(fotograma: CanvasImageSource | null, opciones: { segundos: number; rotulo: string }): Promise<string> {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1280;
  lienzo.height = 720;

  pintaPoster(lienzo.getContext("2d")!, fotograma, opciones);

  return lienzo.toDataURL("image/jpeg", 0.85);
}

/** El dibujo del póster en un contexto de 1280×720 (vale también con @napi-rs/canvas, en el ordenador del club). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pintaPoster(ctx: CanvasRenderingContext2D, fotograma: any, opciones: { segundos: number; rotulo: string }) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, 1280, 720);

  if (fotograma) ctx.drawImage(fotograma, 0, 0, 1280, 720);

  const velo = ctx.createLinearGradient(0, 360, 0, 720);
  velo.addColorStop(0, "rgba(8,17,31,0)");
  velo.addColorStop(1, "rgba(8,17,31,0.85)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, 1280, 720);

  boton(ctx, 640, 360, 70);

  ctx.font = `700 30px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(`VER EL VÍDEO · ${mmss(opciones.segundos)}`, 56, 664);
  ctx.textAlign = "right";
  ctx.fillStyle = ORO;
  ctx.fillText(opciones.rotulo.toUpperCase(), 1224, 664);
  ctx.textAlign = "left";
}

/**
 * La última diapositiva del PDF del resumen (1920×1080, JPEG): el póster a
 * la izquierda y, a la derecha, el QR con el enlace. Así el PDF impreso o
 * reenviado lleva el vídeo dentro.
 */
export async function diapositivaDelVideo(opciones: { url: string; poster: string | null; titulo: string; segundos: number }): Promise<string> {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1920;
  lienzo.height = 1080;
  const ctx = lienzo.getContext("2d")!;

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, 1920, 1080);

  ctx.fillStyle = ORO;
  ctx.fillRect(96, 110, 60, 6);
  ctx.font = `700 30px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("REAL MADRID CASTILLA · EL VÍDEO DEL INFORME", 176, 122);
  ctx.font = `700 72px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(opciones.titulo.toUpperCase(), 96, 220);

  if (opciones.poster) {
    const img = new Image();
    img.src = opciones.poster;
    await img.decode().catch(() => {});

    if (img.width) {
      ctx.drawImage(img, 96, 290, 1120, 630);
      ctx.strokeStyle = ORO;
      ctx.lineWidth = 3;
      ctx.strokeRect(96, 290, 1120, 630);
    }
  }

  dibujaQr(ctx, opciones.url, 1330, 290, 480);

  ctx.font = `700 40px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Escanea para verlo", 1330, 840);
  ctx.font = `400 28px "Barlow Condensed", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(`${mmss(opciones.segundos)} · cortes, datos y voz`, 1330, 884);
  ctx.fillStyle = ORO;
  ctx.fillText("También va adjunto en el correo.", 1330, 924);

  return lienzo.toDataURL("image/jpeg", 0.9);
}

const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El bloque del correo: el póster enlazado al vídeo y una línea debajo. Para tablas de 960 px. */
export function bloqueVideoHtml(opciones: { url: string; cid: string; segundos: number; claro?: boolean; relleno?: string }) {
  const color = opciones.claro ? "#5B6472" : "#9AA3B2";

  /* Sin póster (cid vacío), sólo la línea con el enlace. */
  const imagen = opciones.cid
    ? `<a href="${escHtml(opciones.url)}" target="_blank" style="text-decoration:none"><img src="cid:${escHtml(opciones.cid)}" alt="Ver el vídeo del informe" width="960" style="display:block;width:100%;max-width:960px;height:auto;border-radius:10px;border:0"></a>`
    : "";

  return `<tr><td style="padding:${opciones.relleno ?? "10px 0 4px"}">${imagen}<p style="margin:8px 4px 0;font:400 13px/1.5 Arial,sans-serif;color:${color}">▶ <a href="${escHtml(opciones.url)}" target="_blank" style="color:#C8A96B;font-weight:700;text-decoration:none">Ver el vídeo (${mmss(opciones.segundos)})</a> · también va adjunto en este correo.</p></td></tr>`;
}
