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
