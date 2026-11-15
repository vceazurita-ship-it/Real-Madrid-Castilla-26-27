/**
 * La hoja de penaltis del rival en el PDF de nuestro portero (15/11/2026).
 *
 * La misma lectura que la tarjeta de /scout-rival-abp
 * (`components/abp/PenaltisLanzadores.tsx`): por lanzador, su línea (lado más
 * repetido y si cambió en el último) y la portería en seis zonas con cada
 * penalti, esta temporada y, si las hay, las anteriores. 1080 de ancho como
 * el resto de hojas del PDF (`lib/abp/pizarra-jugador.ts`), alto el justo.
 */

import { C, fuente, rectRedondo, type Ctx } from "@/lib/rivals/lienzo-club";
import type { Penalti } from "@/lib/opta-eventos";
import { resultadoDe, zonaDe, type FichaLanzador } from "@/lib/abp/penaltis-lanzador";

const ANCHO = 1080;
const MARGEN = 64;
const MAX_LANZADORES = 6;
const COLOR = { gol: "#C9A227", parado: "#3B82F6", fuera: C.navy };

function renglones(ctx: Ctx, texto: string, maxW: number): string[] {
  const out: string[] = [];
  let linea = "";
  for (const palabra of texto.split(/\s+/)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > maxW && linea) {
      out.push(linea);
      linea = palabra;
    } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}

function porteria(ctx: Ctx, x: number, y: number, w: number, penaltis: Penalti[], titulo: string) {
  const h = Math.round((w * 244) / 732) + 30;
  fuente(ctx, 24, 700);
  ctx.fillStyle = C.verde;
  ctx.fillText(titulo.toUpperCase(), x, y + 22);
  const top = y + 40;
  ctx.fillStyle = "rgba(15,30,61,0.05)";
  ctx.fillRect(x, top, w, h);
  ctx.strokeStyle = "rgba(15,30,61,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  for (const k of [1, 2]) {
    ctx.moveTo(x + (w * k) / 3, top);
    ctx.lineTo(x + (w * k) / 3, top + h);
  }
  ctx.moveTo(x, top + h / 2);
  ctx.lineTo(x + w, top + h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, top + h);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w, top);
  ctx.lineTo(x + w, top + h);
  ctx.stroke();

  const celdas = new Map<string, Penalti[]>();
  for (const p of penaltis) {
    const z = zonaDe(p);
    if (!z) continue;
    const k = `${z.col}-${z.fila}`;
    celdas.set(k, [...(celdas.get(k) ?? []), p]);
  }
  const cw = w / 3;
  const ch = h / 2;
  const r = Math.max(9, Math.min(16, ch / 6));
  for (const [k, ps] of celdas) {
    const [col, fila] = k.split("-").map(Number);
    const x0 = x + col * cw;
    const y0 = top + fila * ch;
    fuente(ctx, 22, 700);
    ctx.fillStyle = "rgba(15,30,61,0.55)";
    ctx.textAlign = "right";
    ctx.fillText(String(ps.length), x0 + cw - 12, y0 + 28);
    ctx.textAlign = "left";
    ps.forEach((p, i) => {
      const cx = x0 + 14 + r + (i % 4) * (r * 2.6);
      const cy = Math.min(y0 + ch - r - 6, y0 + 14 + r + Math.floor(i / 4) * (r * 2.4));
      const res = resultadoDe(p);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (res === "fuera") {
        ctx.strokeStyle = COLOR.fuera;
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.fillStyle = COLOR[res];
        ctx.fill();
      }
    });
  }
  return 40 + h;
}

/** La hoja, o null si el rival no tiene penaltis en Opta. */
export function hojaPenaltis(fichas: FichaLanzador[], rival: string): HTMLCanvasElement | null {
  const lista = fichas.slice(0, MAX_LANZADORES);
  if (!lista.length) return null;

  const medida = document.createElement("canvas").getContext("2d") as Ctx;
  fuente(medida, 30, 600);
  const lineas = lista.map((f) => renglones(medida, f.linea, ANCHO - MARGEN * 2 - 40));
  const conAntes = lista.map((f) => f.esta.length > 0 && f.antes.length > 0);
  const anchoPort = (doble: boolean) => (doble ? (ANCHO - MARGEN * 2 - 40 - 32) / 2 : 640);
  const altoPort = (doble: boolean) => 40 + Math.round((anchoPort(doble) * 244) / 732) + 30;
  const bloques = lista.map((_, i) => 70 + lineas[i].length * 38 + 20 + altoPort(conAntes[i]) + 40);
  const alto = 200 + bloques.reduce((a, b) => a + b + 24, 0) + 90;

  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = Math.round(alto);
  const ctx = canvas.getContext("2d") as Ctx;
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, ANCHO, canvas.height);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, ANCHO, 12);
  fuente(ctx, 28, 700);
  ctx.fillStyle = C.verde;
  ctx.fillText("PENALTIS · PARA EL PORTERO", MARGEN, 84);
  fuente(ctx, 64, 700);
  ctx.fillStyle = C.navy;
  ctx.fillText(`SUS LANZADORES · ${rival.toUpperCase()}`.slice(0, 40), MARGEN, 150);

  let y = 200;
  lista.forEach((f, i) => {
    const alto = bloques[i];
    ctx.fillStyle = C.crema;
    rectRedondo(ctx, MARGEN, y, ANCHO - MARGEN * 2, alto, 24);
    ctx.fill();
    const x = MARGEN + 20;
    fuente(ctx, 40, 700);
    ctx.fillStyle = C.navy;
    ctx.fillText(f.tirador.toUpperCase(), x, y + 54);
    if (f.pie) {
      const w = ctx.measureText(f.tirador.toUpperCase()).width;
      fuente(ctx, 26, 600);
      ctx.fillStyle = "rgba(15,30,61,0.6)";
      ctx.fillText(f.pie.toUpperCase(), x + w + 18, y + 54);
    }
    fuente(ctx, 30, 600);
    ctx.fillStyle = f.cambio ? "#B4231F" : C.navy;
    lineas[i].forEach((l, k) => ctx.fillText(l, x, y + 70 + 32 + k * 38));
    const py = y + 70 + lineas[i].length * 38 + 20;
    const doble = conAntes[i];
    const w = anchoPort(doble);
    if (doble) {
      porteria(ctx, x, py, w, f.esta, `Esta temporada (${f.esta.length})`);
      porteria(ctx, x + w + 32, py, w, f.antes, `Anteriores (${f.antes.length})`);
    } else {
      const ps = f.esta.length ? f.esta : f.antes;
      porteria(ctx, x, py, w, ps, `${f.esta.length ? "Esta temporada" : "Temporadas anteriores"} (${ps.length})`);
    }
    y += alto + 24;
  });

  /* La leyenda y de dónde sale. */
  fuente(ctx, 24, 600);
  let lx = MARGEN;
  const ly = y + 30;
  for (const [res, texto] of [["gol", "Gol"], ["parado", "Parado"], ["fuera", "Fuera o al palo"]] as const) {
    ctx.beginPath();
    ctx.arc(lx + 10, ly - 8, 10, 0, Math.PI * 2);
    if (res === "fuera") {
      ctx.strokeStyle = COLOR.fuera;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = COLOR[res];
      ctx.fill();
    }
    ctx.fillStyle = C.navy;
    ctx.fillText(texto, lx + 28, ly);
    lx += 28 + ctx.measureText(texto).width + 36;
  }
  fuente(ctx, 22, 500);
  ctx.fillStyle = "rgba(15,30,61,0.6)";
  ctx.fillText("Vista desde el punto de penalti: la izquierda es la del lanzador (tu derecha). Opta.", MARGEN, ly + 40);

  return canvas;
}
