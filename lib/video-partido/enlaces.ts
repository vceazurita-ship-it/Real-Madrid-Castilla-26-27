/**
 * LOS TRES VÍDEOS DE CADA PARTIDO NUESTRO (31/10/2026).
 *
 * «Vídeo Análisis de Partidos» lleva, en cada partido del Castilla, a:
 *
 *   - **Hudl**: la copia que se llama como Wyscout, la que trae el timeline.
 *     Si todavía no se ha visto su id, a la biblioteca del Castilla en Hudl.
 *   - **La grabación táctica** de la carpeta PARTIDOS del ordenador del club
 *     («J 07 - UD IBIZA - RM CASTILLA.mp4»). Un navegador no abre un fichero
 *     del disco desde una página https, así que la abre el vigía de ese
 *     ordenador (scripts/grabacion-tactica.cjs), que escucha sólo en
 *     127.0.0.1. Por eso sólo se enseña en el ordenador principal.
 *   - **El resumen de la federación en YouTube**, el que se cuelga en el canal
 *     de la RFEF. Sin resumen todavía, no hay botón.
 *
 * Los datos los arma `scripts/video-partido-enlaces.mjs` en el ordenador del
 * club (va en la tarea diaria de ABP) y se publican con la app.
 */

import datos from "./enlaces.json";

/** El del vigía de la grabación táctica: el testigo del vigía es el 47831. */
export const PUERTO_GRABACIONES = 47832;

/** El Castilla en Hudl (equipo 363689). */
export const HUDL_BIBLIOTECA = "https://www.hudl.com/library/363689";

export type EnlacesPartido = {
  jornada: number;
  /** «2026-10-09», el día del partido según Wyscout. */
  fecha: string;
  /** «Ibiza - Real Madrid Castilla», sin marcador. */
  partido: string;
  hudl?: { id: string; url: string };
  tactica?: { fichero: string };
  resumen?: { id: string; url: string; canal: string; titulo: string };
};

type Doc = { carpetaTactica: string; partidos: EnlacesPartido[] };

const DOC = datos as Doc;

const DIA = 86_400_000;

const mediodia = (dia: string) => Date.parse(`${dia.slice(0, 10)}T12:00:00Z`);

/**
 * Los vídeos del partido de ese día («AAAA-MM-DD»). Se admite un día de
 * diferencia: Wyscout apunta la hora en UTC y un partido de noche cae en el
 * día siguiente. El Castilla nunca juega dos partidos en dos días.
 */
export function enlacesDelDia(dia: string): EnlacesPartido | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dia)) return null;

  let mejor: EnlacesPartido | null = null;
  let distancia = Infinity;

  for (const p of DOC.partidos) {
    const d = Math.abs(mediodia(p.fecha) - mediodia(dia)) / DIA;

    if (d <= 1 && d < distancia) {
      mejor = p;
      distancia = d;
    }
  }

  return mejor;
}

/** La ruta entera de la grabación táctica en el ordenador del club. */
export function rutaTactica(enlaces: EnlacesPartido) {
  return enlaces.tactica ? `${DOC.carpetaTactica}\\${enlaces.tactica.fichero}` : "";
}

/** Lo que abre la grabación en el reproductor del ordenador del club. */
export function urlTactica(jornada: number) {
  return `http://127.0.0.1:${PUERTO_GRABACIONES}/tactica/${jornada}`;
}
