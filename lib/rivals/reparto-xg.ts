/**
 * REPARTO DEL xG (13/11/2026): de quién depende el gol de un equipo. Sobre
 * `opta:jugadores-partidos` (jugador × partido: Min, ExpG, teamId), sumando la
 * temporada entera de cada jugador CON ESE EQUIPO (si cambió de club, cuenta
 * sólo lo que hizo con este).
 *
 * SIN PENALTIS si el documento trae una columna de xG sin penaltis (se busca
 * por nombre, ver `COLUMNAS_SIN_PENALTI`); si no, xG total, y se dice.
 *
 * LA RAYA: lo que aportaría el jugador si rindiera como la media del equipo
 * por minuto = xG del equipo / minutos del equipo × minutos del jugador. El
 * cociente «×N» es su xG entre esa cifra.
 */

import { num } from "@/lib/opta";
import type { Fila } from "@/lib/opta-analisis";

/** Nombres posibles de una columna de xG sin penaltis, por orden de preferencia. */
const COLUMNAS_SIN_PENALTI = ["NPxG", "npxG", "NpxG", "ExpGNonPen", "NonPenExpG", "ExpGNoPen", "ExpGExclPen", "NPExpG"];

export type RepartoJugador = {
  playerId: string;
  jugador: string;
  xg: number;
  minutos: number;
  /** % del xG del equipo. */
  pct: number;
  /** xG por 90 (null si no llega a 90 minutos). */
  xg90: number | null;
  /** Lo que le tocaría con el rendimiento medio del equipo por minuto. */
  esperado: number;
  /** xG / esperado (null si no tiene minutos). */
  veces: number | null;
};

export type RepartoXg = {
  jugadores: RepartoJugador[];
  /** xG del equipo (suma de todos sus jugadores). */
  total: number;
  minutosEquipo: number;
  /** % que concentra el primero. */
  pctPrimero: number;
  /** % que suman los tres primeros. */
  pctTres: number;
  /** Cuántos jugadores han generado algo de xG. */
  conXg: number;
  sinPenaltis: boolean;
  columna: string;
};

export function columnaXg(filas: Fila[]): { columna: string; sinPenaltis: boolean } {
  const muestra = filas.slice(0, 200);
  for (const c of COLUMNAS_SIN_PENALTI) if (muestra.some((f) => num(f[c]) != null)) return { columna: c, sinPenaltis: true };
  return { columna: "ExpG", sinPenaltis: false };
}

export function repartoXg(filas: Fila[], teamId: string, max = 10): RepartoXg | null {
  const { columna, sinPenaltis } = columnaXg(filas);
  const porJugador = new Map<string, { jugador: string; xg: number; minutos: number }>();
  for (const f of filas) {
    if (String(f.teamId ?? "") !== teamId) continue;
    const id = String(f.playerId ?? "");
    if (!id) continue;
    const min = num(f.Min) ?? 0;
    const xg = num(f[columna]) ?? 0;
    const a = porJugador.get(id) ?? { jugador: "", xg: 0, minutos: 0 };
    a.xg += xg;
    a.minutos += min;
    if (f.jugador) a.jugador = String(f.jugador);
    porJugador.set(id, a);
  }
  const todos = [...porJugador.entries()].map(([playerId, a]) => ({ playerId, ...a }));
  const total = todos.reduce((s, j) => s + j.xg, 0);
  const minutosEquipo = todos.reduce((s, j) => s + j.minutos, 0);
  if (!(total > 0) || !(minutosEquipo > 0)) return null;
  /* La referencia es el jugador medio de los que rematan (xG > 0): con los
     porteros y centrales dentro, cualquier atacante salía a ×2 o más (revisión 13/11). */
  const conTiro = todos.filter((j) => j.xg > 0);
  const minutosConTiro = conTiro.reduce((s, j) => s + j.minutos, 0);
  const porMinuto = minutosConTiro > 0 ? total / minutosConTiro : total / minutosEquipo;

  const jugadores: RepartoJugador[] = todos
    .filter((j) => j.xg > 0)
    .sort((a, b) => b.xg - a.xg || a.minutos - b.minutos)
    .map((j) => {
      const esperado = porMinuto * j.minutos;
      return {
        playerId: j.playerId,
        jugador: j.jugador || j.playerId,
        xg: j.xg,
        minutos: j.minutos,
        pct: (j.xg / total) * 100,
        xg90: j.minutos >= 90 ? (j.xg / j.minutos) * 90 : null,
        esperado,
        veces: esperado > 0 ? j.xg / esperado : null,
      };
    });

  return {
    jugadores: jugadores.slice(0, max),
    total,
    minutosEquipo,
    pctPrimero: jugadores[0]?.pct ?? 0,
    pctTres: jugadores.slice(0, 3).reduce((s, j) => s + j.pct, 0),
    conXg: jugadores.length,
    sinPenaltis,
    columna,
  };
}

/** Cómo de concentrado está: lectura para el titular. */
export function lecturaConcentracion(r: RepartoXg): string {
  if (r.pctPrimero >= 30) return "muy concentrado en uno";
  if (r.pctTres >= 55) return "concentrado en tres";
  return "repartido";
}
