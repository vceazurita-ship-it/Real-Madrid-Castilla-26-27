/**
 * LAS FILAS ETIQUETADAS, CON SU VÍDEO DE OPTA (17/11/2026).
 *
 * Una acción de la hoja (jornada, parte, minuto entero y tipo) casa con el
 * saque de Opta del mismo partido, misma parte, mismo tipo y a un minuto o
 * menos. Si casa, la fila etiquetada gana el «▶ Vídeo» de Opta (nuestro corte
 * si ya está bajado; si no, el enlace a ProVision). Si hay dos candidatos, el
 * del minuto más cercano; si empatan, no se elige ninguno: mejor sin vídeo
 * que con el de otra jugada.
 */

import { parseJornada } from "@/lib/abp/partido";
import { abpFamily } from "@/lib/abp/model";
import { enlaceOptaDe, videoOptaDe, type FilaHojaOpta } from "./tipos";

export type AccionParaCasar = { jornada: number | null; parte: number | null; minuto: number | null; accion: string };

const parteDe = (t: string) => Number(String(t).match(/[12]/)?.[0] ?? 0) || null;

export function casaPorMinuto(a: AccionParaCasar, opta: FilaHojaOpta[]): FilaHojaOpta | null {
  if (a.jornada == null || a.minuto == null) return null;
  const familia = abpFamily(a.accion);
  const candidatas = opta
    .filter((f) => parseJornada(f.JORNADA ?? "").numero === a.jornada)
    .filter((f) => a.parte == null || parteDe(f.Tiempo ?? "") === a.parte)
    .filter((f) => abpFamily(f.Tipo_Accion || "banda") === familia)
    .map((f) => ({ f, d: Math.abs(Number(f.Minuto) - a.minuto!) }))
    .filter((x) => Number.isFinite(x.d) && x.d <= 1)
    .sort((x, y) => x.d - y.d);
  if (!candidatas.length) return null;
  if (candidatas.length > 1 && candidatas[0].d === candidatas[1].d) return null;
  return candidatas[0].f;
}

/** El vídeo y el enlace de Opta de una fila (propia de Opta o casada). */
export function videoDeFilaOpta(f: FilaHojaOpta | null | undefined): { video?: string; opta?: string } | null {
  if (!f) return null;
  const video = videoOptaDe(f);
  const opta = enlaceOptaDe(f);
  if (!video && !opta) return null;
  return { ...(video ? { video } : {}), ...(opta ? { opta } : {}) };
}
