/**
 * Métricas defensivas ajustadas a la posesión (13/11/2026).
 *
 * Un jugador sólo puede interceptar, entrar o disputar un duelo defensivo
 * cuando el balón lo tiene el rival. El Castilla tiene mucho el balón, así que
 * sus «por 90» sin balón salen bajos sin que defienda peor: tiene menos
 * minutos para defender. El ajuste lleva cada cifra a un partido con la
 * posesión repartida a medias:
 *
 *   ajustada = por 90 × 50 / (100 − posesión media de su equipo)
 *
 * Con un 60 % de posesión se multiplica por 1,25; con un 40 %, por 0,83.
 *
 * La posesión es la media de los partidos de liga de Wyscout de esa temporada
 * (sin amistosos), equipo por equipo. Si un equipo no tiene partidos en la
 * descarga (el otro grupo, o una temporada que no está), su cifra se queda
 * como estaba: no se inventa una posesión.
 *
 * Sólo se tocan los recuentos por 90 de la fase sin balón; los porcentajes
 * («duelos defensivos ganados, %») ya son relativos a lo que tuvo y no cambian.
 */

import { esNuestro } from "@/lib/data-analisis/individual";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { mismoEquipo } from "@/lib/data-analisis/nombres";

/** Las columnas que se ajustan: lo que se hace sin balón, contado por 90. */
export const COLUMNAS_AJUSTE_POSESION = [
  "Acciones defensivas realizadas/90",
  "Duelos defensivos/90",
  "Entradas/90",
  "Interceptaciones/90",
  "Tiros interceptados/90",
] as const;

const AJUSTABLES = new Set<string>(COLUMNAS_AJUSTE_POSESION);

export const seAjustaAPosesion = (columna: string) => AJUSTABLES.has(columna);

const COLUMNA_POSESION = "Posesión del balón, %";

/** Posesión media de cada equipo, por temporada («actual» y «anterior»). */
export type Posesiones = Record<"actual" | "anterior", Map<string, { posesion: number; partidos: number }>>;

export function posesionesDe(partidos: FilaPartido[]): Posesiones {
  const temporadas = [...new Set(partidos.map((p) => temporadaDe(p.fecha)))].filter(Boolean).sort();
  const actual = temporadas[temporadas.length - 1] ?? "";
  const anterior = temporadas[temporadas.length - 2] ?? "";

  const mediasDe = (temporada: string) => {
    const suma = new Map<string, { s: number; n: number }>();
    if (!temporada) return new Map<string, { posesion: number; partidos: number }>();
    for (const p of partidos) {
      if (temporadaDe(p.fecha) !== temporada || /amistos|friendl/i.test(p.competicion ?? "")) continue;
      const v = p.datos?.[COLUMNA_POSESION];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v >= 100) continue;
      const previo = suma.get(p.equipo) ?? { s: 0, n: 0 };
      suma.set(p.equipo, { s: previo.s + v, n: previo.n + 1 });
    }
    return new Map([...suma].map(([e, { s, n }]) => [e, { posesion: s / n, partidos: n }]));
  };

  return { actual: mediasDe(actual), anterior: mediasDe(anterior) };
}

/** La posesión media del equipo del jugador en su temporada, o null si no está. */
export function posesionDe(jugador: FilaJugador, posesiones: Posesiones): number | null {
  const mapa = posesiones[jugador.temporada];
  const exacta = mapa.get(jugador.equipo);
  if (exacta) return exacta.posesion;
  for (const [equipo, v] of mapa) {
    if (mismoEquipo(equipo, jugador.equipo)) return v.posesion;
  }
  /* Nuestro equipo puede venir con otro nombre en la descarga de partidos. */
  if (esNuestro(jugador)) {
    for (const [equipo, v] of mapa) if (/madrid castilla/i.test(equipo)) return v.posesion;
  }
  return null;
}

/** Por cuánto se multiplica su cifra sin balón. */
export const factorPosesion = (posesion: number) => 50 / (100 - posesion);

export type AjustePosesion = {
  /** Los mismos jugadores, con las cifras sin balón ajustadas (copias). */
  jugadores: FilaJugador[];
  /** De la copia ajustada a la fila original. */
  original: Map<FilaJugador, FilaJugador>;
  /** La posesión usada para cada copia (null = sin dato, cifra intacta). */
  posesion: Map<FilaJugador, number | null>;
  /** Equipos de esta temporada sin posesión en la descarga de partidos. */
  equiposSinDato: string[];
};

export function ajustaAPosesion(jugadores: FilaJugador[], posesiones: Posesiones): AjustePosesion {
  const original = new Map<FilaJugador, FilaJugador>();
  const posesion = new Map<FilaJugador, number | null>();
  const sinDato = new Set<string>();

  const ajustados = jugadores.map((j) => {
    const pos = posesionDe(j, posesiones);
    if (pos === null) {
      if (j.temporada === "actual" && j.equipo) sinDato.add(j.equipo);
      posesion.set(j, null);
      original.set(j, j);
      return j;
    }
    const f = factorPosesion(pos);
    const datos = { ...j.datos };
    for (const c of COLUMNAS_AJUSTE_POSESION) {
      const v = datos[c];
      if (typeof v === "number" && Number.isFinite(v)) datos[c] = v * f;
    }
    const copia: FilaJugador = { ...j, datos, datosSinAjustar: j.datos };
    original.set(copia, j);
    posesion.set(copia, pos);
    return copia;
  });

  return { jugadores: ajustados, original, posesion, equiposSinDato: [...sinDato].sort((a, b) => a.localeCompare(b, "es")) };
}
