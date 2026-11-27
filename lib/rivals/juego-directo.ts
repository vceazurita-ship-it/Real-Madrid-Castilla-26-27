/**
 * ¿LE VA MEJOR AL RIVAL CUANDO JUEGA DIRECTO? (Scout colectivo, 27/11/2026,
 * idea de X).
 *
 * Sobre `opta:partidos` (equipo × partido). Por partido del rival:
 * - % de pases largos: `LgBall` / `PsAtt` × 100 (la misma cuenta que el rasgo
 *   «juego largo» de la identidad; `LongBall%` de Opta es temporada).
 * - Puntos: 3, 1 o 0 con sus goles (`Goal`) y los de la fila del oponente.
 * - xG a favor: `ExpG` de su fila; xG en contra: `ExpG` de la del oponente.
 * - Remates: `ShtIncBl` (con los bloqueados).
 *
 * Los partidos se ordenan por % de largos y se parten por su propia mediana:
 * la mitad de abajo («menos directo») y la de arriba («más directo»); con un
 * número impar, el partido de la mediana no entra en ninguno.
 *
 * Media de la liga: todas las filas equipo × partido de los equipos de su
 * grupo (él y los que se ha cruzado), las mismas cuatro cifras.
 *
 * «Diferencia clara» si cada mitad tiene al menos MIN_POR_GRUPO partidos, la
 * diferencia en puntos y en balance de xG (a favor − en contra) va en el mismo
 * sentido y al menos una supera su umbral. Si no, «sin diferencia clara».
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import type { Fila, PartidoEquipo } from "@/lib/opta-analisis";
import { num } from "@/lib/opta";

export const MIN_POR_GRUPO = 4;
export const UMBRAL_PUNTOS = 0.5;
export const UMBRAL_BALANCE = 0.3;

export type PartidoDirecto = {
  fecha: string;
  oponente: string;
  largos: number;
  puntos: number;
  gf: number;
  gc: number;
  xg: number | null;
  xgc: number | null;
  remates: number | null;
};

export type Cuatro = { puntos: number | null; xg: number | null; xgc: number | null; remates: number | null; n: number };

export type JuegoDirecto = {
  partidos: PartidoDirecto[];
  mediana: number;
  /** Más largos que su mediana. */
  directo: Cuatro;
  /** Menos largos que su mediana. */
  corto: Cuatro;
  liga: Cuatro;
  /** Mediana de % de largos de toda la liga (fila equipo × partido). */
  medianaLiga: number | null;
  /** «directo»: le va mejor en largo; «corto»: le va mejor jugando corto; null: sin diferencia clara. */
  mejor: "directo" | "corto" | null;
  /** Por qué no hay diferencia clara. */
  motivo: "pocos" | "pequeña" | "cruzada" | null;
};

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const media = (xs: (number | null)[]) => {
  const v = xs.filter(finito);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const n = o.length;
  return n ? (n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2) : null;
};

export function largosDe(f: Fila): number | null {
  const l = num(f.LgBall);
  const p = num(f.PsAtt);
  return l != null && p != null && p > 0 ? (l / p) * 100 : null;
}

function leePartido(p: PartidoEquipo): PartidoDirecto | null {
  if (!p.otra) return null;
  const largos = largosDe(p.fila);
  const gf = num(p.fila.Goal);
  const gc = num(p.otra.Goal) ?? p.gc;
  if (largos == null || gf == null || gc == null) return null;
  return {
    fecha: p.fecha,
    oponente: p.rival,
    largos,
    puntos: gf > gc ? 3 : gf === gc ? 1 : 0,
    gf,
    gc,
    xg: num(p.fila.ExpG),
    xgc: num(p.otra.ExpG),
    remates: num(p.fila.ShtIncBl),
  };
}

const cuatro = (ps: PartidoDirecto[]): Cuatro => ({
  puntos: media(ps.map((p) => p.puntos)),
  xg: media(ps.map((p) => p.xg)),
  xgc: media(ps.map((p) => p.xgc)),
  remates: media(ps.map((p) => p.remates)),
  n: ps.length,
});

/** `porEquipo`: los partidos de cada equipo (partidosPorEquipo). */
export function juegoDirecto(porEquipo: Map<string, PartidoEquipo[]>, rivalId: string): JuegoDirecto | null {
  const suyos = porEquipo.get(rivalId) ?? [];
  const partidos = suyos.map(leePartido).filter((p): p is PartidoDirecto => p != null);
  if (partidos.length < 2) return null;

  const med = mediana(partidos.map((p) => p.largos))!;
  const orden = [...partidos].sort((a, b) => a.largos - b.largos);
  const mitad = Math.floor(orden.length / 2);
  const corto = orden.slice(0, mitad);
  const directo = orden.slice(orden.length - mitad);

  /* Su grupo: él y los que se ha cruzado. */
  const grupo = new Set([rivalId, ...suyos.map((p) => p.rivalId).filter(Boolean)]);
  const deLiga: PartidoDirecto[] = [];
  for (const id of grupo) for (const p of porEquipo.get(id) ?? []) {
    const l = leePartido(p);
    if (l) deLiga.push(l);
  }

  const d = cuatro(directo);
  const c = cuatro(corto);
  let mejor: JuegoDirecto["mejor"] = null;
  let motivo: JuegoDirecto["motivo"] = null;
  if (d.n < MIN_POR_GRUPO || c.n < MIN_POR_GRUPO) motivo = "pocos";
  else {
    const dPts = (d.puntos ?? 0) - (c.puntos ?? 0);
    const balD = d.xg != null && d.xgc != null ? d.xg - d.xgc : null;
    const balC = c.xg != null && c.xgc != null ? c.xg - c.xgc : null;
    const dBal = balD != null && balC != null ? balD - balC : null;
    const grande = Math.abs(dPts) >= UMBRAL_PUNTOS || (dBal != null && Math.abs(dBal) >= UMBRAL_BALANCE);
    const cruzada = dBal != null && Math.sign(dPts) !== 0 && Math.sign(dBal) !== 0 && Math.sign(dPts) !== Math.sign(dBal);
    if (cruzada) motivo = "cruzada";
    else if (!grande) motivo = "pequeña";
    else {
      const s = Math.sign(dPts) || Math.sign(dBal ?? 0);
      mejor = s > 0 ? "directo" : s < 0 ? "corto" : null;
      if (!mejor) motivo = "pequeña";
    }
  }

  return {
    partidos,
    mediana: med,
    directo: d,
    corto: c,
    liga: cuatro(deLiga),
    medianaLiga: mediana(deLiga.map((p) => p.largos)),
    mejor,
    motivo,
  };
}
