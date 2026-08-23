import { compareMatches } from "./matches";
import {
  AREA_KEYS,
  AreaKey,
  MatchMeta,
  MatchRatings,
  PlayerRating,
  RatingsSeason,
} from "./types";

export type RatedEntry = {
  match: MatchMeta;
  entry: PlayerRating;
};

export type PlayerSummary = {
  playerId: string;
  /** Partidos con nota (> 0). Los registros sólo de minutos no cuentan. */
  played: number;
  starts: number;
  minutes: number;
  avg: number;
  /** Media ponderada por minutos: pesa más lo que se juega entero. */
  weighted: number;
  best: RatedEntry | null;
  worst: RatedEntry | null;
  last: RatedEntry | null;
  /** Media de los cinco últimos partidos valorados. */
  form: number;
  /** Diferencia entre las tres últimas notas y las tres anteriores. */
  trend: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  areas: Record<AreaKey, number>;
  /** Todas las apariciones, en orden cronológico. */
  entries: RatedEntry[];
};

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;

  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

/** Partidos de la temporada ordenados por fecha. */
export function sortedMatches(season: RatingsSeason): MatchRatings[] {
  return Object.values(season.matches).sort((a, b) =>
    compareMatches(a.match, b.match)
  );
}

/** Todas las apariciones de un jugador, en orden cronológico. */
export function playerEntries(
  season: RatingsSeason,
  playerId: string
): RatedEntry[] {
  return sortedMatches(season)
    .map((record) => ({ match: record.match, entry: record.players[playerId] }))
    .filter((item): item is RatedEntry => Boolean(item.entry));
}

const EMPTY_AREAS: Record<AreaKey, number> = {
  tecnica: 0,
  tactica: 0,
  fisica: 0,
  mental: 0,
};

export function summarize(
  playerId: string,
  entries: RatedEntry[]
): PlayerSummary {
  const rated = entries.filter((item) => item.entry.rating > 0);

  const notes = rated.map((item) => item.entry.rating);

  const minutesTotal = entries.reduce(
    (total, item) => total + (item.entry.minutes || 0),
    0
  );

  const weightBase = rated.reduce(
    (total, item) => total + (item.entry.minutes || 0),
    0
  );

  const weighted = weightBase
    ? round(
        rated.reduce(
          (total, item) => total + item.entry.rating * (item.entry.minutes || 0),
          0
        ) / weightBase
      )
    : mean(notes);

  const sortedByNote = [...rated].sort(
    (a, b) => b.entry.rating - a.entry.rating
  );

  const lastThree = notes.slice(-3);
  const previousThree = notes.slice(-6, -3);

  const areas = AREA_KEYS.reduce((accumulator, key) => {
    const values = entries
      .map((item) => item.entry.areas?.[key] ?? 0)
      .filter((value) => value > 0);

    accumulator[key] = mean(values);

    return accumulator;
  }, { ...EMPTY_AREAS });

  return {
    playerId,
    played: rated.length,
    starts: entries.filter((item) => item.entry.starter).length,
    minutes: minutesTotal,
    avg: mean(notes),
    weighted,
    best: sortedByNote[0] ?? null,
    worst: sortedByNote[sortedByNote.length - 1] ?? null,
    last: rated[rated.length - 1] ?? null,
    form: mean(notes.slice(-5)),
    trend:
      lastThree.length && previousThree.length
        ? round(mean(lastThree) - mean(previousThree))
        : 0,
    goals: entries.reduce((total, item) => total + (item.entry.goals || 0), 0),
    assists: entries.reduce(
      (total, item) => total + (item.entry.assists || 0),
      0
    ),
    yellow: entries.reduce((total, item) => total + (item.entry.yellow || 0), 0),
    red: entries.filter((item) => item.entry.red).length,
    areas,
    entries,
  };
}

export function summarizePlayer(season: RatingsSeason, playerId: string) {
  return summarize(playerId, playerEntries(season, playerId));
}

/** Resumen de todos los jugadores con al menos un registro. */
export function summarizeAll(season: RatingsSeason) {
  const byPlayer = new Map<string, RatedEntry[]>();

  sortedMatches(season).forEach((record) => {
    Object.values(record.players).forEach((entry) => {
      const list = byPlayer.get(entry.playerId);

      if (list) list.push({ match: record.match, entry });
      else byPlayer.set(entry.playerId, [{ match: record.match, entry }]);
    });
  });

  const result = new Map<string, PlayerSummary>();

  byPlayer.forEach((entries, playerId) =>
    result.set(playerId, summarize(playerId, entries))
  );

  return result;
}

export type MatchSummary = {
  match: MatchMeta;
  /** Media del equipo en ese partido. */
  avg: number;
  rated: number;
  top: PlayerRating | null;
  bottom: PlayerRating | null;
  goals: number;
  assists: number;
};

export function summarizeMatches(season: RatingsSeason): MatchSummary[] {
  return sortedMatches(season).map((record) => {
    const entries = Object.values(record.players);
    const rated = entries.filter((entry) => entry.rating > 0);

    const sorted = [...rated].sort((a, b) => b.rating - a.rating);

    return {
      match: record.match,
      avg: mean(rated.map((entry) => entry.rating)),
      rated: rated.length,
      top: sorted[0] ?? null,
      bottom: sorted[sorted.length - 1] ?? null,
      goals: entries.reduce((total, entry) => total + (entry.goals || 0), 0),
      assists: entries.reduce((total, entry) => total + (entry.assists || 0), 0),
    };
  });
}

/**
 * Color de la nota: rojo por debajo de 5, ámbar hasta 6,5, verde hasta 8 y
 * cian por encima.
 *
 * Devuelve una variable CSS (definida en `app/globals.css`) para que la escala
 * se adapte al tema: los tonos 400 del modo noche quedan ilegibles sobre el
 * blanco del modo día. Vale en cualquier estilo en línea (`color`,
 * `background`, `borderColor`, degradados, sombras).
 *
 * Para atributos SVG usa `ratingColorHex`: un atributo de presentación no
 * resuelve `var()`.
 */
export function ratingColor(value: number) {
  if (value <= 0) return "var(--rmcf-rate-none)";
  if (value < 5) return "var(--rmcf-rate-low)";
  if (value < 6.5) return "var(--rmcf-rate-mid)";
  if (value < 8) return "var(--rmcf-rate-good)";

  return "var(--rmcf-rate-top)";
}

/**
 * La misma escala en hexadecimal, para atributos SVG (`fill`, `stroke`).
 * Devuelve los valores del modo noche; el modo día los corrige por CSS.
 */
export function ratingColorHex(value: number) {
  if (value <= 0) return "#64748B";
  if (value < 5) return "#F87171";
  if (value < 6.5) return "#FBBF24";
  if (value < 8) return "#4ADE80";

  return "#22D3EE";
}

/** Mezcla la nota con transparencia; sustituye a concatenar `${color}55`. */
export function ratingColorAlpha(value: number, percent: number) {
  return `color-mix(in srgb, ${ratingColor(value)} ${percent}%, transparent)`;
}

export function ratingTone(value: number) {
  if (value <= 0) return "border-white/10 bg-white/5 text-white/40";
  if (value < 5) return "border-rose-400/30 bg-rose-400/10 text-rose-300";
  if (value < 6.5) return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (value < 8) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";

  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
}

export function formatRating(value: number) {
  return value > 0 ? value.toFixed(1).replace(".", ",") : "—";
}

export function formatSigned(value: number) {
  if (!value) return "0,0";

  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1).replace(".", ",")}`;
}
