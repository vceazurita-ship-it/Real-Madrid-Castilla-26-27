import type { FilaJugador } from "./leer";
import type { Fase, Unidad } from "./metricas";

/**
 * EL JUGADOR, NO EL EQUIPO.
 *
 * El «Search results» de Wyscout es otra descarga: una fila por jugador con su
 * temporada entera y **todo ya por noventa minutos**, que es la única forma de
 * comparar a quien lleva doscientos minutos con quien lleva veintitrés.
 *
 * Dos cosas mandan en cómo se lee esta sección, y las dos son limitaciones
 * reales que la pantalla dice en voz alta:
 *
 * 1. **La muestra es de dos partidos.** Un «/90» de un jugador con veintitrés
 *    minutos es una extrapolación de tres acciones. Por eso hay un mínimo de
 *    minutos y por eso se avisa de quién no llega.
 * 2. **Sólo está nuestra plantilla.** No hay jugadores de otros equipos en el
 *    fichero, así que el percentil es **dentro del Castilla**, no contra la
 *    categoría. Compararse con los compañeros de puesto es útil; confundirlo
 *    con «está en el percentil 80 de la liga» no lo es.
 */

/* ------------------------------------------------------------------ */
/*  PUESTOS                                                            */
/* ------------------------------------------------------------------ */

export type Puesto = "POR" | "CEN" | "LAT" | "MED" | "BAN" | "DEL";

export const PUESTOS: { key: Puesto; label: string; corto: string }[] = [
  { key: "POR", label: "Porteros", corto: "POR" },
  { key: "CEN", label: "Centrales", corto: "CEN" },
  { key: "LAT", label: "Laterales", corto: "LAT" },
  { key: "MED", label: "Medios", corto: "MED" },
  { key: "BAN", label: "Bandas y mediapuntas", corto: "BAN" },
  { key: "DEL", label: "Delanteros", corto: "DEL" },
];

/**
 * De la sigla de Wyscout al puesto de la caseta.
 *
 * Wyscout puede dar varias —«LAMF, RAMF»— y manda la primera, que es donde más
 * ha jugado. Las siglas llevan el lado delante (`L`/`R`) y eso no cambia el
 * puesto: un `LCB` y un `RCB` son dos centrales.
 */
export function puestoDe(posicion: string): Puesto {
  const primera = posicion.split(",")[0].trim().toUpperCase();

  if (primera === "GK") return "POR";

  const sinLado = primera.replace(/^[LRC](?=[A-Z]{2})/, "");

  if (/^(CB|B)$/.test(sinLado) || /CB$/.test(primera)) return "CEN";
  if (/^(LB|RB|WB|LWB|RWB)$/.test(primera)) return "LAT";
  if (/^(DMF|CMF|MF)$/.test(sinLado)) return "MED";
  if (/^(AMF|WF|W)$/.test(sinLado) || /AMF$/.test(primera)) return "BAN";
  if (/^CF$/.test(primera)) return "DEL";

  return "MED";
}

/* ------------------------------------------------------------------ */
/*  LAS MÉTRICAS                                                       */
/* ------------------------------------------------------------------ */

export type MetricaJugador = {
  /** La columna tal y como la rotula Wyscout. */
  columna: string;
  nombre: string;
  grupo: string;
  fase: Fase;
  unidad: Unidad;
  mejorAlto: boolean | null;
  /** Los puestos a los que la métrica dice algo. Vacío = a todos. */
  puestos?: Puesto[];
  comoLeer: string;
};

export const METRICAS_JUGADOR: MetricaJugador[] = [
  /* ============================ CON BALÓN ========================= */
  {
    columna: "Pases/90",
    nombre: "Pases",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Cuánto participa en la circulación. No es una virtud: dice si el juego pasa por él o no.",
  },
  {
    columna: "Precisión pases, %",
    nombre: "Acierto de pase %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "Se lee junto al volumen y a la longitud: acertar el 90 % pasando en corto hacia atrás no es lo mismo que el 75 % en el último tercio.",
  },
  {
    columna: "Pases progresivos/90",
    nombre: "Pases progresivos",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Los que avanzan de verdad hacia la portería contraria.",
  },
  {
    columna: "Precisión pases progresivos, %",
    nombre: "Acierto de pase progresivo %",
    grupo: "Progresión",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Arriesgar sirve si sale: éste es el porcentaje que lo dice.",
  },
  {
    columna: "Pases hacia adelante/90",
    nombre: "Pases hacia adelante",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "La intención de ir hacia adelante, al margen de si sale.",
  },
  {
    columna: "Carreras en progresión/90",
    nombre: "Conducciones progresivas",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Avanzar con el balón en los pies. Es la otra manera de progresar, y no la mide el pase.",
  },
  {
    columna: "Aceleraciones/90",
    nombre: "Aceleraciones",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cambios de ritmo con balón: lo que rompe una línea sin pasar.",
  },
  {
    columna: "Pases en el último tercio/90",
    nombre: "Pases en el último tercio",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cuánto juega donde se decide.",
  },
  {
    columna: "Precisión pases en el último tercio, %",
    nombre: "Acierto en el último tercio %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "El acierto donde de verdad cuesta acertar.",
  },
  {
    columna: "Jugadas claves/90",
    nombre: "Pases clave",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Pases que terminan en remate: la creación medida en el penúltimo toque.",
  },
  {
    columna: "xA/90",
    nombre: "xA",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Lo que valían los pases que dio: es la asistencia sin depender de si el compañero la metió.",
  },
  {
    columna: "Pases al área de penalti/90",
    nombre: "Pases al área",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Balones metidos dentro. Es la última frontera antes del remate.",
  },
  {
    columna: "Centros/90",
    nombre: "Centros",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Una vía, no una virtud: se mira con el acierto al lado.",
  },
  {
    columna: "Precisión centros, %",
    nombre: "Acierto de centro %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Por debajo del 25 %, centrar es perder el balón con otro nombre.",
  },
  {
    columna: "Pases en profundidad/90",
    nombre: "Pases en profundidad",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El pase a la espalda de la última línea.",
  },
  {
    columna: "Regates/90",
    nombre: "Regates intentados",
    grupo: "Duelos",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Encarar es una decisión de estilo, no una cualidad por sí sola.",
  },
  {
    columna: "Regates realizados, %",
    nombre: "Regates ganados %",
    grupo: "Duelos",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "De cada diez veces que encara, cuántas sale.",
  },
  {
    columna: "Duelos atacantes/90",
    nombre: "Duelos ofensivos",
    grupo: "Duelos",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Cuántas veces se pelea el balón atacando.",
  },
  {
    columna: "Duelos atacantes ganados, %",
    nombre: "Duelos ofensivos ganados %",
    grupo: "Duelos",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Lo que se gana con el balón en disputa cerca del área rival.",
  },
  {
    columna: "Toques en el área de penalti/90",
    nombre: "Toques en el área",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    puestos: ["BAN", "DEL", "MED", "LAT"],
    comoLeer:
      "Cuántas veces aparece dentro. Es la medida de si ataca el área o se queda fuera.",
  },
  {
    columna: "Desmarques/90",
    nombre: "Desmarques",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    puestos: ["BAN", "DEL", "MED"],
    comoLeer: "Movimientos a la espalda: lo que hace que el pase en profundidad exista.",
  },
  {
    columna: "Remates/90",
    nombre: "Remates",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El volumen. Junto al xG por remate dice si llega mucho o llega bien.",
  },
  {
    columna: "Tiros a la portería, %",
    nombre: "Remates a puerta %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Los que al menos obligan al portero.",
  },
  {
    columna: "xG/90",
    nombre: "xG",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Lo que valen las ocasiones que se fabrica, al margen de si entraron.",
  },
  {
    columna: "Goles/90",
    nombre: "Goles",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Comparado con el xG dice si está acertado o si le falta.",
  },
  {
    columna: "Goles hechos, %",
    nombre: "Conversión %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Goles por cada cien remates. Muy alto es acierto, y el acierto vuelve.",
  },
  {
    columna: "Acciones de ataque exitosas/90",
    nombre: "Acciones de ataque exitosas",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El resumen de lo que sale bien atacando: regates, pases y remates.",
  },

  /* ============================ SIN BALÓN ======================== */
  {
    columna: "Acciones defensivas realizadas/90",
    nombre: "Acciones defensivas",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El volumen de trabajo sin balón. Depende del puesto tanto como del jugador.",
  },
  {
    columna: "Duelos defensivos/90",
    nombre: "Duelos defensivos",
    grupo: "Duelos",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Cuántas veces le toca defender un duelo.",
  },
  {
    columna: "Duelos defensivos ganados, %",
    nombre: "Duelos defensivos ganados %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "La primera línea de todo lo demás.",
  },
  {
    columna: "Duelos aéreos en los 90",
    nombre: "Duelos aéreos",
    grupo: "Duelos",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Cuánto juega por arriba: depende del rival tanto como de él.",
  },
  {
    columna: "Duelos aéreos ganados, %",
    nombre: "Duelos aéreos ganados %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "El que decide córners y centros. Se mira con la estatura al lado.",
  },
  {
    columna: "Entradas/90",
    nombre: "Entradas",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Ir al suelo. Muchas suelen ser llegar tarde, no defender mejor.",
  },
  {
    columna: "Interceptaciones/90",
    nombre: "Interceptaciones",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cortar por lectura, sin entrar. Va con la posición, no con el físico.",
  },
  {
    columna: "Posesión conquistada después de una interceptación",
    nombre: "Posesión tras interceptar",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cortar y que el balón se quede: es la interceptación que vale doble.",
  },
  {
    columna: "Posesión conquistada después de una entrada",
    nombre: "Posesión tras entrar",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Entrar y quedarse el balón, en vez de sólo despejarlo.",
  },
  {
    columna: "Tiros interceptados/90",
    nombre: "Remates bloqueados",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Ponerse delante. Mucho volumen es defender dentro del área.",
  },
  {
    columna: "Faltas/90",
    nombre: "Faltas cometidas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "Lo que cuesta llegar tarde.",
  },
  {
    columna: "Tarjetas amarillas/90",
    nombre: "Amarillas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "La factura de las faltas, cuando son de las que se señalan.",
  },
  {
    columna: "Faltas recibidas/90",
    nombre: "Faltas recibidas",
    grupo: "Disciplina",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Las que le hacen. En quien conduce mucho suelen ser la factura de progresar.",
  },

  /* ============================= PORTERO ========================= */
  {
    columna: "Paradas, %",
    nombre: "Paradas %",
    grupo: "Portería",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    puestos: ["POR"],
    comoLeer: "De los remates que van entre palos, cuántos saca.",
  },
  {
    columna: "Goles evitados/90",
    nombre: "Goles evitados",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    puestos: ["POR"],
    comoLeer:
      "Los que el xG en contra decía que iban a entrar y no entraron. Es la nota del portero sin contar la defensa.",
  },
  {
    columna: "xG en contra/90",
    nombre: "xG en contra",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    puestos: ["POR"],
    comoLeer: "Lo que valían las ocasiones que recibió: es la nota de la defensa, no la suya.",
  },
  {
    columna: "Goles recibidos/90",
    nombre: "Goles recibidos",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    puestos: ["POR"],
    comoLeer: "Al lado del xG en contra dice si se está encajando más o menos de lo esperado.",
  },
  {
    columna: "Salidas/90",
    nombre: "Salidas",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    puestos: ["POR"],
    comoLeer: "Cuántas veces abandona la portería: define la altura de la línea de atrás.",
  },
  {
    columna: "Pases hacía atrás recibidos del arquero/90",
    nombre: "Cesiones recibidas",
    grupo: "Portería",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    puestos: ["POR"],
    comoLeer: "Cuánto se le devuelve el balón: la medida de si participa en la salida.",
  },

  /* ========================== BALÓN PARADO ======================= */
  {
    columna: "Córneres/90",
    nombre: "Córners lanzados",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Quién los saca. No es mejor ni peor: es un rol.",
  },
  {
    columna: "Tiros libres/90",
    nombre: "Faltas lanzadas",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "El otro lanzador del equipo.",
  },
  {
    columna: "Goles de cabeza/90",
    nombre: "Goles de cabeza",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Lo que aporta en el área en las jugadas de estrategia.",
  },
];

export const METRICA_JUGADOR_POR_COLUMNA = new Map(
  METRICAS_JUGADOR.map((m) => [m.columna, m]),
);

export const GRUPOS_JUGADOR = [
  "Valor gol",
  "Creación",
  "Ocupación del área",
  "Progresión",
  "Circulación",
  "Duelos",
  "Defensa",
  "Presión y transición",
  "Portería",
  "Balón parado",
  "Disciplina",
];

/* ------------------------------------------------------------------ */
/*  CÁLCULO                                                            */
/* ------------------------------------------------------------------ */

/**
 * Debajo de este umbral, un «por noventa minutos» es una extrapolación.
 *
 * Con veintitrés minutos jugados, tres acciones se convierten en «11,7 por
 * partido». No se esconde al jugador —sigue en la lista— pero se marca, y se
 * queda fuera del percentil para no torcer la comparación de los demás.
 */
export const MINUTOS_MINIMOS = 90;

export const valorDe = (jugador: FilaJugador, columna: string) =>
  jugador.datos[columna] ?? null;

/**
 * Dónde queda un jugador **dentro de la plantilla**.
 *
 * No es un percentil de la categoría: en el fichero sólo están los nuestros.
 * Se calcula contra los compañeros del mismo puesto cuando hay al menos tres,
 * y contra toda la plantilla cuando no —tres centrales dan una referencia;
 * dos, ninguna—.
 */
export function percentilEnPlantilla(
  valor: number,
  valores: number[],
  mejorAlto: boolean | null,
) {
  const utiles = valores.filter((v) => Number.isFinite(v));

  if (utiles.length < 2) return null;

  const peores = utiles.filter((v) =>
    mejorAlto === false ? v > valor : v < valor,
  ).length;

  const iguales = utiles.filter((v) => v === valor).length;

  return Math.round(((peores + iguales / 2) / utiles.length) * 100);
}

/**
 * Con quién se compara un jugador, y con qué honestidad.
 *
 * Dos reglas que costó ver que hacían falta:
 *
 * - **Un portero no se compara con nadie que no sea portero.** Sin esto, el
 *   portero salía en el percentil 4 de «interceptaciones» —claro— y en el 96
 *   de «xG en contra», que en un jugador de campo vale cero. Eran percentiles
 *   perfectamente calculados y perfectamente inútiles.
 * - **Y los porteros tampoco entran en el percentil de los de campo**, por lo
 *   mismo al revés: un cero suyo en «remates» empuja a todos los demás.
 *
 * Cuando no hay tres compañeros del puesto se baja a la plantilla de campo, y
 * si tampoco los hay —el caso del portero único— se dice `solo` y la pantalla
 * enseña las cifras sin percentil, que es lo único honesto.
 */
export type Comparacion = {
  lista: FilaJugador[];
  ambito: "puesto" | "plantilla" | "solo";
};

export function comparablesDe(
  jugadores: FilaJugador[],
  puesto: Puesto,
): Comparacion {
  const conMinutos = jugadores.filter((j) => j.minutos >= MINUTOS_MINIMOS);

  const delPuesto = conMinutos.filter((j) => puestoDe(j.posicion) === puesto);

  if (delPuesto.length >= 3) return { lista: delPuesto, ambito: "puesto" };

  if (puesto === "POR") return { lista: delPuesto, ambito: "solo" };

  const deCampo = conMinutos.filter((j) => puestoDe(j.posicion) !== "POR");

  return deCampo.length >= 3
    ? { lista: deCampo, ambito: "plantilla" }
    : { lista: deCampo, ambito: "solo" };
}

/** Las métricas que le dicen algo a un puesto. */
export const metricasDe = (puesto: Puesto) =>
  METRICAS_JUGADOR.filter((m) => !m.puestos || m.puestos.includes(puesto));

/**
 * Lo que más destaca y lo que más flojea de un jugador.
 *
 * Se mira sólo lo que tiene un sentido claro (`mejorAlto` definido): en
 * «centros por partido» estar arriba o abajo no es ni bueno ni malo, y meterlo
 * en la lista de fortalezas sería inventarse una.
 */
export function fuertesYFlojos(
  jugador: FilaJugador,
  companeros: FilaJugador[],
  puesto: Puesto,
) {
  const filas = metricasDe(puesto)
    .filter((m) => m.mejorAlto !== null)
    .map((m) => {
      const valor = valorDe(jugador, m.columna);

      if (valor === null) return null;

      const percentil = percentilEnPlantilla(
        valor,
        companeros
          .map((c) => valorDe(c, m.columna))
          .filter((v): v is number => v !== null),
        m.mejorAlto,
      );

      return percentil === null ? null : { metrica: m, valor, percentil };
    })
    .filter((x): x is { metrica: MetricaJugador; valor: number; percentil: number } =>
      x !== null,
    );

  const orden = [...filas].sort((a, b) => b.percentil - a.percentil);

  return {
    fuertes: orden.slice(0, 4),
    flojos: orden.slice(-4).reverse(),
    todas: filas,
  };
}
