/**
 * MOMENTO DE CARA A PUERTA (25/11/2026, idea de X).
 *
 * Para delanteros y mediapuntas de la ficha de /rivals: sus últimos 5
 * partidos (los que ha jugado) frente a toda su temporada, en cuatro cifras:
 * goles/90, xG/90, goles menos xG (por 90) y xG por remate. Separa la racha
 * de acierto (marca más de lo que dan sus ocasiones) de la del que de verdad
 * llega más (sube su xG/90).
 *
 * Fuentes (Opta, las mismas claves de partido):
 * - `opta:jugadores-partidos`: minutos de cada partido (`Min`); de ahí qué
 *   partidos ha jugado y cuántos minutos suma en cada tramo.
 * - `opta:remates`: goles, xG y remates de cada partido, SIN PENALTIS (como
 *   «Cómo define»); y la fecha de cada partido para ordenarlos.
 */

import { num, type Celda } from "@/lib/opta";
import type { Remate } from "@/lib/opta-eventos";

type Fila = Record<string, Celda>;

/** Los partidos que cuentan como «últimos». */
export const PARTIDOS_RACHA = 5;
/** Con menos minutos en esos partidos (dos enteros), no se le pone etiqueta. */
export const MINUTOS_RACHA = 180;
/** Con menos minutos en la temporada, no hay con qué comparar. */
const MINUTOS_TEMPORADA = 270;

export type Tramo = {
  partidos: number;
  minutos: number;
  goles: number;
  xg: number;
  remates: number;
  goles90: number;
  xg90: number;
  /** (goles − xG) por 90. */
  dif90: number;
  xgPorRemate: number | null;
};

export type EtiquetaRacha = "genera" | "afinado" | "seco" | "linea" | "menos";

export const ETIQUETAS_RACHA: Record<EtiquetaRacha, { texto: string; orden: string; color: string }> = {
  genera: {
    texto: "Genera más",
    orden: "La racha viene de llegar más: vigilar sus desmarques y cortarle el balón antes de que pise el área.",
    color: "#F87171",
  },
  afinado: {
    texto: "Afinado",
    orden: "Llega lo de siempre pero mete más de lo que valen sus tiros: ni una media ocasión dentro del área.",
    color: "#F59E0B",
  },
  seco: {
    texto: "Seco",
    orden: "Sigue llegando pero no marca: el peligro está ahí aunque no salga en el marcador.",
    color: "#60A5FA",
  },
  linea: {
    texto: "En su línea",
    orden: "Sus últimos partidos dicen lo mismo que su temporada.",
    color: "#94A3B8",
  },
  menos: {
    texto: "Llega menos",
    orden: "En los últimos partidos genera menos que en su temporada.",
    color: "#94A3B8",
  },
};

export type RachaDelantero = {
  ultimos: Tramo;
  temporada: Tramo;
  etiqueta: EtiquetaRacha | null;
  porque: string;
  /** Fecha del más antiguo y del más reciente de los últimos (AAAA-MM-DD). */
  desde: string;
  hasta: string;
};

const esPenalti = (r: Remate) => r.tipo === "PenaltyGoal" || r.situacion === "Penalty";
const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

function tramo(partidos: string[], minutos: Map<string, number>, tiros: Remate[]): Tramo {
  const set = new Set(partidos);
  const min = partidos.reduce((s, p) => s + (minutos.get(p) ?? 0), 0);
  let goles = 0;
  let xg = 0;
  let remates = 0;
  for (const r of tiros) {
    if (!set.has(r.partido)) continue;
    remates += 1;
    xg += r.xG;
    if (r.gol) goles += 1;
  }
  const por90 = (v: number) => (min > 0 ? (v / min) * 90 : 0);
  return {
    partidos: partidos.length,
    minutos: Math.round(min),
    goles,
    xg,
    remates,
    goles90: por90(goles),
    xg90: por90(xg),
    dif90: por90(goles - xg),
    xgPorRemate: remates ? xg / remates : null,
  };
}

/**
 * Sus últimos 5 partidos jugados frente a su temporada. `remates` es TODA la
 * categoría (sólo para fechar los partidos); los suyos se filtran por
 * `tiradorId`. `null` si no ha jugado o no hay con qué comparar.
 */
export function rachaDelantero(playerId: string, jugadoresPartidos: Fila[], remates: Remate[]): RachaDelantero | null {
  if (!playerId) return null;

  const minutos = new Map<string, number>();
  for (const f of jugadoresPartidos) {
    if (String(f.playerId ?? "") !== playerId) continue;
    const m = num(f.Min) ?? 0;
    const p = String(f.partido ?? "");
    if (p && m > 0) minutos.set(p, (minutos.get(p) ?? 0) + m);
  }
  if (!minutos.size) return null;

  const fechas = new Map<string, string>();
  for (const r of remates) if (r.partido && r.fecha && !fechas.has(r.partido)) fechas.set(r.partido, r.fecha);

  const jugados = [...minutos.keys()].sort(
    (a, b) => (fechas.get(a) ?? "").localeCompare(fechas.get(b) ?? "") || a.localeCompare(b),
  );
  const ultimosIds = jugados.slice(-PARTIDOS_RACHA);
  const suyos = remates.filter((r) => r.tiradorId === playerId && !esPenalti(r));

  const temporada = tramo(jugados, minutos, suyos);
  const ultimos = tramo(ultimosIds, minutos, suyos);
  const desde = fechas.get(ultimosIds[0]) ?? "";
  const hasta = fechas.get(ultimosIds[ultimosIds.length - 1]) ?? "";

  let etiqueta: EtiquetaRacha | null = null;
  let porque = "";

  if (temporada.minutos < MINUTOS_TEMPORADA) {
    porque = `Lleva ${temporada.minutos}′ en la temporada: con menos de ${MINUTOS_TEMPORADA} no se compara.`;
  } else if (jugados.length <= PARTIDOS_RACHA) {
    porque = `Ha jugado ${jugados.length} ${jugados.length === 1 ? "partido" : "partidos"}: sus últimos 5 son toda su temporada.`;
  } else if (ultimos.minutos < MINUTOS_RACHA) {
    porque = `${ultimos.minutos}′ en sus últimos ${ultimos.partidos} partidos: con menos de ${MINUTOS_RACHA} no se etiqueta.`;
  } else {
    const subeXg = ultimos.xg90 >= temporada.xg90 * 1.25 && ultimos.xg90 - temporada.xg90 >= 0.1;
    const bajaXg = ultimos.xg90 <= temporada.xg90 * 0.75 && temporada.xg90 - ultimos.xg90 >= 0.1;
    const difUlt = ultimos.goles - ultimos.xg;
    const xgs = `xG/90 de ${coma(ultimos.xg90)} en los últimos 5 y ${coma(temporada.xg90)} en la temporada`;
    if (subeXg) {
      etiqueta = "genera";
      porque = `${xgs}: llega más que en el resto del año.`;
    } else if (!bajaXg && ultimos.goles >= 2 && difUlt >= 1) {
      etiqueta = "afinado";
      porque = `${ultimos.goles} goles con ${coma(ultimos.xg, 1)} de xG en los últimos 5 (${coma(difUlt, 1)} más de lo esperado), con un ${xgs}.`;
    } else if (!bajaXg && ultimos.xg >= 0.8 && difUlt <= -0.8) {
      etiqueta = "seco";
      porque = `${ultimos.goles} ${ultimos.goles === 1 ? "gol" : "goles"} con ${coma(ultimos.xg, 1)} de xG en los últimos 5, con un ${xgs}.`;
    } else if (bajaXg) {
      etiqueta = "menos";
      porque = `${xgs}.`;
    } else {
      etiqueta = "linea";
      porque = `${ultimos.goles} ${ultimos.goles === 1 ? "gol" : "goles"} con ${coma(ultimos.xg, 1)} de xG en los últimos 5 y un ${xgs}.`;
    }
  }

  return { ultimos, temporada, etiqueta, porque, desde, hasta };
}
