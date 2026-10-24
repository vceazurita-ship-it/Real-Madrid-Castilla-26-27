/**
 * UN SOLO NOMBRE PARA CADA EQUIPO (24/10/2026).
 *
 * Cada fuente escribe el club a su manera: «Atlético Madrid B» (Wyscout),
 * «Atlético Madrileño» (BeSoccer), «ATL MADRID B» (la hoja de registro),
 * «Teruel» / «C.D. Teruel» / «CD TERUEL», «Juventud Torremolinos» /
 * «Juventud de Torremolinos CF». En pantalla tiene que salir siempre igual:
 * el del calendario de la liga (`lib/quiniela/calendario.ts`), que es el que
 * usa el resto de la plataforma.
 *
 * Esto es sólo para MOSTRAR. Para cruzar datos entre fuentes sigue valiendo
 * `mismoClub` (`lib/rivals/mismoClub.ts`).
 */

import { claveClub } from "@/lib/rivals/mismoClub";

/** [nombre en pantalla, ...variantes que se ven por ahí]. */
const EQUIPOS: string[][] = [
  ["Atlético Madrileño", "Atlético Madrid B", "ATL MADRID B", "At. Madrid B", "Atlético de Madrid B", "Atl. Madrileño"],
  ["CD Teruel", "Teruel", "C.D. Teruel", "CD TERUEL"],
  ["Algeciras CF", "Algeciras"],
  ["Juventud de Torremolinos CF", "Juventud Torremolinos", "Torremolinos", "Juventud de Torremolinos"],
];

const POR_CLAVE = new Map<string, string>(
  EQUIPOS.flatMap(([bueno, ...variantes]) => [bueno, ...variantes].map((v) => [claveClub(v), bueno] as const)),
);

/** El nombre de pantalla de un equipo; el que no está en la tabla se queda como viene. */
export function nombreEquipo(nombre: string): string {
  return POR_CLAVE.get(claveClub(nombre)) ?? nombre;
}
