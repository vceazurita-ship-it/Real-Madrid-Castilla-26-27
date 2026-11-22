/**
 * ¿SE REPLIEGA EL RIVAL TRAS EL DESCANSO? (Scout colectivo, 22/11/2026, idea
 * de X). Con el evento a evento de Opta (`opta:directo:<partido>`), por cada
 * parte de los partidos de un equipo:
 *
 * - altura del bloque: la x media de sus acciones defensivas (entradas,
 *   intercepciones y recuperaciones: Tackle, Interception, BallRecovery), en
 *   metros desde su portería (Opta x 0-100 = 105 m, siempre hacia la portería
 *   rival);
 * - territorio: % de sus toques que caen en el último tercio (x ≥ 66,7);
 * - duelos: % de sus duelos ganados (Aerial, TakeOn, Tackle, Challenge,
 *   AttemptedTackle con ok = 1).
 *
 * Todo sumado en sus partidos (cociente de sumas). La comparación con la liga
 * es la diferencia 2.ª − 1.ª de cada equipo, y su media.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const MAX_PARTIDOS = 8;
/** Con menos acciones defensivas en una parte no se compara al equipo. */
export const MIN_DEFENSIVAS = 40;
/** Metros de más que tiene que bajar el bloque sobre la caída de la liga para el aviso. */
export const UMBRAL_REPLIEGUE_M = 5;

const DEFENSIVAS = new Set(["Tackle", "Interception", "BallRecovery"]);
const DUELO = new Set(["Aerial", "TakeOn", "Tackle", "Challenge", "AttemptedTackle"]);

export type Medidas = {
  /** Metros desde su portería. */
  altura: number;
  /** Tanto por uno. */
  tercio: number;
  /** Tanto por uno. */
  duelos: number;
  defensivas: number;
  toques: number;
  nDuelos: number;
};

export type PorParte = { partidos: number; p1: Medidas; p2: Medidas };

type Suma = { sx: number; nd: number; toques: number; tercio: number; duelos: number; ganados: number };
const cero = (): Suma => ({ sx: 0, nd: 0, toques: 0, tercio: 0, duelos: 0, ganados: 0 });
const cierra = (s: Suma): Medidas => ({
  altura: s.nd ? ((s.sx / s.nd) * 105) / 100 : 0,
  tercio: s.toques ? s.tercio / s.toques : 0,
  duelos: s.duelos ? s.ganados / s.duelos : 0,
  defensivas: s.nd,
  toques: s.toques,
  nDuelos: s.duelos,
});

/** Las dos partes de `teamId` en esos partidos. `null` si no llega al mínimo en alguna. */
export function porParte(partidos: { eventos: EventoDirecto[] }[], teamId: string): PorParte | null {
  const s: Record<1 | 2, Suma> = { 1: cero(), 2: cero() };
  let leidos = 0;
  for (const p of partidos) {
    let suyo = false;
    for (const e of p.eventos) {
      if (e.teamId !== teamId || (e.parte !== 1 && e.parte !== 2)) continue;
      suyo = true;
      const t = s[e.parte as 1 | 2];
      if (DEFENSIVAS.has(e.tipo) && !(e.x === 0 && e.y === 0)) {
        t.sx += e.x;
        t.nd += 1;
      }
      if (esToque(e)) {
        t.toques += 1;
        if (e.x >= 66.7) t.tercio += 1;
      }
      if (DUELO.has(e.tipo)) {
        t.duelos += 1;
        if (e.ok) t.ganados += 1;
      }
    }
    if (suyo) leidos += 1;
  }
  if (!leidos || s[1].nd < MIN_DEFENSIVAS || s[2].nd < MIN_DEFENSIVAS) return null;
  return { partidos: leidos, p1: cierra(s[1]), p2: cierra(s[2]) };
}

export const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

export type Diferencias = { altura: number; tercio: number; duelos: number };

/** 2.ª − 1.ª. */
export const diferencia = (r: PorParte): Diferencias => ({
  altura: r.p2.altura - r.p1.altura,
  tercio: r.p2.tercio - r.p1.tercio,
  duelos: r.p2.duelos - r.p1.duelos,
});

/** Diferencia media de la liga (2.ª − 1.ª de cada equipo, promediada). */
export const diferenciaLiga = (otros: PorParte[]): Diferencias => {
  const d = otros.map(diferencia);
  return { altura: media(d.map((x) => x.altura)), tercio: media(d.map((x) => x.tercio)), duelos: media(d.map((x) => x.duelos)) };
};

/** Se repliega si su bloque baja más de 5 m que la caída media de la liga. */
export const sePliega = (rival: Diferencias, liga: Diferencias) => rival.altura - liga.altura < -UMBRAL_REPLIEGUE_M;
/** Al revés: sube más de 5 m que la liga. */
export const seAdelanta = (rival: Diferencias, liga: Diferencias) => rival.altura - liga.altura > UMBRAL_REPLIEGUE_M;
