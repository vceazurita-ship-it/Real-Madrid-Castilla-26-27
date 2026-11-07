/**
 * EL NOMBRE DE CADA EQUIPO, EL MISMO EN TODA LA APP (07/11/2026).
 *
 * Los jueces (marketing) vieron «HÉRCULES» y «HUESCA» en los escudos frente a
 * «Hércules de Alicante CF» y «SD Huesca» en la quiniela. La quiniela escribe
 * el nombre oficial (lib/quiniela/calendario.ts, el de las claves de SLUGS);
 * BeSoccer lo acorta según la página. Aquí se elige el largo cuando el equipo
 * es del grupo de la quiniela y se deja tal cual el de los demás.
 */

import { SLUGS, mismoEquipo, nombreClave } from "@/lib/quiniela/besoccer";

const OFICIALES = Object.keys(SLUGS);

/** «Hércules» → «Hércules de Alicante CF»; «Huesca» → «SD Huesca». */
export function nombreOficial(nombre: string): string {
  const limpio = (nombre || "").trim();

  if (!limpio) return limpio;

  /* Primero el que casa exacto por la clave; si no, el que la contiene. */
  const clave = nombreClave(limpio);
  const exacto = OFICIALES.find((oficial) => nombreClave(oficial) === clave);

  if (exacto) return exacto;

  const parecido = OFICIALES.filter((oficial) => mismoEquipo(oficial, limpio));

  /* Sólo si no hay duda: «Real» casaría con media liga. */
  return parecido.length === 1 && clave.length >= 4 ? parecido[0] : limpio;
}
