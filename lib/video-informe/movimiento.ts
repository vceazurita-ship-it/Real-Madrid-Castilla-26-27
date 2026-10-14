/*
|--------------------------------------------------------------------------
| EL MOVIMIENTO DEL VÍDEO: CURVAS, CORTINILLAS, ANILLOS (14/10/2026)
|--------------------------------------------------------------------------
|
| Lo que hace que el vídeo parezca de retransmisión y no una presentación:
| las entradas con inercia y un pequeño rebote, los números que cuentan, la
| cortinilla en diagonal entre escenas y los anillos de porcentaje.
|
| Con dos piezas libres de d3 (GitHub d3/d3-ease, BSD-3-Clause, y
| d3/d3-shape, ISC), que ya venían con recharts y aquí se fijan en
| package.json: las curvas de animación de d3-ease y el generador de arcos de
| d3-shape, que dibuja directamente sobre un contexto 2D. Sólo aritmética y
| `CanvasRenderingContext2D`: vale igual en el navegador que en Node con
| @napi-rs/canvas.
*/

import { easeBackOut, easeCubicInOut, easeExpOut, easeQuadOut } from "d3-ease";
import { arc } from "d3-shape";

type Lienzo = CanvasRenderingContext2D;

const recorta = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Entrada con inercia (frena al llegar). */
export const sale = (t: number) => easeExpOut(recorta(t));

/** Entrada con un pequeño rebote al final. */
const rebote = easeBackOut.overshoot(1.4);
export const salta = (t: number) => rebote(recorta(t));

/** Ida y vuelta suave (las cortinillas). */
export const viaja = (t: number) => easeCubicInOut(recorta(t));

export const suaviza = (t: number) => easeQuadOut(recorta(t));

/** Lo que va de `desde` a `desde + cuanto`, de 0 a 1 con inercia. */
export const tramo = (t: number, desde: number, cuanto = 0.5) => sale((t - desde) / cuanto);

/**
 * Un valor que cuenta: «58%» a medio camino es «29%»; «1,62» es «0,81».
 * Respeta los decimales y la coma; si no hay número, el texto tal cual.
 */
export function cuenta(valor: string, a: number) {
  const m = valor.match(/(\d+(?:[.,]\d+)?)/);

  if (!m || a >= 1) return valor;

  const crudo = m[1];
  const coma = crudo.includes(",");
  const decimales = crudo.split(/[.,]/)[1]?.length ?? 0;
  const n = Number(crudo.replace(",", ".")) * a;
  let texto = n.toFixed(decimales);

  if (coma) texto = texto.replace(".", ",");

  return valor.replace(crudo, texto);
}

/** El porcentaje de un valor («58%» → 0,58), o null si no lo es. */
export function fraccionDe(valor: string): number | null {
  const m = valor.match(/(\d+(?:[.,]\d+)?)\s*%/);

  return m ? Math.min(1, Number(m[1].replace(",", ".")) / 100) : null;
}

/** Un anillo de progreso (d3-shape) con su pista de fondo. `fraccion` de 0 a 1. */
export function anillo(ctx: Lienzo, cx: number, cy: number, radio: number, grosor: number, fraccion: number, color: string, pista = "rgba(255,255,255,0.1)") {
  const g = arc<unknown>().context(ctx);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  g({ innerRadius: radio - grosor, outerRadius: radio, startAngle: 0, endAngle: Math.PI * 2 } as never);
  ctx.fillStyle = pista;
  /* Par-impar: el arco de vuelta entera trae el círculo de dentro y sin esto se rellenaba como un disco. */
  ctx.fill("evenodd");

  if (fraccion > 0) {
    ctx.beginPath();
    g({ innerRadius: radio - grosor, outerRadius: radio, startAngle: 0, endAngle: Math.PI * 2 * Math.min(fraccion, 0.9999), cornerRadius: fraccion < 0.999 ? grosor / 2 : 0 } as never);
    ctx.fillStyle = color;
    ctx.fill("evenodd");
  }

  ctx.restore();
}

/** Un rectángulo con las esquinas redondeadas (sin `roundRect`, que no todos los motores tienen). */
export function caja(ctx: Lienzo, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));

  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

/**
 * La cortinilla entre escenas: un panel azul noche en diagonal con el filo de
 * oro. Al acabar una escena entra desde la izquierda y la tapa (`fase`
 * «entra», p de 0 a 1); al empezar la siguiente sigue su camino hacia la
 * derecha y la descubre (`fase` «sale»). Sustituye al fundido a negro.
 */
export function cortinilla(ctx: Lienzo, ancho: number, alto: number, fase: "entra" | "sale", p: number, oro: string, fondo: string) {
  const sesgo = alto * 0.32;
  const recorrido = ancho + sesgo * 2;
  const v = viaja(p);

  /* El filo que se mueve: al entrar, el derecho; al salir, el izquierdo. */
  const filo = fase === "entra" ? -sesgo + recorrido * v : -sesgo + recorrido * v;
  const desde = fase === "entra" ? -sesgo * 2 : filo;
  const hasta = fase === "entra" ? filo : ancho + sesgo * 2;

  if (hasta <= desde) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(desde + sesgo, 0);
  ctx.lineTo(hasta + sesgo, 0);
  ctx.lineTo(hasta - sesgo, alto);
  ctx.lineTo(desde - sesgo, alto);
  ctx.closePath();
  ctx.fillStyle = fondo;
  ctx.fill();

  /* El filo de oro, y una segunda línea fina detrás. */
  const borde = fase === "entra" ? hasta : desde;

  for (const [desp, grueso, alfa] of [
    [0, 10, 1],
    [fase === "entra" ? -34 : 34, 3, 0.55],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(borde + desp + sesgo, 0);
    ctx.lineTo(borde + desp + sesgo + (fase === "entra" ? grueso : -grueso), 0);
    ctx.lineTo(borde + desp - sesgo + (fase === "entra" ? grueso : -grueso), alto);
    ctx.lineTo(borde + desp - sesgo, alto);
    ctx.closePath();
    ctx.globalAlpha = alfa;
    ctx.fillStyle = oro;
    ctx.fill();
  }

  ctx.restore();
}

/** Texto con espaciado entre letras a mano (no todos los motores tienen `letterSpacing`). Devuelve el ancho. */
export function espaciado(ctx: Lienzo, texto: string, x: number, y: number, aire: number, alinea: "left" | "center" = "left") {
  const anchos = [...texto].map((c) => ctx.measureText(c).width);
  const total = anchos.reduce((s, w) => s + w, 0) + aire * Math.max(0, texto.length - 1);
  let cx = alinea === "center" ? x - total / 2 : x;
  const previa = ctx.textAlign;

  ctx.textAlign = "left";
  [...texto].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += anchos[i] + aire;
  });
  ctx.textAlign = previa;

  return total;
}
