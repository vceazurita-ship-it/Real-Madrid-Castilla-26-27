"use client";

/**
 * LO ELEGIDO, COMPARTIDO ENTRE LECTURAS (10/11/2026).
 *
 * «Un equipo de un vistazo» junta tres lecturas (de un vistazo con Wyscout,
 * jornada a jornada y sus remates con Opta). Cada una tenía su propio
 * selector de equipo y, al pasar de una a otra, se volvía al próximo rival.
 * Aquí se guarda el último equipo elegido —por su nombre, porque los ids de
 * Opta y los nombres de Wyscout no son los mismos— para que la lectura
 * siguiente abra con él. Vive lo que la pestaña: no se guarda en ningún sitio.
 */

import { useSyncExternalStore } from "react";

let equipo = "";
const avisos = new Set<() => void>();

export function ponEquipoElegido(nombre: string) {
  if (nombre === equipo) return;
  equipo = nombre;
  avisos.forEach((f) => f());
}

const suscribe = (f: () => void) => {
  avisos.add(f);
  return () => {
    avisos.delete(f);
  };
};

/** El último equipo elegido en cualquiera de las lecturas («» si ninguno). */
export function useEquipoElegido(): string {
  return useSyncExternalStore(
    suscribe,
    () => equipo,
    () => "",
  );
}
