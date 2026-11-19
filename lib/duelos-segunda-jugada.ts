/**
 * TRAS SU BALÓN LARGO, ¿QUIÉN GANA LA SEGUNDA JUGADA? (19/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`): por cada balón
 * largo de un equipo se busca quién se queda el balón en los 5 segundos
 * siguientes.
 *
 * - Balón largo: pase en juego o saque de puerta (no de banda) de 32 m o más
 *   y hacia delante (al menos 10 de x de Opta). Opta: x 0-100 = 105 m,
 *   y 0-100 = 68 m.
 * - Segunda jugada: el primer toque (`esToque`) de cualquiera de los dos
 *   equipos después del pase, en la misma parte y en los 5 s siguientes. El
 *   duelo aéreo («Aerial») no cuenta como quedársela: es la disputa; cuenta
 *   lo que viene detrás. Si antes hay una falta o no hay toque en 5 s (balón
 *   fuera), esa no entra.
 * - Zona: el sitio del primer toque, siempre visto desde quien lanzó el balón
 *   largo (si toca el otro equipo, Opta lo da desde el suyo: se da la vuelta).
 * - Zona del mediocentro: el pasillo central (y de 37 a 63) entre el medio
 *   campo y el borde del área de quien defiende (x de 50 a 83).
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";

export const LARGO_M = 32;
export const AVANCE_MIN = 10;
export const VENTANA_S = 5;
/** Partidos más recientes que se leen de cada equipo. */
export const MAX_PARTIDOS = 8;
/** Con menos balones largos con segunda jugada no se dice nada. */
export const MIN_BALONES = 15;
/** «Juego directo»: su parte de balones largos, al menos 1,15 veces la de sus rivales en esos partidos. */
export const FACTOR_DIRECTO = 1.15;
/** Malla del mapa de calor (en el marco de quien lanza). */
export const CX = 12;
export const CY = 8;
export const ZONA_MC = { x0: 50, x1: 83, y0: 37, y1: 63 };

export type PartidoSegunda = { partido: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type Recogedor = { id: string; nombre: string; veces: number };

export type SegundaJugada = {
  partidos: number;
  /** Balones largos del equipo y los que tuvieron segunda jugada. */
  largos: number;
  conSegunda: number;
  /** Las que se queda el equipo que lanza. */
  propias: number;
  parte: number;
  /** Su parte de balones largos sobre sus pases en juego, y la de sus rivales en esos partidos. */
  parteLargos: number;
  parteLargosRivales: number | null;
  /** Primeros toques por casilla (CX × CY), en el marco de quien lanza. */
  malla: number[];
  max: number;
  /** En la zona del mediocentro de quien defiende: cuántas caen y cuántas se queda quien defiende. */
  enZonaMc: number;
  defensaGanaZonaMc: number;
  /** Los tres que más las recogen del equipo que se pide (`recoge`). */
  recogen: Recogedor[];
};

const metros = (e: EventoDirecto) =>
  e.finX == null || e.finY == null ? 0 : Math.hypot((e.finX - e.x) * 1.05, (e.finY - e.y) * 0.68);

export const esBalonLargo = (e: EventoDirecto) =>
  e.tipo === "Pass" && e.saque !== "banda" && e.finX != null && e.finX - e.x >= AVANCE_MIN && metros(e) >= LARGO_M;

const esPase = (e: EventoDirecto) => e.tipo === "Pass" && e.saque !== "banda";

/** El primer toque que se queda el balón tras el pase `i`, o null. */
function primerToque(ev: EventoDirecto[], i: number): EventoDirecto | null {
  const p = ev[i];
  for (let k = i + 1; k < ev.length; k++) {
    const e = ev[k];
    if (e.parte !== p.parte || e.segundo - p.segundo > VENTANA_S) return null;
    if (e.segundo < p.segundo) continue;
    if (e.tipo === "Foul") return null;
    if (e.tipo === "Aerial" || !esToque(e)) continue;
    return e;
  }
  return null;
}

/**
 * Los balones largos de `lanza` (o de todos menos `lanza` si `contrarios`)
 * en esos partidos, y quién se queda la segunda jugada. `recoge` = de qué
 * equipo son los tres que más las recogen (por defecto, el que lanza).
 */
export function segundaJugada(
  partidos: PartidoSegunda[],
  equipo: string,
  opciones: { contrarios?: boolean; recogeElEquipo?: boolean } = {},
): SegundaJugada | null {
  const { contrarios = false, recogeElEquipo = true } = opciones;
  const lanzaEl = (t: string) => (contrarios ? t !== equipo : t === equipo);
  const malla = new Array(CX * CY).fill(0);
  const veces = new Map<string, number>();
  const nombres = new Map<string, string>();
  let largos = 0, conSegunda = 0, propias = 0, enZonaMc = 0, defensaGanaZonaMc = 0;
  let pasesLanza = 0, largosLanza = 0, pasesOtro = 0, largosOtro = 0;
  let leidos = 0;

  for (const p of partidos) {
    if (!p.eventos.some((e) => e.teamId === equipo)) continue;
    leidos += 1;
    for (const j of p.jugadores) if (j.id) nombres.set(j.id, j.nombre);
    const ev = p.eventos;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (!e.teamId || !esPase(e)) continue;
      const largo = esBalonLargo(e);
      if (lanzaEl(e.teamId)) {
        pasesLanza += 1;
        if (largo) largosLanza += 1;
      } else {
        pasesOtro += 1;
        if (largo) largosOtro += 1;
      }
      if (!largo || !lanzaEl(e.teamId)) continue;
      largos += 1;
      const t = primerToque(ev, i);
      if (!t || !t.teamId) continue;
      conSegunda += 1;
      const suya = t.teamId === e.teamId;
      if (suya) propias += 1;
      /* Al marco de quien lanza. */
      const x = suya ? t.x : 100 - t.x;
      const y = suya ? t.y : 100 - t.y;
      const ci = Math.min(CX - 1, Math.max(0, Math.floor((x / 100) * CX)));
      const cj = Math.min(CY - 1, Math.max(0, Math.floor((y / 100) * CY)));
      malla[cj * CX + ci] += 1;
      if (x >= ZONA_MC.x0 && x <= ZONA_MC.x1 && y >= ZONA_MC.y0 && y <= ZONA_MC.y1) {
        enZonaMc += 1;
        if (!suya) defensaGanaZonaMc += 1;
      }
      const delQuePide = recogeElEquipo ? suya : !suya;
      if (delQuePide && t.jugadorId) veces.set(t.jugadorId, (veces.get(t.jugadorId) ?? 0) + 1);
    }
  }

  if (conSegunda < MIN_BALONES) return null;
  const recogen = [...veces]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ id, nombre: nombres.get(id) ?? "", veces: n }))
    .filter((r) => r.nombre);
  return {
    partidos: leidos,
    largos,
    conSegunda,
    propias,
    parte: propias / conSegunda,
    parteLargos: pasesLanza ? largosLanza / pasesLanza : 0,
    parteLargosRivales: pasesOtro ? largosOtro / pasesOtro : null,
    malla,
    max: Math.max(...malla),
    enZonaMc,
    defensaGanaZonaMc,
    recogen,
  };
}

export const esJuegoDirecto = (s: SegundaJugada) =>
  s.parteLargosRivales != null && s.parteLargos >= s.parteLargosRivales * FACTOR_DIRECTO;
