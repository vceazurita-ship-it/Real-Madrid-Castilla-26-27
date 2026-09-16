import type { FilaPartido } from "./leer";

/**
 * Qué significa cada cifra, y cuáles se calculan.
 *
 * Wyscout baja ciento tres columnas por partido. Ninguna de ellas contesta sola
 * a lo que pregunta un entrenador —«¿cuánto nos cuesta crear una ocasión?»,
 * «¿aceleramos o damos vueltas?»— porque esas preguntas son **cocientes** entre
 * dos columnas. Aquí viven las dos cosas:
 *
 * - el rótulo, la unidad y **cómo se lee** cada métrica, que es lo que separa
 *   un número de un dato;
 * - y su cálculo, cuando no viene dado.
 *
 * Tres decisiones que cambian todo lo de arriba:
 *
 * 1. **`mejorAlto` no es decorativo.** Sin él no se puede pintar «bien» o «mal»:
 *    en PPDA, pérdidas y goles recibidos, menos es mejor. Todo el color de la
 *    pantalla sale de este campo, no de si el número sube o baja.
 * 2. **Un cociente no se promedia, se recalcula.** La media de los porcentajes
 *    de acierto de diez partidos no es el porcentaje de acierto de los diez:
 *    hay que sumar arriba, sumar abajo y dividir. Por eso una métrica calculada
 *    declara `numerador` y `denominador` en vez de una función suelta.
 * 3. **Lo que no está, no se inventa.** Faltas por zona del campo y segundas
 *    jugadas no vienen en el informe; se dice en pantalla en vez de rellenarlo
 *    con un primo lejano.
 */

export type Unidad = "entero" | "decimal" | "porcentaje" | "minutos";

/**
 * En qué fase del juego se mide.
 *
 * Es la división con la que se habla en la caseta —«con balón hacemos esto, sin
 * balón lo otro»— y no coincide con los grupos temáticos: los duelos ofensivos
 * son con balón y los defensivos sin él, aunque las dos vivan en «Duelos».
 * `general` es lo que no es de una fase: el resultado y la posesión.
 */
export type Fase = "con" | "sin" | "abp" | "general";

export const FASES: { key: Fase; label: string; pregunta: string }[] = [
  {
    key: "con",
    label: "Con balón",
    pregunta: "Qué hacemos cuando lo tenemos: crear, progresar, ocupar el área",
  },
  {
    key: "sin",
    label: "Sin balón",
    pregunta: "Qué hacemos cuando no lo tenemos: presionar, robar, defender",
  },
  {
    key: "abp",
    label: "Balón parado",
    pregunta: "Córners, faltas y penaltis: a favor y en contra",
  },
  {
    key: "general",
    label: "Resultado",
    pregunta: "Lo que queda al final, y el plan de partido",
  },
];

export type Metrica = {
  key: string;
  nombre: string;
  grupo: string;
  fase: Fase;
  unidad: Unidad;
  /** Si un valor alto es bueno. `null` cuando no hay «bueno»: es un estilo. */
  mejorAlto: boolean | null;
  /** Qué mide y, sobre todo, qué se hace con ello. */
  comoLeer: string;
  /** Columna de Wyscout, cuando la métrica viene dada. */
  columna?: string;
  /** Para los cocientes: se suman los dos lados y luego se divide. */
  numerador?: string;
  denominador?: string;
  /** Multiplica el cociente (100 para un porcentaje). */
  factor?: number;
  /**
   * Si sumar sus valores da algo que signifique alguna cosa.
   *
   * Es lo que separa «19 córners en tres partidos» —que se entiende— de «PPDA
   * 25,5», que no es nada. Sólo lo llevan los **conteos**: lo que se cuenta una
   * vez por acción y se puede acumular.
   *
   * **No lo lleva, y no es un olvido:** los porcentajes y los cocientes (un
   * `numerador`/`denominador` se recalcula, nunca se suma) y —la trampa— cinco
   * columnas que Wyscout ya entrega promediadas: PPDA, distancia media de tiro,
   * longitud media de pase, pases por posesión e intensidad de paso. Ésas
   * vienen con `columna` como cualquier conteo, así que sin esta marca el
   * conmutador de «total» las habría multiplicado por los partidos jugados y
   * habría enseñado un PPDA de 25 con toda naturalidad.
   *
   * Al no ponerlo, una métrica se queda en promedio, que es como estaba todo
   * antes de que esto existiera: olvidarse no puede romper una cifra.
   */
  acumulable?: boolean;
};

/** Ver los datos por partido o sumados. */
export type ModoValor = "promedio" | "total";

/* ------------------------------------------------------------------ */
/*  EL CATÁLOGO                                                        */
/* ------------------------------------------------------------------ */

export const GRUPOS = [
  "Resultado",
  "Valor gol",
  "Creación",
  "Ocupación del área",
  "Balón parado",
  "Circulación",
  "Progresión",
  "Duelos",
  "Presión y transición",
  "Defensa",
  "Disciplina",
] as const;

export const METRICAS: Metrica[] = [
  /* -------------------------- RESULTADO -------------------------- */
  {
    key: "goles",
    acumulable: true,
    nombre: "Goles",
    grupo: "Resultado",
    fase: "general",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Lo único que cuenta al final. Se compara con el xG para saber si el resultado se sostiene.",
    columna: "Goles",
  },
  {
    key: "golesContra",
    acumulable: true,
    nombre: "Goles recibidos",
    grupo: "Resultado",
    fase: "general",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "Igual que los goles, por el otro lado. Mírese junto a los tiros en contra: encajar poco recibiendo mucho es suerte, no solidez.",
    columna: "Goles recibidos",
  },
  {
    key: "posesion",
    nombre: "Posesión",
    grupo: "Resultado",
    fase: "general",
    unidad: "porcentaje",
    mejorAlto: null,
    comoLeer: "Cuánto tiempo se tiene el balón. No es buena ni mala por sí misma: dice el plan, no el rendimiento.",
    columna: "Posesión del balón, %",
  },

  /* -------------------------- VALOR GOL -------------------------- */
  {
    key: "xg",
    acumulable: true,
    nombre: "xG a favor",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Los goles que valían las ocasiones creadas. Es la medida honesta de cuánto se generó, al margen de si entró.",
    columna: "xG",
  },
  {
    key: "golesMenosXg",
    nombre: "Goles − xG",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer: "Lo que se marcó por encima de lo que valían las ocasiones. Positivo sostenido es un delantero fino; positivo puntual, una racha que se corregirá sola.",
    numerador: "@goles-xg",
    denominador: "@partidos",
  },
  {
    key: "xgPorTiro",
    nombre: "xG por remate",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "La calidad media de cada remate. Sube ocupando el área y llegando limpio; baja disparando de lejos por no encontrar otra cosa.",
    numerador: "xG",
    denominador: "Tiros",
  },
  {
    key: "tiros",
    acumulable: true,
    nombre: "Remates",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "Cuántas veces se termina la jugada. Mucho volumen con poco xG por remate es ruido.",
    columna: "Tiros",
  },
  {
    key: "tirosPuerta",
    nombre: "Remates a portería %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Tiros · a la portería",
    denominador: "Tiros",
    factor: 100,
    comoLeer: "De cada diez remates, cuántos van entre los tres palos. Mide la ejecución, no la creación.",
  },
  {
    key: "distanciaTiro",
    nombre: "Distancia media de remate",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "Metros a los que se dispara de media. Cuanto más lejos, peor ocasión: es la traducción física del xG por remate.",
    columna: "Distancia media de tiro",
  },
  {
    key: "tirosFuera",
    nombre: "Remates desde fuera del área %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: false,
    numerador: "Tiros de fuera del área",
    denominador: "Tiros",
    factor: 100,
    comoLeer: "Qué parte del volumen se dispara desde lejos. Un número alto suele significar que no se entra al área, no que se tenga buen tiro.",
  },

  /* --------------------------- CREACIÓN -------------------------- */
  {
    key: "pasesPorOcasion",
    nombre: "Pases por ocasión",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: false,
    numerador: "Pases",
    denominador: "Tiros",
    comoLeer: "Cuántos pases cuesta llegar a un remate. Es el precio de cada ocasión: bajarlo es llegar antes, subirlo es dar vueltas.",
  },
  {
    key: "minutosPorOcasion",
    nombre: "Minutos con balón por ocasión",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: false,
    numerador: "@minutos-balon",
    denominador: "Tiros",
    comoLeer: "Los minutos que hay que tener el balón para generar un remate. Dice lo mismo que los pases por ocasión pero en tiempo, que es como se vive en el campo.",
  },
  {
    key: "xgPorAtaque",
    nombre: "xG por ataque",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    numerador: "xG",
    denominador: "@ataques",
    comoLeer: "Cuánto peligro produce cada ataque, sumando los posicionales y los contraataques. Es la medida limpia de si atacar sirve de algo.",
  },
  {
    key: "ataquesPos",
    acumulable: true,
    nombre: "Ataques posicionales",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Ataques posicionales",
    comoLeer: "Ataques con el rival colocado. Su volumen dice cuánto se juega contra bloque formado.",
  },
  {
    key: "ataquesPosRemate",
    nombre: "Ataques posicionales con remate %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Ataques posicionales · con remate",
    denominador: "Ataques posicionales",
    factor: 100,
    comoLeer: "De cada diez ataques contra bloque formado, cuántos acaban en remate. Es el rendimiento del juego elaborado.",
  },
  {
    key: "contras",
    acumulable: true,
    nombre: "Contraataques",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Contraataques",
    comoLeer: "Cuántas veces se acelera al recuperar. Junto a los ataques posicionales dibuja de qué vive el equipo.",
  },
  {
    key: "contrasRemate",
    nombre: "Contraataques con remate %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Contraataques · con remate",
    denominador: "Contraataques",
    factor: 100,
    comoLeer: "Cuántas de esas aceleraciones terminan en remate. Acelerar mucho y rematar poco es correr por correr.",
  },
  {
    key: "abp",
    nombre: "Jugadas a balón parado",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Jugadas a balón parado",
    comoLeer: "Volumen de estrategia. Se cruza con el porcentaje que acaba en remate para saber si la ABP renta.",
  },
  {
    key: "abpRemate",
    nombre: "ABP con remate %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Jugadas a balón parado · con remate",
    denominador: "Jugadas a balón parado",
    factor: 100,
    comoLeer: "Qué parte de la estrategia acaba en remate. Es lo que justifica el tiempo de entrenamiento que se le dedica.",
  },
  {
    key: "corners",
    acumulable: true,
    nombre: "Córners",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Córneres",
    comoLeer: "Cuántos se saca por partido. Sin volumen no hay estrategia que rente, por bien entrenada que esté.",
  },
  {
    key: "cornersRemate",
    nombre: "Córners con remate %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Córneres · con remate",
    denominador: "Córneres",
    factor: 100,
    comoLeer: "De cada diez córners, cuántos acaban en remate. Es la nota del ensayo: el volumen lo pone el partido, esto lo pone el entrenamiento.",
  },
  {
    key: "faltasTiro",
    acumulable: true,
    nombre: "Faltas lanzadas",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Tiros libres",
    comoLeer: "Faltas a favor que se lanzan. Depende tanto de cómo defiende el rival como de lo que se provoque.",
  },
  {
    key: "faltasRemate",
    nombre: "Faltas con remate %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Tiros libres · con remate",
    denominador: "Tiros libres",
    factor: 100,
    comoLeer: "Cuántas faltas acaban en remate. Incluye las que se ponen al área, no sólo las que se tiran a puerta.",
  },
  {
    key: "penaltis",
    acumulable: true,
    nombre: "Penaltis",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Penaltis",
    comoLeer: "Los que se consiguen. En muestras cortas es ruido: dos penaltis cambian una temporada de un delantero.",
  },
  {
    key: "cuotaRematesAbp",
    nombre: "Remates que nacen de ABP %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: null,
    numerador: "Jugadas a balón parado · con remate",
    denominador: "Tiros",
    factor: 100,
    comoLeer: "De todo lo que se remata, qué parte sale de una jugada parada. Alto puede ser una virtud —se ensaya y renta— o un aviso: que en juego no se llega.",
  },
  {
    key: "centros",
    acumulable: true,
    nombre: "Centros laterales",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Centros",
    comoLeer: "Cuántos balones se meten al área desde banda. Es un estilo: alto con poca ocupación de área es regalar el balón.",
  },
  {
    key: "centrosPrecisos",
    nombre: "Centros precisos %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Centros · precisos",
    denominador: "Centros",
    factor: 100,
    comoLeer: "De cada diez centros, cuántos encuentran a alguien. Por debajo del 25 % el centro es una pérdida disfrazada.",
  },

  /* --------------------- OCUPACIÓN DEL ÁREA ---------------------- */
  {
    key: "toquesArea",
    acumulable: true,
    nombre: "Toques en el área",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Toques en el área de penalti",
    comoLeer: "Cuántas veces se toca el balón dentro del área rival. Es lo más cerca que llega el informe a «cuánta gente ocupa el área»: sin gente dentro, no hay toques.",
  },
  {
    key: "entradasArea",
    acumulable: true,
    nombre: "Entradas al área (conducción)",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Entradas al área de penalti · carreras",
    comoLeer: "Cuántas veces se entra al área con el balón en los pies. Es el último tercio ganado por dentro.",
  },
  {
    key: "entradasAreaPase",
    acumulable: true,
    nombre: "Entradas al área (pase)",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Entradas al área de penalti · pases cruzados",
    comoLeer: "Las que se entran con un pase. Comparada con la anterior dice si el equipo entra conduciendo o filtrando.",
  },
  {
    key: "toquesPorEntrada",
    nombre: "Toques por entrada al área",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    numerador: "Toques en el área de penalti",
    denominador: "@entradas-area",
    comoLeer: "Cuánto se juega dentro del área cada vez que se entra. Bajo significa entrar y perderla; alto, que hay gente para seguir la jugada.",
  },
  {
    key: "pasesUltimoTercio",
    acumulable: true,
    nombre: "Pases en el último tercio",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Pases en el último tercio",
    comoLeer: "Volumen de juego en el tercio de ataque. Sin esto, la posesión se queda en el centro del campo.",
  },
  {
    key: "cuotaUltimoTercio",
    nombre: "Juego en el último tercio %",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Pases en el último tercio",
    denominador: "Pases",
    factor: 100,
    comoLeer: "Qué parte de todo el pase del equipo ocurre en el último tercio. Es **dónde** se juega, no cuánto.",
  },

  /* ------------------------- CIRCULACIÓN ------------------------- */
  {
    key: "pases",
    acumulable: true,
    nombre: "Pases",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Pases",
    comoLeer: "El volumen de circulación. Contexto para todo lo demás, no una virtud.",
  },
  {
    key: "pasesPrecisos",
    nombre: "Precisión de pase %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Pases · logrados",
    denominador: "Pases",
    factor: 100,
    comoLeer: "Acierto general. Muy alto con poco juego en el último tercio es circular en horizontal sin riesgo.",
  },
  {
    key: "longitudPase",
    nombre: "Distancia media de pase",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Longitud media pases",
    comoLeer: "Los metros que recorre el pase medio: la distancia de relación entre jugadores. Corta es juego asociativo; larga, juego directo.",
  },
  {
    key: "pasesPorPosesion",
    nombre: "Pases por posesión",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Promedio pases por posesión del balón",
    comoLeer: "Cuánto dura una posesión en pases. Es la medida directa de si el equipo elabora o va directo.",
  },
  {
    key: "intensidadPase",
    nombre: "Intensidad de pase",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Intensidad de paso",
    comoLeer: "Ritmo al que se toca el balón. Junto a los pases por posesión separa al que toca rápido del que toca mucho.",
  },
  {
    key: "pasesLaterales",
    acumulable: true,
    nombre: "Pases horizontales",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Pases laterales",
    comoLeer: "Cuántos pases van en horizontal. Por sí solos no dicen nada: hay que mirarlos como proporción del total.",
  },
  {
    key: "cuotaLaterales",
    nombre: "Juego horizontal %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: false,
    numerador: "Pases laterales",
    denominador: "Pases",
    factor: 100,
    comoLeer: "Qué parte de la circulación va de lado. Alto sostenido es un equipo que mueve el balón sin moverse hacia la portería.",
  },
  {
    key: "pasesLargos",
    nombre: "Juego largo %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: null,
    columna: "Lanzamiento largo %",
    comoLeer: "Qué parte del juego se manda en largo. Es estilo, salvo que suba sólo cuando aprieta el rival: entonces es huida.",
  },

  /* -------------------------- PROGRESIÓN ------------------------- */
  {
    key: "pasesProgresivos",
    acumulable: true,
    nombre: "Pases progresivos",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Pases progresivos",
    comoLeer: "Los pases que de verdad acercan el balón a la portería rival. La cifra que separa circular de progresar.",
  },
  {
    key: "cuotaProgresivos",
    nombre: "Pases progresivos %",
    grupo: "Progresión",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Pases progresivos",
    denominador: "Pases",
    factor: 100,
    comoLeer: "Qué parte de la circulación progresa. Cruzado con el juego horizontal dice hacia dónde mira el equipo.",
  },
  {
    key: "progresivosPrecisos",
    nombre: "Progresivos acertados %",
    grupo: "Progresión",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Pases progresivos · precisos",
    denominador: "Pases progresivos",
    factor: 100,
    comoLeer: "Cuántos de esos pases llegan. Intentar mucho y acertar poco regala transiciones al rival.",
  },
  {
    key: "pasesProfundidad",
    acumulable: true,
    nombre: "Pases en profundidad",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Pases en profundidad completados",
    comoLeer: "Los que rompen líneas hacia dentro. Pocos y con mucha posesión es un equipo al que le falta la puñalada.",
  },
  {
    key: "desmarques",
    acumulable: true,
    nombre: "Desmarques",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Desmarques",
    comoLeer: "Movimientos para recibir a la espalda. Sin ellos no hay a quién dar el pase en profundidad.",
  },

  /* ---------------------------- DUELOS --------------------------- */
  {
    key: "duelos",
    acumulable: true,
    nombre: "Duelos",
    grupo: "Duelos",
    fase: "general",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Duelos",
    comoLeer: "Cuántos duelos se juegan. Muchos duelos es un partido roto; pocos, un partido controlado por alguien.",
  },
  {
    key: "duelosGanados",
    nombre: "Duelos ganados %",
    grupo: "Duelos",
    fase: "general",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Duelos · ganados",
    denominador: "Duelos",
    factor: 100,
    comoLeer: "El reparto global. Por definición la liga entera está en el 50 %: lo que importa es de cuánto se separa uno.",
  },
  {
    key: "duelosOfensivos",
    nombre: "Duelos ofensivos ganados %",
    grupo: "Duelos",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Duelos ofensivos · ganados",
    denominador: "Duelos ofensivos",
    factor: 100,
    comoLeer: "Los que se ganan atacando, en campo rival. Es el uno contra uno de los de arriba.",
  },
  {
    key: "duelosDefensivos",
    nombre: "Duelos defensivos ganados %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Duelos defensivos · ganados",
    denominador: "Duelos defensivos",
    factor: 100,
    comoLeer: "Los que se ganan defendiendo, en campo propio. Con los ofensivos al lado dice en qué mitad se gana el partido.",
  },
  {
    key: "duelosAereos",
    nombre: "Duelos aéreos ganados %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Duelos aéreos · ganados",
    denominador: "Duelos aéreos",
    factor: 100,
    comoLeer: "El juego aéreo. Es lo más cerca que llega el informe a las segundas jugadas: quien gana arriba suele quedarse el rechace.",
  },

  /* ------------------ PRESIÓN Y TRANSICIÓN ----------------------- */
  {
    key: "ppda",
    nombre: "PPDA",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    columna: "PPDA",
    comoLeer: "Pases que se le permiten al rival por cada acción defensiva. Cuanto más bajo, más arriba y más pronto se presiona.",
  },
  {
    key: "recuperaciones",
    acumulable: true,
    nombre: "Recuperaciones",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Balones recuperados",
    comoLeer: "Cuántas veces se roba. El volumen dice poco sin saber dónde.",
  },
  {
    key: "recuperacionesAltas",
    nombre: "Recuperaciones altas %",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Balones recuperados · altos",
    denominador: "Balones recuperados",
    factor: 100,
    comoLeer: "Qué parte de los robos ocurre arriba. Es el **dónde** que le falta a la cifra de recuperaciones, y lo que de verdad mide una presión alta.",
  },
  {
    key: "perdidas",
    acumulable: true,
    nombre: "Pérdidas",
    grupo: "Presión y transición",
    fase: "con",
    unidad: "decimal",
    mejorAlto: false,
    columna: "Balones perdidos",
    comoLeer: "Cuántas veces se entrega el balón. Como con los robos, manda la zona.",
  },
  {
    key: "perdidasBajas",
    nombre: "Pérdidas en campo propio %",
    grupo: "Presión y transición",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: false,
    numerador: "Balones perdidos · bajos",
    denominador: "Balones perdidos",
    factor: 100,
    comoLeer: "Qué parte de las pérdidas ocurre atrás. Son las caras: cada una es una transición del rival cerca del área propia.",
  },

  /* ---------------------------- DEFENSA -------------------------- */
  {
    key: "tirosContra",
    acumulable: true,
    nombre: "Remates en contra",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    columna: "Tiros en contra",
    comoLeer: "Cuánto remata el rival. Es la medida más directa de si la defensa sostiene.",
  },
  {
    key: "tirosContraPuerta",
    nombre: "Remates en contra a portería %",
    grupo: "Defensa",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: false,
    numerador: "Tiros en contra · a la portería",
    denominador: "Tiros en contra",
    factor: 100,
    comoLeer: "De lo que remata el rival, cuánto va a puerta. Alto significa que además rematan cómodos.",
  },
  {
    key: "interceptaciones",
    acumulable: true,
    nombre: "Interceptaciones",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    columna: "Interceptaciones",
    comoLeer: "Balones cortados por lectura, sin duelo. Va con la posición, no con el físico.",
  },
  {
    key: "despejes",
    acumulable: true,
    nombre: "Despejes",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Despejes",
    comoLeer: "Balones alejados sin control. Muchos es defender dentro del área: no es bueno ni malo, es dónde se defiende.",
  },
  {
    key: "entradas",
    nombre: "Entradas logradas %",
    grupo: "Defensa",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    numerador: "Entradas a ras de suelo · logradas",
    denominador: "Entradas a ras de suelo",
    factor: 100,
    comoLeer: "De cada diez entradas al suelo, cuántas salen. Fallarlas deja al equipo en inferioridad detrás del balón.",
  },

  /* -------------------------- DISCIPLINA ------------------------- */
  {
    key: "faltas",
    acumulable: true,
    nombre: "Faltas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    columna: "Faltas",
    comoLeer: "Faltas cometidas. Muchas con PPDA bajo es la factura de presionar; muchas con PPDA alto es llegar tarde.",
  },
  {
    key: "amarillas",
    acumulable: true,
    nombre: "Tarjetas amarillas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    columna: "Tarjetas amarillas",
    comoLeer: "Amonestaciones por partido. Con el calendario al lado avisa de las sanciones antes de que lleguen.",
  },
  {
    key: "rojas",
    acumulable: true,
    nombre: "Tarjetas rojas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    columna: "Tarjetas rojas",
    comoLeer: "Expulsiones por partido. Con tres jornadas una sola lo tiñe todo: se mira el número, no el promedio.",
  },
  {
    key: "faltasPorAmarilla",
    nombre: "Faltas por amarilla",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    /*
    | Cuantas más faltas caben en cada amarilla, más barata sale la falta: o se
    | hacen en sitios que el árbitro no castiga, o se reparten entre muchos. Es
    | la medida del «uso» de la falta, que no es lo mismo que hacer pocas.
    */
    mejorAlto: true,
    numerador: "Faltas",
    denominador: "Tarjetas amarillas",
    factor: 1,
    comoLeer: "Cuántas faltas cuesta cada amonestación. Alto es infringir sin acumular tarjetas; bajo es que cada falta se paga.",
  },
];

export const METRICA_POR_KEY = new Map(METRICAS.map((m) => [m.key, m]));


/* ------------------------------------------------------------------ */
/*  CÁLCULO                                                            */
/* ------------------------------------------------------------------ */

/** Los agregados con `@` se calculan a partir de la fila, no de una columna. */
function derivado(clave: string, fila: FilaPartido): number | null {
  const d = fila.datos;

  if (clave === "@partidos") return 1;

  if (clave === "@goles-xg") {
    const xg = d["xG"];

    return xg === undefined ? null : fila.golesFavor - xg;
  }

  if (clave === "@minutos-balon") {
    const pos = d["Posesión del balón, %"];

    if (pos === undefined || !fila.duracion) return null;

    return (fila.duracion * pos) / 100;
  }

  if (clave === "@ataques") {
    const a = d["Ataques posicionales"];
    const c = d["Contraataques"];

    if (a === undefined && c === undefined) return null;

    return (a ?? 0) + (c ?? 0);
  }

  if (clave === "@entradas-area") {
    const carrera = d["Entradas al área de penalti · carreras"];
    const pase = d["Entradas al área de penalti · pases cruzados"];

    if (carrera === undefined && pase === undefined) return null;

    return (carrera ?? 0) + (pase ?? 0);
  }

  return null;
}

const valorDe = (clave: string, fila: FilaPartido) =>
  clave.startsWith("@") ? derivado(clave, fila) : (fila.datos[clave] ?? null);

/** El valor de una métrica en **un** partido. */
export function valorEnPartido(metrica: Metrica, fila: FilaPartido) {
  if (metrica.columna) {
    if (metrica.columna === "Goles") return fila.golesFavor;
    if (metrica.columna === "Goles recibidos") return fila.golesContra;

    return fila.datos[metrica.columna] ?? null;
  }

  if (!metrica.numerador || !metrica.denominador) return null;

  const arriba = valorDe(metrica.numerador, fila);
  const abajo = valorDe(metrica.denominador, fila);

  if (arriba === null || abajo === null || abajo === 0) return null;

  return (arriba / abajo) * (metrica.factor ?? 1);
}

/**
 * El valor de una métrica en **un grupo** de partidos.
 *
 * Un cociente se recalcula sumando los dos lados; una columna directa se
 * promedia por partido. Promediar los cocientes partido a partido daría más
 * peso a un partido de cinco remates que a otro de veinte.
 *
 * `modo` decide si una columna directa se promedia o se suma, y por aquí pasa
 * **toda** la aplicación —las tablas, los gráficos, la portada, las alertas y
 * la API—, así que el conmutador de la pantalla se nota en todas partes sin
 * tocar ni un componente de pintado. Sólo obedecen las métricas `acumulable`:
 * un porcentaje o un PPDA se promedian siempre, se pida lo que se pida.
 */
export function valorEnGrupo(
  metrica: Metrica,
  filas: FilaPartido[],
  modo: ModoValor = "promedio",
) {
  if (filas.length === 0) return null;

  if (metrica.columna) {
    const valores = filas
      .map((fila) => valorEnPartido(metrica, fila))
      .filter((v): v is number => v !== null);

    if (valores.length === 0) return null;

    const suma = valores.reduce((a, b) => a + b, 0);

    /* Sumar lo que no es un conteo no significa nada: ver `acumulable`. */
    if (modo === "total" && metrica.acumulable) return suma;

    /* Los porcentajes que vienen dados ya son medias: se promedian. */
    return suma / valores.length;
  }

  if (!metrica.numerador || !metrica.denominador) return null;

  let arriba = 0;
  let abajo = 0;
  let hay = false;

  for (const fila of filas) {
    const a = valorDe(metrica.numerador, fila);
    const b = valorDe(metrica.denominador, fila);

    if (a === null || b === null) continue;

    arriba += a;
    abajo += b;
    hay = true;
  }

  if (!hay || abajo === 0) return null;

  return (arriba / abajo) * (metrica.factor ?? 1);
}

/* ------------------------------------------------------------------ */
/*  TEMPORADAS Y FORMATO                                               */
/* ------------------------------------------------------------------ */

/**
 * A qué temporada pertenece una fecha.
 *
 * La liga va de agosto a junio, así que el corte es el 1 de julio: un partido
 * del 29 de mayo de 2026 es de la 2025/26, no de la 2026/27.
 */
export function temporadaDe(fecha: string) {
  const [anio, mes] = fecha.split("-").map(Number);

  if (!anio || !mes) return "";

  const inicio = mes >= 7 ? anio : anio - 1;

  return `${inicio}/${String((inicio + 1) % 100).padStart(2, "0")}`;
}

export function formatea(valor: number | null, unidad: Unidad) {
  if (valor === null || !Number.isFinite(valor)) return "—";

  if (unidad === "porcentaje") return `${valor.toFixed(1)}%`;
  if (unidad === "entero") return String(Math.round(valor));
  if (unidad === "minutos") return `${valor.toFixed(1)}′`;

  return valor.toFixed(2);
}

/**
 * El percentil de un valor dentro de una lista, **ya orientado**.
 *
 * Devuelve siempre «qué bien está»: en PPDA o en pérdidas, estar abajo es estar
 * bien, y el percentil se le da la vuelta. Sin eso, el color de la pantalla
 * mentiría en un tercio de las métricas.
 */
export function percentil(
  valor: number,
  todos: number[],
  mejorAlto: boolean | null,
) {
  const validos = todos.filter((v) => Number.isFinite(v));

  if (validos.length < 2) return null;

  const pordebajo = validos.filter((v) => v < valor).length;
  const iguales = validos.filter((v) => v === valor).length;

  const bruto = ((pordebajo + iguales / 2) / validos.length) * 100;

  return mejorAlto === false ? 100 - bruto : bruto;
}

/* ------------------------------------------------------------------ */
/*  A FAVOR Y EN CONTRA                                                */
/* ------------------------------------------------------------------ */

/**
 * Lo mismo, pero de lo que hizo el rival en esos mismos partidos.
 *
 * El informe de cada equipo trae **las dos filas de cada partido**: la suya y
 * la de su rival. Eso permite contestar a lo que ninguna columna contesta —
 * «¿cuántos córners concedemos?», «¿cuántos remates de ABP nos hacen?»— sin
 * pedir nada más: se buscan las filas del rival de nuestros partidos y se
 * calcula la misma métrica sobre ellas.
 *
 * Si de algún partido no está la fila del rival, ese partido no cuenta: mejor
 * comparar cinco contra cinco que cinco contra tres.
 */
export function aFavorYEnContra(
  metrica: Metrica,
  nuestras: FilaPartido[],
  todas: FilaPartido[],
) {
  const porLlave = new Map(
    todas.map((fila) => [`${fila.fecha}|${fila.equipo}`, fila] as const),
  );

  const mias: FilaPartido[] = [];
  const suyas: FilaPartido[] = [];

  for (const fila of nuestras) {
    const suya = porLlave.get(`${fila.fecha}|${fila.rival}`);

    if (!suya) continue;

    mias.push(fila);
    suyas.push(suya);
  }

  return {
    partidos: mias.length,
    aFavor: valorEnGrupo(metrica, mias),
    enContra: valorEnGrupo(metrica, suyas),
  };
}

/** La mediana, que es con lo que se compara en la pantalla. */
export function mediana(valores: number[]) {
  const orden = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);

  if (orden.length === 0) return null;

  const medio = Math.floor(orden.length / 2);

  return orden.length % 2
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2;
}
