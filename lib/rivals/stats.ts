/*
|--------------------------------------------------------------------------
| ESTADÍSTICAS DE JUGADORES RIVALES
|--------------------------------------------------------------------------
|
| Los números (partidos, minutos, goles, tarjetas…) salen de BeSoccer y se
| guardan en Supabase, no en la hoja de Google: la hoja escribe por nombre de
| columna y no tiene cabeceras para esto, así que un guardado ahí se
| descartaría en silencio. Ver `scripts/rivals-stats/`.
|
| La clave del jugador es su **id de resfu**, el mismo que ya viaja dentro de
| la URL de la columna FOTO (`players/medium/<id>.jpg`). Es el id propio de
| BeSoccer y no se mueve; los `ID_JUGADOR` de la hoja sí se renumeran, así que
| no sirven como clave. Para las filas sin foto queda el índice por
| equipo + nombre.
*/

export type RivalSeasonStats = {
  /** "2026/27". */
  temporada: string;
  /** Equipos en los que jugó esa temporada, en orden de más reciente. */
  equipos: string[];
  partidos: number;
  /** Partidos de titular; el resto entró desde el banquillo. */
  titular: number;
  suplente: number;
  minutos: number;
  amarillas: number;
  rojas: number;
  /* Jugadores de campo. */
  goles?: number;
  asistencias?: number;
  /* Porteros. */
  encajados?: number;
  penaltisParados?: number;
};

export type RivalPlayerStats = {
  /** BeSoccer da columnas distintas a los porteros. */
  portero: boolean;
  /** Ficha de origen, por si hay que comprobar un dato a mano. */
  url: string;
  /** De la más reciente a la más antigua. */
  temporadas: RivalSeasonStats[];
};

export type RivalStatsDoc = {
  /** ISO de la última descarga. */
  actualizado: string;
  fuente: "besoccer";
  /** Temporada en curso, para saber cuál es "la de ahora". */
  temporada: string;
  /** Por id de resfu. */
  porId: Record<string, RivalPlayerStats>;
  /** `equipo|nombre` normalizados -> id de resfu, para las filas sin foto. */
  porNombre: Record<string, string>;
};

/** Clave del documento en `app_documents`. */
export const RIVAL_STATS_KEY = "rivals:stats";

export const RIVAL_STATS_KIND = "rivals";

/** Marcas diacríticas que deja `normalize("NFD")` al separar los acentos. */
const COMBINING = /[̀-ͯ]/g;

export function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Id de resfu escondido en la URL de la foto. */
export function resfuId(foto: unknown) {
  const match = String(foto ?? "").match(/players\/[a-z]+\/(\d+)/);

  return match ? match[1] : null;
}

export function nameKey(equipo: unknown, jugador: unknown) {
  return `${normalizeKey(equipo)}|${normalizeKey(jugador)}`;
}

/** Estadísticas del jugador dentro del documento, si las hay. */
export function findStats(
  doc: RivalStatsDoc | null,
  player: { FOTO?: unknown; NOMBRE_EQUIPO?: unknown; JUGADOR?: unknown },
): RivalPlayerStats | null {
  if (!doc) return null;

  const byPhoto = resfuId(player.FOTO);

  if (byPhoto && doc.porId[byPhoto]) return doc.porId[byPhoto];

  const byName = doc.porNombre[nameKey(player.NOMBRE_EQUIPO, player.JUGADOR)];

  return (byName && doc.porId[byName]) || null;
}

/**
 * Temporada que conviene enseñar de entrada.
 *
 * En agosto la temporada en curso está a cero o casi, y una ficha con todo a
 * cero no dice nada del rival: si aún no ha jugado, manda la última con
 * minutos. En cuanto suma partidos, la actual pasa a mandar ella.
 */
export function defaultSeason(stats: RivalPlayerStats | null) {
  return highlightSeason(stats?.temporadas ?? []);
}

/** Lo mismo, cuando lo que se tiene a mano es la lista y no la ficha entera. */
export function highlightSeason(temporadas: RivalSeasonStats[]) {
  if (!temporadas.length) return null;

  const played = temporadas.find((season) => season.partidos > 0);

  return played ?? temporadas[0];
}

/** Minutos por partido, para leer de un vistazo cuánto pesa en el equipo. */
export function minutesPerGame(season: RivalSeasonStats) {
  if (!season.partidos) return 0;

  return Math.round(season.minutos / season.partidos);
}

/** Goles encajados por partido de un portero, con un decimal. */
export function goalsAgainstPerGame(season: RivalSeasonStats) {
  if (!season.partidos || season.encajados === undefined) return null;

  return Math.round((season.encajados / season.partidos) * 10) / 10;
}

/** Porcentaje de partidos que ha empezado. Null si no ha jugado. */
export function starterShare(season: RivalSeasonStats) {
  if (!season.partidos) return null;

  return Math.round((season.titular / season.partidos) * 100);
}
