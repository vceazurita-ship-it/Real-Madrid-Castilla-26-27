/**
 * CÓMO PROGRESA EL RIVAL: POR DENTRO EN CORTO O EN LARGO DIRECTO
 * (Scout colectivo, 19/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`), por equipo:
 *
 * - X · parte de pases largos: pases en juego (sin saques de banda ni de
 *   puerta) de 32 m o más sobre todos sus pases en juego. Opta: x 0-100 =
 *   105 m, y 0-100 = 68 m.
 * - Y · parte de pases progresivos por dentro: de sus pases progresivos
 *   completados (`progresa`: acercan el balón a la portería al menos un 25 %
 *   y no se quedan en campo propio), los que acaban en el carril central
 *   (y de destino entre 30 y 70).
 *
 * Cuadrante: contra la mediana de los equipos del plano en cada eje.
 * Menos largo que la mediana y más por dentro: «combinativo por dentro»;
 * menos largo y más por fuera: «combinativo por fuera»; más largo y por
 * fuera: «directo»; más largo y aun así por dentro: «mixto».
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, progresa, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const LARGO_M = 32;
export const Y_DENTRO = { y0: 30, y1: 70 };
/** Partidos más recientes de cada equipo para su punto, y los del «ahora» del rival. */
export const MAX_PARTIDOS = 8;
export const RECIENTES = 5;
/** Con menos pases progresivos no se pone el punto. */
export const MIN_PROGRESIVOS = 40;

export type PartidoProgresion = { partido: string; fecha: string; eventos: EventoDirecto[] };

export type PuntoProgresion = {
  teamId: string;
  partidos: number;
  pases: number;
  largos: number;
  progresivos: number;
  dentro: number;
  /** Tanto por uno. */
  x: number;
  y: number;
};

export type Cuadrante = "combinativo por dentro" | "combinativo por fuera" | "directo" | "mixto";

const metros = (e: EventoDirecto) =>
  e.finX == null || e.finY == null ? 0 : Math.hypot((e.finX - e.x) * 1.05, (e.finY - e.y) * 0.68);

/** El punto de `teamId` en esos partidos (null si no llega a `MIN_PROGRESIVOS`). */
export function puntoDe(partidos: PartidoProgresion[], teamId: string, minimo = MIN_PROGRESIVOS): PuntoProgresion | null {
  let pases = 0, largos = 0, progresivos = 0, dentro = 0, leidos = 0;
  for (const p of partidos) {
    let jugo = false;
    for (const e of p.eventos) {
      if (e.teamId !== teamId) continue;
      jugo = true;
      if (!esPaseEnJuego(e)) continue;
      pases += 1;
      if (metros(e) >= LARGO_M) largos += 1;
      if (progresa(e) && e.finY != null) {
        progresivos += 1;
        if (e.finY >= Y_DENTRO.y0 && e.finY <= Y_DENTRO.y1) dentro += 1;
      }
    }
    if (jugo) leidos += 1;
  }
  if (!pases || progresivos < minimo) return null;
  return { teamId, partidos: leidos, pases, largos, progresivos, dentro, x: largos / pases, y: dentro / progresivos };
}

/** Los partidos de un equipo, del más reciente al más viejo, hasta `n`. */
export const ultimosDe = (partidos: PartidoProgresion[], teamId: string, n: number) =>
  partidos
    .filter((p) => p.eventos.some((e) => e.teamId === teamId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, n);

export function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function cuadrante(p: { x: number; y: number }, medX: number, medY: number): Cuadrante {
  const largo = p.x >= medX;
  const porDentro = p.y >= medY;
  if (!largo) return porDentro ? "combinativo por dentro" : "combinativo por fuera";
  return porDentro ? "mixto" : "directo";
}

/** Qué hacer con el bloque según el cuadrante. */
export const QUE_HACER: Record<Cuadrante, string> = {
  "combinativo por dentro": "Progresa en corto y por el pasillo interior: el bloque tiene que cerrar por dentro y orientarle hacia fuera.",
  "combinativo por fuera": "Progresa en corto y abriendo a las bandas: dejarle fuera y saltar con la banda; ahí se le puede encerrar.",
  directo: "Busca el balón largo antes que la combinación: preparar el duelo aéreo, la caída y la segunda jugada, con la línea de atrás protegida.",
  mixto: "Juega largo, pero lo que progresa entra por dentro: atentos a la caída por el centro y a cerrar el pasillo interior a la vez.",
};
