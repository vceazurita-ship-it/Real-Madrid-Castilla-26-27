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

  /*
  | Se resuelve por la **cola** de la sigla, no quitando el lado.
  |
  | Quitar el prefijo de lado parecía más elegante y dejaba fuera a los
  | extremos: «LW» es una L y una sola letra más, así que la regla de «quita la
  | inicial si vienen dos mayúsculas detrás» no la tocaba y `LW` acababa de
  | medio centro. Mirando el final de la sigla no hay ese agujero, y el orden
  | de las comprobaciones resuelve los solapamientos —`RWB` acaba en `B` pero
  | es carrilero, así que va antes que los centrales—.
  */
  if (primera === "GK") return "POR";

  if (/^(LWB|RWB|LB|RB|WB)$/.test(primera)) return "LAT";

  if (/CB$/.test(primera) || primera === "CB") return "CEN";

  if (/(W|WF)$/.test(primera) || /AMF$/.test(primera)) return "BAN";

  if (/(DMF|CMF|MF)$/.test(primera)) return "MED";

  if (/(CF|SS|FW)$/.test(primera)) return "DEL";

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

  /* ================================================================ */
  /*  EL DETALLE QUE VENÍA EN LA DESCARGA Y SE ESTABA TIRANDO         */
  /* ================================================================ */

  /*
  | 17/09/2026: la descarga de Wyscout trae **115 columnas por jugador** y el
  | lector sólo guardaba las declaradas aquí —49—, así que cuarenta y cuatro se
  | perdían al leer el fichero. Entre ellas, las que contestan preguntas que se
  | hacen a diario: por qué banda centra un lateral, si un medio recibe o pide
  | el balón, si juega corto o largo, y casi todo lo que hace un portero.
  |
  | `COLUMNAS_UTILES` (en `leer.ts`) sale de esta lista, así que añadir aquí es
  | lo único que hace falta para que el dato llegue a las pantallas. Ojo con
  | los rótulos: se copian **tal cual los escribe Wyscout**, con sus espacios
  | de más («Pases recibidos /90») y sus erratas («Precision pases hacia
  | atrás, %», sin tilde). Si se corrigen, la columna deja de encontrarse.
  */

  /* ---------------------------- CIRCULACIÓN ----------------------- */
  {
    columna: "Pases recibidos /90",
    nombre: "Pases recibidos",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Cuántas veces le llega el balón. Junto a «Pases» dice si es un jugador al que se busca o uno que sólo devuelve.",
  },
  {
    columna: "Pases largos recibidos/90",
    nombre: "Pases largos recibidos",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Cuántos de los que recibe llegan en largo: es la señal de a quién se busca por alto.",
  },
  {
    columna: "Pases cortos / medios /90",
    nombre: "Pases cortos y medios",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "El volumen de juego asociado.",
  },
  {
    columna: "Precisión pases cortos / medios, %",
    nombre: "Acierto en corto %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Acertar en corto es el suelo: por debajo del 85 % cuesta sostener una posesión.",
  },
  {
    columna: "Pases largos/90",
    nombre: "Pases largos",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Cuánto cambia de zona. No es bueno ni malo: dice de qué va su juego.",
  },
  {
    columna: "Precisión pases largos, %",
    nombre: "Acierto en largo %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Se lee con el volumen: acertar dos de dos no es tener pase largo.",
  },
  {
    columna: "Longitud media pases, m",
    nombre: "Longitud media de pase",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "En metros. Distingue al que junta del que estira sin pedir permiso.",
  },
  {
    columna: "Pases hacia atrás/90",
    nombre: "Pases hacia atrás",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Ni virtud ni defecto: con «Pases hacia adelante» dice hacia dónde mira.",
  },
  {
    columna: "Pases laterales/90",
    nombre: "Pases laterales",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "El pase que cambia de carril sin avanzar.",
  },

  /* ---------------------------- PROGRESIÓN ------------------------ */
  {
    columna: "Precisión pases hacia adelante, %",
    nombre: "Acierto hacia adelante %",
    grupo: "Progresión",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Lo que cuesta de verdad: acertar el pase que rompe una línea.",
  },
  {
    columna: "Precisión pases en profundidad, %",
    nombre: "Acierto en profundidad %",
    grupo: "Progresión",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "De los pases a la espalda de la defensa, cuántos llegan.",
  },
  {
    columna: "Ataque en profundidad/90",
    nombre: "Ataques a la espalda",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cuántas veces ataca el espacio de detrás de la última línea.",
  },

  /* ----------------------------- CREACIÓN ------------------------- */
  {
    columna: "Second assists/90",
    nombre: "Asistencias de la asistencia",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El pase anterior al del gol: aparece quien participa en la jugada sin firmarla.",
  },
  {
    columna: "Third assists/90",
    nombre: "Dos pases antes del gol",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El pase que arranca la jugada del gol. De los pocos números que premian al que empieza.",
  },
  {
    columna: "Centros al área pequeña/90",
    nombre: "Centros al área pequeña",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El centro que obliga al portero a decidir.",
  },
  {
    columna: "Centros desde el último tercio/90",
    nombre: "Centros desde el último tercio",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Los centros puestos desde cerca, no desde su campo.",
  },
  {
    columna: "Pases hacía el área pequeña, %",
    nombre: "Pases al área pequeña %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Qué parte de lo que mete al área va a la zona donde se marca.",
  },

  /*
  | POR QUÉ BANDA CENTRA.
  |
  | Cuatro columnas que Wyscout ya traía y que aquí valen doble: dicen el lado
  | real de un jugador, no el que figura en la hoja. Un lateral que pone seis
  | centros por noventa minutos desde la izquierda y ninguno desde la derecha
  | es un lateral izquierdo, lo ponga donde lo ponga nadie.
  */
  {
    columna: "Centros desde la banda izquierda/90",
    nombre: "Centros por la izquierda",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Con los de la derecha, dice por qué lado juega de verdad.",
  },
  {
    columna: "Precisión centros desde la banda izquierda, %",
    nombre: "Acierto centrando por la izquierda %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Con pocos centros, un porcentaje alto no significa nada: mírese el volumen.",
  },
  {
    columna: "Centros desde la banda derecha/90",
    nombre: "Centros por la derecha",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Con los de la izquierda, dice por qué lado juega de verdad.",
  },
  {
    columna: "Precisión centros desde la banda derecha, %",
    nombre: "Acierto centrando por la derecha %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Con pocos centros, un porcentaje alto no significa nada: mírese el volumen.",
  },

  /* ------------------------ OCUPACIÓN DEL ÁREA -------------------- */
  {
    columna: "Precisión desmarques, %",
    nombre: "Desmarques acertados %",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "De los desmarques que hace, en cuántos le llega el balón.",
  },

  /* ---------------------------- VALOR GOL ------------------------- */
  {
    columna: "Goles, excepto los penaltis/90",
    nombre: "Goles sin penaltis",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El gol en juego. Es el que compara de verdad a dos delanteros.",
  },
  {
    columna: "Penaltis realizados, %",
    nombre: "Penaltis marcados %",
    grupo: "Valor gol",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Con dos o tres lanzamientos no dice nada; se guarda porque a final de curso sí.",
  },

  /* --------------------------- BALÓN PARADO ----------------------- */
  {
    columna: "Tiros libres directos/90",
    nombre: "Faltas directas lanzadas",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Quién tira las de gol, aparte de las puestas al área.",
  },
  {
    columna: "Tiros libres directos, %",
    nombre: "Faltas directas a portería %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "De las que tira a portería, cuántas van entre los tres palos.",
  },

  /* ----------------------------- PORTERÍA ------------------------- */
  {
    columna: "Remates en contra/90",
    nombre: "Remates recibidos",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    puestos: ["POR"],
    comoLeer:
      "Cuánto le tiran. Dice más del equipo que del portero, y por eso se lee antes que las paradas.",
  },
  {
    columna: "Porterías imbatidas en los 90",
    nombre: "Porterías a cero",
    grupo: "Portería",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    puestos: ["POR"],
    comoLeer: "Las veces que acaba sin encajar, por noventa minutos jugados.",
  },

  /* ---------------------------- DISCIPLINA ------------------------ */
  {
    columna: "Tarjetas rojas/90",
    nombre: "Rojas",
    grupo: "Disciplina",
    fase: "general",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "Con esta muestra, una roja dispara el número: se mira el total, no el ritmo.",
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

/**
 * Y en una temporada cerrada hace falta más.
 *
 * Noventa minutos en septiembre son un partido de tres; noventa minutos en una
 * temporada de treinta y ocho jornadas son un jugador que no jugó. Para
 * comparar contra el año pasado el listón sube a cinco partidos.
 */
export const MINUTOS_MINIMOS_ANTERIOR = 450;

/* ------------------------------------------------------------------ */
/*  CONTRA QUIÉN SE COMPARA                                            */
/* ------------------------------------------------------------------ */

/**
 * Los tres universos de comparación.
 *
 * Hasta ahora sólo se podía comparar a un jugador **con sus compañeros**, que
 * es útil para repartir minutos y no sirve para nada más: quince jugadores no
 * son una referencia de categoría. Con las descargas de toda la liga —esta
 * temporada y la cerrada— se puede contestar a las dos preguntas que de verdad
 * se hacen de un canterano: **¿está al nivel de la categoría?** y **¿ha
 * mejorado respecto al año pasado?**
 */
export type Ambito = "plantilla" | "liga" | "ligaAnterior";

export const AMBITOS: {
  key: Ambito;
  label: string;
  corto: string;
  explica: string;
}[] = [
  {
    key: "plantilla",
    label: "Nuestra plantilla",
    corto: "Plantilla",
    explica:
      "Contra sus compañeros de puesto. Sirve para repartir minutos, no para saber si está al nivel de la categoría.",
  },
  {
    key: "liga",
    label: "La categoría, esta temporada",
    corto: "La liga ahora",
    explica:
      "Contra todos los jugadores de su puesto de la categoría. Es la referencia de verdad, y la que dice si un canterano está para jugar aquí.",
  },
  {
    key: "ligaAnterior",
    label: "La categoría, la temporada pasada",
    corto: "La liga el año pasado",
    explica:
      "El mismo listón pero con la temporada cerrada: muchos más minutos por jugador y por tanto una referencia más firme, aunque sea de otro año.",
  },
];

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
  /** Con quién se ha podido comparar de verdad. */
  contra: "puesto" | "campo" | "solo";
  ambito: Ambito;
};

/** Sólo los nuestros, que es la plantilla de esta temporada. */
export const NUESTRO_EQUIPO = "Real Madrid Castilla";

export const esNuestro = (jugador: FilaJugador) =>
  jugador.equipo.toLowerCase().includes("madrid castilla");

/** El universo de un ámbito, ya filtrado por minutos. */
export function universoDe(jugadores: FilaJugador[], ambito: Ambito) {
  if (ambito === "ligaAnterior") {
    return jugadores.filter(
      (j) => j.temporada === "anterior" && j.minutos >= MINUTOS_MINIMOS_ANTERIOR,
    );
  }

  const deAhora = jugadores.filter(
    (j) => j.temporada === "actual" && j.minutos >= MINUTOS_MINIMOS,
  );

  return ambito === "plantilla" ? deAhora.filter(esNuestro) : deAhora;
}

export function comparablesDe(
  jugadores: FilaJugador[],
  puesto: Puesto,
  ambito: Ambito = "plantilla",
): Comparacion {
  const universo = universoDe(jugadores, ambito);

  const delPuesto = universo.filter((j) => puestoDe(j.posicion) === puesto);

  if (delPuesto.length >= 3) {
    return { lista: delPuesto, contra: "puesto", ambito };
  }

  if (puesto === "POR") return { lista: delPuesto, contra: "solo", ambito };

  const deCampo = universo.filter((j) => puestoDe(j.posicion) !== "POR");

  return deCampo.length >= 3
    ? { lista: deCampo, contra: "campo", ambito }
    : { lista: deCampo, contra: "solo", ambito };
}

/** Las métricas que le dicen algo a un puesto. */
export const metricasDe = (puesto: Puesto) =>
  METRICAS_JUGADOR.filter((m) => !m.puestos || m.puestos.includes(puesto));

/* ------------------------------------------------------------------ */
/*  UN PORCENTAJE DE UNA ACCIÓN NO ES UN PORCENTAJE                    */
/* ------------------------------------------------------------------ */

/**
 * DE CUÁNTAS ACCIONES SALE CADA PORCENTAJE, Y CUÁNTAS HACEN FALTA.
 *
 * Mario Rivas, central, salía con «lo que más destaca: acierto de centro,
 * 100 %, percentil 97». Es verdad y no significa nada: puso **un** centro en
 * tres partidos y le salió. Con la mitad de las métricas nuevas siendo
 * porcentajes, esto pasaba de ser un caso raro a ser la norma de la ficha.
 *
 * Así que un porcentaje sólo entra en las listas de fortalezas y flaquezas —y
 * sólo se pinta con su percentil— si **el volumen del que sale llega a un
 * mínimo por noventa minutos**. Debajo de eso se sigue enseñando la cifra, sin
 * barra y diciendo de cuántas acciones sale: esconderla sería peor.
 *
 * Los mínimos son bajos a propósito: no se trata de exigir una muestra
 * estadística —con tres partidos no la hay de nada— sino de tumbar el «100 %
 * de uno».
 */
export const VOLUMEN_DEL_PORCENTAJE: Record<
  string,
  { columna: string; minimo: number }
> = {
  "Precisión pases, %": { columna: "Pases/90", minimo: 10 },
  "Precisión pases cortos / medios, %": { columna: "Pases cortos / medios /90", minimo: 8 },
  "Precisión pases largos, %": { columna: "Pases largos/90", minimo: 2 },
  "Precisión pases hacia adelante, %": { columna: "Pases hacia adelante/90", minimo: 3 },
  "Precision pases hacia atrás, %": { columna: "Pases hacia atrás/90", minimo: 3 },
  "Precisión pases laterales, %": { columna: "Pases laterales/90", minimo: 3 },
  "Precisión pases progresivos, %": { columna: "Pases progresivos/90", minimo: 2 },
  "Precisión pases en el último tercio, %": { columna: "Pases en el último tercio/90", minimo: 2 },
  "Precisión pases en profundidad, %": { columna: "Pases en profundidad/90", minimo: 1 },
  "Pases hacía el área pequeña, %": { columna: "Pases al área de penalti/90", minimo: 1 },
  "Precisión centros, %": { columna: "Centros/90", minimo: 1 },
  "Precisión centros desde la banda izquierda, %": {
    columna: "Centros desde la banda izquierda/90",
    minimo: 1,
  },
  "Precisión centros desde la banda derecha, %": {
    columna: "Centros desde la banda derecha/90",
    minimo: 1,
  },
  "Regates realizados, %": { columna: "Regates/90", minimo: 1 },
  "Precisión desmarques, %": { columna: "Desmarques/90", minimo: 1 },
  "Duelos defensivos ganados, %": { columna: "Duelos defensivos/90", minimo: 2 },
  "Duelos atacantes ganados, %": { columna: "Duelos atacantes/90", minimo: 2 },
  "Duelos aéreos ganados, %": { columna: "Duelos aéreos en los 90", minimo: 1 },
  "Tiros a la portería, %": { columna: "Remates/90", minimo: 1 },
  "Goles hechos, %": { columna: "Remates/90", minimo: 1 },
  "Tiros libres directos, %": { columna: "Tiros libres directos/90", minimo: 0.5 },
  "Paradas, %": { columna: "Remates en contra/90", minimo: 1 },
};

/**
 * Si el porcentaje de un jugador sale de acciones suficientes.
 *
 * Devuelve también de cuántas sale, para poder decirlo en pantalla. Una
 * métrica que no sea porcentaje —o de la que no se sepa el volumen— se da por
 * buena: lo que se persigue aquí es el «100 % de uno», no todo lo demás.
 */
export function volumenDelPorcentaje(jugador: FilaJugador, columna: string) {
  const regla = VOLUMEN_DEL_PORCENTAJE[columna];

  if (!regla) return { fiable: true, cuantas: null as number | null, regla: null };

  const cuantas = valorDe(jugador, regla.columna);

  return {
    fiable: cuantas !== null && cuantas >= regla.minimo,
    cuantas,
    regla,
  };
}

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
    /* Un porcentaje de una acción no encabeza nada: ver `VOLUMEN_DEL_PORCENTAJE`. */
    .filter((m) => volumenDelPorcentaje(jugador, m.columna).fiable)
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

  /*
  | Con pocas métricas, «las cuatro mejores» y «las cuatro peores» son las
  | mismas cuatro puestas del revés, y la ficha enseñaría el mismo dato en las
  | dos columnas. Se parte por la mitad cuando no llegan a ocho.
  */
  const cuantas = Math.min(4, Math.floor(orden.length / 2));

  return {
    fuertes: orden.slice(0, cuantas),
    flojos: cuantas === 0 ? [] : orden.slice(-cuantas).reverse(),
    todas: filas,
  };
}

/* ------------------------------------------------------------------ */
/*  ¿HA MEJORADO?                                                      */
/* ------------------------------------------------------------------ */

/**
 * El mismo jugador, un año después.
 *
 * Es la comparación más difícil de hacer a ojo y la más fácil de hacer mal:
 * mirar el número de este año contra el del año pasado no dice nada, porque
 * puede haber cambiado la liga, el equipo o el rol. Lo que sí compara es **el
 * percentil contra su categoría de cada año**: si el año pasado estaba en el
 * 40 de los medios de la liga y hoy está en el 70, ha mejorado respecto a sus
 * iguales, no respecto a sí mismo.
 *
 * Dieciséis de los diecinueve que han jugado esta temporada jugaron la pasada
 * en el Castilla, así que la comparación es del mismo jugador, no de un
 * parecido.
 */
export type Evolucion = {
  metrica: MetricaJugador;
  antes: number;
  ahora: number;
  percentilAntes: number;
  percentilAhora: number;
  /** Puntos de percentil ganados o perdidos. */
  salto: number;
};

/** Busca al mismo jugador en la temporada cerrada. */
export function elMismoElAnoPasado(
  jugador: FilaJugador,
  jugadores: FilaJugador[],
) {
  const suyo = jugador.jugador.trim().toLowerCase();

  return (
    jugadores.find(
      (j) => j.temporada === "anterior" && j.jugador.trim().toLowerCase() === suyo,
    ) ?? null
  );
}

export function evolucionDe(
  jugador: FilaJugador,
  jugadores: FilaJugador[],
): { antes: FilaJugador | null; filas: Evolucion[]; fiable: boolean } {
  const antes = elMismoElAnoPasado(jugador, jugadores);

  if (!antes) return { antes: null, filas: [], fiable: false };

  /*
  | Que exista el año pasado no basta.
  |
  | Lezcano jugó sesenta y seis minutos y Rezola setenta y seis: su percentil
  | de entonces sale de una muestra de un partido, así que el «salto» contra
  | este año es ruido con pinta de progreso. Se calcula igual —sirve para
  | mirarlo— pero se marca, y los avisos automáticos no lo usan.
  */
  const fiable = antes.minutos >= MINUTOS_MINIMOS_ANTERIOR;

  const puesto = puestoDe(jugador.posicion);

  /* Cada año contra su propia categoría: es lo único comparable. */
  const ahoraContra = comparablesDe(jugadores, puesto, "liga");
  const antesContra = comparablesDe(jugadores, puesto, "ligaAnterior");

  if (ahoraContra.contra === "solo" || antesContra.contra === "solo") {
    return { antes, filas: [], fiable };
  }

  const filas: Evolucion[] = [];

  for (const metrica of metricasDe(puesto)) {
    if (metrica.mejorAlto === null) continue;

    const valorAhora = valorDe(jugador, metrica.columna);
    const valorAntes = valorDe(antes, metrica.columna);

    if (valorAhora === null || valorAntes === null) continue;

    const percentilAhora = percentilEnPlantilla(
      valorAhora,
      ahoraContra.lista
        .map((c) => valorDe(c, metrica.columna))
        .filter((v): v is number => v !== null),
      metrica.mejorAlto,
    );

    const percentilAntes = percentilEnPlantilla(
      valorAntes,
      antesContra.lista
        .map((c) => valorDe(c, metrica.columna))
        .filter((v): v is number => v !== null),
      metrica.mejorAlto,
    );

    if (percentilAhora === null || percentilAntes === null) continue;

    filas.push({
      metrica,
      antes: valorAntes,
      ahora: valorAhora,
      percentilAntes,
      percentilAhora,
      salto: percentilAhora - percentilAntes,
    });
  }

  return { antes, fiable, filas: filas.sort((a, b) => b.salto - a.salto) };
}
