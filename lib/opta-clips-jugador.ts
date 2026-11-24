/**
 * EL VÍDEO DE CADA JUGADOR RIVAL POR SUS FORTALEZAS (24/11/2026).
 *
 * La forma del documento `opta:clips-jugador`, que escribe
 * scripts/opta-clips-jugador.mjs cada noche (fortalezas de Opta en percentil
 * contra su línea, cortes de sus últimos 5 partidos, como mucho 2 minutos).
 * Sólo el administrador: vetado en /api/docs, se lee por
 * /api/opta/clips-jugador y el vídeo vive en `privado/` de B2.
 *
 * Sin datos aquí (el repo es público): sólo tipos y una limpieza.
 */

export const CLAVE_CLIPS_JUGADOR = "opta:clips-jugador";

export type FortalezaJugador = { clave: string; nombre: string; percentil: number; por90: number; relativa?: boolean; enVideo: boolean };

export type CorteJugador = { partido: string; fecha: string; rival: string; parte: number; segundo: number; fortaleza: string; que: string; dura: number };

export type ClipsJugador = {
  nombre: string;
  teamId: string;
  equipo: string;
  puesto: string;
  minutos: number;
  fortalezas: FortalezaJugador[];
  url?: string;
  bytes?: number;
  segundos?: number;
  en?: string;
  cortes?: CorteJugador[];
  sinVideo?: string;
};

export type EquipoClips = { nombre: string; partidos: { partido: string; fecha: string; rival: string }[]; revisado: string; jugadores: string[] };

export type DocClipsJugador = { actualizado?: string; equipos: Record<string, EquipoClips>; jugadores: Record<string, ClipsJugador> };

export function normalizaClipsJugador(crudo: unknown): DocClipsJugador {
  const d = (crudo && typeof crudo === "object" ? crudo : {}) as Partial<DocClipsJugador>;
  return {
    actualizado: typeof d.actualizado === "string" ? d.actualizado : undefined,
    equipos: d.equipos && typeof d.equipos === "object" ? d.equipos : {},
    jugadores: d.jugadores && typeof d.jugadores === "object" ? d.jugadores : {},
  };
}

/** El minuto que se ve en el marcador (la segunda parte empieza en el 2700). */
export const minutoDe = (segundo: number) => `${Math.floor(segundo / 60) + 1}'`;
