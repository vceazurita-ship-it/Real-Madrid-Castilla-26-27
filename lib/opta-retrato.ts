/**
 * EL RETRATO 3D DEL PARTIDO (14/11/2026; inspirado en Football Dataportraits,
 * petición del analista).
 *
 * El campo entero (105 × 68) como una superficie: cada zona, del color del
 * equipo que la domina en los últimos minutos y tan alta como la actividad que
 * hay en ella. Con el evento a evento de opta:directo:<partido>:
 *
 * - cada acción de un jugador cae en su sitio del campo (el rival, dado la
 *   vuelta: los dos en el mismo campo físico, A ataca hacia la derecha) y se
 *   reparte con un suavizado de unos 4 m;
 * - en el instante T cuenta lo de los minutos de antes con un peso que se
 *   apaga en ~4 minutos (ventana de 12): por eso la superficie «respira»;
 * - cada remate levanta un bulto en su sitio (por su xG) durante 3 minutos;
 * - la curva de abajo: por minuto, acciones de A en su último tercio menos las
 *   de B en el suyo.
 */

import type { EventoDirecto } from "@/lib/opta-directo-mapas";
import { minutoEje } from "@/lib/opta-relieve";

export const GX = 52;
export const GY = 34;
const RADIO = 2; // celdas (≈ 4 m)
const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);
const NO_ES_ACCION = new Set(["FreeKick", "Corner", "Foul"]);

export type TiroRetrato = { minuto: number; gx: number; gy: number; xg: number; gol: boolean; deA: boolean; jugadorId: string };

export type Retrato = {
  minutos: number;
  /** Por minuto, lo de A y lo de B en la malla (GX × GY). */
  a: Float32Array[];
  b: Float32Array[];
  tiros: TiroRetrato[];
  /** Curva de dominio por minuto (A − B en el último tercio), ya suavizada. */
  curva: number[];
  /** Escala de la altura (lo más alto de una ventana típica). */
  escala: number;
};

const NUCLEO: { dx: number; dy: number; w: number }[] = [];
for (let dx = -RADIO * 2; dx <= RADIO * 2; dx++)
  for (let dy = -RADIO * 2; dy <= RADIO * 2; dy++) {
    const w = Math.exp(-(dx * dx + dy * dy) / (2 * RADIO * RADIO));
    if (w > 0.02) NUCLEO.push({ dx, dy, w });
  }

export function retrato(ev: EventoDirecto[], a: string, b: string): Retrato {
  const fin = Math.max(90, ...ev.map(minutoEje));
  const M = fin + 1;
  const ma = Array.from({ length: M }, () => new Float32Array(GX * GY));
  const mb = Array.from({ length: M }, () => new Float32Array(GX * GY));
  const tiros: TiroRetrato[] = [];
  const dif = new Array(M).fill(0);
  for (const e of ev) {
    if ((e.teamId !== a && e.teamId !== b) || NO_ES_ACCION.has(e.tipo) || (e.x === 0 && e.y === 0)) continue;
    const deA = e.teamId === a;
    const x = deA ? e.x : 100 - e.x;
    const y = deA ? e.y : 100 - e.y;
    const gx = Math.min(GX - 1, Math.max(0, Math.floor((x / 100) * GX)));
    const gy = Math.min(GY - 1, Math.max(0, Math.floor((y / 100) * GY)));
    const m = minutoEje(e);
    const malla = (deA ? ma : mb)[m];
    for (const k of NUCLEO) {
      const i = gx + k.dx;
      const j = gy + k.dy;
      if (i < 0 || i >= GX || j < 0 || j >= GY) continue;
      malla[j * GX + i] += k.w;
    }
    if (e.x >= 66.7) dif[m] += deA ? 1 : -1;
    if (TIROS.has(e.tipo)) tiros.push({ minuto: m, gx, gy, xg: e.xG ?? 0, gol: e.tipo === "Goal", deA, jugadorId: e.jugadorId });
  }
  const curva = dif.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let d = -3; d <= 3; d++) {
      const k = Math.exp(-(d * d) / 4);
      if (dif[i + d] === undefined) continue;
      s += dif[i + d] * k;
      w += k;
    }
    return w ? s / w : 0;
  });
  /* La escala: el máximo de una ventana de ~6 minutos, en tres momentos del partido. */
  let escala = 0;
  for (const t of [20, 45, 70]) {
    const v = ventana({ minutos: M, a: ma, b: mb, tiros, curva, escala: 1 }, t);
    for (let i = 0; i < GX * GY; i++) escala = Math.max(escala, v.total[i]);
  }
  return { minutos: M, a: ma, b: mb, tiros, curva, escala: escala || 1 };
}

/** Lo que se ve en el instante t: intensidad total y parte de A en cada celda. */
export function ventana(r: Retrato, t: number): { total: Float32Array; parteA: Float32Array } {
  /* Peso continuo en el tiempo (campana de ~2,5 minutos centrada un poco antes de t):
     la superficie fluye como un mar, sin escalones al cambiar de minuto. */
  const total = new Float32Array(GX * GY);
  const sa = new Float32Array(GX * GY);
  const centro = t - 1.5;
  for (let m = Math.max(0, Math.floor(centro) - 8); m <= Math.min(r.minutos - 1, Math.ceil(t) + 1); m++) {
    const d = centro - m;
    const w = Math.exp(-(d * d) / (2 * 2.5 * 2.5)) * (m > t ? Math.max(0, 1 - (m - t)) : 1);
    if (w < 0.01) continue;
    const A = r.a[m];
    const B = r.b[m];
    for (let i = 0; i < GX * GY; i++) {
      sa[i] += A[i] * w;
      total[i] += (A[i] + B[i]) * w;
    }
  }
  const parteA = new Float32Array(GX * GY);
  for (let i = 0; i < GX * GY; i++) parteA[i] = total[i] > 0 ? sa[i] / total[i] : 0.5;
  return { total, parteA };
}
