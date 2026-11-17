/**
 * EL PARTIDO DE CADA SEMANA DEL REPOSITORIO (17/11/2026, fútbol).
 *
 * Una semana del repositorio (`WeekData`, «16 nov – 22 nov») y el partido del
 * Castilla que cae dentro, del calendario de BeSoccer. Sirve para decir en la
 * tira y en la semana abierta contra quién se jugó y para abrir lo que la
 * completa con el rival ya elegido. Sin partido en la semana, `null`.
 *
 * Función pura: ni fetch ni estado.
 */

import { comoNuestro, type PartidoCastilla, type PartidoNuestro } from "@/lib/castilla/calendario";
import type { WeekData } from "@/lib/season/types";
import { parseWeekDate } from "@/lib/season/utils";

export function partidoDeLaSemana(
  partidos: PartidoCastilla[],
  semana: Pick<WeekData, "start" | "end"> | null | undefined,
): PartidoNuestro | null {
  if (!semana || !partidos.length) return null;

  const desde = parseWeekDate(semana.start);
  const hasta = parseWeekDate(semana.end);

  if (!desde || !hasta) return null;

  desde.setHours(0, 0, 0, 0);
  hasta.setHours(23, 59, 59, 999);

  for (const p of partidos) {
    const nuestro = comoNuestro(p);
    const dia = new Date(`${nuestro.cuando.slice(0, 10)}T12:00:00`);

    if (!Number.isNaN(dia.getTime()) && dia >= desde && dia <= hasta) return nuestro;
  }

  return null;
}

/** «J13 vs Real Murcia (en casa)» o «J12 en Gimnàstic Tarragona · 1-0». */
export function rotuloPartido(p: PartidoNuestro) {
  const donde = p.lado === "casa" ? `vs ${p.rival} (en casa)` : `en ${p.rival}`;
  const marcador = p.jugado && p.golesFavor != null && p.golesContra != null ? ` · ${p.golesFavor}-${p.golesContra}` : "";

  return `J${p.jornada} ${donde}${marcador}`;
}
