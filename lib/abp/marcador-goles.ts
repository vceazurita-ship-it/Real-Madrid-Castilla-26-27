/*
|--------------------------------------------------------------------------
| EL MARCADOR DE UNA ACCIÓN, DESDE LOS GOLES DEL PARTIDO (19/10/2026)
|--------------------------------------------------------------------------
|
| La hoja de ABP defensivo no tiene «Resultado RMC» ni «Resultado RIVAL» (la
| ofensiva sí): sus 84 acciones llegaban sin marcador y «Según el marcador»
| salía vacío. Pero sí trae JORNADA y MINUTO, y `goles:analisis` tiene los
| goles de cada partido de liga con su minuto (BeSoccer): contando los que
| van antes de la acción sale cómo iba el partido.
|
| Sólo se rellena lo que la hoja deja vacío: si un día escribe el marcador,
| manda el suyo. Sólo liga (los goles son de la liga) y sólo con minuto.
| Un gol en el mismo minuto que la acción NO cuenta: si el gol sale de esa
| misma acción, el marcador de antes es el bueno.
*/

import { mismoEquipo } from "@/lib/data-analisis/nombres";
import { CASTILLA, type PartidoGoles } from "@/lib/goles/analisis";
import type { ContextoAccion, MarcadorAbp } from "@/lib/abp/partido";

/** El instante en una línea única: la parte manda (un 45+2 de la primera va antes del 46). */
const instante = (parte: 1 | 2, minuto: number) => parte * 1000 + minuto;

export function marcadorEn(partido: PartidoGoles, parte: 1 | 2, minuto: number): MarcadorAbp {
  const somosLocal = mismoEquipo(partido.local, CASTILLA) || /castilla/i.test(partido.local);
  const ahora = instante(parte, minuto);
  let rmcf = 0;
  let rival = 0;

  for (const g of partido.goles) {
    if (instante(g.parte, g.min + (g.extra || 0)) >= ahora) continue;

    if ((g.lado === "local") === somosLocal) rmcf += 1;
    else rival += 1;
  }

  return { rmcf, rival, texto: `${rmcf}-${rival}`, estado: rmcf > rival ? "ganando" : rmcf < rival ? "perdiendo" : "empatando" };
}

/** Las filas con el marcador que les falte, sacado de los goles de su partido de liga. */
export function completaMarcador<T extends { contexto: ContextoAccion }>(filas: T[], partidos: PartidoGoles[] | null | undefined): T[] {
  if (!partidos?.length) return filas;

  const nuestros = new Map<number, PartidoGoles>();

  for (const p of partidos) if (/castilla/i.test(`${p.local} ${p.visitante}`)) nuestros.set(p.jornada, p);

  return filas.map((fila) => {
    const { jornada, minuto, marcador } = fila.contexto;

    if (marcador.estado !== null || jornada.competicion !== "liga" || jornada.numero == null || minuto.minuto == null) return fila;

    const partido = nuestros.get(jornada.numero);

    if (!partido) return fila;

    const parte = minuto.parte ?? (minuto.minuto > 45 ? 2 : 1);

    return { ...fila, contexto: { ...fila.contexto, marcador: marcadorEn(partido, parte, minuto.minuto) } };
  });
}
