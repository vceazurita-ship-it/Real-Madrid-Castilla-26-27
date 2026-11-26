/**
 * ESTADÍSTICAS DE LA PLANTILLA (26/11/2026).
 *
 * El analista: «que haya una sección general de estadísticas de nuestra
 * plantilla: minutos, tarjetas, goles, asistencias, etc.». La cuenta de cada
 * jugador sale de Valoraciones (partido a partido: minutos, titular, goles,
 * asistencias, amarillas y roja; lo rellena cada noche BeSoccer,
 * scripts/valoraciones-besoccer.mjs, y la nota la pone el cuerpo técnico) y,
 * aparte, lo que da Opta de la temporada en liga (opta:castilla: xG, xA,
 * remates, pases, recuperaciones, duelos; paradas del portero).
 *
 * Sin datos de nadie aquí (el repo es público): sólo la cuenta.
 */

import { partidosDeLiga } from "@/lib/plantilla/dashboard";
import type { RatingsSeason } from "@/lib/ratings/types";

export type FiltroCompeticion = "todas" | "liga";

export type EstadisticaJugador = {
  id: string;
  /** Partidos con minutos. */
  pj: number;
  titular: number;
  suplente: number;
  /** Convocado sin jugar no se sabe (Valoraciones sólo guarda a quien jugó). */
  minutos: number;
  goles: number;
  asistencias: number;
  amarillas: number;
  /** Expulsiones (roja directa o doble amarilla). */
  rojas: number;
  /** Nota media del cuerpo técnico (sin los «sin valorar» ni los 0). */
  nota: number | null;
  conNota: number;
};

const esLiga = (competicion: string) => !competicion || /liga|primera|rfef|grupo/i.test(competicion);

/** Los partidos jugados que cuentan con ese filtro, y la estadística de cada jugador (por su id vigente). */
export function estadisticasDe(season: RatingsSeason, hoy: string, filtro: FiltroCompeticion) {
  const partidos = partidosDeLiga(season, hoy).filter((p) => filtro === "todas" || esLiga(p.match.competition));
  const porId = new Map<string, EstadisticaJugador & { sumaNota: number }>();
  for (const p of partidos) {
    for (const [id, r] of p.jugadores) {
      const jugo = (r.minutes ?? 0) > 0 || r.starter;
      if (!jugo) continue;
      const e = porId.get(id) ?? { id, pj: 0, titular: 0, suplente: 0, minutos: 0, goles: 0, asistencias: 0, amarillas: 0, rojas: 0, nota: null, conNota: 0, sumaNota: 0 };
      e.pj++;
      if (r.starter) e.titular++;
      else e.suplente++;
      e.minutos += r.minutes ?? 0;
      e.goles += r.goals ?? 0;
      e.asistencias += r.assists ?? 0;
      e.amarillas += r.yellow ?? 0;
      if (r.red || (r.yellow ?? 0) >= 2) e.rojas++;
      if (!r.unrated && r.rating > 0) {
        e.conNota++;
        e.sumaNota += r.rating;
      }
      porId.set(id, e);
    }
  }
  const jugadores = new Map<string, EstadisticaJugador>();
  for (const [id, e] of porId) {
    const { sumaNota, ...resto } = e;
    jugadores.set(id, { ...resto, nota: e.conNota ? Math.round((sumaNota / e.conNota) * 10) / 10 : null });
  }
  return { partidos: partidos.length, competiciones: [...new Set(partidosDeLiga(season, hoy).map((p) => p.match.competition || "Liga"))], jugadores };
}

/* ---------------------------- OPTA ---------------------------- */

export type OptaJugador = {
  xG: number | null;
  xA: number | null;
  remates: number | null;
  aPuerta: number | null;
  pases: number | null;
  aciertoPase: number | null;
  ocasiones: number | null;
  recuperaciones: number | null;
  duelos: number | null;
  paradas: number | null;
  encajados: number | null;
};

const llano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Su fila de Opta por el nombre, y sólo si es una: igual; o todas las palabras
 * de uno dentro del otro, en los dos sentidos («Cestero» ↔ «Jorge Cestero»,
 * «Fortea» → «Jesús Fortea»); una inicial casa con la palabra que empieza por
 * ella («A. Leiva» → «Ávaro Leiva», que Opta escribe así).
 */
export function casaOpta<T extends Record<string, unknown>>(nombre: string, apodo: string, filas: T[]): T | null {
  const n = llano(nombre);
  const a = llano(apodo);
  const igual = filas.filter((f) => [n, a].filter(Boolean).includes(llano(String(f.jugador ?? ""))));
  if (igual.length === 1) return igual[0];
  const palabras = (t: string) => t.split(" ").filter(Boolean);
  const cabe = (de: string[], en: string[]) => de.some((p) => p.length > 1) && de.every((p) => (p.length === 1 ? en.some((q) => q.startsWith(p)) : en.includes(p)));
  const mias = [n, a].filter(Boolean).map(palabras);
  const dentro = filas.filter((f) => {
    const suyas = palabras(llano(String(f.jugador ?? "")));
    return mias.some((m) => cabe(suyas, m) || cabe(m, suyas));
  });
  return dentro.length === 1 ? dentro[0] : null;
}

export function optaDe(f: Record<string, unknown> | null): OptaJugador | null {
  if (!f) return null;
  const n = (k: string) => {
    const v = f[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const pct = (k: string) => {
    const v = n(k);
    return v == null ? null : v <= 1 ? v * 100 : v;
  };
  return {
    xG: n("ExpG"),
    xA: n("xA"),
    remates: n("ShtIncBl"),
    aPuerta: n("SOG"),
    pases: n("PsAtt"),
    aciertoPase: pct("Pass%"),
    ocasiones: n("Chance"),
    recuperaciones: n("Recovery"),
    duelos: pct("Duel%"),
    paradas: n("Saves"),
    encajados: n("GAg"),
  };
}
