/**
 * Fichajes que ya están en la plantilla pero todavía no en la hoja.
 *
 * La plantilla sale de la pestaña JUGADORES (`hooks/usePlayers`) y ésa es la
 * fuente buena: aquí no se duplica a nadie ni se mantiene una lista paralela.
 * Lo que pasa es que **dar de alta a un jugador desde la app no llega a esa
 * pestaña**: la acción `createPlayer` del Apps Script escribe en la hoja de
 * sesiones —la de disponibilidad por fecha— y la maestra la lleva a mano el
 * cuerpo técnico. Hasta que alguien escribe esa fila, el fichaje no existe
 * para el once, ni para la pizarra de ABP, ni para el coding.
 *
 * Esto es el puente para ese rato: el jugador aparece en toda la app desde el
 * primer día y **se retira solo** en cuanto la hoja lo trae, porque el cruce
 * es por nombre y la hoja siempre gana. Si algún día `createPlayer` escribe en
 * la maestra, este archivo se queda vacío y no hay nada que limpiar.
 *
 * Cómo se añade uno: la ficha de abajo, y la foto por
 * `scripts/crop-player-cutouts.mjs` + `lib/playerImages.ts` (ver el README de
 * las fotos). Cómo se quita: cuando esté en la hoja, borrar su entrada.
 */

import { getPlayerImage, getPlayerPhotoSrc, normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

type Ficha = {
  /** El `ID_JUGADOR` que devolvió el alta, para que las notas cuadren. */
  id: string;
  nombre: string;
  apodo: string;
  /** Como la escribe la hoja: `CENTRAL`, `LATERAL D.`, `6`, `PORTERO`… */
  posicion: string;
  licencia: string;
  dorsal?: number;
};

const FICHAS: Ficha[] = [
  {
    /*
    | Central ghanés de 21 años, del Granada, agosto de 2026. Juega también de
    | lateral derecho; en la hoja sólo cabe un puesto y va el de lateral
    | derecho, que es donde el cuerpo técnico lo quiere ahora.
    */
    id: "JUG-52",
    nombre: "Óscar Naasei",
    apodo: "Naasei",
    posicion: "LATERAL D.",
    licencia: "RMCF Castilla",
  },
  {
    /*
    | Alta del 4 de septiembre de 2026. El puesto está **sin confirmar**: la
    | hoja todavía no le tiene fila y el cuerpo técnico no lo ha dicho, así que
    | va vacío a propósito. Con el puesto en blanco sale en las listas y en la
    | ficha, pero el campograma no lo coloca en ninguna banda: en cuanto se
    | sepa, se escribe aquí (o llega la fila de la hoja, que manda).
    */
    id: "JUG-53",
    nombre: "Sergio Martínez",
    apodo: "Sergio",
    posicion: "",
    licencia: "RMCF Castilla",
  },
];

/** Los fichajes convertidos en jugadores, con sus recortes. */
const PENDIENTES: Player[] = FICHAS.map((ficha) => ({
  id: ficha.id,
  nombre: ficha.nombre,
  apodo: ficha.apodo,
  posicion: ficha.posicion,
  dorsal: ficha.dorsal,
  foto: getPlayerPhotoSrc(ficha.nombre, { id: ficha.id, variant: "cerca" }),
  fotoLejos: getPlayerImage(ficha.nombre, "lejos", ficha.id) ?? undefined,
  licencia: ficha.licencia,
  esCastilla: ficha.licencia === "RMCF Castilla",
  estado: "ÓPTIMO",
  activo: true,
  hudl: "",
}));

/**
 * Añade a la lista de la hoja los fichajes que ella todavía no trae.
 *
 * El cruce es por nombre normalizado y no por ID a propósito: la hoja ha
 * renumerado los `ID_JUGADOR` alguna vez, y lo que se mueve con la persona es
 * el nombre. En cuanto aparece en la hoja —aunque sea con otro ID— deja de
 * añadirse, así que no hay forma de que salga dos veces.
 */
export function conFichajes(deLaHoja: Player[]): Player[] {
  if (PENDIENTES.length === 0) return deLaHoja;

  const yaEstan = new Set(deLaHoja.map((jugador) => normalizePlayerName(jugador.nombre)));

  const faltan = PENDIENTES.filter(
    (ficha) => !yaEstan.has(normalizePlayerName(ficha.nombre)),
  );

  return faltan.length > 0 ? [...deLaHoja, ...faltan] : deLaHoja;
}
