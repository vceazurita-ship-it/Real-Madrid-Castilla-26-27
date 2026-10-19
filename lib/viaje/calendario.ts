/*
|--------------------------------------------------------------------------
| LA HORA DEL PARTIDO, DEL CALENDARIO DE BESOCCER (19/10/2026)
|--------------------------------------------------------------------------
|
| Cuando se hizo el desplazamiento no había ninguna fuente con la hora del
| partido y había que teclearla. Ahora el cron de la noche deja el
| calendario del Castilla en `castilla:calendario` (BeSoccer) con la hora de
| cada partido —«2026-10-25T16:30:00+01:00», ya en hora de Madrid—, así que
| un viaje nuevo abre montado a su hora y uno guardado avisa si no cuadra.
*/

import { mismoEquipo } from "@/lib/data-analisis/nombres";

export const CALENDARIO_CASTILLA_KEY = "castilla:calendario";

export type PartidoBesoccer = {
  local: string;
  visitante: string;
  /** ISO con el desfase de Madrid: la fecha y la hora se leen tal cual, sin pasar por UTC. */
  cuando: string;
  jornada: number;
};

export type HoraCalendario = { fecha: string; hora: string; jornada: number; rival: string; enCasa: boolean };

/** El partido del calendario de BeSoccer que corresponde a este viaje: por fecha y, si no, por rival. */
export function horaDelCalendario(lista: PartidoBesoccer[] | null | undefined, partido: { fecha: string; rival: string; jornada?: number | null }): HoraCalendario | null {
  if (!lista?.length) return null;

  const leidos = lista
    .filter((p) => typeof p?.cuando === "string")
    .map((p) => {
      const enCasa = /castilla/i.test(p.local);
      const m = p.cuando.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);

      return { fecha: m?.[1] ?? "", hora: m ? `${m[2]}:${m[3]}` : "", jornada: p.jornada, rival: enCasa ? p.visitante : p.local, enCasa };
    });

  const porFecha = partido.fecha ? leidos.find((p) => p.fecha === partido.fecha) : undefined;
  /* Por rival, con la jornada para no confundir la ida con la vuelta (la fecha de la hoja RIVALES a veces no es la buena). */
  const delRival = partido.rival ? leidos.filter((p) => mismoEquipo(p.rival, partido.rival)) : [];
  const elegido = porFecha ?? delRival.find((p) => partido.jornada != null && p.jornada === partido.jornada) ?? (delRival.length === 1 ? delRival[0] : undefined);

  /* 00:00 es lo que BeSoccer pone cuando aún no hay hora oficial: no es una hora. */
  if (!elegido || !elegido.hora || elegido.hora === "00:00") return elegido ? { ...elegido, hora: "" } : null;

  return elegido;
}

/** «https://www.google.com/maps/dir/?api=1&origin=…&destination=…»: la ruta, para sacar distancia, tiempo y la captura. */
export function enlaceRuta(origen: string, destino: string) {
  if (!origen.trim() || !destino.trim()) return "";

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origen.trim())}&destination=${encodeURIComponent(destino.trim())}&travelmode=driving`;
}
