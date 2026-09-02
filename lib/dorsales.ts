/**
 * Los dorsales de la plantilla, mientras la hoja no los traiga.
 *
 * La columna `DORSAL` de la pestaña JUGADORES está **vacía en las 43 filas**,
 * así que hasta ahora ningún sitio de la app podía decir con qué número juega
 * nadie: el coding enseñaba un guion donde va el número, y las pizarras y el
 * once tiraban del apodo. Con el mercado cerrado (1 de septiembre de 2026) los
 * números ya son los definitivos, y éstos son los que publica la ficha del
 * Castilla en BeSoccer, cotejados uno a uno el 02/09/2026.
 *
 * Es el mismo puente que `lib/fichajes.ts`, y por la misma razón: la pestaña
 * JUGADORES **la lleva a mano el cuerpo técnico** —`createPlayer` del Apps
 * Script escribe en la hoja de sesiones, no en la maestra, y
 * `updatePlayerStatus` contesta `ok` sin cambiar nada—, así que desde aquí no
 * hay forma de escribir esa columna.
 *
 * **Se retira solo.** El cruce es por nombre y **la hoja siempre gana**: en
 * cuanto alguien escriba el número en la columna `DORSAL`, esta lista deja de
 * aportar nada para esa fila y se puede borrar la entrada. Por eso se cruza
 * por nombre y no por `ID_JUGADOR`: la hoja ha renumerado los IDs alguna vez y
 * lo que se mueve con la persona es el nombre.
 *
 * Quien no aparezca aquí es que BeSoccer todavía no publica su número (Cristian
 * David, Liberto, Izan Regueira y Álvaro Ginés el 02/09/2026) o que no está en
 * la ficha del Castilla —los de licencia RMC y juvenil—. Un jugador sin número
 * se queda sin número: inventarlo sería peor.
 */

import { normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

interface Dorsal {
  /** El nombre **como lo escribe la hoja**, que es por donde se cruza. */
  nombre: string;
  /** El `ID_JUGADOR` del día en que se escribió esto. Sólo para leerlo. */
  id: string;
  dorsal: number;
}

const DORSALES: Dorsal[] = [
  { id: "JUG-23", nombre: "Mestre", dorsal: 1 },
  { id: "JUG-01", nombre: "Fortea", dorsal: 2 },
  { id: "JUG-04", nombre: "Diego Aguado", dorsal: 3 },
  { id: "JUG-08", nombre: "Mario Rivas", dorsal: 4 },
  { id: "JUG-07", nombre: "Joan Martínez", dorsal: 5 },
  { id: "JUG-11", nombre: "Cestero", dorsal: 6 },
  { id: "JUG-18", nombre: "Yáñez", dorsal: 7 },
  { id: "JUG-22", nombre: "Rachad", dorsal: 9 },
  { id: "JUG-16", nombre: "Pol Fortuny", dorsal: 10 },
  { id: "JUG-20", nombre: "Á. Leiva", dorsal: 11 },
  { id: "JUG-24", nombre: "Javi Navarro", dorsal: 13 },
  { id: "JUG-26", nombre: "Ángel Carvajal", dorsal: 19 },
  { id: "JUG-15", nombre: "Roberto", dorsal: 20 },
  { id: "JUG-52", nombre: "Óscar Naasei", dorsal: 21 },
  { id: "JUG-17", nombre: "Mesonero", dorsal: 22 },
  { id: "JUG-09", nombre: "Lamini", dorsal: 23 },
  { id: "JUG-25", nombre: "F. Quetglas", dorsal: 25 },
  { id: "JUG-19", nombre: "Alexis Ciria", dorsal: 26 },
  { id: "JUG-06", nombre: "Álvaro Lezcano", dorsal: 27 },
  { id: "JUG-13", nombre: "Diego Lacosta", dorsal: 28 },
  { id: "JUG-14", nombre: "M. Rezola", dorsal: 29 },
];

const POR_NOMBRE = new Map(
  DORSALES.map((uno) => [normalizePlayerName(uno.nombre), uno.dorsal]),
);

/** El dorsal de un jugador por su nombre de la hoja, si se sabe. */
export function dorsalDe(nombre: string): number | undefined {
  return POR_NOMBRE.get(normalizePlayerName(nombre));
}

/**
 * Rellena el dorsal de los que no lo traen de la hoja.
 *
 * Lo que venga escrito en la hoja no se toca nunca, ni para "corregirlo": si
 * el cuerpo técnico escribe un número, ése es el bueno.
 */
export function conDorsales(jugadores: Player[]): Player[] {
  return jugadores.map((jugador) =>
    jugador.dorsal
      ? jugador
      : { ...jugador, dorsal: dorsalDe(jugador.nombre) },
  );
}
