/**
 * EL SEGUIMIENTO INDIVIDUAL · atar cada registro a su jugador.
 *
 * La hoja de seguimiento guarda `ID_JUGADOR` **y** `NOMBRE`, y el bueno es el
 * nombre: los `JUG-XX` de la pestaña JUGADORES se han renumerado alguna vez
 * (en agosto de 2026 todo el bloque JUG-14..27 bajó un número), así que un
 * registro escrito antes apunta hoy a otra persona. Medido el 03/09/2026: un
 * seguimiento de Diego Lacosta salía a nombre de M. Rezola, y diez registros
 * más quedaban colgando de un ID que ya no existe —en el calendario se leían
 * como «JUG-49» y en el dashboard caían en «Sin posición»—.
 *
 * Esto reescribe el `ID_JUGADOR` de cada fila al de la plantilla de ahora
 * cruzando por nombre, y así todo lo que viene después —agrupar, filtrar,
 * contar cobertura, pintar el mapa de calor— cuadra sin tocar nada más.
 *
 * Ver la nota "ids-jugador-renumerados": el nombre manda sobre el ID.
 */

import { normalizePlayerName } from "@/lib/playerImages";

interface FilaSeguimiento {
  ID_JUGADOR: string;
  NOMBRE?: string;
}

interface JugadorMinimo {
  id: string;
  nombre: string;
}

export function alineaSeguimiento<T extends FilaSeguimiento>(
  filas: T[],
  jugadores: JugadorMinimo[],
): T[] {
  if (jugadores.length === 0) return filas;

  const porNombre = new Map(
    jugadores.map((jugador) => [normalizePlayerName(jugador.nombre), jugador.id]),
  );

  return filas.map((fila) => {
    const id = fila.NOMBRE
      ? porNombre.get(normalizePlayerName(fila.NOMBRE))
      : undefined;

    /* Sin nombre, o con un nombre que ya no está en la plantilla, se queda
       como estaba: el registro es de alguien que se fue, y borrarle el ID lo
       sacaría de la lista en vez de enseñarlo. */
    return !id || id === fila.ID_JUGADOR ? fila : { ...fila, ID_JUGADOR: id };
  });
}

/*
|--------------------------------------------------------------------------
| A QUIÉN SE LE CUENTA EL SEGUIMIENTO
|--------------------------------------------------------------------------
|
| Desde el 11/10/2026, **sólo a los jugadores de campo con licencia del
| Castilla**. Lo pidió el cuerpo técnico para las alertas y para los
| feedback: los de licencia RMC y juvenil que vienen a entrenar llevan su
| seguimiento en su equipo, y los porteros tienen su entrenador y su propia
| planificación, que no se registra en esta hoja. Contarlos hundía la
| cobertura y la media por jugador —sumaban al denominador sin sumar
| registros— y llenaba la portada de avisos sobre gente que no es nuestra.
|
| Antes había además una lista de cinco de fuera escrita a mano
| (`DE_FUERA_CON_SEGUIMIENTO`, en el Dashboard Seguimiento). Se quitó ese
| día: la regla ahora es la licencia y nada más.
|
| Es UNA función para la portada y para el Dashboard, así las dos pantallas
| dicen el mismo número. El puesto lo escribe la hoja de dos maneras, con
| palabra ("PORTERO") y con el número de rol (1), así que se miran las dos.
| Ver `lib/posiciones.ts`.
*/

interface JugadorConLicencia {
  esCastilla: boolean;
  posicion: string;
}

export function esDeSeguimiento(jugador: JugadorConLicencia) {
  const puesto = (jugador.posicion || "").trim();

  if (puesto === "1" || /portero/i.test(puesto)) return false;

  return jugador.esCastilla;
}

/**
 * Los registros de la hoja que son de esos jugadores. Las filas tienen que
 * venir ya pasadas por `alineaSeguimiento` **contra la plantilla entera**:
 * si se alinean sólo contra los del Castilla, el registro de un portero o de
 * uno del RMC se queda con su ID viejo, que hoy puede ser el de un jugador
 * nuestro, y se le cuenta a quien no toca.
 */
export function filasDeSeguimiento<T extends FilaSeguimiento>(
  filasAlineadas: T[],
  jugadores: { id: string }[],
): T[] {
  const nuestros = new Set(jugadores.map((jugador) => jugador.id));

  return filasAlineadas.filter((fila) => nuestros.has(fila.ID_JUGADOR));
}
