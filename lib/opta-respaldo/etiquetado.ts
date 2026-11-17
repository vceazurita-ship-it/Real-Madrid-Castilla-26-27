/**
 * ¿ESTÁ YA ETIQUETADO ESTE PARTIDO? (17/11/2026)
 *
 * Lo etiquetado manda siempre; Opta sólo entra en el partido que aún no está:
 *
 * - Hojas de ABP y de banda: un partido está etiquetado si la hoja tiene al
 *   menos una fila de liga con su jornada («LIGA 12»). Se mira hoja a hoja:
 *   la de banda puede ir por delante de la de córners. La jornada de Opta es
 *   el orden de fecha de los partidos de liga del Castilla.
 * - Robos, pérdidas y faltas (`lib/transiciones/datos.ts`, `lib/faltas/datos.ts`,
 *   del timeline de Hudl): si hay un partido con esa fecha (±1 día) y filas
 *   del modo que se mira. En pérdidas, J2 y J3 (mirados a ojo) no tienen
 *   ninguna: ahí también entra Opta.
 */

import { parseJornada, type FilaHoja } from "@/lib/abp/partido";
import type { FilaHojaOpta } from "./tipos";

const DIA = 86_400_000;

/** ¿Hay un partido etiquetado a un día o menos de `fecha`? */
export function fechaEtiquetada(fecha: string, etiquetadas: string[]): boolean {
  const t = Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(t)) return false;
  return etiquetadas.some((f) => Math.abs(Date.parse(`${f.slice(0, 10)}T12:00:00Z`) - t) <= DIA);
}

/** Las jornadas de liga que ya tiene una hoja. */
export function jornadasDeHoja(filas: FilaHoja[]): Set<number> {
  const salida = new Set<number>();
  for (const f of filas) {
    const j = parseJornada(f.JORNADA ?? f.Jornada ?? "");
    if (j.competicion === "liga" && j.numero != null) salida.add(j.numero);
  }
  return salida;
}

/** Las filas de Opta de los partidos que la hoja aún no tiene. */
export function filasSinEtiquetar(opta: FilaHojaOpta[], hoja: FilaHoja[]): FilaHojaOpta[] {
  const hechas = jornadasDeHoja(hoja);
  return opta.filter((f) => {
    const j = parseJornada(f.JORNADA ?? "");
    return j.numero != null && !hechas.has(j.numero);
  });
}
