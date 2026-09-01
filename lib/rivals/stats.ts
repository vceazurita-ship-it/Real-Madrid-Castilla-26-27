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
  /**
   * Escudo de cada uno de esos equipos, en el mismo orden que `equipos`.
   *
   * Es opcional a propósito: el documento que ya está subido en Supabase es
   * anterior a que el script los descargara, y sin escudo la ficha pinta la
   * inicial del club en vez de romperse. Se rellenan al volver a correr
   * `scripts/rivals-stats.mjs`.
   */
  escudos?: string[];
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

/**
 * El equipo rival como club: su escudo.
 *
 * La hoja RIVALES no tiene columna de escudo —y no se le puede añadir sin
 * tocar el Apps Script—, así que el escudo del club viaja aquí, junto a los
 * números, y lo baja el mismo script. Es lo que firma la cabecera del PDF del
 * once y la portada del jugador.
 */
export type RivalTeamInfo = {
  /** `ID_EQUIPO` de la hoja ("RIV-01"). */
  id: string;
  /** Nombre tal y como lo escribe la hoja ("Teruel"). */
  nombre: string;
  /**
   * PNG con transparencia y a 500 px de lado
   * (`cdn.resfu.com/img_data/equipos/<id>.png`). En PNG y no en el `.jpg` de
   * los escudos pequeños porque este se pinta grande y sobre fondos distintos:
   * el recuadro blanco del JPEG se vería.
   */
  escudo: string;
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
  /**
   * Los diecinueve clubes del grupo, por `ID_EQUIPO`.
   *
   * Opcional como los escudos del historial: un documento subido antes de que
   * el script los bajara no los trae, y entonces se pinta la inicial del club.
   */
  equipos?: Record<string, RivalTeamInfo>;
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
 * Palabras que sólo dicen qué tipo de club es y no cuál.
 *
 * Cada hoja escribe el mismo equipo a su manera —la de rivales dice
 * «Hércules» y la videoteca «HERCULES CF»—, así que para comparar dos nombres
 * estas sobran.
 */
const CLUB_WORDS = new Set([
  "ac",
  "ad",
  "ca",
  "cd",
  "ce",
  "cf",
  "cp",
  "club",
  "deportiva",
  "deportivo",
  "fc",
  "futbol",
  "sad",
  "sd",
  "ud",
]);

/** El nombre reducido a lo que de verdad identifica al club. */
function teamWords(value: unknown) {
  return normalizeKey(value)
    .split(" ")
    .filter((word) => word && !CLUB_WORDS.has(word));
}

/**
 * El club rival dentro del documento, con su escudo.
 *
 * Se busca por `ID_EQUIPO`, que es la clave con la que se guardó, y si la
 * fila no lo trae —o el documento es anterior— se cae al nombre, que es lo
 * único que tienen a mano el campograma, el pop-up del once y las páginas que
 * leen de otras hojas.
 *
 * El nombre se compara en tres pasadas cada vez más tolerante, porque no hay
 * una sola forma de escribirlo en toda la casa:
 *
 * 1. Tal cual, normalizado: es lo que ocurre entre la hoja de plantillas y la
 *    de rivales, que escriben igual.
 * 2. Sin las siglas del tipo de club: «HERCULES CF» y «Hércules».
 * 3. Cuando uno de los dos nombres es parte del otro: «JAEN CF» y «Real Jaén».
 *    Aquí se exige que sólo encaje un club: si hay dos —«Real» a secas
 *    valdría para Murcia, Jaén y Zaragoza— no se adivina y se devuelve nada,
 *    que es lo que hace pintar la inicial en vez de un escudo equivocado.
 */
export function findTeam(
  doc: RivalStatsDoc | null,
  equipo: { ID_EQUIPO?: unknown; NOMBRE_EQUIPO?: unknown } | string | null,
): RivalTeamInfo | null {
  if (!doc?.equipos || !equipo) return null;

  const id = typeof equipo === "string" ? "" : String(equipo.ID_EQUIPO ?? "");

  if (id && doc.equipos[id]) return doc.equipos[id];

  const crudo = typeof equipo === "string" ? equipo : equipo.NOMBRE_EQUIPO;
  const nombre = normalizeKey(crudo);

  if (!nombre) return null;

  const clubes = Object.values(doc.equipos);

  const exacto = clubes.find((club) => normalizeKey(club.nombre) === nombre);

  if (exacto) return exacto;

  const palabras = teamWords(crudo);

  if (!palabras.length) return null;

  const clave = palabras.join(" ");

  const sinSiglas = clubes.filter(
    (club) => teamWords(club.nombre).join(" ") === clave,
  );

  if (sinSiglas.length === 1) return sinSiglas[0];

  const parciales = clubes.filter((club) => {
    const suyas = teamWords(club.nombre);

    const contenido =
      palabras.every((word) => suyas.includes(word)) ||
      suyas.every((word) => palabras.includes(word));

    /* Una inicial suelta no basta: lo compartido tiene que ser un nombre. */
    return (
      contenido &&
      palabras.some((word) => word.length >= 4 && suyas.includes(word))
    );
  });

  return parciales.length === 1 ? parciales[0] : null;
}

/**
 * Temporada que se enseña de un jugador rival.
 *
 * **Manda la temporada en curso**, aunque lleve pocos partidos. En un informe
 * de la jornada que viene, los veinticinco partidos del año pasado de alguien
 * que este año no ha jugado un minuto no dicen lo que parece que dicen: en las
 * fichas del PowerPoint y del PDF sólo se pinta una temporada y **sin
 * etiqueta**, así que quien la mira da por hecho que es la de ahora.
 *
 * Mientras no había competición esto no se podía hacer —todo a cero no dice
 * nada— y se enseñaba la última con minutos. Desde la primera jornada ya hay
 * de qué hablar, y cada semana habrá más.
 *
 * Sin `temporadaActual` se conserva el comportamiento de antes, que es lo que
 * quiere quien sólo tiene a mano la lista.
 */
export function defaultSeason(
  stats: RivalPlayerStats | null,
  temporadaActual?: string,
) {
  return highlightSeason(stats?.temporadas ?? [], temporadaActual);
}

/** Lo mismo, cuando lo que se tiene a mano es la lista y no la ficha entera. */
export function highlightSeason(
  temporadas: RivalSeasonStats[],
  temporadaActual?: string,
): RivalSeasonStats | null {
  if (temporadaActual) {
    const actual = temporadas.find(
      (season) => season.temporada === temporadaActual,
    );

    if (actual) return actual;

    /*
    | BeSoccer no crea la fila de la temporada hasta que el jugador debuta, así
    | que al que no ha jugado un minuto le falta. Se devuelve una **en blanco**
    | con el nombre de la temporada: cero partidos es un dato, y es el que
    | corresponde. Antes se caía a la temporada anterior y la ficha del rival
    | daba a un suplente los números de titular del año pasado.
    */
    return temporadaEnBlanco(temporadas, temporadaActual);
  }

  if (!temporadas.length) return null;

  const played = temporadas.find((season) => season.partidos > 0);

  return played ?? temporadas[0];
}

/**
 * Una temporada a cero, con la forma que le toca al jugador.
 *
 * Si su historial trae goles encajados es un portero y la fila lleva
 * `encajados`; si trae goles, lleva `goles`. Se mira el historial y no la
 * posición de la hoja porque es lo mismo que decide BeSoccer al montar la
 * tabla, y así el cero sale en la casilla correcta.
 */
function temporadaEnBlanco(
  temporadas: RivalSeasonStats[],
  temporada: string,
): RivalSeasonStats {
  const portero = temporadas.some((season) => season.encajados !== undefined);

  return {
    temporada,
    equipos: [],
    escudos: [],
    partidos: 0,
    titular: 0,
    suplente: 0,
    minutos: 0,
    amarillas: 0,
    rojas: 0,
    ...(portero
      ? { encajados: 0, penaltisParados: 0 }
      : { goles: 0, asistencias: 0 }),
  };
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
