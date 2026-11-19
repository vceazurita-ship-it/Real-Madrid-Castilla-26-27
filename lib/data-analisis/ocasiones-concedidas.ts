/**
 * OCASIONES QUE CONCEDE CADA EQUIPO (19/11/2026, idea de X): cuántas deja
 * rematar por partido y de qué calidad es cada una (xG medio por remate), para
 * todos los equipos del grupo del Castilla, con la media de la liga como cruz.
 *
 * Entra cada remate de `opta:remates` ya limpio (`rematesDe`), sólo de
 * partidos entre dos equipos del grupo, y sin penaltis: un penalti vale
 * ~0,79 xG y no es una ocasión que el rival «deje»; con dos o tres sube el
 * xG medio de cualquiera.
 *
 * Zona: dentro del área = `enArea` de lib/opta-eventos.ts (x ≥ 83 y entre las
 * líneas del área, y 21,1-78,9); el resto, fuera.
 */

import { enArea, type Remate } from "@/lib/opta-eventos";

export type Cuadrante = "muchoPeligroso" | "muchoLejos" | "pocoClaro" | "solido";

export const CUADRANTE: Record<Cuadrante, string> = {
  muchoPeligroso: "Concede mucho y peligroso",
  muchoLejos: "Concede mucho pero lejos",
  pocoClaro: "Concede poco pero claro",
  solido: "Sólido",
};

/** Qué hacer contra él: la razón de ser del gráfico. */
export const CONSIGNA: Record<Cuadrante, string> = {
  muchoPeligroso: "deja rematar mucho y cerca: hay que llegar muchas veces y con gente dentro del área.",
  muchoLejos: "deja rematar, pero de lejos: no basta con llegar, hay que pisar el área antes de tirar.",
  pocoClaro: "deja rematar poco, pero claro cuando lo deja: tiene sentido tener paciencia y esperar la ocasión buena.",
  solido: "concede poco y lejos: habrá pocas ocasiones; el balón parado y las segundas jugadas pesan más.",
};

export type FilaConcede = {
  teamId: string;
  equipo: string;
  partidos: number;
  remates: number;
  xG: number;
  rematesPartido: number;
  xgRemate: number;
  dentro: number;
  fuera: number;
  xgDentro: number;
  xgFuera: number;
};

export type Concesiones = {
  filas: FilaConcede[];
  /** Media de la liga (de los equipos, no de los remates): las líneas de la cruz. */
  mediaRemates: number;
  mediaXg: number;
  /** % de remates concedidos desde dentro del área en toda la liga (todos sus remates juntos). */
  pctDentroLiga: number;
  xgDentroLiga: number;
  xgFueraLiga: number;
  /** Los remates concedidos de cada equipo, para el mapa. */
  porEquipo: Map<string, Remate[]>;
};

export const esPenalti = (r: Remate) => r.situacion === "Penalty" || r.tipo === "PenaltyGoal";
export const dentroDelArea = (r: Remate) => enArea(r.x, r.y);

export function concesiones(remates: Remate[], grupo: Set<string>, nombre: (teamId: string, equipo: string) => string): Concesiones | null {
  const partidos = new Map<string, Set<string>>();
  const porEquipo = new Map<string, Remate[]>();
  const nombres = new Map<string, string>();
  for (const r of remates) {
    if (!grupo.has(r.teamId) || !grupo.has(r.rivalId)) continue;
    for (const [id, eq] of [[r.teamId, r.equipo], [r.rivalId, r.rival]] as const) {
      if (!partidos.has(id)) partidos.set(id, new Set());
      partidos.get(id)!.add(r.partido);
      if (!nombres.has(id) && eq) nombres.set(id, eq);
    }
    if (esPenalti(r)) continue;
    if (!porEquipo.has(r.rivalId)) porEquipo.set(r.rivalId, []);
    porEquipo.get(r.rivalId)!.push(r);
  }

  const filas: FilaConcede[] = [];
  for (const [teamId, ps] of partidos) {
    const rs = porEquipo.get(teamId) ?? [];
    if (!ps.size) continue;
    const dentro = rs.filter(dentroDelArea);
    const fuera = rs.filter((r) => !dentroDelArea(r));
    const suma = (xs: Remate[]) => xs.reduce((s, r) => s + r.xG, 0);
    const xG = suma(rs);
    filas.push({
      teamId,
      equipo: nombre(teamId, nombres.get(teamId) ?? teamId),
      partidos: ps.size,
      remates: rs.length,
      xG,
      rematesPartido: rs.length / ps.size,
      xgRemate: rs.length ? xG / rs.length : 0,
      dentro: dentro.length,
      fuera: fuera.length,
      xgDentro: suma(dentro),
      xgFuera: suma(fuera),
    });
  }
  if (filas.length < 3) return null;

  const media = (f: (x: FilaConcede) => number) => filas.reduce((s, x) => s + f(x), 0) / filas.length;
  const total = filas.reduce((s, f) => s + f.remates, 0);
  const dentro = filas.reduce((s, f) => s + f.dentro, 0);
  const fuera = total - dentro;
  return {
    filas,
    mediaRemates: media((f) => f.rematesPartido),
    mediaXg: media((f) => f.xgRemate),
    pctDentroLiga: total ? dentro / total : 0,
    xgDentroLiga: dentro ? filas.reduce((s, f) => s + f.xgDentro, 0) / dentro : 0,
    xgFueraLiga: fuera ? filas.reduce((s, f) => s + f.xgFuera, 0) / fuera : 0,
    porEquipo,
  };
}

export function cuadranteDe(f: FilaConcede, c: Concesiones): Cuadrante {
  const mucho = f.rematesPartido >= c.mediaRemates;
  const peligroso = f.xgRemate >= c.mediaXg;
  if (mucho) return peligroso ? "muchoPeligroso" : "muchoLejos";
  return peligroso ? "pocoClaro" : "solido";
}
