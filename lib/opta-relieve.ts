/**
 * EL PARTIDO EN RELIEVE (14/11/2026, idea de Alexander Bogachev, petición del analista).
 *
 * El partido como un volumen: a lo largo, el tiempo (minuto a minuto); a lo
 * ancho, el carril del campo (de una banda a otra, visto desde el que ataca
 * hacia la derecha); en altura, la presión de ataque. Los dos equipos son dos
 * colores en el mismo cuerpo. Regla del original: **si hay un pico, hubo un
 * remate de verdad**: la presión sin remate sólo levanta una loma baja (como
 * mucho el 30 % de la altura) y cada remate levanta un pico proporcional a su
 * xG (mínimo visible aunque el xG sea pequeño); el gol, con su marca.
 *
 * Presión = acciones del equipo en el último 40 % del campo (x ≥ 60), cada
 * una 1 + 10 × su xPV positivo, suavizadas (±2 minutos, ±1 carril).
 * Los carriles del rival se dan la vuelta (100 − y) para que los dos estén en
 * el mismo campo físico.
 */

import type { EventoDirecto } from "@/lib/opta-directo-mapas";

export const CARRILES = 9;
const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);

export type Pico = { minuto: number; carril: number; xg: number; gol: boolean; deA: boolean; jugadorId: string };

export type Relieve = {
  minutos: number;
  /** altura[m][c] en 0..1 (la de los dos sumada). */
  altura: number[][];
  /** parteA[m][c] en 0..1: cuánto de esa altura es del equipo A. */
  parteA: number[][];
  picos: Pico[];
};

/** El minuto en el eje: el descuento de la 1.ª parte se queda en el 45, la 2.ª empieza en el 46. */
export function minutoEje(e: Pick<EventoDirecto, "parte" | "segundo">): number {
  const m = Math.floor(e.segundo / 60) + 1;
  if (e.parte === 1) return Math.min(m, 45);
  if (e.parte === 2) return Math.max(m, 46);
  return m;
}

const carrilDe = (y: number, deA: boolean) => {
  const yy = deA ? y : 100 - y;
  return Math.min(CARRILES - 1, Math.max(0, Math.floor((yy / 100) * CARRILES)));
};

function suaviza(m: number[][], rt: number, rc: number): number[][] {
  const M = m.length;
  const sal = m.map((f) => f.map(() => 0));
  const kt = Array.from({ length: 2 * rt + 1 }, (_, i) => Math.exp(-((i - rt) ** 2) / (2 * Math.max(0.5, rt / 1.5) ** 2)));
  const kc = Array.from({ length: 2 * rc + 1 }, (_, i) => Math.exp(-((i - rc) ** 2) / (2 * Math.max(0.5, rc) ** 2)));
  for (let t = 0; t < M; t++)
    for (let c = 0; c < CARRILES; c++) {
      let s = 0;
      let w = 0;
      for (let dt = -rt; dt <= rt; dt++)
        for (let dc = -rc; dc <= rc; dc++) {
          const tt = t + dt;
          const cc = c + dc;
          if (tt < 0 || tt >= M || cc < 0 || cc >= CARRILES) continue;
          const k = kt[dt + rt] * kc[dc + rc];
          s += m[tt][cc] * k;
          w += k;
        }
      sal[t][c] = w ? s / w : 0;
    }
  return sal;
}

export function relieve(ev: EventoDirecto[], a: string, b: string): Relieve {
  const fin = Math.max(90, ...ev.map(minutoEje));
  const M = fin + 1;
  const vacia = () => Array.from({ length: M }, () => new Array(CARRILES).fill(0));
  const pa = vacia();
  const pb = vacia();
  const picos: Pico[] = [];
  for (const e of ev) {
    if (e.teamId !== a && e.teamId !== b) continue;
    const deA = e.teamId === a;
    const m = minutoEje(e);
    const c = carrilDe(e.y, deA);
    if (TIROS.has(e.tipo)) picos.push({ minuto: m, carril: c, xg: e.xG ?? 0, gol: e.tipo === "Goal", deA, jugadorId: e.jugadorId });
    if (e.x < 60) continue;
    (deA ? pa : pb)[m][c] += 1 + 10 * Math.max(0, e.xPV);
  }
  const sa = suaviza(pa, 2, 1);
  const sb = suaviza(pb, 2, 1);
  let tope = 0;
  for (let t = 0; t < M; t++) for (let c = 0; c < CARRILES; c++) tope = Math.max(tope, sa[t][c] + sb[t][c]);

  /* La loma de la presión (hasta 0,3) y los picos de los remates encima. */
  const altura = vacia();
  const pico = vacia();
  const picoA = vacia();
  for (const p of picos) {
    const h = 0.25 + 0.75 * Math.min(1, Math.sqrt(p.xg / 0.6));
    for (let dt = -2; dt <= 2; dt++)
      for (let dc = -1; dc <= 1; dc++) {
        const t = p.minuto + dt;
        const c = p.carril + dc;
        if (t < 0 || t >= M || c < 0 || c >= CARRILES) continue;
        const k = h * Math.exp(-(dt * dt) / 1.2 - (dc * dc) / 0.8);
        if (k > pico[t][c]) {
          pico[t][c] = k;
          picoA[t][c] = p.deA ? 1 : 0;
        }
      }
  }
  const parteA = vacia();
  for (let t = 0; t < M; t++)
    for (let c = 0; c < CARRILES; c++) {
      const loma = tope ? (0.3 * (sa[t][c] + sb[t][c])) / tope : 0;
      altura[t][c] = Math.max(loma, pico[t][c]);
      const total = sa[t][c] + sb[t][c];
      parteA[t][c] = pico[t][c] > loma ? picoA[t][c] : total > 0 ? sa[t][c] / total : 0.5;
    }
  return { minutos: M, altura, parteA, picos };
}
