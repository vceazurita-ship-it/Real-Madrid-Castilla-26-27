/**
 * LA TEMPORADA PASADA DE UN JUGADOR, CON WYSCOUT (12/11/2026).
 *
 * «Temporada a temporada» de la ficha (/individual, pestaña Opta) salía de las
 * tablas históricas de Opta, y la 25/26 de Opta sólo trae 2 o 3 partidos de
 * casi todos los equipos (del Castilla, 3). Wyscout sí tiene la temporada
 * cerrada entera de los 40 equipos de la categoría —es el «Search results»
 * de la liga del año pasado, `temporada: "anterior"` en
 * `/api/data-analisis`—, así que esa temporada se completa con él.
 *
 * Aquí no hay ningún dato: funciones puras sobre las filas que ya da
 * `/api/data-analisis`. Con la misma lógica que el resto de la ficha:
 *
 * - **Quién es quién.** Primero se busca al jugador en la temporada en curso
 *   de Wyscout con `casaNombre` (entre los del Castilla primero) y se toma la fila del
 *   año pasado con **ese mismo nombre de Wyscout** y una edad que cuadre
 *   (igual o un año menos). Si no está así —cambió de nombre en Wyscout o
 *   no ha jugado este año—, `casaNombre` contra la temporada pasada, pero
 *   sólo si la inicial del nombre de pila, la edad y la altura no lo
 *   desmienten. Si hay duda, no sale: no se inventa una temporada.
 * - **Con quién se compara.** `comparablesDe(..., "ligaAnterior")`: los de su
 *   puesto de toda la categoría con 450′ o más; el portero sólo con porteros.
 *   Con menos de 450′ no hay percentil (se dice), y un porcentaje de pocas
 *   acciones (`volumenDelPorcentaje`) tampoco lo lleva.
 */

import { normalizePlayerName } from "@/lib/playerImages";

import {
  METRICA_JUGADOR_POR_COLUMNA,
  MINUTOS_MINIMOS_ANTERIOR,
  PUESTOS,
  comparablesDe,
  esNuestro,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  volumenDelPorcentaje,
  type Puesto,
} from "./individual";
import type { FilaJugador } from "./leer";
import type { Unidad } from "./metricas";
import { nombreCanonico } from "./nombres";
import { casaNombre } from "./once";

/* ------------------------------------------------------------------ */
/*  QUIÉN ES QUIÉN                                                     */
/* ------------------------------------------------------------------ */

const limpio = (n: string) => normalizePlayerName(nombreCanonico(n));

/** La edad del año pasado puede ser la misma o un año menos que la de ahora. */
const edadCuadra = (antes: number, ahora: number | null) => !ahora || !antes || (ahora - antes >= 0 && ahora - antes <= 1);

/** Con las dos alturas, no más de 3 cm de diferencia (Wyscout la corrige a veces). */
const alturaCuadra = (a: number, b: number | null) => !a || !b || Math.abs(a - b) <= 3;

/**
 * Si el nombre de pila no lo desmiente: «J. Cestero» vale para Jorge Cestero,
 * «M. Cestero» no. Un nombre de una sola palabra (un apodo) no se mira.
 */
function inicialCuadra(nuestro: string, suyo: string) {
  const a = limpio(nuestro).split(" ").filter(Boolean);
  const b = limpio(suyo).split(" ").filter(Boolean);
  if (a.length < 2 || b.length < 2) return true;
  return a[0][0] === b[0][0];
}

/**
 * Su fila de esta temporada en Wyscout, sólo entre los del Castilla (hay un
 * «Adrián Pérez» en el Águilas y otro en el Athletic): por nombre y, si dos
 * comparten apellido («S. Martínez» y «Joan Martínez»), por apellido más
 * inicial. Fuera del Castilla no se busca: un tocayo de otro equipo daría
 * la temporada pasada de otra persona.
 */
function filaDeAhora(nombres: string[], actuales: FilaJugador[]) {
  const nuestros = actuales.filter(esNuestro);
  for (const n of nombres) {
    const f = casaNombre(n, nuestros, (j) => j.jugador);
    if (f) return f;
  }
  for (const n of nombres) {
    const trozos = limpio(n).split(" ").filter(Boolean);
    if (trozos.length < 2) continue;
    const apellido = trozos[trozos.length - 1];
    const xs = nuestros.filter((j) => limpio(j.jugador).split(" ").includes(apellido) && inicialCuadra(n, j.jugador));
    if (xs.length === 1) return xs[0];
  }
  return null;
}

/**
 * El jugador de la plantilla en la temporada pasada de Wyscout (null si no
 * está o hay duda). `edad` es la de ahora en otra fuente (Opta), para
 * descartar a un tocayo cuando Wyscout no le tiene este año.
 */
export function casaTemporadaAnterior(nombre: string, apodo: string | undefined, jugadores: FilaJugador[], edad?: number | null): FilaJugador | null {
  const nombres = [nombre, apodo].filter((n): n is string => Boolean(n && n.trim()));
  const actuales = jugadores.filter((j) => j.temporada === "actual");
  const anteriores = jugadores.filter((j) => j.temporada === "anterior" && j.minutos > 0);
  if (!anteriores.length || !nombres.length) return null;

  const hoy = filaDeAhora(nombres, actuales);
  const edadHoy = hoy?.edad || edad || null;
  const cuadra = (j: FilaJugador) => edadCuadra(j.edad, edadHoy) && alturaCuadra(j.altura, hoy?.altura ?? null);
  const unico = (xs: FilaJugador[]) => (xs.length === 1 ? xs[0] : null);

  /* 1. El mismo nombre de Wyscout que este año, con edad y altura que cuadran. */
  if (hoy) {
    const mismos = anteriores.filter((j) => limpio(j.jugador) === limpio(hoy.jugador));
    if (mismos.length) return unico(mismos.filter(cuadra));
  }

  /* 2. Por nombre contra la temporada pasada, si nada lo desmiente. */
  for (const n of nombres) {
    const exactos = anteriores.filter((j) => limpio(j.jugador) === limpio(n));
    if (exactos.length) {
      const f = unico(exactos.filter(cuadra));
      if (f) return f;
      continue;
    }
    const c = casaNombre(n, anteriores, (j) => j.jugador);
    if (c && inicialCuadra(n, c.jugador) && cuadra(c)) return c;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  LA TARJETA                                                         */
/* ------------------------------------------------------------------ */

/**
 * Lo principal de cada puesto, por 90 o en porcentaje (columnas de Wyscout).
 * Seis por puesto, lo que cabe en la tarjeta sin que deje de leerse.
 */
export const PRINCIPALES_TEMPORADA: Record<Puesto, string[]> = {
  POR: ["Goles evitados/90", "Paradas, %", "Goles recibidos/90", "Salidas/90", "Pases largos/90", "Precisión pases largos, %"],
  CEN: ["Duelos aéreos ganados, %", "Duelos defensivos ganados, %", "Interceptaciones/90", "Acciones defensivas realizadas/90", "Pases progresivos/90", "Precisión pases, %"],
  LAT: ["Carreras en progresión/90", "Centros/90", "Ataque en profundidad/90", "Pases progresivos/90", "Duelos defensivos ganados, %", "Interceptaciones/90"],
  MED: ["Pases progresivos/90", "Precisión pases, %", "Pases en el último tercio/90", "Jugadas claves/90", "Interceptaciones/90", "Duelos defensivos ganados, %"],
  BAN: ["xG/90", "xA/90", "Carreras en progresión/90", "Regates realizados, %", "Toques en el área de penalti/90", "Jugadas claves/90"],
  DEL: ["xG/90", "Goles, excepto los penaltis/90", "Remates/90", "Toques en el área de penalti/90", "xA/90", "Duelos aéreos ganados, %"],
};

export type MetricaTemporada = {
  columna: string;
  nombre: string;
  unidad: Unidad;
  valor: number;
  /** Percentil frente a su puesto (null: sin sentido claro, pocos minutos o pocas acciones). */
  p: number | null;
  /** Un porcentaje que sale de muy pocas acciones: se enseña sin percentil. */
  pocasAcciones: boolean;
};

export type TarjetaWyscout = {
  jugador: string;
  equipo: string;
  puesto: Puesto;
  /** «Centrales», «Medios»… */
  puestoNombre: string;
  partidos: number;
  minutos: number;
  goles: number | null;
  asistencias: number | null;
  xg: number | null;
  xa: number | null;
  metricas: MetricaTemporada[];
  /** Con cuántos se compara y de qué grupo. */
  comparados: number;
  contra: "puesto" | "campo" | "solo";
  /** Si no llega a los minutos de la temporada cerrada. */
  sinMinimo: boolean;
  minimo: number;
};

export function tarjetaWyscout(fila: FilaJugador, jugadores: FilaJugador[]): TarjetaWyscout {
  const puesto = puestoDe(fila.posicion);
  const comparacion = comparablesDe(jugadores, puesto, "ligaAnterior");
  const sinMinimo = fila.minutos < MINUTOS_MINIMOS_ANTERIOR;
  const conPercentil = !sinMinimo && comparacion.contra !== "solo";

  const metricas: MetricaTemporada[] = [];
  for (const columna of PRINCIPALES_TEMPORADA[puesto]) {
    const m = METRICA_JUGADOR_POR_COLUMNA.get(columna);
    const valor = valorDe(fila, columna);
    if (!m || valor === null) continue;
    const pocasAcciones = !volumenDelPorcentaje(fila, columna).fiable;
    const p =
      conPercentil && m.mejorAlto !== null && !pocasAcciones
        ? percentilEnPlantilla(
            valor,
            comparacion.lista.map((c) => valorDe(c, columna)).filter((v): v is number => v !== null),
            m.mejorAlto,
          )
        : null;
    metricas.push({ columna, nombre: m.nombre, unidad: m.unidad, valor, p, pocasAcciones });
  }

  return {
    jugador: fila.jugador,
    equipo: fila.equipo,
    puesto,
    puestoNombre: PUESTOS.find((x) => x.key === puesto)?.label ?? "",
    partidos: fila.partidos,
    minutos: fila.minutos,
    goles: valorDe(fila, "Goles"),
    asistencias: valorDe(fila, "Asistencias"),
    xg: valorDe(fila, "xG"),
    xa: valorDe(fila, "xA"),
    metricas,
    comparados: comparacion.lista.length,
    contra: comparacion.contra,
    sinMinimo,
    minimo: MINUTOS_MINIMOS_ANTERIOR,
  };
}
