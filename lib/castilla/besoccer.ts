/**
 * Lo que BeSoccer sabe de NUESTROS jugadores.
 *
 * Es el espejo de `lib/rivals/stats.ts`, pero del lado de casa: el enlace a su
 * ficha —que es lo que se abre desde el perfil— y el historial por temporadas
 * que la hoja de plantilla no tiene ni puede tener (escribe por nombre de
 * columna y no hay cabeceras para partidos, minutos ni goles).
 *
 * Vive en `app_documents` bajo `castilla:besoccer` y lo escribe
 * `scripts/castilla-besoccer.mjs`, que lo regenera cruzando nuestra hoja con la
 * plantilla del Castilla en BeSoccer. Aquí no se guarda nada.
 *
 * **La clave es nuestro `ID_JUGADOR`**, no el id de BeSoccer: al revés que en
 * los rivales, aquí la lista de la que se parte es la nuestra y el que puede
 * faltar es el de fuera. Un juvenil que sube a entrenar no está en la plantilla
 * de BeSoccer y sencillamente no tiene bloque; la ficha no enseña nada y no
 * pasa nada.
 */

export const CASTILLA_BESOCCER_KEY = "castilla:besoccer";

/** Una temporada del historial, ya sumada si jugó en dos clubes ese año. */
export type TemporadaBesoccer = {
  /** "2026/27". */
  temporada: string;
  partidos: number;
  titular: number;
  suplente: number;
  minutos: number;
  amarillas: number;
  rojas: number;
  /** En jugadores de campo. */
  goles?: number;
  asistencias?: number;
  /** En porteros, donde BeSoccer cambia esas dos columnas. */
  encajados?: number;
  penaltisParados?: number;
  /** Los clubes de esa temporada y sus escudos, en el mismo orden. */
  equipos: string[];
  escudos: string[];
};

export type JugadorBesoccer = {
  besoccerId: string;
  /** Como lo escribe BeSoccer, que no siempre es como lo escribimos nosotros. */
  nombre: string;
  puesto: string;
  /** Su ficha: es el enlace que se abre desde el perfil. */
  ficha: string;
  foto: string;
  /** Cómo se ató: "manual", "nombre", "apellido" o "parecido". */
  via: string;
  portero: boolean;
  temporadas: TemporadaBesoccer[];
};

export type CastillaBesoccerDoc = {
  /** ISO de la última descarga. */
  actualizado: string;
  fuente: "besoccer";
  equipo: string;
  /** Por nuestro `ID_JUGADOR`. */
  porJugador: Record<string, JugadorBesoccer>;
};

/** Lo que sabe BeSoccer de un jugador nuestro, o `null` si no está atado. */
export function buscaBesoccer(
  doc: CastillaBesoccerDoc | null,
  idJugador: string | undefined,
): JugadorBesoccer | null {
  if (!doc?.porJugador || !idJugador) return null;

  return doc.porJugador[idJugador] ?? null;
}

/**
 * La temporada que dice algo del jugador.
 *
 * En agosto la actual está a cero y lo que cuenta de alguien es la anterior;
 * en marzo manda la de este año. Se elige la más reciente **con partidos**, y
 * si no hay ninguna, la más reciente a secas.
 */
export function temporadaDestacada(
  temporadas: TemporadaBesoccer[],
): TemporadaBesoccer | null {
  if (!temporadas.length) return null;

  return temporadas.find((una) => una.partidos > 0) ?? temporadas[0];
}

/** Minutos por partido, que es como se lee de verdad un rol en la plantilla. */
export function minutosPorPartido(temporada: TemporadaBesoccer) {
  return temporada.partidos ? temporada.minutos / temporada.partidos : 0;
}
