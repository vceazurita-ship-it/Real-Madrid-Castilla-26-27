/**
 * MAPA DE LA LIGA: ALTURA DEFENSIVA CONTRA OCASIONES (23/11/2026, idea de X).
 *
 * Para cada equipo del grupo del Castilla, con el evento a evento de Opta de
 * sus últimos partidos (`opta:directo:<partido>`, los mismos que «El rival por
 * tercios»):
 *
 * - Altura defensiva: la x media (Opta 0-100, desde su portería) de sus
 *   Tackle, Interception y BallRecovery. Cuanto más alta, más arriba defiende.
 * - xG a favor por partido: la suma del xG de sus remates / partidos.
 * - xG en contra por partido: la suma del xG de los remates del contrario /
 *   partidos.
 *
 * Las rayas son la mediana de cada eje entre los equipos. Un equipo «se sale
 * de la nube» si su distancia a las medianas, en desviaciones típicas de
 * cada eje, pasa de 1,5.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { tiros, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const MAX_PARTIDOS = 8;
export const MIN_PARTIDOS = 2;
export const UMBRAL_NUBE = 1.5;

const DEFENSIVAS = new Set(["Tackle", "Interception", "BallRecovery"]);

export type EjeY = "favor" | "contra";

export type PuntoLiga = {
  teamId: string;
  equipo: string;
  partidos: number;
  /** x media de sus acciones defensivas, 0-100. */
  altura: number;
  xgFavor: number;
  xgContra: number;
};

export function puntoLiga(partidos: { eventos: EventoDirecto[] }[], teamId: string, equipo: string): PuntoLiga | null {
  let n = 0;
  let sx = 0;
  let nd = 0;
  let favor = 0;
  let contra = 0;
  for (const p of partidos) {
    if (!p.eventos.some((e) => e.teamId === teamId)) continue;
    n += 1;
    for (const e of p.eventos) {
      if (e.teamId === teamId && DEFENSIVAS.has(e.tipo) && !(e.x === 0 && e.y === 0)) {
        sx += e.x;
        nd += 1;
      }
    }
    for (const t of tiros(p.eventos)) {
      const xg = t.xG ?? 0;
      if (t.teamId === teamId) favor += xg;
      else contra += xg;
    }
  }
  if (n < MIN_PARTIDOS || !nd) return null;
  return { teamId, equipo, partidos: n, altura: sx / nd, xgFavor: favor / n, xgContra: contra / n };
}

export const mediana = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const desviacion = (v: number[]) => {
  if (v.length < 2) return 0;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
};

export const valorY = (p: PuntoLiga, eje: EjeY) => (eje === "favor" ? p.xgFavor : p.xgContra);

export type MapaLiga = {
  puntos: PuntoLiga[];
  medX: number;
  medY: number;
  sdX: number;
  sdY: number;
};

export function mapaLiga(puntos: PuntoLiga[], eje: EjeY): MapaLiga | null {
  if (puntos.length < 4) return null;
  const xs = puntos.map((p) => p.altura);
  const ys = puntos.map((p) => valorY(p, eje));
  return { puntos, medX: mediana(xs), medY: mediana(ys), sdX: desviacion(xs), sdY: desviacion(ys) };
}

/** Distancia a las medianas, en desviaciones típicas de cada eje. */
export function lejania(p: PuntoLiga, m: MapaLiga, eje: EjeY): number {
  const dx = m.sdX ? (p.altura - m.medX) / m.sdX : 0;
  const dy = m.sdY ? (valorY(p, eje) - m.medY) / m.sdY : 0;
  return Math.hypot(dx, dy);
}

export type Cuadrante = "altoMucho" | "altoPoco" | "bajoMucho" | "bajoPoco";

export function cuadranteDe(p: PuntoLiga, m: MapaLiga, eje: EjeY): Cuadrante {
  const alto = p.altura >= m.medX;
  const mucho = valorY(p, eje) >= m.medY;
  return alto ? (mucho ? "altoMucho" : "altoPoco") : mucho ? "bajoMucho" : "bajoPoco";
}

export const CUADRANTE: Record<EjeY, Record<Cuadrante, string>> = {
  favor: {
    altoMucho: "Defiende arriba y crea",
    altoPoco: "Defiende arriba, crea poco",
    bajoMucho: "Bloque bajo que crea",
    bajoPoco: "Bloque bajo, crea poco",
  },
  contra: {
    altoMucho: "Defiende arriba y concede",
    altoPoco: "Defiende arriba y no concede",
    bajoMucho: "Bloque bajo que concede",
    bajoPoco: "Bloque bajo y sólido",
  },
};

/**
 * Los equipos más parecidos a `p` en el mapa (los dos ejes en desviaciones
 * típicas), sólo entre los `candidatos`.
 */
export function parecidos(p: PuntoLiga, m: MapaLiga, eje: EjeY, candidatos: Set<string>, cuantos = 3): PuntoLiga[] {
  return m.puntos
    .filter((o) => o.teamId !== p.teamId && candidatos.has(o.teamId))
    .map((o) => {
      const dx = m.sdX ? (o.altura - p.altura) / m.sdX : 0;
      const dy = m.sdY ? (valorY(o, eje) - valorY(p, eje)) / m.sdY : 0;
      return { o, d: Math.hypot(dx, dy) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, cuantos)
    .map((x) => x.o);
}
