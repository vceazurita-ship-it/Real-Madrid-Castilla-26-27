/**
 * EL VÍDEO DE UN EVENTO EN OPTA PROVISION (16/11/2026).
 *
 * «Haz que los enlaces a Opta sean los de cada evento». ProVision no tiene una
 * dirección por evento, pero su Event Log sí se puede abrir ya filtrado y con
 * el vídeo de una fila abierto, y la dirección lo guarda todo (probado en el
 * Chrome del club el 16/11/2026):
 *
 *   /soccer/match-event-log-in-possession/<A-B>/<AAAA-MM-DD>/<gameId>
 *     ?e={"clonePbpTable":"tableGameEventLog","selectedRowIndex":0,
 *         "selectedTab":"panelEventQuery","videos":{"panelName":"panelEventQuery"}}
 *     &f={"fsocgc":["1.95","1.98"],"sper":["1"]}      reloj en minutos (admite decimales) y parte
 *     &pc={"sgeipp":"shots","ske":"no"}                  tipo de evento: touches · passes · shots
 *     &t={"orderBy":…event.gameEventIndex ASC…,"customReport":{"selectedReportId":223}}
 *
 * Con el reloj acotado a ese segundo la tabla se queda con el evento (o con
 * dos o tres del mismo segundo) y la fila 0 abre su vídeo en el «Event
 * Explorer», 8 s antes y 8 s después. Hace falta tener la sesión de Opta
 * abierta en ese navegador: es la del club.
 *
 * `segundo` es `event.gameClock` de Opta tal como lo bajamos (opta-liga.mjs):
 * reloj de partido corrido, la segunda parte empieza en 45:00.
 */

const SITIO_OPTA = "https://realmadrid.opta.trumediasports.com";

export type TipoEventoOpta = "shots" | "passes" | "touches";

export type EventoOpta = {
  /** `game.gameId` de Opta. */
  partido: string;
  /** AAAA-MM-DD. */
  fecha: string;
  parte: number;
  /** `event.gameClock`, en segundos. */
  segundo: number;
};

const json = (v: unknown) => encodeURIComponent(JSON.stringify(v));

/** El enlace que abre el vídeo de ese evento en ProVision. */
export function urlVideoOpta(evento: EventoOpta, tipo: TipoEventoOpta = "touches"): string | null {
  /* Segundo 0 = la fila no traía reloj (las lecturas ponen 0 por defecto): mejor sin enlace que el saque inicial (17/11/2026). */
  if (!evento.partido || !/^\d{4}-\d{2}-\d{2}/.test(evento.fecha) || !Number.isFinite(evento.segundo) || evento.segundo <= 0) return null;

  /* Un segundo de margen a cada lado: el reloj de nuestra descarga y el de la tabla pueden ir medio segundo cambiados. */
  const desde = Math.max(0, (evento.segundo - 1) / 60).toFixed(3);
  const hasta = ((evento.segundo + 1) / 60).toFixed(3);

  const e = { clonePbpTable: "tableGameEventLog", selectedRowIndex: 0, selectedTab: "panelEventQuery", videos: { panelName: "panelEventQuery" } };
  const f = { fsocgc: [desde, hasta], sper: [String(evento.parte)] };
  const pc = { sgeipp: tipo, ske: "no" };
  const t = { orderBy: { 0: { orderCols: "event.gameEventIndex", sortOrder: "ASC" } }, customReport: { selectedReportName: "Event Log", selectedReportId: 223 } };

  return `${SITIO_OPTA}/soccer/match-event-log-in-possession/partido/${evento.fecha.slice(0, 10)}/${encodeURIComponent(evento.partido)}?e=${json(e)}&f=${json(f)}&pc=${json(pc)}&t=${json(t)}`;
}
