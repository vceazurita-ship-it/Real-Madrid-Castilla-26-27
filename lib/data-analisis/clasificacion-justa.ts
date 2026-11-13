/**
 * CLASIFICACIÓN JUSTA (13/11/2026): puntos reales contra puntos esperados por
 * xG (xPts) en el grupo del Castilla, sobre `opta:partidos` (equipo × partido).
 *
 * EL MODELO. En cada partido, los goles de cada equipo son un Poisson
 * independiente con media su ExpG (el del rival, su ExpG o nuestro ExpGAg).
 * xPts = 3 × P(ganar) + 1 × P(empatar). Los puntos reales salen del marcador
 * de la misma fila (Goal contra GA, o el Goal del rival).
 *
 * LA JORNADA, como en `lib/opta-evolucion.ts`: «hasta la jornada N» son los N
 * primeros partidos de cada equipo por fecha (Opta no trae el número). Los
 * partidos sin xG no cuentan en ninguna de las dos columnas, para comparar lo
 * mismo con lo mismo.
 */

import { num } from "@/lib/opta";
import { nombreEquipo, type Fila } from "@/lib/opta-analisis";
import { partidosPorEquipo } from "@/lib/opta-evolucion";

/** Hasta 10 goles: con xG de partido (< 5) lo que queda fuera es despreciable. */
const MAX_GOLES = 10;

function poisson(lambda: number): number[] {
  const l = Math.max(0, lambda);
  const p: number[] = [Math.exp(-l)];
  for (let k = 1; k <= MAX_GOLES; k++) p.push((p[k - 1] * l) / k);
  return p;
}

/** Probabilidad de ganar, empatar y perder con xG propio `a` y del rival `b`. */
export function probabilidades(a: number, b: number): { gana: number; empata: number; pierde: number } {
  const pa = poisson(a);
  const pb = poisson(b);
  let gana = 0;
  let empata = 0;
  let pierde = 0;
  for (let i = 0; i <= MAX_GOLES; i++)
    for (let j = 0; j <= MAX_GOLES; j++) {
      const x = pa[i] * pb[j];
      if (i > j) gana += x;
      else if (i === j) empata += x;
      else pierde += x;
    }
  const t = gana + empata + pierde || 1;
  return { gana: gana / t, empata: empata / t, pierde: pierde / t };
}

export const xPtsDe = (a: number, b: number) => {
  const p = probabilidades(a, b);
  return 3 * p.gana + p.empata;
};

export type FilaJusta = {
  teamId: string;
  equipo: string;
  partidos: number;
  puntos: number;
  xPts: number;
  gf: number;
  gc: number;
  xgf: number;
  xgc: number;
  /** Puesto en la tabla real y en la de xPts (1 = primero). */
  puestoReal: number;
  puestoJusto: number;
  /** puntos − xPts: positivo, tiene más de lo que merece. */
  dif: number;
};

/** El mayor número de partidos con xG de un equipo del grupo: el tope del selector. */
export function jornadasDe(partidos: Fila[], grupo: Set<string>): number {
  const porEquipo = partidosPorEquipo(partidos);
  let max = 0;
  for (const id of grupo) {
    const n = (porEquipo.get(id) ?? []).filter((p) => num(p.fila.ExpG) != null && p.otra && num(p.otra.ExpG) != null).length;
    max = Math.max(max, n);
  }
  return max;
}

/** Las dos tablas a la vez, hasta la jornada `hasta` de cada equipo. */
export function clasificacionJusta(partidos: Fila[], grupo: Set<string>, hasta: number): FilaJusta[] {
  const porEquipo = partidosPorEquipo(partidos);
  const filas: Omit<FilaJusta, "puestoReal" | "puestoJusto">[] = [];

  for (const id of grupo) {
    const suyos = (porEquipo.get(id) ?? [])
      .filter((p) => p.otra && grupo.has(p.rivalId))
      .filter((p) => num(p.fila.ExpG) != null && (num(p.fila.ExpGAg) ?? num(p.otra!.ExpG)) != null)
      .filter((p) => p.gf != null && (p.gc ?? num(p.otra!.Goal)) != null)
      .slice(0, hasta);
    if (!suyos.length) continue;
    let puntos = 0;
    let xPts = 0;
    let gf = 0;
    let gc = 0;
    let xgf = 0;
    let xgc = 0;
    for (const p of suyos) {
      const a = num(p.fila.ExpG)!;
      const b = (num(p.fila.ExpGAg) ?? num(p.otra!.ExpG))!;
      const g = p.gf!;
      const c = (p.gc ?? num(p.otra!.Goal))!;
      puntos += g > c ? 3 : g === c ? 1 : 0;
      xPts += xPtsDe(a, b);
      gf += g;
      gc += c;
      xgf += a;
      xgc += b;
    }
    filas.push({ teamId: id, equipo: nombreEquipo(suyos[0].fila), partidos: suyos.length, puntos, xPts, gf, gc, xgf, xgc, dif: puntos - xPts });
  }

  const real = [...filas].sort((a, b) => b.puntos - a.puntos || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.equipo.localeCompare(b.equipo, "es"));
  const justa = [...filas].sort((a, b) => b.xPts - a.xPts || b.xgf - b.xgc - (a.xgf - a.xgc) || a.equipo.localeCompare(b.equipo, "es"));
  const pReal = new Map(real.map((f, i) => [f.teamId, i + 1]));
  const pJusto = new Map(justa.map((f, i) => [f.teamId, i + 1]));
  return real.map((f) => ({ ...f, puestoReal: pReal.get(f.teamId)!, puestoJusto: pJusto.get(f.teamId)! }));
}
