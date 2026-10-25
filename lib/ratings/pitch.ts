/**
 * Campograma de la plantilla propia.
 *
 * A diferencia del de rivales —que adivina la línea de un texto libre—, aquí
 * las posiciones vienen de nuestra hoja y son un juego cerrado: PORTERO,
 * CENTRAL, LATERAL D./I. y los dorsales de rol 6, 8, 10, 7, 11 y 9.
 *
 * El reparto tiene tres reglas, y en este orden:
 *
 *   1 · Nadie se pisa. Primero se calcula qué tamaño de ficha cabe y luego se
 *       separan las líneas hasta garantizar el hueco mínimo.
 *   2 · Cada línea se abre en sub-filas cuando hay demasiada gente, y las
 *       mejores notas ocupan la sub-fila de delante.
 *   3 · Dentro de la sub-fila se reparte de forma uniforme, con laterales y
 *       extremos abriéndose a su banda.
 *
 * El campo se pinta en dos orientaciones y el motor es el mismo para las dos:
 * en vertical se ataca hacia arriba (móvil, pantalla alta y estrecha) y en
 * horizontal hacia la derecha (portátil y escritorio, pantalla apaisada).
 * Internamente no se razona en X/Y sino en dos ejes abstractos:
 *
 *   · «profundidad» — el eje del ataque, el que separa las líneas.
 *   · «anchura»     — el eje perpendicular, el que reparte una línea.
 *
 * En vertical profundidad = Y y anchura = X; en horizontal, al revés. Sólo el
 * último paso traduce esos dos números a píxeles de pantalla.
 */

import {
  ANCLAS_SLOT,
  ANCLA_SUELTA,
  SLOTS_DE_BANDA,
  columnasDeBanda,
  columnasDeBloque,
  reparteCampograma,
  type BloqueEntrada,
} from "@/lib/rivals/campograma-motor";

export type PitchRowKey = "del" | "band" | "diez" | "ocho" | "piv" | "def" | "por";

/** Cómo se pinta el campo: atacando hacia arriba o hacia la derecha. */
export type PitchOrientation = "vertical" | "horizontal";

export const ROW_LABELS: Record<PitchRowKey, string> = {
  del: "Delanteros",
  band: "Extremos",
  diez: "Mediapuntas",
  ocho: "Interiores",
  piv: "Pivotes",
  def: "Defensas",
  por: "Porteros",
};

/** Ancho mínimo cómodo por ficha: por debajo, los nombres se solapan. */
const MIN_SLOT_X = 96;

/** Alto mínimo cómodo por ficha: foto pequeña + su pie. */
const MIN_SLOT_Y = 66;

/** Cuánta gente cabe en una sub-fila antes de abrir otra. */
const MAX_PER_SUB_ROW: Record<PitchOrientation, number> = {
  vertical: 5,
  horizontal: 6,
};

const PAD_X = 24;
const PAD_Y = 16;
const ROW_GAP = 8;

/** Alto del pie de ficha: nombre solo, o nombre + partidos y minutos. */
const LABEL_FULL = 36;
const LABEL_COMPACT = 22;

/** Por debajo de este diámetro la foto deja de reconocerse. */
const MIN_AVATAR = 30;
const MAX_AVATAR = 66;

function normalize(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

/*
| La hoja escribe el puesto con palabras o con su número de rol, y de números
| no sólo usa 1, 6-11: también 2 y 3 (laterales), 4 y 5 (centrales) y 13 (el
| portero suplente). Antes esos caían en el «resto» —el interior—, así que un
| lateral escrito «2» salía dibujado entre los centrocampistas.
*/
const PUESTO_DE_ROL: Record<string, string> = {
  "1": "PORTERO",
  "13": "PORTERO",
  "2": "LATERAL D",
  "3": "LATERAL I",
  "4": "CENTRAL",
  "5": "CENTRAL",
};

function puestoLeido(position: string) {
  const p = normalize(position);

  return PUESTO_DE_ROL[p] ?? p;
}

export function detectRow(position: string): PitchRowKey {
  const p = puestoLeido(position);

  if (p.startsWith("PORTERO") || p === "1") return "por";
  if (p.startsWith("LATERAL") || p.startsWith("CENTRAL") || p.startsWith("DEFENSA")) {
    return "def";
  }

  if (p === "9" || p.startsWith("DELANTERO")) return "del";
  if (p === "7" || p === "11" || p.startsWith("EXTREMO")) return "band";
  if (p === "10" || p.startsWith("MEDIAPUNTA")) return "diez";
  if (p === "6" || p.startsWith("PIVOTE")) return "piv";

  return "ocho";
}

/**
 * La línea del jugador —portero, defensa, medio o ataque— para agrupar y
 * filtrar.
 *
 * 19/10/2026: la lista de valorar y la media por líneas del equipo comparaban
 * el puesto con una lista cerrada ("PORTERO", "LATERAL D.", "6"…), así que un
 * portero escrito con su número de rol —la hoja usa las dos formas, ver
 * `lib/posiciones.ts`— caía entre los centrocampistas al valorar y
 * desaparecía de la media por líneas. Ahora sale de `detectRow`, la misma
 * lectura que coloca a cada uno en el campograma.
 */
export type LineaKey = "por" | "def" | "med" | "del";

export function lineaDe(position: string): LineaKey {
  const row = detectRow(position);

  if (row === "por" || row === "def" || row === "del") return row;
  if (row === "band") return "del";

  return "med";
}

export type PitchItem = {
  id: string;
  position: string;
  /** Cuanto mayor, más adelante se coloca cuando la línea se parte en varias. */
  rank?: number;
};

export type PlacedItem<T extends PitchItem> = {
  item: T;
  row: PitchRowKey;
  x: number;
  y: number;
  /** Ancho en píxeles reservado al nombre: lo recorta sin invadir al vecino. */
  slot: number;
};

export type PitchLayout<T extends PitchItem> = {
  placed: PlacedItem<T>[];
  clusters: PitchCluster[];
  avatar: number;
  /** Con la plantilla entera no caben los pies de ficha: se ocultan. */
  compact: boolean;
};

function empty<T extends PitchItem>(): PitchLayout<T> {
  return { placed: [], clusters: [], avatar: 0, compact: false };
}

/** El eje que reparte cada línea: su tamaño, su margen y su hueco mínimo. */
function acrossAxis(
  orientation: PitchOrientation,
  width: number,
  height: number
) {
  const vertical = orientation === "vertical";

  const extent = vertical ? width : height;
  const pad = vertical ? PAD_X : PAD_Y;

  return {
    extent,
    pad,
    usable: Math.max(120, extent - 2 * pad),
    minSlot: vertical ? MIN_SLOT_X : MIN_SLOT_Y,
  };
}

/** Cuántas fichas caben una junto a otra con el espacio disponible. */
function perSubRow(
  orientation: PitchOrientation,
  width: number,
  height: number
) {
  const across = acrossAxis(orientation, width, height);

  return Math.max(
    2,
    Math.min(
      MAX_PER_SUB_ROW[orientation],
      Math.floor(across.usable / across.minSlot)
    )
  );
}

/** En cuántas sub-filas acaba repartiéndose la lista con este espacio. */
function countSubRows<T extends PitchItem>(
  items: T[],
  orientation: PitchOrientation,
  width: number,
  height: number
) {
  const max = perSubRow(orientation, width, height);

  const counts = new Map<PitchRowKey, number>();

  items.forEach((item) => {
    const key = detectRow(item.position);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  let rows = 0;

  counts.forEach((total) => {
    rows += Math.ceil(total / max);
  });

  return rows;
}

/**
 * Alto que necesita el campo para que nadie se pise.
 *
 * En vertical, con la plantilla entera y una pantalla estrecha no hay forma de
 * meter 44 fichas legibles en una sola vista: en vez de amontonarlas, el campo
 * crece y la página se desplaza. Con los valorados —el caso normal— devuelve el
 * alto de base.
 *
 * En horizontal las líneas se separan a lo ancho, no a lo alto: el campo se
 * queda con el alto de base para no obligar a hacer scroll en un portátil.
 */
export function recommendedHeight<T extends PitchItem>(
  items: T[],
  width: number,
  base: number,
  orientation: PitchOrientation = "vertical"
) {
  if (items.length === 0 || width < 120) return base;
  if (orientation === "horizontal") return base;

  const rows = countSubRows(items, orientation, width, base);

  /* Foto cómoda (44) + pie compacto + aire entre líneas. */
  const perRowHeight = 44 + LABEL_COMPACT + ROW_GAP;

  return Math.max(base, Math.round(rows * perRowHeight + 2 * PAD_Y));
}

/** Reparte `total` elementos en `count` grupos que difieren como mucho en uno. */

/*
|--------------------------------------------------------------------------
| EL MISMO MOTOR QUE EL CAMPOGRAMA DE RIVALES
|--------------------------------------------------------------------------
|
| Antes esta pantalla repartía cada línea en huecos iguales a lo ancho, y eso
| sólo coloca bien un 1-4-3-3 exacto: con la plantilla de verdad —cuatro
| extremos, cinco defensas, dos dieces— salían jugadores en sitios donde nadie
| juega y el campo dejaba de leerse como un equipo.
|
| El campograma del rival ya tenía resuelto esto con otra idea: **cada
| posición tiene su sitio en el campo** (`ANCLAS_SLOT`) y la gente de una misma
| posición forma un bloque que se coloca lo más cerca posible de ese sitio,
| buscando el tamaño de ficha más grande con el que todo cabe. Es el mismo
| motor, `lib/rivals/campograma-motor.ts`, así que ahora las dos pantallas
| colocan igual y lo que se arregle en una vale para la otra.
|
| Lo único de aquí es la traducción de nuestro vocabulario —PORTERO, CENTRAL,
| LATERAL D./I. y los dorsales de rol 6, 8, 10, 7, 11 y 9— a los slots de ese
| motor, y las medidas de esta ficha, que lleva nombre y pie debajo de la foto.
*/

/** De nuestra posición al slot del motor de rivales. */
function slotDePosicion(position: string): string {
  const p = puestoLeido(position);

  if (p.startsWith("PORTERO") || p === "1") return "por";
  if (p.startsWith("LATERAL I") || p.startsWith("CARRILERO I")) return "li";
  if (p.startsWith("LATERAL D") || p.startsWith("CARRILERO D")) return "ld";
  if (p.startsWith("CENTRAL") || p.startsWith("DEFENSA")) return "dfc";
  if (p === "6" || p.startsWith("PIVOTE")) return "mcd";
  if (p === "10" || p.startsWith("MEDIAPUNTA")) return "mp";
  if (p === "11" || p.startsWith("EXTREMO I")) return "ei";
  if (p === "7" || p.startsWith("EXTREMO D")) return "ed";
  if (p === "9" || p.startsWith("DELANTERO")) return "dc";

  /* El 8 y todo lo que no se reconozca, al interior: es el centro del campo. */
  return "int";
}

/** Orden de los slots en el campo, para leer el reparto de atrás adelante. */
const ORDEN_SLOT = ["por", "li", "dfc", "ld", "mcd", "int", "mp", "ei", "ed", "dc"];

/*
| La chapa de cada bloque: el mismo código y el mismo color de línea que en
| Plantillas rivales, para que los dos campogramas se lean igual.
*/
const PORTERO = "#D4A017";
const DEFENSA = "#7DA6D9";
const MEDIO = "#52B788";
const ATAQUE = "#D46A6A";

const CHAPA_DE_SLOT: Record<string, { code: string; color: string }> = {
  por: { code: "POR", color: PORTERO },
  li: { code: "LI", color: DEFENSA },
  dfc: { code: "DFC", color: DEFENSA },
  ld: { code: "LD", color: DEFENSA },
  mcd: { code: "MCD", color: MEDIO },
  int: { code: "INT", color: MEDIO },
  mp: { code: "MP", color: MEDIO },
  ei: { code: "EI", color: ATAQUE },
  ed: { code: "ED", color: ATAQUE },
  dc: { code: "DC", color: ATAQUE },
};

const CHAPA_ALTO = 15;

/** El fondo y la chapa que agrupan a los de una posición. */
export type PitchCluster = {
  key: string;
  code: string;
  color: string;
  count: number;
  /** Centro de la chapa: va justo encima de su bloque. */
  x: number;
  y: number;
  boxX: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
};

export function layoutPitch<T extends PitchItem>(
  items: T[],
  width: number,
  height: number,
  orientation: PitchOrientation = "vertical"
): PitchLayout<T> {
  if (items.length === 0 || width < 120 || height < 200) return empty<T>();

  const horizontal = orientation === "horizontal";

  /* 1 · Un bloque por posición, y dentro los mejores primero. */

  const bloques = new Map<string, BloqueEntrada<T>>();

  items.forEach((item) => {
    const key = slotDePosicion(item.position);
    const ancla = ANCLAS_SLOT[key] ?? ANCLA_SUELTA;

    const existente = bloques.get(key);

    if (existente) {
      existente.jugadores.push(item);

      return;
    }

    bloques.set(key, {
      key,
      anchorX: ancla.x,
      anchorY: ancla.y,
      banda: SLOTS_DE_BANDA.has(key),
      etiquetado: false,
      jugadores: [item],
      anchoChapa: 0,
    });
  });

  /* Ancho de la chapa, medido como en rivales: px-1.5, borde, código a 9 px y
     el contador al lado. */
  bloques.forEach((bloque) => {
    bloque.anchoChapa =
      14 +
      (CHAPA_DE_SLOT[bloque.key]?.code.length ?? 3) * 5.6 +
      4 +
      String(bloque.jugadores.length).length * 5.4;
  });

  const entradas = [...bloques.values()]
    .sort((a, b) => ORDEN_SLOT.indexOf(a.key) - ORDEN_SLOT.indexOf(b.key))
    .map((bloque) => ({
      ...bloque,
      /* La mejor nota, delante de su bloque. */
      jugadores: [...bloque.jugadores].sort((a, b) => {
        const diff = (b.rank ?? 0) - (a.rank ?? 0);

        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }),
    }));

  /* 2 · Las medidas de esta ficha: foto redonda, nombre y pie debajo. */

  const reparte = (etiquetaAlta: boolean) =>
    reparteCampograma(entradas, {
      ancho: width,
      alto: height,
      horizontal,
      padAncho: PAD_X,
      padAlto: PAD_Y,
      chapaAlto: () => CHAPA_ALTO,
      huecoFila: () => ROW_GAP,
      huecoBanda: () => (horizontal ? 10 : 12),
      /* Tumbado, el aire de más es para que se vea el corte entre dos fondos
         del mismo color, como en rivales. */
      huecoBloque: (tamano) => (horizontal ? ROW_GAP + 12 : tamano * 0.5),
      paso: (tamano) => Math.max(tamano * 1.45, tamano + 8),
      altoFicha: (tamano) =>
        tamano + (etiquetaAlta ? LABEL_FULL : LABEL_COMPACT),
      margenBanda: horizontal ? 0.03 : 0.07,
      busquedaMin: 1,
      busquedaMax: MAX_AVATAR,
      suelo: 6,
      opcionesColumnas: [3, 2, 1],
      columnasDeBanda,
      columnasDeBloque,
      huecoChapa: 3,
    });

  /*
  | Dos pasadas, porque el pie de ficha depende del tamaño y el tamaño del pie.
  | Se prueba con el pie entero y, si la foto sale tan pequeña que el pie no se
  | va a pintar, se repite reclamando sólo el alto del nombre: así la foto gana
  | los píxeles que el pie ya no ocupa.
  */
  let reparto = reparte(true);
  let compact = reparto.tamano < MIN_AVATAR + 10;

  if (compact) reparto = reparte(false);

  if (reparto.fichas.length === 0) return empty<T>();

  const avatar = Math.max(MIN_AVATAR, Math.min(MAX_AVATAR, reparto.tamano));

  compact = avatar < MIN_AVATAR + 10;

  /* 3 · Del reparto a lo que pinta el JSX. */

  const placed: PlacedItem<T>[] = reparto.fichas.map((ficha) => ({
    item: ficha.item,
    row: detectRow(ficha.item.position),
    x: ficha.x,
    y: ficha.y,
    /* El nombre dispone del paso entre fichas: recorta sin invadir al vecino. */
    slot: Math.max(MIN_SLOT_X * 0.75, reparto.paso),
  }));

  const clusters: PitchCluster[] = reparto.bloques.map((bloque) => {
    const chapa = CHAPA_DE_SLOT[bloque.key] ?? { code: "S/P", color: "#9AA3AD" };

    return {
      key: bloque.key,
      code: chapa.code,
      color: chapa.color,
      count: bloque.cuantos,
      x: bloque.chapaX,
      y: bloque.arriba - 3,
      boxX: bloque.cajaX,
      boxTop: bloque.cajaArriba,
      boxWidth: bloque.cajaAncho,
      boxHeight: bloque.cajaAlto,
    };
  });

  return { placed, clusters, avatar, compact };
}
