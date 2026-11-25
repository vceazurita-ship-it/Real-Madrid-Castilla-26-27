/**
 * EL VÍDEO DE CADA JUGADOR RIVAL POR SUS FORTALEZAS (24/11/2026).
 *
 * La forma del documento `opta:clips-jugador`, que escribe
 * scripts/opta-clips-jugador.mjs cada noche (fortalezas de Opta en percentil
 * contra su línea, cortes de sus últimos 5 partidos, como mucho 2 minutos).
 * Sólo el administrador: vetado en /api/docs, se lee por
 * /api/opta/clips-jugador y el vídeo vive en `privado/` de B2.
 *
 * 25/11/2026: además, los RASGOS DE SU PUESTO (scripts/opta-rasgos-jugador.mjs:
 * hacia dónde regatea, desde dónde centra, cómo remata, qué hace tras robo, si
 * arriesga en su campo…) y el vídeo por capítulos (`fortaleza` de cada corte =
 * la clave de la fortaleza o del rasgo). Para que el documento pese poco, los
 * cortes se guardan sin fecha ni rival: los repone normalizaClipsJugador con
 * los partidos del equipo. Los documentos de antes (sin rasgos, portada de 3 s)
 * siguen valiendo.
 *
 * Sin datos aquí (el repo es público): sólo tipos y una limpieza.
 */

export const CLAVE_CLIPS_JUGADOR = "opta:clips-jugador";

export type FortalezaJugador = { clave: string; nombre: string; percentil: number; por90: number; relativa?: boolean; enVideo: boolean };

/** Un rasgo de su puesto: el título corto (el del capítulo en el vídeo) y el texto con las cifras. */
export type RasgoJugador = {
  clave: string;
  titulo: string;
  texto: string;
  enVideo: boolean;
  /** Desmiente una fortaleza de la temporada: es forma de sus últimos 5 partidos, sin capítulo en el vídeo. */
  reciente?: boolean;
};

export type CorteJugador = { partido: string; fecha: string; rival: string; parte: number; segundo: number; fortaleza: string; que: string; dura: number };

export type ClipsJugador = {
  nombre: string;
  teamId: string;
  equipo: string;
  puesto: string;
  minutos: number;
  fortalezas: FortalezaJugador[];
  /** Los rasgos de su puesto (desde el 25/11/2026). */
  rasgos?: RasgoJugador[];
  /** El puesto en sus últimos partidos, el que manda en los rasgos. */
  rol?: string;
  /** Segundos de la portada (3 antes del 25/11/2026, 5 después). */
  portada?: number;
  url?: string;
  ruta?: string;
  firma?: string;
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
  const equipos: Record<string, EquipoClips> = d.equipos && typeof d.equipos === "object" ? d.equipos : {};
  const crudos: Record<string, ClipsJugador> = d.jugadores && typeof d.jugadores === "object" ? d.jugadores : {};
  const jugadores: Record<string, ClipsJugador> = {};
  for (const [id, j] of Object.entries(crudos)) {
    if (!j || typeof j !== "object") continue;
    /* La fecha y el rival de cada corte, de los partidos de su equipo (no se guardan en cada corte). */
    const partidos = new Map((equipos[j.teamId]?.partidos ?? []).map((p) => [p.partido, p]));
    jugadores[id] = {
      ...j,
      fortalezas: Array.isArray(j.fortalezas) ? j.fortalezas : [],
      rasgos: Array.isArray(j.rasgos) ? j.rasgos : [],
      portada: typeof j.portada === "number" ? j.portada : 3,
      cortes: Array.isArray(j.cortes)
        ? j.cortes.map((c) => ({ ...c, fecha: c.fecha ?? partidos.get(c.partido)?.fecha ?? "", rival: c.rival ?? partidos.get(c.partido)?.rival ?? "", que: c.que ?? "" }))
        : undefined,
    };
  }
  return { actualizado: typeof d.actualizado === "string" ? d.actualizado : undefined, equipos, jugadores };
}

/** El minuto que se ve en el marcador (la segunda parte empieza en el 2700). */
export const minutoDe = (segundo: number) => `${Math.floor(segundo / 60) + 1}'`;
