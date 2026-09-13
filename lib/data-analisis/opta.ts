import type { Fase, Unidad } from "./metricas";

/**
 * Los agregados de Opta: **el Castilla contra la media de la categoría**.
 *
 * La carpeta trae dos cosas con la misma pinta y que no son lo mismo, y
 * confundirlas cuesta caro:
 *
 * - Un agregado de **cien partidos** con reparto de casa y fuera. No es el
 *   Castilla: es **toda la categoría**. Se ve en que los duelos dan un 50,0 %
 *   clavado, los aéreos otro 50,0 % y los goles a favor igualan a los goles en
 *   contra —la aritmética de sumar a los dos equipos de cada partido—.
 * - Un agregado del **Castilla**, con su `teamId`, sus tres partidos de esta
 *   temporada y **las mismas columnas**.
 *
 * Que compartan columnas es lo que lo hace valioso: se puede poner al Castilla
 * al lado de la media de la categoría en cosas que Wyscout **no mide**:
 *
 * - **Conducciones progresivas**: progresar con el balón en los pies.
 * - **Uno contra uno**, intentados y ganados, atacando y defendiendo.
 * - **Duración media de la posesión** y el reparto de posesiones por duración
 *   —menos de diez segundos, de diez a veinte, de veinte a cuarenta—, que es
 *   la medida directa de cuánto se tarda en llegar.
 * - **Porcentaje de presión alta del equipo**.
 * - **Acierto de pase en el último tercio**, donde de verdad cuesta.
 * - **Balón parado en contra**: córners, faltas y penaltis concedidos.
 *
 * Y del lado de la categoría hay además columnas que sólo trae ella —dónde se
 * disputan los duelos, los córners por lado, las prolongaciones de cabeza—:
 * ésas no se pueden comparar, pero sí sirven de retrato de la liga.
 */

export type MetricaOpta = {
  /** La columna tal y como la llama Opta. */
  columna: string;
  nombre: string;
  grupo: string;
  fase: Fase;
  unidad: Unidad;
  mejorAlto: boolean | null;
  comoLeer: string;
  /** Si la cifra ya viene por noventa minutos o es un porcentaje. */
  porNoventa?: boolean;
};

/**
 * Lo que está en los dos ficheros, y por tanto se puede comparar.
 *
 * El orden importa poco; el grupo y la fase sí, porque es como se reparte la
 * pantalla.
 */
export const METRICAS_OPTA: MetricaOpta[] = [
  /* ============================ CON BALÓN ========================= */
  {
    columna: "Conducciones Progresivas/90",
    nombre: "Conducciones progresivas",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Veces por partido que se avanza con el balón en los pies. Es la otra mitad de progresar: lo que no se gana pasando se gana conduciendo, y Wyscout no lo mide.",
  },
  {
    columna: "FwdPassPer90",
    nombre: "Pases hacia adelante",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Cuántos pases por partido van hacia la portería contraria. Con acierto alto y esto bajo, la circulación es cómoda pero no progresa.",
  },
  {
    columna: "Pases en Ultimo Tercio",
    nombre: "Pases en el último tercio",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "El volumen de juego donde se decide. Es lo que hay que mirar antes de culpar a los delanteros.",
  },
  {
    columna: "Ps%InA3rd",
    nombre: "Acierto de pase en el último tercio %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El acierto donde de verdad cuesta. El global lo infla la circulación de atrás; éste no.",
  },
  {
    columna: "Pass%",
    nombre: "Acierto de pase %",
    grupo: "Circulación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El acierto de toda la circulación. Sirve de contraste con el del último tercio: la diferencia entre los dos es lo que cuesta el riesgo.",
  },
  {
    columna: "Duracion media posesion (seg)",
    nombre: "Duración media de la posesión",
    grupo: "Circulación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Segundos que dura de media tener el balón. No hay un valor bueno: dice si el equipo elabora o va directo, y hay que leerlo con lo que produce cada posesión.",
  },
  {
    columna: "1v1/90",
    nombre: "Uno contra uno intentados",
    grupo: "Duelos",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Regates intentados por partido. Es una decisión de estilo: hay equipos que resuelven asociándose y otros encarando.",
  },
  {
    columna: "1v1%",
    nombre: "Uno contra uno ganados %",
    grupo: "Duelos",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "De cada diez regates, cuántos salen. Por debajo de la media de la categoría, encarar cuesta más de lo que da.",
  },
  {
    columna: "Toques Area Rival/90",
    nombre: "Toques en el área rival",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Sin gente dentro del área no hay toques dentro del área: es la medida indirecta de cuánta gente la ocupa.",
  },
  {
    columna: "Toques Tercio Rival P90",
    nombre: "Toques en el último tercio",
    grupo: "Ocupación del área",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Volumen de juego en el tercio de ataque. Con posesión alta y esto bajo, la posesión se queda en el medio.",
  },
  {
    columna: "KeyPassPer90",
    nombre: "Pases clave",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Pases que terminan en remate. Es la creación medida en el penúltimo toque, no en el último.",
  },
  {
    columna: "Centros Juego Abierto/90",
    nombre: "Centros en juego abierto",
    grupo: "Creación",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Centros que no vienen de jugada parada. Es una vía, no una virtud: se mira con el acierto al lado.",
  },
  {
    columna: "%Centros Positivos Juego Abierto",
    nombre: "Centros positivos %",
    grupo: "Creación",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "De cada diez centros, cuántos encuentran a alguien nuestro. Por debajo del 20 % el centro es una pérdida con otro nombre.",
  },
  {
    columna: "xG P90",
    nombre: "xG por partido",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer: "Lo que valen las ocasiones que se generan en un partido.",
  },
  {
    columna: "xG Por Tiro",
    nombre: "xG por remate",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "La calidad media del remate. Sube acercándose y quedándose solo, no disparando más.",
  },
  {
    columna: "Tiros Totales",
    nombre: "Remates por partido",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "El volumen. Junto al xG por remate dice si se llega mucho o si se llega bien.",
  },
  {
    columna: "Tiros a Puerta",
    nombre: "Remates a puerta",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer: "Los que obligan al portero. Es el filtro entre rematar y crear peligro.",
  },
  {
    columna: "Conversion%",
    nombre: "Conversión %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "Goles por cada cien remates. Muy por encima de la media es acierto, y el acierto vuelve a la media.",
  },

  /* ============================ SIN BALÓN ======================== */
  {
    columna: "Recuperaciones Campo Rival/90",
    nombre: "Recuperaciones en campo rival",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Robos en el campo del rival por partido. Es la medida de presionar arriba, no de presionar mucho.",
  },
  {
    columna: "Rcuperaciones P90",
    nombre: "Recuperaciones",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Todas las recuperaciones del partido. Muy altas con poca posesión suelen ser el equipo que corre detrás del balón.",
  },
  {
    columna: "Despejes P90",
    nombre: "Despejes",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Balones alejados sin control. Muchos no son buena defensa: son mucho tiempo dentro del área propia.",
  },
  {
    columna: "Intercepciones P90",
    nombre: "Intercepciones",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    porNoventa: true,
    comoLeer:
      "Balones cortados por lectura, sin entrar. Va con la posición, no con el físico.",
  },
  {
    columna: "Entradas P90",
    nombre: "Entradas",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Ir al suelo a quitar el balón. Muchas suelen significar llegar tarde, no defender mejor.",
  },
  {
    columna: "%Entradas Ganadas",
    nombre: "Entradas ganadas %",
    grupo: "Defensa",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "De cada diez entradas, cuántas salen. Fallarlas deja al equipo en inferioridad por detrás del balón.",
  },
  {
    columna: "Regates SufridosP90",
    nombre: "Regates sufridos",
    grupo: "Defensa",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    porNoventa: true,
    comoLeer:
      "Cuántas veces superan a un jugador nuestro por partido. Sube cuando se defiende lejos de la ayuda.",
  },
  {
    columna: "DuelsDefPer90",
    nombre: "Duelos defensivos",
    grupo: "Duelos",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Cuántos duelos hay que defender por partido. Muchos es que el rival llega mucho, no que se defienda bien.",
  },
  {
    columna: "%DuelosDef ganados",
    nombre: "Duelos defensivos ganados %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Los que se ganan defendiendo. Es la primera línea de todo lo demás.",
  },
  {
    columna: "Duelos AereosP90",
    nombre: "Duelos aéreos",
    grupo: "Duelos",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    porNoventa: true,
    comoLeer:
      "Cuánto se juega por arriba. Depende tanto del rival como de uno mismo.",
  },
  {
    columna: "%Duelos Aereos Ganados",
    nombre: "Duelos aéreos ganados %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El que decide córners y centros. Por debajo de la media hay que defender el área de otra manera.",
  },
  {
    columna: "Pass%D3",
    nombre: "Acierto de pase en campo propio %",
    grupo: "Circulación",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El acierto saliendo desde atrás. Cada fallo aquí es una ocasión del rival, no una pérdida cualquiera.",
  },
  {
    columna: "FoulCom",
    nombre: "Faltas cometidas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Las que se hacen. Con muchas recuperaciones altas al lado suelen ser el precio de presionar.",
  },
  {
    columna: "Yellow",
    nombre: "Amarillas",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer: "Lo que cuestan las faltas cuando se cometen tarde o mal.",
  },
  {
    columna: "Offsides",
    nombre: "Fueras de juego",
    grupo: "Disciplina",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Los que se señalan a favor nuestro al atacar. Muchos indican ataque al espacio; pocos, ataque con el balón dominado.",
  },

  /* ========================== BALÓN PARADO ======================= */
  {
    columna: "Corners",
    nombre: "Córners lanzados",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer: "El volumen de la estrategia. Sin él no hay nada que rentabilizar.",
  },
  {
    columna: "xGCrnrs",
    nombre: "xG de córner",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Lo que valían las ocasiones nacidas de córner. Es la nota del ensayo, al margen de si entraron.",
  },
  {
    columna: "GoalCrnrs",
    nombre: "Goles de córner",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Comparado con el xG de córner dice si la estrategia rinde o si se está teniendo suerte.",
  },
];

export const OPTA_POR_COLUMNA = new Map(METRICAS_OPTA.map((m) => [m.columna, m]));

/**
 * Lo que **sólo** trae el agregado de la categoría.
 *
 * No se puede comparar con nosotros —en el fichero del Castilla esas columnas
 * no existen—, pero retrata la liga y da el listón de lo que es normal aquí.
 */
export const SOLO_LIGA: MetricaOpta[] = [
  {
    columna: "%DuelosCampoRival",
    nombre: "Duelos en campo rival %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "De todos los duelos del partido, cuántos se juegan en el campo del rival. Es el «y dónde» que le falta al recuento de duelos.",
  },
  {
    columna: "%DuelosDentroÁrea",
    nombre: "Duelos ganados dentro del área %",
    grupo: "Duelos",
    fase: "sin",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El duelo que decide goles. Se gana con colocación y con salto, y no se parece al de medio campo.",
  },
  {
    columna: "RecuperacionesÚltimo1/3",
    nombre: "Recuperaciones en el último tercio",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Las de más valor: se roba a treinta metros de la portería contraria, con el rival abierto.",
  },
  {
    columna: "PerdidasCampoPropio",
    nombre: "Pérdidas en campo propio",
    grupo: "Presión y transición",
    fase: "sin",
    unidad: "decimal",
    mejorAlto: false,
    comoLeer:
      "Las caras: cada una es una transición del rival cerca del área propia.",
  },
  {
    columna: "PérdidasCampoRival",
    nombre: "Pérdidas en campo rival",
    grupo: "Presión y transición",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Las baratas: se pierde lejos de la propia portería, y con presión tras pérdida buena salen a cuenta.",
  },
  {
    columna: "CambiosOrientación",
    nombre: "Cambios de orientación",
    grupo: "Progresión",
    fase: "con",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Balones cambiados de banda. Muchos indican que se busca el lado débil del bloque.",
  },
  {
    columna: "%RematesArea",
    nombre: "Remates dentro del área %",
    grupo: "Valor gol",
    fase: "con",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "Qué parte del volumen se remata desde dentro. Es la traducción más directa de la calidad de la ocasión.",
  },
  {
    columna: "BgChnc",
    nombre: "Grandes ocasiones",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Las que se espera que entren. Generar muchas y marcar pocas es un problema de definición, no de juego.",
  },
  {
    columna: "DisparosParaHacerGol",
    nombre: "Remates por gol",
    grupo: "Valor gol",
    fase: "con",
    unidad: "decimal",
    mejorAlto: false,
    porNoventa: true,
    comoLeer:
      "Cuántos remates cuesta un gol en esta categoría. Baja mejorando la ocasión, no disparando más.",
  },
  {
    columna: "ShrtCrnrs",
    nombre: "Córners en corto",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: null,
    comoLeer:
      "Cuántos no se ponen al área. Es una decisión de estructura, no un recurso menor.",
  },
  {
    columna: "LftCrnrSc%",
    nombre: "Acierto de córner izquierdo %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "Córners desde la izquierda que llegan a su destino. Comparado con el derecho dice si un lado renta más.",
  },
  {
    columna: "RgtCrnrSc%",
    nombre: "Acierto de córner derecho %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer: "Lo mismo por el otro lado. La diferencia entre los dos suele ser el lanzador.",
  },
  {
    columna: "PrlgcnesCabza",
    nombre: "Prolongaciones de cabeza",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Balones peinados para que siga la jugada. Es lo más cerca que llega un informe a las segundas jugadas.",
  },
  {
    columna: "%AereosGanadosEnMis45m",
    nombre: "Aéreos ganados en campo propio %",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "porcentaje",
    mejorAlto: true,
    comoLeer:
      "El juego aéreo defendiendo, que es el que se juega en los córners en contra.",
  },
  {
    columna: "GoalSetPly",
    nombre: "Goles de jugada parada",
    grupo: "Balón parado",
    fase: "abp",
    unidad: "decimal",
    mejorAlto: true,
    comoLeer:
      "Todo lo que nace de balón parado, no sólo del córner. En la categoría es más de un gol de cada cuatro.",
  },
];

/* ------------------------------------------------------------------ */
/*  LA DURACIÓN DE LAS POSESIONES                                      */
/* ------------------------------------------------------------------ */

/**
 * Cuánto duran las posesiones, repartidas.
 *
 * Es lo más cerca que llega el informe a «cuánto tiempo con balón hace falta
 * para hacer ocasión»: un equipo que vive por debajo de los diez segundos
 * ataca en transición, y uno que se va a los cuarenta es de los que elaboran.
 * Los nombres de columna traen las comillas de los segundos dentro, tal cual.
 */
export const DURACION_POSESION: { columna: string; etiqueta: string }[] = [
  { columna: 'Posesiones Entre 10""', etiqueta: "Menos de 10″" },
  { columna: 'Posesiones Entre 10""-20""', etiqueta: "De 10″ a 20″" },
  { columna: 'Posesiones Entre 20""-40""', etiqueta: "De 20″ a 40″" },
];

/** La posesión por tramos del primer tiempo, que Opta da suelta. */
export const POSESION_POR_TRAMO: { columna: string; etiqueta: string }[] = [
  { columna: "Posesion Min 1-15", etiqueta: "Min 1-15" },
  { columna: "Posesion Min 16-30", etiqueta: "Min 16-30" },
  { columna: "Posesion Min 31-45", etiqueta: "Min 31-45" },
];

/* ------------------------------------------------------------------ */
/*  DE DÓNDE SALEN LOS GOLES DE ESTRATEGIA                             */
/* ------------------------------------------------------------------ */

/**
 * El reparto de los goles de balón parado en la categoría.
 *
 * Aquí hay una trampa que conviene no pisar: en el agregado de la liga, «a
 * favor» y «en contra» son **el mismo gol contado dos veces** —cada uno es de
 * alguien y contra alguien—, y por eso las columnas salen casi iguales. Poner
 * las dos enfrentadas no diría nada. Lo que sí dice algo es **por dónde entran
 * esos goles en esta categoría**, que es el listón de cuánto renta cada
 * ensayo.
 */
export const ORIGEN_ESTRATEGIA: { nombre: string; columna: string }[] = [
  { nombre: "Córner", columna: "GoalCrnrs" },
  { nombre: "Falta lateral", columna: "TIRO_LIBRE" },
  { nombre: "Falta directa", columna: "FALDIR_FAVOR" },
  { nombre: "Penalti", columna: "PenGoal" },
];

/* ------------------------------------------------------------------ */
/*  LECTURA DE LOS AGREGADOS                                           */
/* ------------------------------------------------------------------ */

export type AmbitoOpta = {
  ambito: string;
  fuente: "liga" | "nuestro";
  datos: Record<string, number | string>;
};

/** Las filas de un lado: la categoría o nosotros. */
export const filasDe = (historico: AmbitoOpta[], fuente: "liga" | "nuestro") =>
  historico.filter((h) => h.fuente === fuente);

/**
 * El valor de una columna.
 *
 * `ambito` es "TOTAL", "Home" o "Away" en el agregado de la liga. En el
 * nuestro sólo hay total, así que si no encuentra el ámbito pedido y sólo hay
 * una fila, usa esa: pedirle «Home» al fichero del Castilla no es un error, es
 * que ese reparto no existe.
 */
export function valorOpta(
  filas: AmbitoOpta[],
  ambito: string,
  columna: string,
): number | null {
  const fila =
    filas.find((h) => h.ambito === ambito) ??
    (ambito === "TOTAL" && filas.length === 1 ? filas[0] : undefined);

  if (!fila) return null;

  const bruto = fila.datos[columna];

  if (bruto === undefined) return null;

  if (typeof bruto === "number") return bruto;

  const limpio = String(bruto).replace("%", "").replace(",", ".").trim();

  if (!limpio || limpio === "-") return null;

  const n = Number(limpio);

  return Number.isFinite(n) ? n : null;
}

/** Los partidos que cubre un ámbito, para poder pasar a «por partido». */
export const partidosDe = (filas: AmbitoOpta[], ambito: string) =>
  valorOpta(filas, ambito, "GM") ?? 0;

/**
 * El valor **por partido**, que es la única forma de comparar los dos lados.
 *
 * Aquí está lo que hace que la comparación signifique algo: la categoría lleva
 * cien partidos y el Castilla tres. Un total contra otro total no dice nada;
 * lo que se compara es siempre por partido. Las columnas que Opta ya da por
 * noventa minutos y los porcentajes se dejan como vienen.
 */
export function porPartidoOpta(
  filas: AmbitoOpta[],
  ambito: string,
  metrica: MetricaOpta,
) {
  const valor = valorOpta(filas, ambito, metrica.columna);

  if (valor === null) return null;

  if (metrica.porNoventa || metrica.unidad === "porcentaje") return valor;

  const partidos = partidosDe(filas, ambito);

  return partidos > 0 ? valor / partidos : valor;
}

/** El resumen de resultados de un ámbito: lo que abre el panel. */
export function resumenOpta(filas: AmbitoOpta[], ambito: string) {
  const dato = (c: string) => valorOpta(filas, ambito, c);

  const partidos = partidosDe(filas, ambito);

  return {
    partidos,
    ganados: dato("W") ?? 0,
    empates: dato("D") ?? 0,
    perdidos: dato("L") ?? 0,
    golesFavor: dato("GF") ?? 0,
    golesContra: dato("GA") ?? 0,
    puntos: dato("P") ?? 0,
    xg: dato("ExpG"),
    /* Opta lo da como xG − goles; se le da la vuelta para que signifique lo
       mismo que en el resto de la pantalla: goles por encima de lo esperado. */
    golesMenosXg: dato("xG-G") === null ? null : -(dato("xG-G") as number),
  };
}

/**
 * Lo nuestro contra la media, en tanto por ciento.
 *
 * Positivo es «por encima de la categoría», y ya viene con el sentido de la
 * métrica puesto: en regates sufridos o en amarillas, tener menos sale
 * positivo, porque lo que se quiere saber es si estamos mejor, no si el número
 * es más grande.
 */
export function contraLaMedia(
  nuestro: number | null,
  liga: number | null,
  mejorAlto: boolean | null,
) {
  if (nuestro === null || liga === null || liga === 0) return null;

  const bruto = ((nuestro - liga) / Math.abs(liga)) * 100;

  return mejorAlto === false ? -bruto : bruto;
}
