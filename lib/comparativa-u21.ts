/**
 * COMPARATIVO U-21: los nuestros contra los jóvenes de la categoría.
 *
 * Sustituye al informe de Power BI con lo que ya tenemos: la descarga de
 * jugadores de Wyscout de toda la categoría (edad, puesto, minutos y 86
 * métricas por noventa minutos), nuestras valoraciones de partido y los
 * seguimientos.
 *
 * La pregunta es la de «proyección»: **¿cómo está este chico frente a los de
 * su edad y su puesto que juegan en la categoría?** Por eso la referencia son
 * los sub-21 (o sub-23, o todos) del MISMO puesto, con minutos, y nunca la
 * plantilla sola.
 *
 * Reglas que vienen de DATA y no se tocan aquí:
 * - Percentil, nunca «% sobre la media» (ver lib/data-analisis/destacados.ts).
 * - Un porcentaje de una sola acción no cuenta (`volumenDelPorcentaje`).
 * - El portero sólo contra porteros (`comparablesDe`).
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  MINUTOS_MINIMOS,
  esNuestro,
  evolucionDe,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  volumenDelPorcentaje,
  type MetricaJugador,
  type Puesto,
} from "@/lib/data-analisis/individual";

export type Referencia = "u21" | "u23" | "todos";

export const REFERENCIAS: { key: Referencia; label: string; edad: number }[] = [
  { key: "u21", label: "Sub-21 de la categoría", edad: 21 },
  { key: "u23", label: "Sub-23 de la categoría", edad: 23 },
  { key: "todos", label: "Toda la categoría", edad: 99 },
];

const edadMaxima = (ref: Referencia) => REFERENCIAS.find((r) => r.key === ref)?.edad ?? 21;

/** Los de la categoría con los que se compara: esta temporada, con minutos, del puesto y la edad. */
export function referenciaDe(jugadores: FilaJugador[], puesto: Puesto, ref: Referencia) {
  return jugadores.filter(
    (j) =>
      j.temporada === "actual" &&
      j.minutos >= MINUTOS_MINIMOS &&
      puestoDe(j.posicion) === puesto &&
      j.edad > 0 &&
      j.edad <= edadMaxima(ref),
  );
}

export type Percentil = { metrica: MetricaJugador; valor: number; percentil: number };

/** Los percentiles de un jugador en las métricas de su puesto, contra un grupo. */
export function percentilesDe(jugador: FilaJugador, contra: FilaJugador[], puesto: Puesto): Percentil[] {
  if (contra.length < 3) return [];

  return metricasDe(puesto)
    .filter((m) => m.mejorAlto !== null)
    .filter((m) => volumenDelPorcentaje(jugador, m.columna).fiable)
    .map((m) => {
      const valor = valorDe(jugador, m.columna);
      if (valor === null) return null;
      const percentil = percentilEnPlantilla(
        valor,
        contra.map((c) => valorDe(c, m.columna)).filter((v): v is number => v !== null),
        m.mejorAlto,
      );
      return percentil === null ? null : { metrica: m, valor, percentil };
    })
    .filter((x): x is Percentil => x !== null);
}

/**
 * El índice: la media de sus percentiles en las métricas de su puesto.
 *
 * Es un resumen para ordenar, no una nota: dos medios con el mismo 60 pueden
 * serlo por cosas muy distintas, y la ficha enseña cuáles.
 */
export const indiceDe = (percentiles: Percentil[]) =>
  percentiles.length ? Math.round(percentiles.reduce((s, p) => s + p.percentil, 0) / percentiles.length) : null;

export type FilaComparativa = {
  jugador: FilaJugador;
  puesto: Puesto;
  /** Con cuántos de la referencia se compara (él incluido si entra). */
  referencia: FilaJugador[];
  percentiles: Percentil[];
  indice: number | null;
  /** Su puesto en el ranking de la referencia por índice: 1 = el mejor. */
  ranking: { posicion: number; de: number } | null;
  /** Salto medio de percentil contra su categoría del año pasado. */
  evolucion: { salto: number; fiable: boolean } | null;
};

/**
 * La tabla entera de un golpe.
 *
 * El ranking necesita el índice de TODA la referencia, no sólo de los nuestros,
 * así que se calcula una vez por puesto y se reutiliza.
 */
export function comparativa(jugadores: FilaJugador[], ref: Referencia): FilaComparativa[] {
  const nuestros = jugadores.filter((j) => esNuestro(j) && j.temporada === "actual" && j.minutos > 0);
  const porPuesto = new Map<Puesto, { referencia: FilaJugador[]; indices: Map<FilaJugador, number> }>();

  const delPuesto = (puesto: Puesto) => {
    const hecho = porPuesto.get(puesto);
    if (hecho) return hecho;
    const referencia = referenciaDe(jugadores, puesto, ref);
    const indices = new Map<FilaJugador, number>();
    for (const r of referencia) {
      const i = indiceDe(percentilesDe(r, referencia, puesto));
      if (i !== null) indices.set(r, i);
    }
    const suyo = { referencia, indices };
    porPuesto.set(puesto, suyo);
    return suyo;
  };

  return nuestros.map((jugador) => {
    const puesto = puestoDe(jugador.posicion);
    const { referencia, indices } = delPuesto(puesto);
    const percentiles = percentilesDe(jugador, referencia, puesto);
    const indice = indiceDe(percentiles);

    /* Si él no entra en la referencia (más mayor, o pocos minutos), se le coloca igualmente. */
    const otros = [...indices.entries()].filter(([r]) => r !== jugador).map(([, i]) => i);
    const ranking =
      indice === null || otros.length === 0
        ? null
        : { posicion: otros.filter((i) => i > indice).length + 1, de: otros.length + 1 };

    const evo = evolucionDe(jugador, jugadores);
    const evolucion = evo.filas.length
      ? { salto: Math.round(evo.filas.reduce((s, f) => s + f.salto, 0) / evo.filas.length), fiable: evo.fiable }
      : null;

    return { jugador, puesto, referencia, percentiles, indice, ranking, evolucion };
  });
}

/** Los mejores de la referencia de un puesto, para ver dónde queda uno de los nuestros. */
export function mejoresDe(jugadores: FilaJugador[], puesto: Puesto, ref: Referencia, cuantos = 8) {
  const referencia = referenciaDe(jugadores, puesto, ref);
  return referencia
    .map((j) => ({ jugador: j, indice: indiceDe(percentilesDe(j, referencia, puesto)) }))
    .filter((x): x is { jugador: FilaJugador; indice: number } => x.indice !== null)
    .sort((a, b) => b.indice - a.indice)
    .slice(0, cuantos);
}

/**
 * La nube de «proyección»: todos los del puesto de la categoría, con su edad y
 * su índice contra TODA la categoría del puesto (no contra los de su edad, o
 * los mayores saldrían siempre peor por construcción y la edad no diría nada).
 */
export function nubeDe(jugadores: FilaJugador[], puesto: Puesto) {
  const todos = referenciaDe(jugadores, puesto, "todos");
  return todos
    .map((j) => ({ jugador: j, edad: j.edad, indice: indiceDe(percentilesDe(j, todos, puesto)), nuestro: esNuestro(j) }))
    .filter((x): x is { jugador: FilaJugador; edad: number; indice: number; nuestro: boolean } => x.indice !== null);
}
