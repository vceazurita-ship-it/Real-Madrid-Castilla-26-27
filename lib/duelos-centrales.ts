/**
 * A QUÉ CENTRAL RIVAL ATACAR (27/11/2026, idea de X).
 *
 * En el duelo de nuestro delantero contra sus centrales: todos los centrales
 * del rival en un plano, duelos defensivos por 90 (X) contra % de duelos
 * defensivos ganados (Y), con la mediana de los centrales de la categoría en
 * los dos ejes. Se resalta al que más duelos pierde por 90
 * (duelos/90 × (1 − % ganados)), con su % de duelos aéreos ganados al lado.
 *
 * Wyscout, esta temporada. La mediana, con los centrales de la categoría de
 * 90′ o más y un % con volumen (`volumenDelPorcentaje`, la regla de DATA).
 * Los del rival con menos de 540′ (seis partidos) salen en gris y con aviso, y
 * sólo se eligen como «el que más pierde» si ninguno llega a 540′.
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { MINUTOS_MINIMOS, puestoDe, valorDe, volumenDelPorcentaje } from "@/lib/data-analisis/individual";
import type { ResultadoDuelo } from "@/lib/duelos";
import { mismoClub } from "@/lib/rivals/mismoClub";

export const COL_DUELOS_DEF_90 = "Duelos defensivos/90";
export const COL_DUELOS_DEF_PCT = "Duelos defensivos ganados, %";
export const COL_AEREOS_PCT = "Duelos aéreos ganados, %";
export const MINUTOS_FIABLES_CENTRAL = 540;

export type PuntoCentral = {
  jugador: string;
  equipo: string;
  minutos: number;
  duelos: number;
  ganados: number;
  /** Duelos defensivos perdidos por 90. */
  perdidos: number;
  aereos: number | null;
  poca: boolean;
  /** En el once de este duelo. */
  titular: boolean;
};

export type PlanoCentrales = {
  puntos: PuntoCentral[];
  medianaDuelos: number;
  medianaGanados: number;
  comparables: number;
  /** El que más duelos pierde por 90 (entre los de 540′ si hay alguno). */
  objetivo: PuntoCentral | null;
};

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const esCentral = (f: FilaJugador) => f.temporada === "actual" && puestoDe(f.posicion) === "CEN";

/** Sus centrales en el plano; null fuera del duelo delantero–central o sin referencia. */
export function centralesDelDuelo(d: ResultadoDuelo, equipo: string, jugadores: FilaJugador[]): PlanoCentrales | null {
  if (d.def.tipo !== "delantero-central" || !equipo) return null;
  const categoria = jugadores
    .filter((f) => esCentral(f) && f.minutos >= MINUTOS_MINIMOS && volumenDelPorcentaje(f, COL_DUELOS_DEF_PCT).fiable)
    .map((f) => ({ d: valorDe(f, COL_DUELOS_DEF_90), g: valorDe(f, COL_DUELOS_DEF_PCT) }))
    .filter((x): x is { d: number; g: number } => x.d !== null && x.g !== null);
  if (categoria.length < 10) return null;

  /* Su equipo en Wyscout: el de sus centrales del once; si no, el nombre de la plantilla. */
  const equipoWy = d.suyos.map((j) => j.wyscout?.equipo).find(Boolean);
  const delEquipo = (f: FilaJugador) => (equipoWy ? f.equipo === equipoWy : mismoClub(f.equipo, equipo));
  const titulares = new Set(d.suyos.map((j) => j.wyscout && `${j.wyscout.jugador}|${j.wyscout.equipo}`).filter(Boolean));

  const puntos: PuntoCentral[] = jugadores
    .filter((f) => esCentral(f) && delEquipo(f) && f.minutos > 0)
    .map((f) => {
      const duelos = valorDe(f, COL_DUELOS_DEF_90);
      const ganados = valorDe(f, COL_DUELOS_DEF_PCT);
      if (duelos === null || ganados === null || duelos <= 0) return null;
      const aereos = volumenDelPorcentaje(f, COL_AEREOS_PCT).fiable ? valorDe(f, COL_AEREOS_PCT) : null;
      return {
        jugador: f.jugador,
        equipo: f.equipo,
        minutos: f.minutos,
        duelos,
        ganados,
        perdidos: duelos * (1 - ganados / 100),
        aereos,
        poca: f.minutos < MINUTOS_FIABLES_CENTRAL,
        titular: titulares.has(`${f.jugador}|${f.equipo}`),
      };
    })
    .filter((p): p is PuntoCentral => p !== null);
  if (!puntos.length) return null;

  const fiables = puntos.filter((p) => !p.poca);
  const objetivo = [...(fiables.length ? fiables : puntos)].sort((a, b) => b.perdidos - a.perdidos)[0] ?? null;

  return {
    puntos,
    medianaDuelos: mediana(categoria.map((x) => x.d)),
    medianaGanados: mediana(categoria.map((x) => x.g)),
    comparables: categoria.length,
    objetivo,
  };
}
