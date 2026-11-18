/**
 * ¿SE LE ROMPE LA SALIDA SI LE PRESIONAMOS? (Scout colectivo, 18/11/2026).
 * Un punto por partido del rival: en X el PPDA de su oponente en ese partido
 * (cuantos menos pases le deja dar, más le aprieta) y en Y sus pérdidas en
 * campo propio (`PsLostD3`, su primer tercio).
 *
 * Sobre `opta:partidos` (equipo × partido): el PPDA sale de la fila del
 * oponente (`otra`) y las pérdidas, de la del rival. La recta es la de mínimos
 * cuadrados; la pendiente se da al revés («pérdidas de más por cada punto
 * MENOS de PPDA») porque así se lee la presión. r es el de Pearson.
 *
 * Los partidos contra equipos que presionan como nosotros: PPDA del oponente
 * dentro de nuestro PPDA medio ± 1,5. Su media de pérdidas va aparte.
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { valorDe } from "@/lib/opta-evolucion";
import type { PartidoEquipo } from "@/lib/opta-analisis";

/** Partidos mínimos para hablar de tendencia. */
export const MIN_PARTIDOS = 5;
/** Margen alrededor de nuestro PPDA medio para «presiona como nosotros». */
export const MARGEN_PPDA = 1.5;

export type PuntoPresion = {
  fecha: string;
  oponente: string;
  /** PPDA del oponente en ese partido. */
  ppda: number;
  /** Pérdidas del rival en su campo. */
  perdidas: number;
  /** El oponente presionó como nosotros (nuestro PPDA medio ± 1,5). */
  comoNosotros: boolean;
};

export type PresionSalida = {
  puntos: PuntoPresion[];
  /** Pérdidas de más por cada punto menos de PPDA (−pendiente de la recta). */
  porPunto: number | null;
  /** Recta y = a + b·x, para pintarla. */
  a: number | null;
  b: number | null;
  r: number | null;
  lectura: "se rompe" | "aguanta" | "algo" | "al revés" | null;
  nuestroPpda: number | null;
  mediaComoNosotros: number | null;
  mediaResto: number | null;
  nComoNosotros: number;
};

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function presionSalida(rival: PartidoEquipo[], nuestros: PartidoEquipo[]): PresionSalida | null {
  const nuestroPpda = media(nuestros.map((p) => valorDe(p.fila, "PPDA")).filter(finito));

  const base = rival
    .map((p) => ({ p, ppda: p.otra ? valorDe(p.otra, "PPDA") : null, perdidas: valorDe(p.fila, "PsLostD3") }))
    .filter((x): x is { p: PartidoEquipo; ppda: number; perdidas: number } => finito(x.ppda) && finito(x.perdidas));
  if (!base.length) return null;

  const puntos: PuntoPresion[] = base.map(({ p, ppda, perdidas }) => ({
    fecha: p.fecha,
    oponente: p.rival,
    ppda,
    perdidas,
    comoNosotros: nuestroPpda != null && Math.abs(ppda - nuestroPpda) <= MARGEN_PPDA,
  }));

  let a: number | null = null;
  let b: number | null = null;
  let r: number | null = null;
  if (puntos.length >= MIN_PARTIDOS) {
    const mx = media(puntos.map((q) => q.ppda))!;
    const my = media(puntos.map((q) => q.perdidas))!;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const q of puntos) {
      sxy += (q.ppda - mx) * (q.perdidas - my);
      sxx += (q.ppda - mx) ** 2;
      syy += (q.perdidas - my) ** 2;
    }
    if (sxx > 0) {
      b = sxy / sxx;
      a = my - b * mx;
      r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
    }
  }

  const lectura = r == null ? null : r <= -0.5 ? "se rompe" : Math.abs(r) < 0.3 ? "aguanta" : r < 0 ? "algo" : "al revés";
  const como = puntos.filter((q) => q.comoNosotros);
  const resto = puntos.filter((q) => !q.comoNosotros);

  return {
    puntos,
    porPunto: b == null ? null : -b,
    a,
    b,
    r,
    lectura,
    nuestroPpda,
    mediaComoNosotros: media(como.map((q) => q.perdidas)),
    mediaResto: media(resto.map((q) => q.perdidas)),
    nComoNosotros: como.length,
  };
}
