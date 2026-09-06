/*
|--------------------------------------------------------------------------
| CAMPOGRAMA · MOTOR DE COLOCACIÓN
|--------------------------------------------------------------------------
|
| Dónde se pone cada jugador en el campo. Lo usan los dos campogramas que
| existen del rival:
|
|   · el de pantalla, en `app/rivals/page.tsx` (fichas con foto redonda y el
|     nombre debajo, de pie en el móvil y tumbado en un portátil);
|   · el del `.pptx` de día de partido, en `lib/rivals/alineacion-ppt.ts`
|     (fichas de cartón con retrato, dorsal y cuatro renglones de números).
|
| Antes eran dos motores parecidos y **no salía lo mismo**: distinto margen
| para compartir banda, distinto tope de columnas, distinto reparto de las
| bandas a lo hondo. Quien miraba la pantalla y luego abría el PowerPoint veía
| dos plantillas colocadas de otra manera, y el documento existe justo para lo
| contrario: llevarse a la reunión lo que ya se ha estudiado en pantalla.
|
| Aquí sólo vive la GEOMETRÍA. No sabe de fichas ni de lienzos: recibe bloques
| ya formados —quién va con quién y dónde querría estar— y un puñado de
| medidas, y devuelve coordenadas. Lo que cambia entre los dos documentos son
| las medidas: la ficha de pantalla es más ancha que alta y la del pptx al
| revés, así que cada uno le dice al motor cuánto ocupa la suya.
|
| El reparto, en orden:
|
|   1. Los bloques a profundidad parecida comparten BANDA, para no gastar de
|      más en el eje que escasea.
|   2. Se busca el tamaño de ficha más grande con el que todo cabe.
|   3. Cada banda se coloca a su profundidad sin pisar a la anterior, y dentro
|      de ella cada bloque va lo más cerca posible de su ancla.
|
| El campo se pinta en dos orientaciones y el motor no razona en X/Y sino en
| dos ejes: el PROFUNDO —donde se apilan las bandas— y el LARGO —donde cada
| banda reparte sus bloques—. De pie (ataque hacia arriba) profundo = Y y largo
| = X; tumbado (ataque hacia la derecha), al revés. Lo que NO gira es la ficha,
| que siempre lleva el nombre bajo la foto: por eso un bloque mide distinto en
| cada eje y hay que preguntarle al eje, no al bloque, cuánto sitio ocupa.
*/

/* ------------------------------------------------------------------ */
/*  ANCLAS                                                             */
/* ------------------------------------------------------------------ */

export type AnclaSlot = { x: number; y: number; xSide?: number };

/*
| Ancla de cada slot en fracciones del campo (el ataque, arriba). `xSide` es
| cuánto se desplaza a los lados cuando la posición trae lado ("interior
| derecho"); los slots que ya son de un lado (LI, LD, EI, ED) no lo llevan.
*/
export const ANCLAS_SLOT: Record<string, AnclaSlot> = {
  dc: { x: 0.5, y: 0.1, xSide: 0.16 },
  sd: { x: 0.5, y: 0.19, xSide: 0.16 },
  ei: { x: 0.12, y: 0.28 },
  ed: { x: 0.88, y: 0.28 },
  ext: { x: 0.5, y: 0.28, xSide: 0.38 },
  mp: { x: 0.5, y: 0.35, xSide: 0.16 },
  int: { x: 0.5, y: 0.47, xSide: 0.26 },
  mc: { x: 0.5, y: 0.5, xSide: 0.18 },
  med: { x: 0.5, y: 0.5, xSide: 0.18 },
  mcd: { x: 0.5, y: 0.63, xSide: 0.18 },
  car: { x: 0.5, y: 0.7, xSide: 0.4 },
  li: { x: 0.11, y: 0.79 },
  ld: { x: 0.89, y: 0.79 },
  dfc: { x: 0.5, y: 0.81, xSide: 0.15 },
  def: { x: 0.5, y: 0.81, xSide: 0.3 },
  por: { x: 0.5, y: 0.93 },
};

/** Quien no cae en ningún slot se queda en tierra de nadie, en el centro. */
export const ANCLA_SUELTA: AnclaSlot = { x: 0.5, y: 0.56 };

/*
| Slots de banda: extremos, laterales y carrileros. Su bloque se lee de
| izquierda a derecha, en una sola fila, en vez de apilarse.
|
| El bloque cuadrado va bien en el centro del campo, donde hay ancho de sobra a
| los dos lados. Pegado a la línea de banda no: los tres laterales izquierdos
| quedaban uno debajo de otro, una columna larga que se comía el fondo del
| campo y empujaba a la banda de al lado. En fila ocupan lo que tienen a mano
| —el ancho hacia dentro del campo— y la banda queda a la altura que le toca.
*/
export const SLOTS_DE_BANDA = new Set(["ei", "ed", "ext", "li", "ld", "car"]);

/* ------------------------------------------------------------------ */
/*  EL ONCE: EL ESQUELETO DEL CAMPOGRAMA                               */
/* ------------------------------------------------------------------ */

/*
| Antes había un bloque por cada posición que trajera la hoja, así que el
| campograma cambiaba de forma con cada rival: uno con seis centrales y sin
| mediapunta salía con cinco bloques amontonados atrás y un hueco delante, y
| dos plantillas seguidas no se podían comparar de un vistazo.
|
| Después el esqueleto pasó a ser SIEMPRE el mismo —once bloques colocados como
| un 1-4-2-3-1— y lo que cambia es cuánta gente cae en cada uno.
|
| Y desde ahora ese esqueleto **se elige**. Un rival que juega con tres
| centrales y dos carrileros, leído sobre un 1-4-2-3-1, no se parece a lo que
| se va a ver el domingo: los carrileros salen de laterales, el tercer central
| se amontona con otro y el dibujo miente. Con el suyo puesto, la plantilla se
| lee como el equipo que es.
|
| El 1-4-2-3-1 sigue siendo el de partida porque es el más repetido en la
| categoría, y quien no toque nada verá exactamente lo de siempre.
*/

/**
 * Familias de puesto: lo mínimo con lo que se puede repartir a cualquiera.
 *
 * No son los slots de la hoja —que son quince y muy finos— sino los ocho
 * papeles que un dibujo sabe colocar. Entre los dos hay una tabla, y es ahí
 * donde se decide que un carrilero es un lateral y un segundo punta una
 * mediapunta.
 */
export type FamiliaPuesto =
  | "por"
  | "lateral"
  | "central"
  | "pivote"
  | "interior"
  | "mediapunta"
  | "extremo"
  | "delantero";

const FAMILIA_DE_SLOT: Record<string, FamiliaPuesto> = {
  por: "por",

  li: "lateral",
  ld: "lateral",
  /* Carrilero: es un lateral con otro nombre. */
  car: "lateral",

  dfc: "central",
  def: "central",

  mcd: "pivote",
  mc: "pivote",
  med: "pivote",

  int: "interior",

  mp: "mediapunta",
  sd: "mediapunta",

  ei: "extremo",
  ed: "extremo",
  ext: "extremo",

  dc: "delantero",
};

/**
 * Puestos que ya dicen de qué lado son por su propio nombre.
 *
 * Un «lateral izquierdo» es de la izquierda aunque la hoja no escriba nada
 * más, y la página manda `lado: 0` para ellos —el lado se saca del texto sólo
 * en los puestos que admiten los dos, y éstos no—. Sin esta tabla, el reparto
 * los tomaba por gente sin lado y los equilibraba por número: el lateral
 * derecho acababa dibujado en el bloque de la izquierda.
 */
/* Con `undefined` a la vista: sin él, TypeScript da por hecho que cualquier
   slot está en la tabla y el `??` de abajo sobra a sus ojos. */
const LADO_DE_SLOT: Record<string, -1 | 1 | undefined> = {
  li: -1,
  ld: 1,
  ei: -1,
  ed: 1,
};

/**
 * Adónde se va una familia cuando el dibujo elegido no tiene ese puesto.
 *
 * Un 4-4-2 no tiene mediapunta y un 4-1-4-1 no tiene extremos puros: sin esta
 * tabla, esa gente se quedaría fuera del campo. Se prueba en orden y se coge
 * el primero que exista, así que el orden es la respuesta a «y si no, ¿a qué
 * se parece más?».
 */
const PARIENTES: Record<FamiliaPuesto, FamiliaPuesto[]> = {
  por: [],
  lateral: ["central", "interior"],
  central: ["lateral", "pivote"],
  pivote: ["interior", "central"],
  interior: ["pivote", "mediapunta"],
  mediapunta: ["interior", "delantero", "extremo"],
  extremo: ["interior", "delantero", "mediapunta"],
  delantero: ["mediapunta", "extremo", "interior"],
};

export type BloqueOnce = {
  /** Clave del bloque; es la que llevan las fichas colocadas. */
  key: string;
  /** Lo que se pinta en la chapa. */
  code: string;
  anchorX: number;
  anchorY: number;
  /** Los de fuera se leen en fila; los de dentro, apilados. */
  banda: boolean;
  /** Qué familias caen aquí. */
  admite: FamiliaPuesto[];
  /** -1 izquierda, 0 por dentro, 1 derecha. Decide a quién se le da el lado. */
  lado: -1 | 0 | 1;
};

/** Un dibujo: su nombre y sus once bloques. */
export type DibujoCampo = {
  /** "4-2-3-1". Es lo que se elige en la pantalla. */
  id: string;
  bloques: BloqueOnce[];
};

/*
| Los dibujos, con el ataque arriba. Los anclajes van en fracciones del campo y
| no salen de ninguna plantilla concreta: son los sitios donde el cuerpo
| técnico dibuja cada puesto en una pizarra.
*/

const POR: BloqueOnce = {
  key: "por",
  code: "POR",
  anchorX: 0.5,
  anchorY: 0.93,
  banda: false,
  admite: ["por"],
  lado: 0,
};

/*
|                        DC
|              MI        MP        MD
|                  MC-I      MC-D
|         LI     DFC-I     DFC-D     LD
|                       POR
*/
export const ONCE_1_4_2_3_1: BloqueOnce[] = [
  { key: "dc", code: "DC", anchorX: 0.5, anchorY: 0.11, banda: false, admite: ["delantero"], lado: 0 },

  { key: "mi", code: "MI", anchorX: 0.13, anchorY: 0.3, banda: true, admite: ["extremo"], lado: -1 },
  { key: "mp", code: "MP", anchorX: 0.5, anchorY: 0.33, banda: false, admite: ["mediapunta"], lado: 0 },
  { key: "md", code: "MD", anchorX: 0.87, anchorY: 0.3, banda: true, admite: ["extremo"], lado: 1 },

  { key: "mci", code: "MC", anchorX: 0.38, anchorY: 0.55, banda: false, admite: ["pivote", "interior"], lado: -1 },
  { key: "mcd", code: "MC", anchorX: 0.62, anchorY: 0.55, banda: false, admite: ["pivote", "interior"], lado: 1 },

  { key: "li", code: "LI", anchorX: 0.1, anchorY: 0.74, banda: true, admite: ["lateral"], lado: -1 },
  { key: "dfci", code: "DFC", anchorX: 0.37, anchorY: 0.78, banda: false, admite: ["central"], lado: -1 },
  { key: "dfcd", code: "DFC", anchorX: 0.63, anchorY: 0.78, banda: false, admite: ["central"], lado: 1 },
  { key: "ld", code: "LD", anchorX: 0.9, anchorY: 0.74, banda: true, admite: ["lateral"], lado: 1 },

  POR,
];

/*
|              EI        DC        ED
|                  INT-I     INT-D
|                       MCD
|         LI     DFC-I     DFC-D     LD
|                       POR
*/
const ONCE_1_4_3_3: BloqueOnce[] = [
  { key: "ei", code: "EI", anchorX: 0.12, anchorY: 0.17, banda: true, admite: ["extremo"], lado: -1 },
  { key: "dc", code: "DC", anchorX: 0.5, anchorY: 0.11, banda: false, admite: ["delantero"], lado: 0 },
  { key: "ed", code: "ED", anchorX: 0.88, anchorY: 0.17, banda: true, admite: ["extremo"], lado: 1 },

  { key: "inti", code: "INT", anchorX: 0.33, anchorY: 0.44, banda: false, admite: ["interior", "mediapunta"], lado: -1 },
  { key: "intd", code: "INT", anchorX: 0.67, anchorY: 0.44, banda: false, admite: ["interior", "mediapunta"], lado: 1 },
  { key: "mcd", code: "MCD", anchorX: 0.5, anchorY: 0.62, banda: false, admite: ["pivote"], lado: 0 },

  { key: "li", code: "LI", anchorX: 0.1, anchorY: 0.75, banda: true, admite: ["lateral"], lado: -1 },
  { key: "dfci", code: "DFC", anchorX: 0.37, anchorY: 0.8, banda: false, admite: ["central"], lado: -1 },
  { key: "dfcd", code: "DFC", anchorX: 0.63, anchorY: 0.8, banda: false, admite: ["central"], lado: 1 },
  { key: "ld", code: "LD", anchorX: 0.9, anchorY: 0.75, banda: true, admite: ["lateral"], lado: 1 },

  POR,
];

/*
|                  DC-I      DC-D
|         MI     MC-I      MC-D     MD
|         LI     DFC-I     DFC-D     LD
|                       POR
*/
const ONCE_1_4_4_2: BloqueOnce[] = [
  { key: "dci", code: "DC", anchorX: 0.38, anchorY: 0.13, banda: false, admite: ["delantero"], lado: -1 },
  { key: "dcd", code: "DC", anchorX: 0.62, anchorY: 0.13, banda: false, admite: ["delantero"], lado: 1 },

  { key: "mi", code: "MI", anchorX: 0.11, anchorY: 0.44, banda: true, admite: ["extremo"], lado: -1 },
  { key: "mci", code: "MC", anchorX: 0.38, anchorY: 0.5, banda: false, admite: ["pivote", "interior", "mediapunta"], lado: -1 },
  { key: "mcd", code: "MC", anchorX: 0.62, anchorY: 0.5, banda: false, admite: ["pivote", "interior", "mediapunta"], lado: 1 },
  { key: "md", code: "MD", anchorX: 0.89, anchorY: 0.44, banda: true, admite: ["extremo"], lado: 1 },

  { key: "li", code: "LI", anchorX: 0.1, anchorY: 0.76, banda: true, admite: ["lateral"], lado: -1 },
  { key: "dfci", code: "DFC", anchorX: 0.37, anchorY: 0.8, banda: false, admite: ["central"], lado: -1 },
  { key: "dfcd", code: "DFC", anchorX: 0.63, anchorY: 0.8, banda: false, admite: ["central"], lado: 1 },
  { key: "ld", code: "LD", anchorX: 0.9, anchorY: 0.76, banda: true, admite: ["lateral"], lado: 1 },

  POR,
];

/*
|                        DC
|         MI     INT-I     INT-D     MD
|                       MCD
|         LI     DFC-I     DFC-D     LD
|                       POR
*/
const ONCE_1_4_1_4_1: BloqueOnce[] = [
  { key: "dc", code: "DC", anchorX: 0.5, anchorY: 0.11, banda: false, admite: ["delantero"], lado: 0 },

  { key: "mi", code: "MI", anchorX: 0.11, anchorY: 0.34, banda: true, admite: ["extremo"], lado: -1 },
  { key: "inti", code: "INT", anchorX: 0.38, anchorY: 0.38, banda: false, admite: ["interior", "mediapunta"], lado: -1 },
  { key: "intd", code: "INT", anchorX: 0.62, anchorY: 0.38, banda: false, admite: ["interior", "mediapunta"], lado: 1 },
  { key: "md", code: "MD", anchorX: 0.89, anchorY: 0.34, banda: true, admite: ["extremo"], lado: 1 },

  { key: "mcd", code: "MCD", anchorX: 0.5, anchorY: 0.6, banda: false, admite: ["pivote"], lado: 0 },

  { key: "li", code: "LI", anchorX: 0.1, anchorY: 0.76, banda: true, admite: ["lateral"], lado: -1 },
  { key: "dfci", code: "DFC", anchorX: 0.37, anchorY: 0.8, banda: false, admite: ["central"], lado: -1 },
  { key: "dfcd", code: "DFC", anchorX: 0.63, anchorY: 0.8, banda: false, admite: ["central"], lado: 1 },
  { key: "ld", code: "LD", anchorX: 0.9, anchorY: 0.76, banda: true, admite: ["lateral"], lado: 1 },

  POR,
];

/*
|                  DC-I      DC-D
|      CAR-I   INT-I    MCD    INT-D   CAR-D
|            DFC-I    DFC    DFC-D
|                       POR
*/
const ONCE_1_3_5_2: BloqueOnce[] = [
  { key: "dci", code: "DC", anchorX: 0.38, anchorY: 0.12, banda: false, admite: ["delantero"], lado: -1 },
  { key: "dcd", code: "DC", anchorX: 0.62, anchorY: 0.12, banda: false, admite: ["delantero"], lado: 1 },

  { key: "cari", code: "CAR", anchorX: 0.09, anchorY: 0.44, banda: true, admite: ["lateral", "extremo"], lado: -1 },
  { key: "inti", code: "INT", anchorX: 0.34, anchorY: 0.46, banda: false, admite: ["interior", "mediapunta"], lado: -1 },
  { key: "mcd", code: "MCD", anchorX: 0.5, anchorY: 0.6, banda: false, admite: ["pivote"], lado: 0 },
  { key: "intd", code: "INT", anchorX: 0.66, anchorY: 0.46, banda: false, admite: ["interior", "mediapunta"], lado: 1 },
  { key: "card", code: "CAR", anchorX: 0.91, anchorY: 0.44, banda: true, admite: ["lateral", "extremo"], lado: 1 },

  { key: "dfci", code: "DFC", anchorX: 0.28, anchorY: 0.79, banda: false, admite: ["central"], lado: -1 },
  { key: "dfc", code: "DFC", anchorX: 0.5, anchorY: 0.83, banda: false, admite: ["central"], lado: 0 },
  { key: "dfcd", code: "DFC", anchorX: 0.72, anchorY: 0.79, banda: false, admite: ["central"], lado: 1 },

  POR,
];

/*
|                  DC-I      DC-D
|            INT-I    MCD    INT-D
|      CAR-I   DFC-I   DFC   DFC-D   CAR-D
|                       POR
*/
const ONCE_1_5_3_2: BloqueOnce[] = [
  { key: "dci", code: "DC", anchorX: 0.38, anchorY: 0.12, banda: false, admite: ["delantero"], lado: -1 },
  { key: "dcd", code: "DC", anchorX: 0.62, anchorY: 0.12, banda: false, admite: ["delantero"], lado: 1 },

  { key: "inti", code: "INT", anchorX: 0.33, anchorY: 0.42, banda: false, admite: ["interior", "mediapunta", "extremo"], lado: -1 },
  { key: "mcd", code: "MCD", anchorX: 0.5, anchorY: 0.55, banda: false, admite: ["pivote"], lado: 0 },
  { key: "intd", code: "INT", anchorX: 0.67, anchorY: 0.42, banda: false, admite: ["interior", "mediapunta", "extremo"], lado: 1 },

  { key: "cari", code: "CAR", anchorX: 0.09, anchorY: 0.72, banda: true, admite: ["lateral"], lado: -1 },
  { key: "dfci", code: "DFC", anchorX: 0.3, anchorY: 0.8, banda: false, admite: ["central"], lado: -1 },
  { key: "dfc", code: "DFC", anchorX: 0.5, anchorY: 0.84, banda: false, admite: ["central"], lado: 0 },
  { key: "dfcd", code: "DFC", anchorX: 0.7, anchorY: 0.8, banda: false, admite: ["central"], lado: 1 },
  { key: "card", code: "CAR", anchorX: 0.91, anchorY: 0.72, banda: true, admite: ["lateral"], lado: 1 },

  POR,
];

/*
|              EI        DC        ED
|      CAR-I     MC-I      MC-D     CAR-D
|            DFC-I    DFC    DFC-D
|                       POR
*/
const ONCE_1_3_4_3: BloqueOnce[] = [
  { key: "ei", code: "EI", anchorX: 0.13, anchorY: 0.15, banda: true, admite: ["extremo"], lado: -1 },
  { key: "dc", code: "DC", anchorX: 0.5, anchorY: 0.1, banda: false, admite: ["delantero"], lado: 0 },
  { key: "ed", code: "ED", anchorX: 0.87, anchorY: 0.15, banda: true, admite: ["extremo"], lado: 1 },

  { key: "cari", code: "CAR", anchorX: 0.09, anchorY: 0.45, banda: true, admite: ["lateral"], lado: -1 },
  { key: "mci", code: "MC", anchorX: 0.37, anchorY: 0.5, banda: false, admite: ["pivote", "interior", "mediapunta"], lado: -1 },
  { key: "mcd", code: "MC", anchorX: 0.63, anchorY: 0.5, banda: false, admite: ["pivote", "interior", "mediapunta"], lado: 1 },
  { key: "card", code: "CAR", anchorX: 0.91, anchorY: 0.45, banda: true, admite: ["lateral"], lado: 1 },

  { key: "dfci", code: "DFC", anchorX: 0.28, anchorY: 0.79, banda: false, admite: ["central"], lado: -1 },
  { key: "dfc", code: "DFC", anchorX: 0.5, anchorY: 0.83, banda: false, admite: ["central"], lado: 0 },
  { key: "dfcd", code: "DFC", anchorX: 0.72, anchorY: 0.79, banda: false, admite: ["central"], lado: 1 },

  POR,
];

/** Los dibujos que se ofrecen, en el orden en que se enseñan. */
export const DIBUJOS: DibujoCampo[] = [
  { id: "4-2-3-1", bloques: ONCE_1_4_2_3_1 },
  { id: "4-3-3", bloques: ONCE_1_4_3_3 },
  { id: "4-4-2", bloques: ONCE_1_4_4_2 },
  { id: "4-1-4-1", bloques: ONCE_1_4_1_4_1 },
  { id: "3-5-2", bloques: ONCE_1_3_5_2 },
  { id: "5-3-2", bloques: ONCE_1_5_3_2 },
  { id: "3-4-3", bloques: ONCE_1_3_4_3 },
];

/** El de partida: el más repetido en la categoría. */
export const DIBUJO_POR_DEFECTO = "4-2-3-1";

/** Los bloques del dibujo pedido; el de siempre si no se reconoce. */
export function dibujoDeCampo(id: string | undefined | null): BloqueOnce[] {
  return DIBUJOS.find((uno) => uno.id === id)?.bloques ?? ONCE_1_4_2_3_1;
}

/**
 * Los bloques donde cabe un jugador, en orden de preferencia.
 *
 * Primero los de su familia, y dentro de ellos los de su lado si la hoja lo
 * dice; si el dibujo no tiene ese puesto, se baja por los parientes. Devolver
 * varios y no uno es lo que permite equilibrar después: un «central» a secas
 * puede ir a cualquiera de los dos —o de los tres— y se decide repartiendo.
 */
function candidatos(
  bloques: BloqueOnce[],
  slot: string,
  lado: number,
): BloqueOnce[] {
  const familia = FAMILIA_DE_SLOT[slot];

  /*
  | Puesto que la hoja no escribe, o escribe de una forma que no reconocemos.
  | Va por el centro del campo, que es donde menos miente: ni lo pone en la
  | portería ni lo manda a una banda.
  */
  const orden: FamiliaPuesto[] = familia
    ? [familia, ...PARIENTES[familia]]
    : ["mediapunta", "interior", "pivote"];

  /* El del puesto manda sobre el que venga de fuera: «lateral izquierdo» es
     de la izquierda diga lo que diga el resto de la fila. */
  const suyo: -1 | 0 | 1 =
    LADO_DE_SLOT[slot] ?? (lado < 0 ? -1 : lado > 0 ? 1 : 0);

  for (const cual of orden) {
    const caben = bloques.filter((bloque) => bloque.admite.includes(cual));

    if (caben.length === 0) continue;

    if (suyo !== 0) {
      const suLado = caben.filter((bloque) => bloque.lado === suyo);

      if (suLado.length > 0) return suLado;
    }

    return caben;
  }

  /*
  | Un dibujo sin sitio para él. No debería pasar —las familias de arriba
  | cubren los siete dibujos— pero si algún día se añade uno al que le falte un
  | puesto, esta gente tiene que salir en el campo igual: **cualquier bloque
  | menos la portería** antes que desaparecer del campograma sin avisar.
  */
  return bloques.filter((bloque) => bloque.key !== "por");
}

/**
 * Reparte una plantilla entre los bloques del dibujo elegido.
 *
 * Devuelve, por clave de bloque, la lista de jugadores que le tocan. Los
 * bloques que se quedan vacíos **no salen**: un rival sin mediapunta no pinta
 * un hueco con una chapa dentro.
 *
 * Los que sólo caben en un sitio se colocan primero y el resto se reparte
 * después al bloque que menos gente tenga, para que los dos centrales —o los
 * tres— queden parejos en vez de amontonarse todos a la izquierda.
 */
export function reparteEnOnce<T>(
  jugadores: T[],
  lee: (jugador: T) => { slot: string; lado: number },
  bloques: BloqueOnce[] = ONCE_1_4_2_3_1,
): Map<string, T[]> {
  const reparto = new Map<string, T[]>();

  const mete = (clave: string, jugador: T) => {
    const lista = reparto.get(clave);

    if (lista) lista.push(jugador);
    else reparto.set(clave, [jugador]);
  };

  const dudosos: { jugador: T; donde: BloqueOnce[] }[] = [];

  for (const jugador of jugadores) {
    const { slot, lado } = lee(jugador);
    const donde = candidatos(bloques, slot, lado);

    if (donde.length === 1) mete(donde[0].key, jugador);
    else if (donde.length > 1) dudosos.push({ jugador, donde });
  }

  for (const { jugador, donde } of dudosos) {
    const cuantos = (clave: string) => reparto.get(clave)?.length ?? 0;

    const elegido = donde.reduce((mejor, bloque) =>
      cuantos(bloque.key) < cuantos(mejor.key) ? bloque : mejor,
    );

    mete(elegido.key, jugador);
  }

  return reparto;
}

/*
| Tope de la fila de un bloque de banda.
|
| Eran cuatro, y con cuatro el bloque ya es más ancho que medio campo: una
| tira larguísima de laterales que además le quita tamaño a la foto de TODA la
| plantilla, porque el motor busca el tamaño con el que cabe todo. Con tres, un
| bloque de cinco sale en 3+2 —un grupo— en vez de en una fila de cinco.
*/
const COLUMNAS_DE_BANDA = 3;

/** Cuántas columnas quiere un bloque de banda: las suyas, hasta el tope. */
export function columnasDeBanda(cuantos: number) {
  return Math.min(cuantos, COLUMNAS_DE_BANDA);
}

/**
 * Forma de un bloque de centro: un grupo, no una tira.
 *
 * Antes tres jugadores en un bloque salían en **una sola línea de tres**, y
 * cuatro en dos de dos. Esa línea de tres es la que se veía en el campo como
 * una fila larguísima de centrales o de mediocentros atravesando el ancho:
 * con el campo tumbado, además, cae en vertical y se come el alto entero.
 *
 * Ahora se busca la caja más cuadrada que quepa —la raíz del número de
 * jugadores— con un tope de tres columnas: 3 salen 2+1, 4 salen 2+2, 5 y 6 en
 * 3+2 y 3+3, y de ahí para arriba se apilan filas de tres. Un grupo apretado
 * se lee como «aquí hay tres centrales» de un vistazo; una fila de tres, no.
 *
 * La pareja se queda en dos en línea a propósito: dos centrales uno al lado
 * del otro es justo como se dibujan en una pizarra.
 */
export function columnasDeBloque(cuantos: number) {
  if (cuantos <= 2) return cuantos;

  return Math.min(3, Math.ceil(Math.sqrt(cuantos)));
}

/* ------------------------------------------------------------------ */
/*  REPARTO DE UNA FILA                                                */
/* ------------------------------------------------------------------ */

/*
| Reparte una fila de cajas entre `desde` y `hasta`: cada una lo más cerca
| posible de donde querría estar, sin pisar a la anterior y sin salirse.
| Devuelve los centros.
|
| La clave es que los límites se encadenan desde los dos extremos: el mínimo de
| una caja sale del sitio que ya ocupan todas las anteriores y su máximo del que
| necesitan todas las siguientes. Empujar sólo hacia un lado y recortar al final
| —como se hacía antes— dejaba dos cajas en la misma posición cuando la fila no
| cabía. Si no cabe, el hueco se encoge (puede quedar negativo) y el apretón se
| reparte entre todas en vez de amontonarse en un extremo.
*/
export function reparteFila(
  tamanos: number[],
  querido: number[],
  desde: number,
  hasta: number,
  hueco: number,
): number[] {
  const mitades = tamanos.map((tamano) => tamano / 2);

  const total = tamanos.reduce((suma, tamano) => suma + tamano, 0);

  const aire = Math.min(
    hueco,
    (hasta - desde - total) / Math.max(1, tamanos.length - 1),
  );

  const minimos: number[] = [];
  const maximos: number[] = [];

  mitades.forEach((mitad, indice) => {
    minimos[indice] =
      indice === 0
        ? desde + mitad
        : minimos[indice - 1] + mitades[indice - 1] + aire + mitad;
  });

  for (let indice = mitades.length - 1; indice >= 0; indice -= 1) {
    maximos[indice] =
      indice === mitades.length - 1
        ? hasta - mitades[indice]
        : maximos[indice + 1] - mitades[indice + 1] - aire - mitades[indice];
  }

  const centros: number[] = [];

  let siguienteMinimo = -Infinity;

  mitades.forEach((mitad, indice) => {
    const objetivo = Math.min(
      Math.max(querido[indice], minimos[indice]),
      maximos[indice],
    );

    centros[indice] = Math.max(objetivo, siguienteMinimo);

    siguienteMinimo = centros[indice] + mitad + aire + (mitades[indice + 1] ?? 0);
  });

  return centros;
}

/* ------------------------------------------------------------------ */
/*  LO QUE RECIBE Y LO QUE DEVUELVE                                    */
/* ------------------------------------------------------------------ */

/** Un bloque ya formado: todos los de una posición (slot + lado). */
export type BloqueEntrada<T> = {
  key: string;
  /** 0..1 a lo ancho del campo, con el lado ya sumado. */
  anchorX: number;
  /** 0..1 en profundidad, con el ataque arriba. */
  anchorY: number;
  /** Pegado a una línea de banda: se coloca en fila, no apilado. */
  banda: boolean;
  /** Alguien del bloque lleva chapas: TODA su gente lleva la ficha más alta. */
  etiquetado: boolean;
  /** Ya ordenados como se quieran leer (por dorsal, normalmente). */
  jugadores: T[];
  /** Ancho de la chapa de posición que se pinta encima; 0 si no hay chapa. */
  anchoChapa: number;
};

/*
| Medidas de quien llama. Todo lo que depende del tamaño de ficha se pide como
| función porque el motor busca ese tamaño por bisección: no puede recibir los
| números ya calculados.
*/
export type MedidasCampograma = {
  /** Caja donde cabe todo, en píxeles. */
  ancho: number;
  alto: number;
  /** Tumbado se ataca a la derecha; de pie, hacia arriba. */
  horizontal: boolean;
  padAncho: number;
  padAlto: number;
  /** Alto de la chapa de posición sobre el bloque. */
  chapaAlto: (tamano: number) => number;
  /** Aire entre las filas de un mismo bloque. */
  huecoFila: (tamano: number) => number;
  /** Aire entre una banda y la siguiente, en el eje profundo. */
  huecoBanda: (tamano: number) => number;
  /** Aire entre dos bloques de una misma banda, en el eje largo. */
  huecoBloque: (tamano: number) => number;
  /** Paso entre columnas de un bloque: la ficha más su aire. */
  paso: (tamano: number) => number;
  /** Alto de una ficha con lo que le cuelgue debajo. */
  altoFicha: (tamano: number, etiquetado: boolean) => number;
  /** Cuánto se parecen dos profundidades para compartir banda. */
  margenBanda: number;
  /** Topes de la bisección del tamaño de ficha y suelo de seguridad. */
  busquedaMin: number;
  busquedaMax: number;
  suelo: number;
  /** Formas de bloque que se prueban de pie (tope de columnas). */
  opcionesColumnas: number[];
  columnasDeBanda: (cuantos: number) => number;
  columnasDeBloque: (cuantos: number) => number;
  /** Aire mínimo entre dos chapas de posición vecinas (paso 6, sólo de pie). */
  huecoChapa: number;
};

export type FichaRepartida<T> = {
  item: T;
  /** Centro de la ficha. */
  x: number;
  y: number;
  /** El bloque reserva fila de chapas, la lleve este jugador o no. */
  etiquetado: boolean;
};

export type BloqueRepartido<T> = {
  key: string;
  cuantos: number;
  cols: number;
  filas: number;
  /** Centro de la chapa de posición: puede acabar desplazada (paso 6). */
  chapaX: number;
  /** Borde de arriba del bloque, ya por debajo de la chapa. */
  arriba: number;
  /** Caja del bloque: el fondo que agrupa a todos los de una posición. */
  cajaX: number;
  cajaArriba: number;
  cajaAncho: number;
  cajaAlto: number;
  fichas: FichaRepartida<T>[];
};

export type RepartoCampograma<T> = {
  bloques: BloqueRepartido<T>[];
  /** Todas las fichas, en el orden en que se han colocado. */
  fichas: FichaRepartida<T>[];
  /** Tamaño de ficha con el que ha cabido todo. */
  tamano: number;
  /** Paso entre columnas con ese tamaño. */
  paso: number;
  /** Alto de la ficha de un bloque sin etiquetar / etiquetado. */
  altoFicha: number;
};

/* ------------------------------------------------------------------ */
/*  EL MOTOR                                                           */
/* ------------------------------------------------------------------ */

type BloqueVivo<T> = BloqueEntrada<T> & {
  cols: number;
  filas: number;
  /** Centro del bloque en el eje que reparte su banda (X de pie, Y tumbado). */
  largo: number;
  ancho: number;
  alto: number;
  /** Alto de una ficha suya y salto entre filas, ya con su etiqueta. */
  altoDeFicha: number;
  pasoFila: number;
};

export function reparteCampograma<T>(
  entrada: BloqueEntrada<T>[],
  medidas: MedidasCampograma,
): RepartoCampograma<T> {
  const vacio: RepartoCampograma<T> = {
    bloques: [],
    fichas: [],
    tamano: 0,
    paso: 0,
    altoFicha: 0,
  };

  if (entrada.length === 0) return vacio;

  const { horizontal, ancho, alto } = medidas;

  const bloques: BloqueVivo<T>[] = entrada.map((bloque) => ({
    ...bloque,
    cols: 0,
    filas: 0,
    largo: 0,
    ancho: 0,
    alto: 0,
    altoDeFicha: 0,
    pasoFila: 0,
  }));

  /* 1 · Bandas: bloques a profundidad parecida comparten franja del campo. */

  bloques.sort((a, b) => a.anchorY - b.anchorY);

  /*
  | Cuánto se parecen dos profundidades para compartir banda lo decide quien
  | llama, y no es lo mismo de pie que tumbado: de pie una banda es una FILA y
  | las bandas se apilan a lo alto, que es lo que escasea, así que agrupar de
  | más es lo que hace que quepa la plantilla; tumbado una banda es una COLUMNA
  | y partirla reparte a su gente en dos columnas más cortas.
  */
  const bandas: { bloques: BloqueVivo<T>[]; anchorY: number }[] = [];

  bloques.forEach((bloque) => {
    const ultima = bandas[bandas.length - 1];

    if (ultima && bloque.anchorY - ultima.anchorY <= medidas.margenBanda) {
      ultima.bloques.push(bloque);
      return;
    }

    bandas.push({ bloques: [bloque], anchorY: bloque.anchorY });
  });

  /*
  | Tumbado se ataca hacia la derecha: la banda que de pie va arriba —los
  | delanteros— pasa a ser la de más a la derecha. Se le da la vuelta a la lista
  | para que el resto del reparto pueda recorrer las bandas en el mismo orden en
  | que se pintan, que es lo que dan por hecho los pasos 5 y 6.
  */
  if (horizontal) bandas.reverse();

  /* 2 · Cuánto ocupa cada cosa. */

  /*
  | Los dos ejes del reparto. De pie las bandas se apilan en el eje PROFUNDO
  | (la Y) y cada banda coloca sus bloques en el eje LARGO (la X). Tumbado los
  | dos ejes se cambian el papel.
  */
  const largoTotal = horizontal ? alto : ancho;
  const largoPad = horizontal ? medidas.padAlto : medidas.padAncho;
  const fondoTotal = horizontal ? ancho : alto;
  const fondoPad = horizontal ? medidas.padAncho : medidas.padAlto;

  const largoLibre = largoTotal - 2 * largoPad;

  const anchoBloque = (bloque: BloqueVivo<T>, tamano: number) =>
    bloque.cols * medidas.paso(tamano);

  /* La chapa de posición se pinta encima del bloque: cuenta como alto suyo. */
  const altoBloque = (bloque: BloqueVivo<T>, tamano: number) =>
    medidas.chapaAlto(tamano) +
    bloque.filas *
      (medidas.altoFicha(tamano, bloque.etiquetado) + medidas.huecoFila(tamano));

  const largoDe = (bloque: BloqueVivo<T>, tamano: number) =>
    horizontal ? altoBloque(bloque, tamano) : anchoBloque(bloque, tamano);

  const fondoDe = (bloque: BloqueVivo<T>, tamano: number) =>
    horizontal ? anchoBloque(bloque, tamano) : altoBloque(bloque, tamano);

  /* Profundidad que pide el reparto entero con una ficha de este tamaño. */
  const pideFondo = (tamano: number) =>
    2 * fondoPad +
    (bandas.length - 1) * medidas.huecoBanda(tamano) +
    bandas.reduce(
      (suma, banda) =>
        suma +
        banda.bloques.reduce(
          (hondo, bloque) => Math.max(hondo, fondoDe(bloque, tamano)),
          0,
        ),
      0,
    );

  /* Lo que pide, en su eje largo, la banda más apretada. */
  const pideLargo = (tamano: number) =>
    bandas.reduce((mayor, banda) => {
      const total = banda.bloques.reduce(
        (suma, bloque) => suma + largoDe(bloque, tamano),
        0,
      );

      return Math.max(
        mayor,
        total + (banda.bloques.length - 1) * medidas.huecoBloque(tamano),
      );
    }, 0);

  /* Forma de los bloques con un tope de columnas dado (de pie). */
  const formaBloques = (tope: number) => {
    bloques.forEach((bloque) => {
      /* Los de banda van en fila y no entran en la prueba de columnas: si el
         tope común los apilara, volveríamos a la columna que se quería quitar. */
      bloque.cols = bloque.banda
        ? medidas.columnasDeBanda(bloque.jugadores.length)
        : Math.min(medidas.columnasDeBloque(bloque.jugadores.length), tope);

      bloque.filas = Math.ceil(bloque.jugadores.length / bloque.cols);
    });
  };

  /*
  | Forma de los bloques tumbado, banda a banda. Aquí no vale un tope común
  | para todo el campo: el ancho de cada banda se SUMA (son columnas, una al
  | lado de otra), así que ensanchar un bloque que no lo necesita le quita
  | ancho a todas las demás. En la banda apretada —cinco bloques de defensas
  | uno debajo de otro— interesa lo contrario: bloques anchos de pocas filas,
  | porque cada fila se come el alto, que es lo que ahí escasea.
  |
  | **Se empieza con la forma de grupo, no con una sola columna.** Empezando en
  | una, un bloque de tres centrales salía en una tira de tres cabezas que
  | atravesaba el campo de arriba abajo, y sólo se recogía si a la banda no le
  | cabía; con la banda holgada —que es lo normal— se quedaba estirado para
  | siempre. Con la forma de grupo (columnasDeBloque) tres salen 2+1 y cuatro
  | 2+2, que es como se dibujan tres centrales en una pizarra, y el bucle de
  | abajo sigue pudiendo ensanchar más si aun así no cabe.
  */
  const formaBandas = (tamano: number) => {
    bandas.forEach((banda) => {
      banda.bloques.forEach((bloque) => {
        bloque.cols = bloque.banda
          ? medidas.columnasDeBanda(bloque.jugadores.length)
          : medidas.columnasDeBloque(bloque.jugadores.length);

        bloque.filas = Math.ceil(bloque.jugadores.length / bloque.cols);
      });

      const largoDeBanda = () =>
        banda.bloques.reduce(
          (suma, bloque) => suma + largoDe(bloque, tamano),
          0,
        ) +
        (banda.bloques.length - 1) * medidas.huecoBloque(tamano);

      while (largoDeBanda() > largoLibre) {
        const anchas = Math.max(...banda.bloques.map((bloque) => bloque.cols));

        const candidatos = banda.bloques.filter(
          (bloque) => bloque.cols < bloque.jugadores.length,
        );

        if (candidatos.length === 0) break;

        const gratis = candidatos.filter((bloque) => bloque.cols < anchas);

        const peor = (gratis.length > 0 ? gratis : candidatos).reduce(
          (largo, bloque) =>
            largoDe(bloque, tamano) > largoDe(largo, tamano) ? bloque : largo,
        );

        peor.cols += 1;
        peor.filas = Math.ceil(peor.jugadores.length / peor.cols);
      }
    });
  };

  /* 3 · Tamaño de ficha con el que todo cabe. */

  /*
  | El alto de la ficha depende del propio tamaño (la tipografía y la chapa del
  | dorsal están topadas por arriba y por abajo), así que no se puede despejar
  | de una fórmula: buscamos por bisección la ficha más grande con la que todo
  | cabe de verdad, a lo largo y a lo hondo.
  */
  const buscaTamano = () => {
    const cabe = (tamano: number) => {
      /* Tumbado la forma depende del tamaño: se rehace en cada prueba. */
      if (horizontal) formaBandas(tamano);

      return pideFondo(tamano) <= fondoTotal && pideLargo(tamano) <= largoLibre;
    };

    let bajo = medidas.busquedaMin;
    let arriba = medidas.busquedaMax;

    if (!cabe(bajo)) return bajo;
    if (cabe(arriba)) return arriba;

    for (let paso = 0; paso < 40; paso += 1) {
      const medio = (bajo + arriba) / 2;

      if (cabe(medio)) bajo = medio;
      else arriba = medio;
    }

    return bajo;
  };

  let mejor = -Infinity;

  if (horizontal) {
    /* Tumbado la forma la decide `formaBandas` dentro de la propia búsqueda. */
    mejor = buscaTamano();
  } else {
    /*
    | En una banda con muchos bloques (laterales + tres bloques de centrales es
    | el caso típico) el ancho es lo que aprieta y la ficha se queda diminuta.
    | Probamos también bloques de dos y de una columna —apilar en vertical
    | estrecha la banda— y nos quedamos con el reparto que deja la ficha más
    | grande. Como la búsqueda elige el máximo, probar de más nunca empeora.
    */
    let mejorTope = medidas.opcionesColumnas[0];

    medidas.opcionesColumnas.forEach((tope) => {
      formaBloques(tope);

      const cabe = buscaTamano();

      if (cabe > mejor) {
        mejor = cabe;
        mejorTope = tope;
      }
    });

    formaBloques(mejorTope);
  }

  const tamano = Math.max(medidas.suelo, mejor);

  /* La última prueba de la bisección pudo ser con una ficha que no cabía. */
  if (horizontal) formaBandas(tamano);

  const paso = medidas.paso(tamano);
  const chapaAlto = medidas.chapaAlto(tamano);
  const huecoFila = medidas.huecoFila(tamano);
  const huecoBanda = medidas.huecoBanda(tamano);
  const huecoBloque = medidas.huecoBloque(tamano);

  bloques.forEach((bloque) => {
    bloque.altoDeFicha = medidas.altoFicha(tamano, bloque.etiquetado);
    bloque.pasoFila = bloque.altoDeFicha + huecoFila;
    bloque.ancho = bloque.cols * paso;
    bloque.alto = chapaAlto + bloque.filas * bloque.pasoFila;
  });

  /*
  | 4 · Reparto dentro de la banda: cada bloque en su ancla, sin pisarse. De
  | pie eso es repartir a lo ancho; tumbado, a lo alto.
  |
  | Antes se empujaba cada bloque hacia un lado sin tope y, al final, un recorte
  | devolvía al campo lo que se hubiera salido. En una banda que no cabe entera
  | —laterales derechos + tres bloques de centrales es el caso típico— ese
  | recorte dejaba dos bloques en la misma posición, uno encima del otro.
  | `reparteFila` no puede hacer eso.
  */
  bandas.forEach((banda) => {
    /* Tumbado el campo gira en el sentido del reloj: la banda izquierda queda
       arriba, así que el mismo orden de anclas vale para los dos casos. */
    banda.bloques.sort((a, b) => a.anchorX - b.anchorX);

    const centros = reparteFila(
      banda.bloques.map((bloque) => (horizontal ? bloque.alto : bloque.ancho)),
      banda.bloques.map((bloque) => bloque.anchorX * largoTotal),
      largoPad,
      largoTotal - largoPad,
      huecoBloque,
    );

    banda.bloques.forEach((bloque, indice) => {
      bloque.largo = centros[indice];
    });
  });

  /* 5 · Cada banda a su profundidad, sin pisar a la anterior. */

  /* Lo que ocupa la banda en el eje profundo: su bloque más hondo. */
  const fondos = bandas.map((banda) =>
    banda.bloques.reduce(
      (hondo, bloque) =>
        Math.max(hondo, horizontal ? bloque.ancho : bloque.alto),
      0,
    ),
  );

  const centros = bandas.map(
    (banda) => (horizontal ? 1 - banda.anchorY : banda.anchorY) * fondoTotal,
  );

  /* Avanzando: nadie pisa a la banda anterior. */
  let cursor = fondoPad;

  bandas.forEach((banda, indice) => {
    const mitad = fondos[indice] / 2;

    centros[indice] = Math.max(centros[indice], cursor + mitad);
    cursor = centros[indice] + mitad + huecoBanda;
  });

  /* Volviendo: lo que se haya salido por el final vuelve a entrar. */
  let tope = fondoTotal - fondoPad;

  for (let indice = bandas.length - 1; indice >= 0; indice -= 1) {
    const mitad = fondos[indice] / 2;

    centros[indice] = Math.min(centros[indice], tope - mitad);
    tope = centros[indice] - mitad - huecoBanda;
  }

  /*
  | Red de seguridad: si ni con la ficha al mínimo cabe todo, preferimos
  | amontonar un poco a que alguien acabe fuera del campo.
  */
  cursor = fondoPad;

  bandas.forEach((banda, indice) => {
    const mitad = fondos[indice] / 2;

    centros[indice] = Math.min(
      Math.max(centros[indice], cursor + mitad),
      Math.max(fondoPad + mitad, fondoTotal - fondoPad - mitad),
    );

    cursor = centros[indice] + mitad + huecoBanda;
  });

  /* 6 · Colocar a cada jugador dentro de su bloque. */

  const colocados: BloqueRepartido<T>[] = [];
  const fichas: FichaRepartida<T>[] = [];

  bandas.forEach((banda, indiceBanda) => {
    const arranque = centros[indiceBanda] - fondos[indiceBanda] / 2;

    const chapas: BloqueRepartido<T>[] = [];

    banda.bloques.forEach((bloque) => {
      const pila = bloque.filas * bloque.pasoFila;

      /*
      | De pie, la banda es una franja: el bloque se centra a lo alto de ella y
      | su sitio a lo ancho es el que le dio el paso 4. Tumbado la banda es una
      | columna y los papeles se invierten: el bloque se centra a lo ancho de la
      | columna y es el eje vertical el que le trae repartido su sitio.
      */
      const bloqueX = horizontal
        ? arranque + fondos[indiceBanda] / 2
        : bloque.largo;

      const bloqueArriba = horizontal
        ? bloque.largo - bloque.alto / 2 + chapaAlto
        : arranque + chapaAlto + (fondos[indiceBanda] - chapaAlto - pila) / 2;

      const colocado: BloqueRepartido<T> = {
        key: bloque.key,
        cuantos: bloque.jugadores.length,
        cols: bloque.cols,
        filas: bloque.filas,
        chapaX: bloqueX,
        arriba: bloqueArriba,
        cajaX: bloqueX,
        /*
        | El bloque ya reserva medio hueco de fila por arriba y por abajo
        | (`pasoFila` es ficha + hueco), así que la caja se sube medio hueco y
        | mide filas enteras: queda el mismo aire por los cuatro lados sin
        | pedirle sitio de más al reparto.
        */
        cajaArriba: bloqueArriba - huecoFila / 2,
        cajaAncho: bloque.ancho,
        cajaAlto: pila,
        fichas: [],
      };

      chapas.push(colocado);
      colocados.push(colocado);

      bloque.jugadores.forEach((item, indice) => {
        const fila = Math.floor(indice / bloque.cols);
        const columna = indice % bloque.cols;

        /* La última fila puede ir a medias —cinco en una rejilla de dos—, así
           que se centra sola en vez de dejar un hueco a un lado. */
        const enLaFila = Math.min(
          bloque.cols,
          bloque.jugadores.length - fila * bloque.cols,
        );

        const ficha: FichaRepartida<T> = {
          item,
          etiquetado: bloque.etiquetado,
          x: bloqueX + (columna - (enLaFila - 1) / 2) * paso,
          y: bloqueArriba + fila * bloque.pasoFila + bloque.altoDeFicha / 2,
        };

        colocado.fichas.push(ficha);
        fichas.push(ficha);
      });
    });

    /*
    | Las chapas se deslizan lo justo para no pisarse. Van centradas sobre su
    | bloque, pero una chapa es más ancha que un bloque de una sola columna, así
    | que en bandas apretadas dos vecinas se tocaban. Que una chapa quede un
    | poco descentrada sobre los suyos no se nota; que se solape con la de al
    | lado, sí.
    |
    | Tumbado no hace falta: los bloques de una banda van uno debajo de otro y
    | el hueco de cada chapa ya está reservado en el reparto del paso 4.
    */
    if (!horizontal && chapas.length > 1) {
      const centrosChapa = reparteFila(
        banda.bloques.map((bloque) => bloque.anchoChapa),
        chapas.map((chapa) => chapa.chapaX),
        medidas.padAncho,
        ancho - medidas.padAncho,
        medidas.huecoChapa,
      );

      chapas.forEach((chapa, indice) => {
        chapa.chapaX = centrosChapa[indice];
      });
    }
  });

  return {
    bloques: colocados,
    fichas,
    tamano,
    paso,
    altoFicha: medidas.altoFicha(tamano, false),
  };
}
