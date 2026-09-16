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

/*
| Vacío desde el 16/09/2026: la hoja ya trae a los dos que había aquí —Óscar
| Naasei (JUG-52) y Sergio Martínez (JUG-53)—, así que el puente ha hecho su
| trabajo y se retira, que es justo lo que dice el encabezado.
|
| Y no era inofensivo dejarlos: **la hoja escribe "Óscar Nassei"** y aquí
| estaba escrito "Óscar Naasei" —que es como lo escriben la foto, el recorte,
| el dorsal y el registro de Opta—. El cruce que evita duplicados es por
| nombre, dos eses contra dos aes no casan, y el jugador salía DOS VECES en
| todas las pantallas que leen la plantilla: el once, la pizarra, el coding,
| las valoraciones y el dashboard de seguimiento. Se vio al contar la plantilla
| del dashboard: quince jugadores de campo y dieciséis en la lista.
|
| Si algún día hay que volver a usar esto, el nombre tiene que ir **como lo
| escriba la hoja**, aunque esté mal escrito: es la hoja la que manda.
*/
const FICHAS: Ficha[] = [];

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
