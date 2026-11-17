/**
 * EL EXTREMO RIVAL EN EL PLANO DEL REGATE (17/11/2026, idea de X).
 *
 * En el duelo de nuestro lateral contra su extremo: todos los extremos de la
 * categoría en un plano, regates intentados/90 (X) contra completados/90 (Y).
 * Dos líneas de la liga lo parten en cuatro:
 *
 * - la vertical, los intentos medios de los extremos;
 * - la diagonal, el acierto medio (completados totales / intentados totales):
 *   por encima, regatea mejor que la media; por debajo, peor.
 *
 * Al lado, el % de duelos defensivos ganados de nuestro lateral frente a la
 * media de los laterales. Si el extremo es desequilibrante y el lateral está
 * por debajo de su media, el duelo se marca en rojo: hay que doblar la banda.
 *
 * Wyscout, esta temporada, con al menos 90′ (la regla de toda la pantalla).
 * Un % de regates o de duelos de muy pocas acciones no cuenta
 * (`volumenDelPorcentaje`, la misma regla de DATA).
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { MINUTOS_MINIMOS, puestoDe, valorDe, volumenDelPorcentaje } from "@/lib/data-analisis/individual";
import type { JugadorDuelo, ResultadoDuelo } from "@/lib/duelos";

export const COL_INTENTOS = "Regates/90";
export const COL_ACIERTO = "Regates realizados, %";
export const COL_DUELOS_DEF = "Duelos defensivos ganados, %";

export type Cuadrante = "desequilibrante" | "insistente" | "selectivo" | "no-regatea";

export const ROTULO_CUADRANTE: Record<Cuadrante, string> = {
  desequilibrante: "Desequilibrante",
  insistente: "Insistente poco eficaz",
  selectivo: "Selectivo eficaz",
  "no-regatea": "No regatea",
};

export const LECTURA_CUADRANTE: Record<Cuadrante, string> = {
  desequilibrante: "encara más que la media y le sale mejor que a la media",
  insistente: "encara más que la media pero le sale peor",
  selectivo: "encara poco, pero cuando lo hace le sale mejor que a la media",
  "no-regatea": "encara poco y le sale peor que a la media",
};

export type PuntoRegate = { jugador: string; equipo: string; intentos: number; completados: number };

export type PlanoRegate = {
  puntos: PuntoRegate[];
  /** Intentos medios por 90 de los extremos (la vertical). */
  mediaIntentos: number;
  /** Completados / intentados de toda la nube (la pendiente de la diagonal). */
  acierto: number;
};

/* Extremos de verdad: LW, RW, LWF, RWF, LAMF, RAMF (sin el mediapunta centrado, AMF). */
const esExtremo = (posicion: string) => /^(L|R)(W|WF|AMF)$/.test(posicion.split(",")[0].trim().toUpperCase());

const valida = (f: FilaJugador) => f.temporada === "actual" && f.minutos >= MINUTOS_MINIMOS;

/** Sus regates por 90 (intentados y completados), o null si no hay muestra. */
export function puntoDe(f: FilaJugador | null): PuntoRegate | null {
  if (!f || !valida(f)) return null;
  const intentos = valorDe(f, COL_INTENTOS);
  if (intentos === null) return null;
  /* Con muy pocos intentos el % no vale, pero el que no regatea también es dato: completados ≈ 0. */
  const acierto = volumenDelPorcentaje(f, COL_ACIERTO).fiable ? valorDe(f, COL_ACIERTO) : null;
  const completados = acierto === null ? (intentos < 1 ? 0 : null) : (intentos * acierto) / 100;
  if (completados === null) return null;
  return { jugador: f.jugador, equipo: f.equipo, intentos, completados };
}

/** La nube de los extremos de la categoría y sus dos líneas; null con menos de 10. */
export function planoDeExtremos(jugadores: FilaJugador[]): PlanoRegate | null {
  const puntos = jugadores.filter((f) => valida(f) && esExtremo(f.posicion)).map(puntoDe).filter((p): p is PuntoRegate => Boolean(p));
  if (puntos.length < 10) return null;
  const intentos = puntos.reduce((a, p) => a + p.intentos, 0);
  const completados = puntos.reduce((a, p) => a + p.completados, 0);
  if (intentos <= 0) return null;
  return { puntos, mediaIntentos: intentos / puntos.length, acierto: completados / intentos };
}

export function cuadranteDe(p: PuntoRegate, plano: PlanoRegate): Cuadrante {
  const mucho = p.intentos >= plano.mediaIntentos;
  const bien = p.completados >= p.intentos * plano.acierto;
  return mucho ? (bien ? "desequilibrante" : "insistente") : bien ? "selectivo" : "no-regatea";
}

export type DuelosDefensivosLateral = { valor: number; media: number; comparables: number };

/** El % de duelos defensivos ganados del lateral y la media de los laterales de la categoría. */
export function duelosDefensivosDe(f: FilaJugador | null, jugadores: FilaJugador[]): DuelosDefensivosLateral | null {
  if (!f || !valida(f) || !volumenDelPorcentaje(f, COL_DUELOS_DEF).fiable) return null;
  const valor = valorDe(f, COL_DUELOS_DEF);
  if (valor === null) return null;
  const otros = jugadores
    .filter((c) => valida(c) && puestoDe(c.posicion) === "LAT" && volumenDelPorcentaje(c, COL_DUELOS_DEF).fiable)
    .map((c) => valorDe(c, COL_DUELOS_DEF))
    .filter((v): v is number => v !== null);
  if (otros.length < 5) return null;
  return { valor, media: otros.reduce((a, b) => a + b, 0) / otros.length, comparables: otros.length };
}

export type RegateDelDuelo = {
  plano: PlanoRegate;
  extremo: JugadorDuelo;
  punto: PuntoRegate | null;
  cuadrante: Cuadrante | null;
  lateral: JugadorDuelo | null;
  defensa: DuelosDefensivosLateral | null;
  /** Desequilibrante contra un lateral por debajo de su media: doblar la vigilancia. */
  alerta: boolean;
};

/** Lo del plano para un duelo lateral–extremo; null en los demás duelos o sin nube. */
export function regateDelDuelo(d: ResultadoDuelo, plano: PlanoRegate | null, jugadores: FilaJugador[]): RegateDelDuelo | null {
  if (!plano || d.def.tipo !== "lateral-extremo") return null;
  const extremo = d.suyos[0];
  if (!extremo) return null;
  const punto = puntoDe(extremo.wyscout);
  const cuadrante = punto ? cuadranteDe(punto, plano) : null;
  const lateral = d.nuestros[0] ?? null;
  const defensa = lateral ? duelosDefensivosDe(lateral.wyscout, jugadores) : null;
  const alerta = cuadrante === "desequilibrante" && defensa !== null && defensa.valor < defensa.media;
  return { plano, extremo, punto, cuadrante, lateral, defensa, alerta };
}
