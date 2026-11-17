/**
 * EL RESPALDO DE OPTA EN LAS PANTALLAS DE ABP Y BANDA (17/11/2026).
 *
 * Lo que comparten /setpieces, /setpieces_def y los dos saques de banda al
 * cargar la hoja: juntar sus filas con las de Opta de los partidos que la
 * hoja aún no tiene, y dar a cada acción su vídeo de Opta (la propia, o la
 * etiquetada que casa por minuto con un saque de Opta).
 */

import type { EnlaceAccionAbp } from "@/lib/abp/cortes-abp";
import { filasSinEtiquetar } from "./etiquetado";
import { casaPorMinuto, videoDeFilaOpta, type AccionParaCasar } from "./casar";
import { esDeOpta, type FilaHojaOpta } from "./tipos";

/** Las filas de la hoja y, detrás, las de Opta de las jornadas que no tiene (lo etiquetado manda). */
export function hojaConOpta<F extends Record<string, string>>(hoja: F[], opta: FilaHojaOpta[]): (F | FilaHojaOpta)[] {
  return [...hoja, ...filasSinEtiquetar(opta, hoja)];
}

/**
 * Los enlaces de cada acción con lo de Opta encima: a la fila de Opta, su
 * corte y ProVision; a la etiquetada sin corte propio que casa por minuto,
 * el de Opta (sin quitarle Hudl).
 */
export function enlacesConOpta<T>(
  enlaces: Map<string, EnlaceAccionAbp>,
  filas: T[],
  claveDe: (f: T) => string | null | undefined,
  accionDe: (f: T) => AccionParaCasar & { fila?: Record<string, string> | null },
  opta: FilaHojaOpta[],
): Map<string, EnlaceAccionAbp> {
  if (!opta.length && !filas.length) return enlaces;
  const salida = new Map(enlaces);
  for (const f of filas) {
    const clave = claveDe(f);
    if (!clave) continue;
    const a = accionDe(f);
    const antes = salida.get(clave);
    if (antes?.video) continue;
    const deOpta = a.fila && esDeOpta(a.fila) ? videoDeFilaOpta(a.fila) : videoDeFilaOpta(casaPorMinuto(a, opta));
    if (!deOpta) continue;
    salida.set(clave, { ...(antes ?? {}), ...deOpta });
  }
  return salida;
}
