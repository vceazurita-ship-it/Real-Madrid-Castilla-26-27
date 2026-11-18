/**
 * SI LE DEJAMOS TOCAR, ¿SE NOS VA? (Plan de partido · Proyección, 18/11/2026).
 * Un punto por partido del rival: en X el PPDA de su oponente en ese partido
 * (menos, más le aprietan) y en Y sus pases por posesión (`·PasesSecuencia`:
 * pases intentados entre secuencias, la derivada de `lib/opta-evolucion.ts`).
 *
 * Sobre `opta:partidos` (equipo × partido): el PPDA sale de la fila del
 * oponente (`otra`) y los pases, de la del rival. Recta de mínimos cuadrados
 * y r de Pearson. Sobre la recta, dos escenarios nuestros:
 *  - «Como venimos»: nuestro PPDA medio de los últimos 5 partidos.
 *  - «En bloque bajo»: nuestro PPDA medio en el tercio de partidos de la
 *    temporada en que menos presionamos (PPDA más alto; al menos 2 partidos).
 *
 * Lectura: r ≥ 0,6 «depende de que le dejen»; r < 0,3 (en valor absoluto)
 * «mantiene su forma»; en medio, relación floja.
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { valorDe } from "@/lib/opta-evolucion";
import type { PartidoEquipo } from "@/lib/opta-analisis";

/** Partidos mínimos para trazar la recta. */
export const MIN_PARTIDOS = 5;
/** Partidos nuestros para «como venimos». */
export const ULTIMOS = 5;

export type PuntoPases = { fecha: string; oponente: string; ppda: number; pases: number };

export type Escenario = { ppda: number; pases: number; n: number };

export type PasesSegunPresion = {
  puntos: PuntoPases[];
  a: number | null;
  b: number | null;
  r: number | null;
  lectura: "depende" | "mantiene" | "algo" | null;
  /** Nuestro PPDA medio en los últimos 5 partidos, llevado a la recta. */
  venimos: Escenario | null;
  /** Nuestro PPDA en bloque bajo (el tercio de partidos con el PPDA más alto). */
  bloqueBajo: Escenario | null;
  mediaPases: number | null;
};

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function pasesSegunPresion(rival: PartidoEquipo[], nuestros: PartidoEquipo[]): PasesSegunPresion | null {
  const puntos: PuntoPases[] = rival
    .map((p) => ({ fecha: p.fecha, oponente: p.rival, ppda: p.otra ? valorDe(p.otra, "PPDA") : null, pases: valorDe(p.fila, "·PasesSecuencia") }))
    .filter((q): q is PuntoPases => finito(q.ppda) && finito(q.pases));
  if (!puntos.length) return null;

  let a: number | null = null;
  let b: number | null = null;
  let r: number | null = null;
  if (puntos.length >= MIN_PARTIDOS) {
    const mx = media(puntos.map((q) => q.ppda))!;
    const my = media(puntos.map((q) => q.pases))!;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const q of puntos) {
      sxy += (q.ppda - mx) * (q.pases - my);
      sxx += (q.ppda - mx) ** 2;
      syy += (q.pases - my) ** 2;
    }
    if (sxx > 0) {
      b = sxy / sxx;
      a = my - b * mx;
      r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
    }
  }

  const lectura = r == null ? null : r >= 0.6 ? "depende" : Math.abs(r) < 0.3 ? "mantiene" : "algo";

  /* Nuestros PPDA, partido a partido y en orden de fecha (partidosDe ya ordena). */
  const nuestrosPpda = nuestros.map((p) => valorDe(p.fila, "PPDA")).filter(finito);
  const enRecta = (ppda: number | null, n: number): Escenario | null =>
    ppda == null || a == null || b == null ? null : { ppda, pases: Math.max(0, a + b * ppda), n };

  const ultimos = nuestrosPpda.slice(-ULTIMOS);
  const venimos = enRecta(media(ultimos), ultimos.length);

  const tercio = Math.max(2, Math.round(nuestrosPpda.length / 3));
  const altos = nuestrosPpda.length >= 2 * tercio ? [...nuestrosPpda].sort((x, y) => y - x).slice(0, tercio) : [];
  const bloqueBajo = enRecta(media(altos), altos.length);

  return { puntos, a, b, r, lectura, venimos, bloqueBajo, mediaPases: media(puntos.map((q) => q.pases)) };
}
