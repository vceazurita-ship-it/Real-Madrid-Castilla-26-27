/**
 * Valoraciones de partido: un registro por jugador y partido que se guarda
 * para siempre en Supabase y alimenta la ficha individual y la página de equipo.
 */

export const RATINGS_SEASON = "2026-2027";

/** Escala común a la nota global y a las cuatro áreas. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;

export const AREA_KEYS = ["tecnica", "tactica", "fisica", "mental"] as const;

export type AreaKey = (typeof AREA_KEYS)[number];

export const AREA_LABELS: Record<AreaKey, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisica: "Física",
  mental: "Mental",
};

/** Notas por área. Cada una es opcional: se puede valorar sólo la global. */
export type RatingAreas = Partial<Record<AreaKey, number>>;

export type PlayerRating = {
  playerId: string;
  /** Nota global 0-10 en pasos de 0,5. */
  rating: number;
  minutes: number;
  starter: boolean;
  goals: number;
  assists: number;
  /** 0, 1 o 2 amarillas. */
  yellow: number;
  red: boolean;
  areas: RatingAreas;
  note: string;
  updatedAt: string;
};

/**
 * Datos del partido guardados junto a las notas. Se copian dentro del registro
 * para que el histórico siga siendo legible aunque el CSV de partidos cambie.
 */
export type MatchMeta = {
  id: string;
  /** "YYYY-MM-DD", o "" si el partido aún no tiene fecha. */
  date: string;
  opponent: string;
  competition: string;
  isHome: boolean;
  /** Marcador tal cual se escribe, "3-0". */
  result: string;
  /** Goles a favor / en contra del Castilla, o null si no hay marcador. */
  gf: number | null;
  ga: number | null;
  /** "csv" viene del calendario de partidos; "manual" lo creó el cuerpo técnico. */
  source: "csv" | "manual";
};

export type MatchRatings = {
  match: MatchMeta;
  players: Record<string, PlayerRating>;
  updatedAt: string;
};

export type RatingsSeason = {
  season: string;
  matches: Record<string, MatchRatings>;
  updatedAt: string;
};

export function emptySeason(season = RATINGS_SEASON): RatingsSeason {
  return { season, matches: {}, updatedAt: "" };
}

/** Registro en blanco: la nota 0 significa "sin valorar" y no cuenta en las medias. */
export function emptyRating(playerId: string): PlayerRating {
  return {
    playerId,
    rating: 0,
    minutes: 0,
    starter: false,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: false,
    areas: {},
    note: "",
    updatedAt: "",
  };
}

/** Un registro cuenta si tiene nota, minutos o cualquier dato del partido. */
export function hasContent(entry: PlayerRating) {
  return (
    entry.rating > 0 ||
    entry.minutes > 0 ||
    entry.goals > 0 ||
    entry.assists > 0 ||
    entry.yellow > 0 ||
    entry.red ||
    entry.starter ||
    entry.note.trim().length > 0 ||
    AREA_KEYS.some((key) => (entry.areas?.[key] ?? 0) > 0)
  );
}

export function clampRating(value: number) {
  if (!Number.isFinite(value)) return 0;

  const stepped = Math.round(value / RATING_STEP) * RATING_STEP;

  return Math.min(RATING_MAX, Math.max(RATING_MIN, stepped));
}
