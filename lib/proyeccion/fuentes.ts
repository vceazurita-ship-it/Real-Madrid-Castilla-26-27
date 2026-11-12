/**
 * PROYECCIÓN DE LA JORNADA · DE LAS FUENTES A LA TABLA (12/11/2026).
 *
 * Convierte lo que ya lee la app en filas equipo × partido (`FilaPartido`):
 *
 * - **Opta** (`opta:partidos`): una fila por equipo y partido con las cifras
 *   de juego (posesión, xG, remates, PPDA…) y los córners. Es la base: cubre
 *   los 40 equipos de Primera RFEF con el mismo criterio.
 * - **Opta evento a evento** (`opta:abp-eventos` + `opta:remates`, ya
 *   deduplicados por `saquesDe` / `rematesDe`): faltas laterales, saques de
 *   banda en campo rival, faltas directas y penaltis, con los remates y el xG
 *   que salen de cada uno (también la segunda jugada).
 * - **Wyscout** (`public/data/analisis.json`, los Team Stats por partido): el
 *   campo (el título del partido pone primero al local, cosa que Opta no
 *   trae) y los contraataques.
 *
 * Sin datos aquí (el repo es público): sólo nombres y cuentas.
 */

import { num, type Celda } from "@/lib/opta";
import { casaEquipo, enArea, esFaltaLateral, type Remate, type Saque } from "@/lib/opta-eventos";

import type { FilaPartido } from "./base";

type Fila = Record<string, Celda>;

export type EquipoOpta = { teamId: string; equipo: string };

/** Un partido de los Team Stats de Wyscout, tal cual viene en `analisis.json`. */
export type PartidoWyscout = {
  fecha: string;
  partido: string;
  competicion?: string;
  equipo: string;
  rival?: string;
  datos: Record<string, number | null | undefined>;
};

/** La temporada en curso empieza aquí (la de BeSoccer y la de Opta). */
export const DESDE_TEMPORADA = "2026-07-01";

const dia = (fecha: string) => String(fecha ?? "").slice(0, 10);

function masDias(fecha: string, d: number): string {
  const t = Date.parse(`${fecha}T12:00:00Z`);
  if (!Number.isFinite(t)) return fecha;
  return new Date(t + d * 86_400_000).toISOString().slice(0, 10);
}

/** «Águilas - Gimnàstic Tarragona 1:1» → local y visitante. */
export function equiposDelTitulo(titulo: string): { local: string; visitante: string } | null {
  const m = /^(.*?) - (.*?)\s+\d+:\d+/.exec(String(titulo ?? ""));
  if (!m) return null;
  return { local: m[1].trim(), visitante: m[2].trim() };
}

/** Un traductor de nombres de Wyscout a teamId de Opta, con memoria. */
export function traductor(equipos: EquipoOpta[]) {
  const hecho = new Map<string, string | null>();
  return (nombre: string): string | null => {
    if (!hecho.has(nombre)) hecho.set(nombre, casaEquipo(nombre, equipos));
    return hecho.get(nombre) ?? null;
  };
}

export const esLigaWyscout = (p: PartidoWyscout) => /primera divisi[oó]n rfef/i.test(p.competicion ?? "") && dia(p.fecha) >= DESDE_TEMPORADA;

/**
 * Quién jugó en casa: `teamId|fecha` → true (local) / false (visitante), del
 * título de los partidos de Wyscout de esta temporada.
 */
export function camposDeWyscout(partidos: PartidoWyscout[], equipos: EquipoOpta[]): Map<string, boolean> {
  const id = traductor(equipos);
  const out = new Map<string, boolean>();
  const vistos = new Set<string>();
  for (const p of partidos) {
    if (!esLigaWyscout(p)) continue;
    const k = `${dia(p.fecha)}|${p.partido}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const t = equiposDelTitulo(p.partido);
    if (!t) continue;
    const a = id(t.local);
    const b = id(t.visitante);
    if (!a || !b || a === b) continue;
    out.set(`${a}|${dia(p.fecha)}`, true);
    out.set(`${b}|${dia(p.fecha)}`, false);
  }
  return out;
}

/** El campo de un equipo en una fecha (con un día de margen: Opta y Wyscout no siempre ponen el mismo). */
export function campoDe(campos: Map<string, boolean>, teamId: string, fecha: string): boolean | null {
  const f = dia(fecha);
  for (const d of [0, -1, 1]) {
    const v = campos.get(`${teamId}|${masDias(f, d)}`);
    if (v !== undefined) return v;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  JUEGO (Opta por partido + Wyscout)                                 */
/* ------------------------------------------------------------------ */

/** Las columnas de `opta:partidos` que usa la proyección del juego. */
export const COLUMNAS_JUEGO_OPTA = [
  "Goal",
  "ExpG",
  "ShtIncBl",
  "SOG",
  "Poss%",
  "PPDA",
  "PsAtt",
  "LgBall",
  "TouchOpBox",
  "Chance",
  "Crosses",
  "Recovery",
  "PosWonA3rd",
  "PsLostD3",
  "SeqEndInA3",
  "Corners",
  "FoulCom",
  "FoulSuf",
] as const;

/** Las de Wyscout, con la clave corta con la que van en la fila. */
export const COLUMNAS_WYSCOUT: Record<string, string> = {
  wContra: "Contraataques",
  wContraRem: "Contraataques · con remate",
  wRecAlt: "Balones recuperados · altos",
  wPerdBaj: "Balones perdidos · bajos",
};

/** Una fila por equipo y partido de `opta:partidos`, con su campo. */
export function filasJuegoOpta(partidos: Fila[], campos: Map<string, boolean>): FilaPartido[] {
  return partidos
    .filter((f) => f.partido && f.teamId)
    .map((f) => {
      const v: Record<string, number | null> = {};
      for (const c of COLUMNAS_JUEGO_OPTA) v[c] = num(f[c]);
      const pases = v.PsAtt;
      v.directo = pases && v.LgBall != null ? v.LgBall / pases : null;
      return {
        partido: String(f.partido),
        fecha: dia(String(f.fecha ?? "")),
        equipo: String(f.teamId),
        local: campoDe(campos, String(f.teamId), String(f.fecha ?? "")),
        v,
      };
    })
    .filter((f) => f.fecha);
}

/**
 * Añade a las filas de Opta lo de Wyscout del mismo equipo y la misma fecha
 * (un día de margen). Lo que Wyscout no tiene se queda en null: esa métrica
 * sale sólo con los partidos que sí lo traen.
 */
export function conWyscout(filas: FilaPartido[], partidos: PartidoWyscout[], equipos: EquipoOpta[]): FilaPartido[] {
  const id = traductor(equipos);
  const porClave = new Map<string, PartidoWyscout>();
  for (const p of partidos) {
    if (!esLigaWyscout(p)) continue;
    const t = id(p.equipo);
    if (t) porClave.set(`${t}|${dia(p.fecha)}`, p);
  }
  return filas.map((f) => {
    let p: PartidoWyscout | undefined;
    for (const d of [0, -1, 1]) {
      p = porClave.get(`${f.equipo}|${masDias(f.fecha, d)}`);
      if (p) break;
    }
    const v = { ...f.v };
    for (const [k, col] of Object.entries(COLUMNAS_WYSCOUT)) {
      const x = p?.datos?.[col];
      v[k] = typeof x === "number" && Number.isFinite(x) ? x : null;
    }
    return { ...f, v };
  });
}

/* ------------------------------------------------------------------ */
/*  BALÓN PARADO (Opta evento a evento)                                */
/* ------------------------------------------------------------------ */

/** El saque de banda «en campo rival»: desde su mitad (x ≥ 50). */
export const esBandaCampoRival = (s: Saque) => s.abp === "banda" && s.x >= 50;

export type TipoAbp = "corner" | "faltaLateral" | "faltaDirecta" | "bandaRival" | "penalti";

export const TIPOS_ABP: TipoAbp[] = ["corner", "faltaLateral", "faltaDirecta", "bandaRival", "penalti"];

const SITUACION_DIRECTA = "Direct Free Kick";
const SITUACION_PENALTI = "Penalty";

/**
 * Una fila por equipo y partido con el balón parado: cuántas acciones de cada
 * tipo y cuántos remates, xG y goles salen de ellas (primera y segunda
 * jugada). Las claves: `<tipo>`, `<tipo>Rem`, `<tipo>XG`, `<tipo>Gol`.
 *
 * - Córners: el recuento de `opta:partidos` (`Corners`, el oficial); los
 *   remates y el xG, de los saques de córner evento a evento.
 * - Faltas laterales: colgadas al área desde fuera de su ancho (`esFaltaLateral`).
 * - Faltas directas: cada tiro directo de falta es una acción.
 * - Saques de banda en campo rival: desde x ≥ 50.
 * - Penaltis: cada penalti lanzado.
 * - Lleva también `Poss%` (para el tipo de partido).
 */
export function filasAbpOpta(partidos: Fila[], saques: Saque[], remates: Remate[], campos: Map<string, boolean>): FilaPartido[] {
  type Acc = Record<string, number>;
  const acc = new Map<string, Acc>();
  const de = (partido: string, teamId: string) => {
    const k = `${partido}|${teamId}`;
    let a = acc.get(k);
    if (!a) acc.set(k, (a = {}));
    return a;
  };
  const suma = (a: Acc, k: string, v: number) => (a[k] = (a[k] ?? 0) + v);

  const apunta = (a: Acc, tipo: TipoAbp, rs: Remate[]) => {
    suma(a, tipo, 1);
    suma(a, `${tipo}Rem`, rs.length);
    suma(a, `${tipo}XG`, rs.reduce((s, r) => s + (r.xG || 0), 0));
    suma(a, `${tipo}Gol`, rs.filter((r) => r.gol).length);
  };

  for (const s of saques) {
    const a = de(s.partido, s.teamId);
    const rs = [...s.remates, ...s.segundas];
    if (s.abp === "corner") {
      /* El número de córners va de la columna oficial; aquí sólo lo que sale de ellos. */
      suma(a, "cornerEv", 1);
      suma(a, "cornerRem", rs.length);
      suma(a, "cornerXG", rs.reduce((x, r) => x + (r.xG || 0), 0));
      suma(a, "cornerGol", rs.filter((r) => r.gol).length);
      if (s.remates.length) suma(a, "cornerConRemate", 1);
    } else if (esFaltaLateral(s)) apunta(a, "faltaLateral", rs);
    else if (esBandaCampoRival(s)) {
      apunta(a, "bandaRival", rs);
      if (enArea(s.finX, s.finY)) suma(a, "bandaArea", 1);
    }
  }
  for (const r of remates) {
    if (r.situacion === SITUACION_DIRECTA) apunta(de(r.partido, r.teamId), "faltaDirecta", [r]);
    else if (r.situacion === SITUACION_PENALTI) apunta(de(r.partido, r.teamId), "penalti", [r]);
  }

  return partidos
    .filter((f) => f.partido && f.teamId)
    .map((f) => {
      const a = acc.get(`${f.partido}|${f.teamId}`) ?? {};
      const v: Record<string, number | null> = { "Poss%": num(f["Poss%"]), corner: num(f.Corners) };
      for (const tipo of TIPOS_ABP) {
        if (tipo !== "corner") v[tipo] = a[tipo] ?? 0;
        for (const suf of ["Rem", "XG", "Gol"]) v[`${tipo}${suf}`] = a[`${tipo}${suf}`] ?? 0;
      }
      v.cornerEv = a.cornerEv ?? 0;
      v.cornerConRemate = a.cornerConRemate ?? 0;
      v.bandaArea = a.bandaArea ?? 0;
      v.abpXG = TIPOS_ABP.reduce((s, t) => s + (v[`${t}XG`] ?? 0), 0);
      return {
        partido: String(f.partido),
        fecha: dia(String(f.fecha ?? "")),
        equipo: String(f.teamId),
        local: campoDe(campos, String(f.teamId), String(f.fecha ?? "")),
        v,
      };
    })
    .filter((f) => f.fecha);
}

/** Sólo los equipos del grupo de `teamId` (los grupos salen de quién juega contra quién). */
export function delGrupo(filas: FilaPartido[], grupos: Map<string, number>, teamId: string): FilaPartido[] {
  const g = grupos.get(teamId);
  if (g === undefined) return filas;
  return filas.filter((f) => grupos.get(f.equipo) === g);
}
