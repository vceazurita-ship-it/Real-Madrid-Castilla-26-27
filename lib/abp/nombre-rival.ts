/**
 * EL RIVAL ESCRITO IGUAL EN TODAS LAS PIEZAS DE BALÓN PARADO (12/11/2026).
 *
 * Los jueces (marketing) leyeron «Gimnàstic de Tarragona» en los pies y
 * «GIMNÀSTIC TARRAGONA» en las cabeceras: cada pieza tomaba el nombre de una
 * fuente (la hoja RIVALES, BeSoccer, el tablero) y lo pasaba a mayúsculas a su
 * manera. Aquí sale UN texto base —el nombre oficial de `lib/equipos/nombres`
 * si el equipo es del grupo; si no, el que llega, con sus mayúsculas
 * arregladas— y las cabeceras lo ponen en mayúsculas al pintar, del mismo
 * texto. Pura: la usan la pantalla, el PDF general, el PPT y los PDF por
 * jugador.
 */

import { nombreOficial } from "@/lib/equipos/nombres";

/** Palabras que van en minúscula dentro del nombre («de», «del»…). */
const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y", "i", "d'"]);

/** Siglas de club que van en mayúsculas («CF», «UD»…). */
const SIGLAS = /^(ad|cd|cf|fc|sd|ud|ue|rcd|sad|cp|cdf|ce|rc|cyd|cdc)$/i;

/** «GIMNÀSTIC TARRAGONA» → «Gimnàstic Tarragona» (sólo si llegó todo en mayúsculas). */
function arreglaMayusculas(nombre: string) {
  if (nombre !== nombre.toLocaleUpperCase("es-ES")) return nombre;

  return nombre
    .toLocaleLowerCase("es-ES")
    .split(/\s+/)
    .map((palabra, i) => {
      if (SIGLAS.test(palabra)) return palabra.toLocaleUpperCase("es-ES");
      if (i > 0 && MENORES.has(palabra)) return palabra;

      return palabra.charAt(0).toLocaleUpperCase("es-ES") + palabra.slice(1);
    })
    .join(" ");
}

/** El nombre del rival como se escribe en todas las piezas: «Gimnàstic de Tarragona». */
export function nombreRivalPieza(nombre: string | undefined | null): string {
  const limpio = (nombre ?? "").replace(/\s+/g, " ").trim();

  if (!limpio) return "";

  const oficial = nombreOficial(limpio);

  return oficial !== limpio ? oficial : arreglaMayusculas(limpio);
}

/** El mismo texto, en mayúsculas para una cabecera. */
export function nombreRivalCabecera(nombre: string | undefined | null): string {
  return nombreRivalPieza(nombre).toLocaleUpperCase("es-ES");
}
