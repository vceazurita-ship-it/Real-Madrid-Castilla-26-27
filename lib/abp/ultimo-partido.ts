/**
 * CUÁL ES EL ÚLTIMO PARTIDO ANALIZADO.
 *
 * Desde el 11/10/2026 las pantallas de análisis (faltas, robos, pérdidas,
 * balón parado y saques de banda) abren por defecto en el último partido
 * que tiene datos, no en «todos» ni en el primero: lo que se quiere mirar el
 * lunes es lo del domingo. «Todos» sigue a un toque.
 *
 * Aquí viven las dos formas de decidirlo: por jornada, para las hojas de ABP
 * (la jornada más alta de la competición oficial, sin pretemporada), y por
 * fecha, para los partidos etiquetados a mano (faltas y transiciones).
 */

import { comparaJornadas, type JornadaAbp } from "@/lib/abp/partido";

/**
 * La jornada más reciente de las que hay. Primero la liga (o la copa); los
 * amistosos sólo si no hay otra cosa. Devuelve su `clave`, o `""` sin nada.
 */
export function ultimaJornada(jornadas: JornadaAbp[]): string {
  const oficiales = jornadas.filter((j) => j.competicion !== "amistoso" && j.clave);
  const candidatas = oficiales.length > 0 ? oficiales : jornadas.filter((j) => j.clave);

  if (candidatas.length === 0) return "";

  return [...candidatas].sort(comparaJornadas)[candidatas.length - 1].clave;
}

/** Las jornadas anteriores a una, de la misma competición, para la media. */
export function jornadasAnteriores(jornadas: JornadaAbp[], clave: string): JornadaAbp[] {
  const elegida = jornadas.find((j) => j.clave === clave);

  if (!elegida) return [];

  return jornadas
    .filter((j) => j.competicion === elegida.competicion && j.clave !== clave && comparaJornadas(j, elegida) < 0)
    .sort(comparaJornadas);
}

/** El último por fecha (AAAA-MM-DD) de una lista de partidos. */
export function ultimoPorFecha<T extends { fecha: string }>(partidos: T[]): T | null {
  if (partidos.length === 0) return null;

  return [...partidos].sort((a, b) => a.fecha.localeCompare(b.fecha))[partidos.length - 1];
}

/** Los anteriores por fecha a uno dado, del más antiguo al más reciente. */
export function anterioresPorFecha<T extends { fecha: string }>(partidos: T[], elegido: T): T[] {
  return partidos.filter((p) => p !== elegido && p.fecha < elegido.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
