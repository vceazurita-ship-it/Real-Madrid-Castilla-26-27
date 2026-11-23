/**
 * CON SU TRÍO Y SIN ÉL (Duelos, 23/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de los últimos
 * partidos del rival y su sociedad (`lib/rivals/sociedades.ts`: los tres que
 * más se pasan el balón en el último tercio):
 *
 * - Minutos de cada uno en el campo, de las alineaciones y los cambios: entra
 *   en el 0 si es titular o en su evento «SubstitutionOn»; sale en su
 *   «SubstitutionOff» o al final. Si Opta no trae esos eventos, se reparte
 *   con sus minutos (titular: del 0 a sus minutos; suplente: sus últimos
 *   minutos del partido).
 * - El reloj se hace continuo: la segunda parte empieza donde acabó la
 *   primera con su añadido (Opta pone el 45:00 al empezar la segunda).
 * - «Con»: los minutos en que están los tres a la vez; «sin»: el resto del
 *   partido (falta alguno). Un partido sin uno de ellos va entero a «sin».
 * - Goles y xG del rival (a favor) y xG del contrario (en contra), por el
 *   minuto del remate; todo por 90 minutos.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import type { EventoDirecto, JugadorDirecto } from "@/lib/opta-directo-mapas";

/** Con menos minutos en un lado, la cifra va en gris («muestra corta»). */
export const MIN_MINUTOS = 270;

const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);

export type PartidoConSin = { partido: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type Tramo = { minutos: number; goles: number; xg: number; xgContra: number; golesContra: number };

export type ConSin = {
  trio: string[];
  partidos: number;
  /** Partidos en que llegan a coincidir los tres. */
  partidosJuntos: number;
  con: Tramo;
  sin: Tramo;
};

const vacio = (): Tramo => ({ minutos: 0, goles: 0, xg: 0, xgContra: 0, golesContra: 0 });

/** El reloj continuo (en segundos) de un partido. */
function relojDe(ev: EventoDirecto[]) {
  const fin1 = Math.max(45 * 60, ...ev.filter((e) => e.parte === 1).map((e) => e.segundo));
  const tras = fin1 - 45 * 60;
  const t = (e: EventoDirecto) => (e.parte >= 2 ? e.segundo + tras : e.segundo);
  const total = Math.max(fin1, ...ev.filter((e) => e.parte === 2).map(t));
  return { t, total };
}

/** Los tramos [entra, sale) en segundos de reloj continuo; null si no jugó. */
function enCampo(id: string, ev: EventoDirecto[], jugadores: JugadorDirecto[], t: (e: EventoDirecto) => number, total: number): [number, number] | null {
  const j = jugadores.find((x) => x.id === id);
  const entra = ev.find((e) => e.jugadorId === id && e.tipo === "SubstitutionOn");
  const sale = ev.find((e) => e.jugadorId === id && e.tipo === "SubstitutionOff");
  const min = (j?.minutos ?? 0) * 60;
  if (!j?.titular && !entra && min <= 0) return null;
  const a = entra ? t(entra) : j?.titular ? 0 : Math.max(0, total - min);
  const b = sale ? t(sale) : j?.titular && min > 0 && min < total - 5 * 60 ? min : total;
  return b > a ? [a, b] : null;
}

export function conSinSociedad(partidos: PartidoConSin[], teamId: string, trio: string[]): ConSin | null {
  if (trio.length < 3) return null;
  const con = vacio();
  const sin = vacio();
  let leidos = 0;
  let juntos = 0;
  for (const p of partidos) {
    const ev = p.eventos.filter((e) => e.parte === 1 || e.parte === 2);
    if (!ev.some((e) => e.teamId === teamId) || !p.jugadores.some((j) => j.teamId === teamId)) continue;
    leidos += 1;
    const { t, total } = relojDe(ev);
    const tramos = trio.map((id) => enCampo(id, ev, p.jugadores, t, total));
    const a = tramos.every(Boolean) ? Math.max(...tramos.map((x) => x![0])) : 0;
    const b = tramos.every(Boolean) ? Math.min(...tramos.map((x) => x![1])) : 0;
    const dentro = b > a ? [a, b] : null;
    if (dentro) juntos += 1;
    const seg = dentro ? dentro[1] - dentro[0] : 0;
    con.minutos += seg / 60;
    sin.minutos += (total - seg) / 60;
    for (const e of ev) {
      if (!TIROS.has(e.tipo)) continue;
      const momento = t(e);
      const lado = dentro && momento >= dentro[0] && momento < dentro[1] ? con : sin;
      const nuestro = e.teamId === teamId;
      if (nuestro) {
        lado.xg += e.xG ?? 0;
        if (e.tipo === "Goal") lado.goles += 1;
      } else {
        lado.xgContra += e.xG ?? 0;
        if (e.tipo === "Goal") lado.golesContra += 1;
      }
    }
  }
  if (!leidos) return null;
  return { trio, partidos: leidos, partidosJuntos: juntos, con, sin };
}

/** Por 90 minutos (null sin minutos). */
export const por90 = (v: number, minutos: number) => (minutos > 0 ? (v / minutos) * 90 : null);
