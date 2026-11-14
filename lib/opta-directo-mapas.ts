/**
 * LOS MAPAS DEL DIRECTO (14/11/2026).
 *
 * Con el evento a evento que deja `scripts/opta-directo.mjs` en cada
 * `opta:directo:<partido>` (`eventos` y `jugadores`, ya sin la fila repetida
 * de Opta y con el equipo de quien hace la acción):
 *
 * - densidad de toques (mapa de calor continuo, malla 50 × 34, suavizado ~6 m)
 * - territorio: % de toques en el último tercio de cada uno, sobre el total
 * - red de pases: posición media de cada jugador (sus pases y lo que recibe) y
 *   pases completados entre cada pareja
 * - remates (xG de cada uno) y la curva de xG acumulado por minuto
 * - recuperaciones y pérdidas con su altura
 * - rendimiento de cada jugador: lo que da Opta del partido + lo que se cuenta
 *   aquí (pases progresivos, al último tercio, xPV sumado)
 *
 * Coordenadas de Opta: cada acción desde quien la hace (x 0-100 hacia la
 * portería rival). Mismas reglas que `lib/opta-eventos.ts` (progresivo,
 * recuperación, pérdida, alturas).
 */

import { aObjetos, num, type TablaOpta } from "@/lib/opta";
import { alturaAccion, esPerdida, esProgresivo, esRecuperacion, type Altura3 } from "@/lib/opta-eventos";

export type EventoDirecto = {
  teamId: string;
  parte: number;
  segundo: number;
  minuto: number;
  tipo: string;
  jugadorId: string;
  receptorId: string;
  x: number;
  y: number;
  finX: number | null;
  finY: number | null;
  ok: boolean;
  xG: number | null;
  xPV: number;
  /** "banda" o "puerta" si el pase es un saque (Opta no los cuenta en «pases intentados»). */
  saque: string;
};

/** Pase en juego: sin saques de banda ni de puerta (así cuadra con «pases intentados» de Opta). */
export const esPaseEnJuego = (e: EventoDirecto) => e.tipo === "Pass" && !e.saque;

export type JugadorDirecto = {
  id: string;
  nombre: string;
  teamId: string;
  dorsal: string;
  puesto: string;
  minutos: number;
  titular: boolean;
  cifras: Record<string, number | null>;
};

export type Tramo = "todo" | "1" | "2" | "ultimos15";

/** Lo que no es tocar el balón (para el mapa de calor). */
const NO_ES_TOQUE = new Set(["FreeKick", "Corner", "Challenge", "AttemptedTackle", "Foul"]);
const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);

export function leeEventos(t: TablaOpta | null | undefined): EventoDirecto[] {
  if (!t?.cols?.length || !Array.isArray(t.filas)) return [];
  const c = (n: string) => t.cols.indexOf(n);
  const [iT, iP, iS, iTi, iJ, iR, iX, iY, iFx, iFy, iOk, iXg, iXpv, iSa] = ["teamId", "parte", "segundo", "tipo", "jugadorId", "receptorId", "x", "y", "finX", "finY", "ok", "xG", "xPV", "saque"].map(c);
  const salida: EventoDirecto[] = [];
  for (const f of t.filas) {
    const x = num(f[iX]);
    const y = num(f[iY]);
    if (x == null || y == null) continue;
    const segundo = num(f[iS]) ?? 0;
    salida.push({
      teamId: String(f[iT] ?? ""),
      parte: num(f[iP]) ?? 1,
      segundo,
      minuto: Math.floor(segundo / 60) + 1,
      tipo: String(f[iTi] ?? ""),
      jugadorId: String(f[iJ] ?? ""),
      receptorId: String(f[iR] ?? ""),
      x,
      y,
      finX: num(f[iFx]),
      finY: num(f[iFy]),
      ok: num(f[iOk]) === 1,
      xG: num(f[iXg]),
      xPV: num(f[iXpv]) ?? 0,
      saque: iSa >= 0 ? String(f[iSa] ?? "") : "",
    });
  }
  return salida;
}

export function leeJugadores(t: TablaOpta | null | undefined): JugadorDirecto[] {
  return aObjetos(t ?? null).map((f) => {
    const cifras: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(f)) if (!["partido", "playerId", "jugador", "teamId", "dorsal", "puesto"].includes(k)) cifras[k] = num(v);
    return {
      id: String(f.playerId ?? ""),
      nombre: String(f.jugador ?? ""),
      teamId: String(f.teamId ?? ""),
      dorsal: String(f.dorsal ?? ""),
      puesto: String(f.puesto ?? ""),
      minutos: num(f.Min) ?? 0,
      titular: num(f.GS) === 1,
      cifras,
    };
  });
}

/** El tramo elegido. «Últimos 15'» = los 15 minutos antes del último evento. */
export function filtraTramo(ev: EventoDirecto[], tramo: Tramo): EventoDirecto[] {
  if (tramo === "todo") return ev;
  if (tramo === "1" || tramo === "2") return ev.filter((e) => e.parte === Number(tramo));
  const ultimo = ev.reduce((m, e) => Math.max(m, e.segundo), 0);
  return ev.filter((e) => e.segundo >= ultimo - 15 * 60);
}

/* ------------------------------ calor ------------------------------ */

export const MX = 50;
export const MY = 34;
const SIGMA = 3;

const NUCLEO = (() => {
  const r = Math.ceil(SIGMA * 3);
  const k: number[] = [];
  for (let d = -r; d <= r; d++) k.push(Math.exp(-(d * d) / (2 * SIGMA * SIGMA)));
  const s = k.reduce((a, b) => a + b, 0);
  return { r, k: k.map((v) => v / s) };
})();

function suaviza(m: number[]): number[] {
  const { r, k } = NUCLEO;
  const a = new Array(MX * MY).fill(0);
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += m[j * MX + Math.min(MX - 1, Math.max(0, i + d))] * k[d + r];
      a[j * MX + i] = s;
    }
  const b = new Array(MX * MY).fill(0);
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += a[Math.min(MY - 1, Math.max(0, j + d)) * MX + i] * k[d + r];
      b[j * MX + i] = s;
    }
  return b;
}

export const esToque = (e: EventoDirecto) => !NO_ES_TOQUE.has(e.tipo) && !(e.x === 0 && e.y === 0);

/** Densidad de toques (suma 1) en la malla; `max` para la escala. */
export function densidad(ev: EventoDirecto[]): { malla: number[]; max: number; toques: number } {
  const m = new Array(MX * MY).fill(0);
  let n = 0;
  for (const e of ev) {
    if (!esToque(e)) continue;
    const i = Math.min(MX - 1, Math.max(0, Math.floor((e.x / 100) * MX)));
    const j = Math.min(MY - 1, Math.max(0, Math.floor((e.y / 100) * MY)));
    m[j * MX + i]++;
    n++;
  }
  const malla = n ? suaviza(m.map((v) => v / n)) : m;
  return { malla, max: Math.max(0, ...malla), toques: n };
}

/** Toques en el último tercio de cada equipo: el «territorio» (field tilt). */
export function territorio(ev: EventoDirecto[], a: string, b: string): { a: number; b: number; pctA: number | null } {
  let na = 0;
  let nb = 0;
  for (const e of ev) {
    if (!esToque(e) || e.x < 66.7) continue;
    if (e.teamId === a) na++;
    else if (e.teamId === b) nb++;
  }
  return { a: na, b: nb, pctA: na + nb ? na / (na + nb) : null };
}

/** Toques por tercio (en % de los suyos). */
export function porTercios(ev: EventoDirecto[]): Record<Altura3, number> {
  const t: Record<Altura3, number> = { alta: 0, media: 0, baja: 0 };
  let n = 0;
  for (const e of ev) {
    if (!esToque(e)) continue;
    t[alturaAccion(e.x)]++;
    n++;
  }
  if (n) for (const k of Object.keys(t) as Altura3[]) t[k] /= n;
  return t;
}

/* ------------------------------ red ------------------------------ */

export type Nodo = { id: string; x: number; y: number; pases: number; recibe: number };
export type Enlace = { a: string; b: string; n: number };

/**
 * Red de pases de un equipo. Sólo hasta el primer cambio si `hastaCambio`
 * (la red se lee con once fijo); si no, todos.
 */
export function redPases(ev: EventoDirecto[], teamId: string): { nodos: Nodo[]; enlaces: Enlace[]; pases: number } {
  const sitio = new Map<string, { sx: number; sy: number; n: number; pases: number; recibe: number }>();
  const suma = (id: string, x: number, y: number, pase: boolean) => {
    if (!id) return;
    const s = sitio.get(id) ?? { sx: 0, sy: 0, n: 0, pases: 0, recibe: 0 };
    s.sx += x;
    s.sy += y;
    s.n++;
    if (pase) s.pases++;
    else s.recibe++;
    sitio.set(id, s);
  };
  const enlaces = new Map<string, Enlace>();
  let pases = 0;
  for (const e of ev) {
    if (e.teamId !== teamId || !esPaseEnJuego(e) || e.finX == null || e.finY == null) continue;
    pases++;
    suma(e.jugadorId, e.x, e.y, true);
    if (!e.ok || !e.receptorId || e.receptorId === e.jugadorId) continue;
    suma(e.receptorId, e.finX, e.finY, false);
    const [p, q] = [e.jugadorId, e.receptorId].sort();
    const k = `${p}|${q}`;
    const en = enlaces.get(k) ?? { a: p, b: q, n: 0 };
    en.n++;
    enlaces.set(k, en);
  }
  return {
    nodos: [...sitio.entries()].map(([id, s]) => ({ id, x: s.sx / s.n, y: s.sy / s.n, pases: s.pases, recibe: s.recibe })),
    enlaces: [...enlaces.values()],
    pases,
  };
}

/* ------------------------------ remates ------------------------------ */

export type Tiro = EventoDirecto & { gol: boolean; aPuerta: boolean; origen: EventoDirecto | null };

/**
 * Los remates, cada uno con su origen: el último pase completado de su
 * equipo en los 12 segundos de antes (en la misma parte), si lo hay.
 * `ev` en orden de partido.
 */
export function tiros(ev: EventoDirecto[]): Tiro[] {
  const salida: Tiro[] = [];
  ev.forEach((e, i) => {
    if (!TIROS.has(e.tipo)) return;
    let origen: EventoDirecto | null = null;
    for (let k = i - 1; k >= 0 && k >= i - 40; k--) {
      const o = ev[k];
      if (o.parte !== e.parte || e.segundo - o.segundo > 12) break;
      if (o.teamId === e.teamId && o.tipo === "Pass" && o.ok && o.finX != null) {
        origen = o;
        break;
      }
    }
    salida.push({ ...e, gol: e.tipo === "Goal", aPuerta: e.tipo === "Goal" || e.tipo === "AttemptSaved", origen });
  });
  return salida;
}

/** xG acumulado de cada equipo, minuto a minuto (0 … último). */
export function curvaXg(ts: Tiro[], equipos: string[], hasta: number): Record<string, number[]> {
  const fin = Math.max(hasta, ...ts.map((t) => t.minuto), 1);
  const salida: Record<string, number[]> = {};
  for (const eq of equipos) {
    const v = new Array(fin + 1).fill(0);
    for (const t of ts) if (t.teamId === eq) v[Math.min(fin, t.minuto)] += t.xG ?? 0;
    for (let i = 1; i <= fin; i++) v[i] += v[i - 1];
    salida[eq] = v;
  }
  return salida;
}

/* ------------------------------ robos y pérdidas ------------------------------ */

const comoAccion = (e: EventoDirecto) => ({ tipo: e.tipo, x: e.x, y: e.y, finX: e.finX, finY: e.finY, ok: e.ok });

export const recupera = (e: EventoDirecto) => esRecuperacion(comoAccion(e));
export const pierde = (e: EventoDirecto) => esPerdida(comoAccion(e));
export const progresa = (e: EventoDirecto) => esProgresivo(comoAccion(e));
export const alUltimoTercio = (e: EventoDirecto) => e.tipo === "Pass" && e.ok && e.finX != null && e.x < 66.7 && e.finX >= 66.7;

/** Pérdida que acaba en remate del rival en menos de 15 segundos (misma parte). */
function peligrosas(ev: EventoDirecto[], teamId: string): Set<EventoDirecto> {
  const salida = new Set<EventoDirecto>();
  ev.forEach((e, i) => {
    if (e.teamId !== teamId || !pierde(e)) return;
    for (let k = i + 1; k < ev.length; k++) {
      const o = ev[k];
      if (o.parte !== e.parte || o.segundo - e.segundo > 15) break;
      if (o.teamId !== teamId && TIROS.has(o.tipo)) {
        salida.add(e);
        break;
      }
    }
  });
  return salida;
}

export function robosYPerdidas(ev: EventoDirecto[], teamId: string) {
  const suyos = ev.filter((e) => e.teamId === teamId);
  const robos = suyos.filter(recupera);
  /* Pérdidas en juego: un saque de banda o de puerta largo que no llega no es perder el balón jugando. */
  const perdidas = suyos.filter((e) => pierde(e) && !e.saque);
  const caras = peligrosas(ev, teamId);
  const cuenta = (l: EventoDirecto[]) => {
    const c: Record<Altura3, number> = { alta: 0, media: 0, baja: 0 };
    for (const e of l) c[alturaAccion(e.x)]++;
    return c;
  };
  return { robos, perdidas, caras: perdidas.filter((e) => caras.has(e)), alturaRobos: cuenta(robos), alturaPerdidas: cuenta(perdidas) };
}

/* ------------------------------ jugadores ------------------------------ */

export type Rendimiento = {
  jugador: JugadorDirecto;
  toques: number;
  pases: number;
  pasesOk: number;
  progresivos: number;
  alTercio: number;
  xG: number;
  tiros: number;
  recuperaciones: number;
  perdidas: number;
  duelos: number;
  duelosGanados: number;
  /** Suma del xPV añadido de sus acciones (cuánto acerca el balón al gol). */
  xPV: number;
  /** Minutos en el campo dentro del tramo (aprox.: de su primera a su última acción, o sus minutos si es el partido). */
  enCampo: number;
};

/** xPV por 90 minutos en el campo. */
export const xpv90 = (r: Rendimiento) => (r.xPV / r.enCampo) * 90;

function minutosEn(l: EventoDirecto[], minutosPartido: number): number {
  if (!l.length) return 0;
  const a = Math.min(...l.map((e) => e.segundo));
  const b = Math.max(...l.map((e) => e.segundo));
  return Math.min(minutosPartido || 999, Math.max(5, (b - a) / 60 + 3));
}

const DUELO = new Set(["Aerial", "TakeOn", "Tackle", "Challenge", "AttemptedTackle"]);

/** Lo de cada jugador en el tramo (las cifras de Opta, `jugador.cifras`, son del partido entero). */
export function rendimientos(ev: EventoDirecto[], jugadores: JugadorDirecto[]): Rendimiento[] {
  const por = new Map<string, EventoDirecto[]>();
  for (const e of ev) {
    const l = por.get(e.jugadorId);
    if (l) l.push(e);
    else por.set(e.jugadorId, [e]);
  }
  return jugadores
    .filter((j) => j.minutos > 0 || por.has(j.id))
    .map((j) => {
      const l = por.get(j.id) ?? [];
      const pases = l.filter(esPaseEnJuego);
      const duelos = l.filter((e) => DUELO.has(e.tipo));
      return {
        jugador: j,
        toques: l.filter(esToque).length,
        pases: pases.length,
        pasesOk: pases.filter((e) => e.ok).length,
        progresivos: l.filter(progresa).length,
        alTercio: l.filter(alUltimoTercio).length,
        xG: l.reduce((s, e) => s + (TIROS.has(e.tipo) ? (e.xG ?? 0) : 0), 0),
        tiros: l.filter((e) => TIROS.has(e.tipo)).length,
        recuperaciones: l.filter(recupera).length,
        perdidas: l.filter(pierde).length,
        duelos: duelos.length,
        duelosGanados: duelos.filter((e) => e.ok).length,
        xPV: l.reduce((s, e) => s + e.xPV, 0),
        enCampo: Math.max(1, minutosEn(l, j.minutos)),
      };
    });
}

/* ------------------------------ las dos partes ------------------------------ */

export type Parte = { territorio: number | null; xg: number; tercio: number; toques: number };

/** Lo de cada parte para un equipo, para compararlas en una línea. */
export function porPartes(ev: EventoDirecto[], a: string, b: string): Record<1 | 2, { a: Parte; b: Parte }> {
  const una = (p: 1 | 2) => {
    const l = ev.filter((e) => e.parte === p);
    const t = territorio(l, a, b);
    const de = (id: string): Parte => {
      const m = l.filter((e) => e.teamId === id);
      const toques = m.filter(esToque);
      return {
        territorio: t.pctA == null ? null : id === a ? t.pctA : 1 - t.pctA,
        xg: m.reduce((s, e) => s + (TIROS.has(e.tipo) ? (e.xG ?? 0) : 0), 0),
        tercio: toques.length ? toques.filter((e) => e.x >= 66.7).length / toques.length : 0,
        toques: toques.length,
      };
    };
    return { a: de(a), b: de(b) };
  };
  return { 1: una(1), 2: una(2) };
}

/* ------------------------------ balón parado ------------------------------ */

export type AccionAbp = {
  tipo: "corner" | "banda";
  saque: EventoDirecto;
  /** Remate del mismo equipo en los 10 s siguientes (misma parte), si lo hay. */
  remate: Tiro | null;
  /** Remate del rival en los 15 s siguientes: la contra que nos hacen. */
  contra: Tiro | null;
};

/** Córner: pase que sale de la esquina (Opta lo pone en x ≥ 99 y en y ≤ 1 o ≥ 99). */
export const esCorner = (e: EventoDirecto) => e.tipo === "Pass" && !e.saque && e.x >= 99 && (e.y <= 1 || e.y >= 99);

/**
 * El balón parado de un equipo: sus córners y sus saques de banda en el
 * último tercio, cada uno con el remate que da (10 s) y la contra rival (15 s).
 * `ev` en orden de partido. Las faltas no salen: el directo no trae el
 * calificador de falta de Opta.
 */
export function balonParado(ev: EventoDirecto[], teamId: string): AccionAbp[] {
  const ts = tiros(ev);
  const salida: AccionAbp[] = [];
  for (const e of ev) {
    if (e.teamId !== teamId) continue;
    const tipo = esCorner(e) ? "corner" : e.saque === "banda" && e.x >= 66.7 ? "banda" : null;
    if (!tipo) continue;
    const tras = (t: Tiro, s: number) => t.parte === e.parte && t.segundo >= e.segundo && t.segundo - e.segundo <= s;
    salida.push({
      tipo,
      saque: e,
      remate: ts.find((t) => t.teamId === teamId && tras(t, 10)) ?? null,
      contra: ts.find((t) => t.teamId !== teamId && tras(t, 15)) ?? null,
    });
  }
  return salida;
}
