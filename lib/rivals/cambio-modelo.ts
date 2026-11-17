/**
 * ¿HA CAMBIADO SU MODELO? (17/11/2026). PPDA y pases por partido del rival,
 * jornada a jornada, con su media móvil de 5, y los últimos 5 partidos contra
 * el resto de la temporada, con los puntos de cada bloque.
 *
 * Sobre `opta:partidos` (equipo × partido): `PPDA` es el cociente que Opta ya
 * da hecho por partido y `PsAtt` los pases intentados del equipo. Los puntos,
 * del marcador de la fila (`Goal` / `GA`). La media de un bloque es la media
 * de sus partidos (el PPDA no se puede rehacer como cociente de sumas sin sus
 * dos totales).
 *
 * La etiqueta: si el PPDA sube más de 2 y los pases bajan más de un 10 %,
 * «más reactivo» (presiona menos y tiene menos el balón); al revés, «más
 * protagonista». Si sólo se mueve uno, o ninguno, no hay etiqueta.
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { valorDe } from "@/lib/opta-evolucion";
import type { PartidoEquipo } from "@/lib/opta-analisis";

export const VENTANA = 5;
/** Partidos que tiene que tener «el resto» para comparar. */
export const MIN_RESTO = 3;
export const UMBRAL_PPDA = 2;
export const UMBRAL_PASES = 0.1;

export type PartidoModelo = {
  jornada: number;
  fecha: string;
  rival: string;
  ppda: number | null;
  pases: number | null;
  puntos: number | null;
  /** Media de los últimos 5 partidos con dato hasta éste (null hasta tener 5). */
  ppdaMovil: number | null;
  pasesMovil: number | null;
};

export type Bloque = {
  partidos: number;
  ppda: number | null;
  pases: number | null;
  puntos: number;
  /** Partidos con marcador (para los puntos por partido). */
  conMarcador: number;
};

export type CambioModelo = {
  serie: PartidoModelo[];
  ultimos: Bloque;
  resto: Bloque | null;
  difPpda: number | null;
  /** Cambio relativo de los pases (0,12 = +12 %). */
  difPases: number | null;
  etiqueta: "más reactivo" | "más protagonista" | null;
};

const finito = (v: number | null): v is number => v != null && Number.isFinite(v);
const media = (xs: (number | null)[]) => {
  const v = xs.filter(finito);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

function movil(xs: (number | null)[]): (number | null)[] {
  return xs.map((_, i) => {
    const previos = xs.slice(0, i + 1).filter(finito);
    if (!finito(xs[i]) || previos.length < VENTANA) return null;
    return media(previos.slice(-VENTANA));
  });
}

function puntosDe(p: PartidoEquipo): number | null {
  if (p.gf == null || p.gc == null) return null;
  return p.gf > p.gc ? 3 : p.gf === p.gc ? 1 : 0;
}

function bloque(ps: PartidoModelo[]): Bloque {
  const conPuntos = ps.filter((p) => p.puntos != null);
  return {
    partidos: ps.length,
    ppda: media(ps.map((p) => p.ppda)),
    pases: media(ps.map((p) => p.pases)),
    puntos: conPuntos.reduce((s, p) => s + (p.puntos ?? 0), 0),
    conMarcador: conPuntos.length,
  };
}

/** `suyos`: los partidos del rival por fecha (`partidosPorEquipo`). Null si no hay dato. */
export function cambioDeModelo(suyos: PartidoEquipo[]): CambioModelo | null {
  const base = suyos
    .map((p) => ({ p, ppda: valorDe(p.fila, "PPDA"), pases: valorDe(p.fila, "PsAtt") }))
    .filter((x) => finito(x.ppda) || finito(x.pases));
  if (!base.length) return null;

  const ppdaM = movil(base.map((x) => x.ppda));
  const pasesM = movil(base.map((x) => x.pases));
  const serie: PartidoModelo[] = base.map((x, i) => ({
    jornada: i + 1,
    fecha: x.p.fecha,
    rival: x.p.rival,
    ppda: finito(x.ppda) ? x.ppda : null,
    pases: finito(x.pases) ? x.pases : null,
    puntos: puntosDe(x.p),
    ppdaMovil: ppdaM[i],
    pasesMovil: pasesM[i],
  }));

  const ultimos = bloque(serie.slice(-VENTANA));
  const previos = serie.slice(0, Math.max(0, serie.length - VENTANA));
  const resto = previos.length >= MIN_RESTO ? bloque(previos) : null;

  const difPpda = resto && finito(ultimos.ppda) && finito(resto.ppda) ? ultimos.ppda - resto.ppda : null;
  const difPases = resto && finito(ultimos.pases) && finito(resto.pases) && resto.pases > 0 ? ultimos.pases / resto.pases - 1 : null;

  let etiqueta: CambioModelo["etiqueta"] = null;
  if (difPpda != null && difPases != null) {
    if (difPpda > UMBRAL_PPDA && difPases < -UMBRAL_PASES) etiqueta = "más reactivo";
    else if (difPpda < -UMBRAL_PPDA && difPases > UMBRAL_PASES) etiqueta = "más protagonista";
  }

  return { serie, ultimos, resto, difPpda, difPases, etiqueta };
}
