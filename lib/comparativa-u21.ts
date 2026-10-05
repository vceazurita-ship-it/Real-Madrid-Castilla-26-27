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
        contra
          .filter((c) => volumenDelPorcentaje(c, m.columna).fiable)
          .map((c) => valorDe(c, m.columna))
          .filter((v): v is number => v !== null),
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
    const percentiles = jugador.minutos >= MINUTOS_MINIMOS ? percentilesDe(jugador, referencia, puesto) : [];
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

/* ------------------------------------------------------------------ */
/*  LA BATERÍA DE PREGUNTAS                                            */
/* ------------------------------------------------------------------ */

/**
 * Como en DATA (`lib/data-analisis/preguntas.ts`), pero de jugadores: una
 * pregunta de caseta y el par de métricas que la contesta. Al elegirla se
 * rellenan los dos ejes; luego se pueden cambiar a mano.
 */
export type Fase = "con" | "sin" | "tr" | "abp" | "por";

export const FASES: { key: Fase; label: string }[] = [
  { key: "con", label: "Con balón" },
  { key: "sin", label: "Sin balón" },
  { key: "tr", label: "Transiciones" },
  { key: "abp", label: "Balón parado" },
  { key: "por", label: "Porteros" },
];

export type Pregunta = {
  fase: Fase;
  pregunta: string;
  x: string;
  y: string;
  lectura: string;
  /** Cuando la pregunta lee el eje X al revés que la métrica (más remates en contra = más trabajo, no peor). */
  mejorX?: boolean;
};

export const PREGUNTAS: Pregunta[] = [
  { fase: "con", pregunta: "¿Quién hace avanzar el balón?", x: "Pases progresivos/90", y: "Carreras en progresión/90", lectura: "Arriba a la derecha, los que progresan pasando y conduciendo." },
  { fase: "con", pregunta: "¿Quién da el último pase?", x: "Jugadas claves/90", y: "xA/90", lectura: "Pases clave contra la calidad de las ocasiones que dan." },
  { fase: "con", pregunta: "¿Quién pisa el área y genera peligro?", x: "Toques en el área de penalti/90", y: "xG/90", lectura: "Presencia en el área contra peligro propio." },
  { fase: "con", pregunta: "¿Quién finaliza mejor de lo esperado?", x: "xG/90", y: "Goles/90", lectura: "Por encima de la diagonal marca más de lo que dicen sus ocasiones." },
  { fase: "con", pregunta: "¿Quién desborda?", x: "Regates/90", y: "Regates realizados, %", lectura: "Cuánto lo intenta y cuánto le sale." },
  { fase: "con", pregunta: "¿Quién la pide y la cuida?", x: "Pases recibidos /90", y: "Precisión pases, %", lectura: "Participación contra seguridad en el pase." },
  { fase: "con", pregunta: "¿Quién centra y con qué acierto?", x: "Centros/90", y: "Precisión centros, %", lectura: "Volumen de centros contra acierto." },
  { fase: "sin", pregunta: "¿Quién gana los duelos?", x: "Duelos defensivos/90", y: "Duelos defensivos ganados, %", lectura: "Cuántos duelos defiende y cuántos gana." },
  { fase: "sin", pregunta: "¿Quién anticipa y roba?", x: "Interceptaciones/90", y: "Posesión conquistada después de una interceptación", lectura: "Interceptaciones y cuántas acaban en balón para su equipo." },
  { fase: "sin", pregunta: "¿Quién defiende sin hacer falta?", x: "Acciones defensivas realizadas/90", y: "Faltas/90", lectura: "Abajo a la derecha: mucho trabajo defensivo y pocas faltas." },
  { fase: "sin", pregunta: "¿Quién manda por arriba?", x: "Duelos aéreos en los 90", y: "Duelos aéreos ganados, %", lectura: "Duelos aéreos disputados y ganados." },
  { fase: "tr", pregunta: "¿Quién ataca la espalda?", x: "Ataque en profundidad/90", y: "Aceleraciones/90", lectura: "Desmarques de ruptura contra cambios de ritmo." },
  { fase: "tr", pregunta: "¿Quién sale corriendo tras robar?", x: "Posesión conquistada después de una entrada", y: "Carreras en progresión/90", lectura: "Balones ganados en la entrada contra conducciones que hacen avanzar." },
  { fase: "tr", pregunta: "¿Quién cuida el balón en la pérdida?", x: "Duelos atacantes/90", y: "Duelos atacantes ganados, %", lectura: "Duelos con balón disputados y ganados: quien los gana no regala transiciones." },
  { fase: "abp", pregunta: "¿Quién es amenaza a balón parado?", x: "Duelos aéreos en los 90", y: "Goles de cabeza/90", lectura: "Juego aéreo contra goles de cabeza." },
  { fase: "abp", pregunta: "¿Quién lanza?", x: "Córneres/90", y: "Tiros libres/90", lectura: "Quién se encarga de córners y faltas." },
  { fase: "por", pregunta: "¿Qué portero para más de lo esperado?", x: "Paradas, %", y: "Goles evitados/90", lectura: "Porcentaje de paradas contra goles evitados sobre el xG recibido." },
  { fase: "por", pregunta: "¿Qué portero juega con los pies?", x: "Pases largos/90", y: "Precisión pases largos, %", lectura: "Volumen de juego en largo contra acierto." },
  { fase: "por", pregunta: "¿Qué portero juega corto?", x: "Pases cortos / medios /90", y: "Precisión pases cortos / medios, %", lectura: "Cuánto inicia en corto y con qué seguridad." },
  { fase: "por", pregunta: "¿Qué portero sale más?", x: "Salidas/90", y: "Duelos aéreos ganados, %", lectura: "Salidas de su línea contra balones por alto ganados." },
  { fase: "por", pregunta: "¿Cuánto trabajo le dan?", x: "Remates en contra/90", y: "Goles recibidos/90", mejorX: true, lectura: "Lo que le tiran contra lo que le entra: abajo a la derecha, mucho trabajo y pocos goles." },
];

export type PuntoJugador = { jugador: FilaJugador; x: number; y: number; nuestro: boolean; comparado: boolean };

/**
 * Los puntos de un par de métricas: la referencia (edad y puesto) más los
 * nuestros aunque no entren en ella por edad, para que siempre se vean.
 * Un porcentaje sacado de muy pocas acciones no se pinta.
 */
export function puntosDe(
  jugadores: FilaJugador[],
  ref: Referencia,
  puesto: Puesto | "todos",
  x: string,
  y: string,
  /** Equipos elegidos para comparar: entran todos los suyos del puesto, tengan la edad que tengan. */
  equipos: string[] = [],
): PuntoJugador[] {
  const edad = edadMaxima(ref);
  const valen = (j: FilaJugador) =>
    j.temporada === "actual" &&
    j.minutos >= MINUTOS_MINIMOS &&
    (puesto === "todos" ? puestoDe(j.posicion) !== "POR" : puestoDe(j.posicion) === puesto) &&
    (esNuestro(j) || equipos.includes(j.equipo) || (j.edad > 0 && j.edad <= edad));

  return jugadores
    .filter(valen)
    .filter((j) => volumenDelPorcentaje(j, x).fiable && volumenDelPorcentaje(j, y).fiable)
    .map((j) => ({ jugador: j, x: valorDe(j, x), y: valorDe(j, y), nuestro: esNuestro(j), comparado: !esNuestro(j) && equipos.includes(j.equipo) }))
    .filter((p): p is PuntoJugador => p.x !== null && p.y !== null);
}

export const mediana = (valores: number[]) => {
  const o = [...valores].sort((a, b) => a - b);
  if (!o.length) return 0;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
