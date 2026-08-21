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
 *   3 · Dentro de la sub-fila se reparte a lo ancho de forma uniforme, con
 *       laterales y extremos abriéndose a su banda.
 */

export type PitchRowKey = "del" | "band" | "diez" | "ocho" | "piv" | "def" | "por";

/** Altura preferida de cada línea, en fracción del alto del campo. */
const PITCH_ROWS: { key: PitchRowKey; top: number }[] = [
  { key: "del", top: 0.1 },
  { key: "band", top: 0.25 },
  { key: "diez", top: 0.39 },
  { key: "ocho", top: 0.52 },
  { key: "piv", top: 0.64 },
  { key: "def", top: 0.79 },
  { key: "por", top: 0.94 },
];

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
const MIN_SLOT = 96;

/** Separación entre sub-filas de una misma línea, en fracción del alto. */
const SUB_ROW_SPREAD = 0.085;

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

export function detectRow(position: string): PitchRowKey {
  const p = normalize(position);

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

/** Cuánto se abre hacia una banda: −1 izquierda, +1 derecha. */
function horizontalPreference(position: string) {
  const p = normalize(position);

  if (p.startsWith("LATERAL D")) return 0.78;
  if (p.startsWith("LATERAL I")) return -0.78;
  if (p === "7") return 0.62;
  if (p === "11") return -0.62;

  return 0;
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
  /** Ancho reservado para esta ficha: recorta el nombre sin invadir al vecino. */
  slot: number;
};

export type PitchLayout<T extends PitchItem> = {
  placed: PlacedItem<T>[];
  avatar: number;
  /** Con la plantilla entera no caben los pies de ficha: se ocultan. */
  compact: boolean;
};

function empty<T extends PitchItem>(): PitchLayout<T> {
  return { placed: [], avatar: 0, compact: false };
}

/** Cuántas fichas caben una al lado de otra con el ancho disponible. */
function perSubRow(width: number) {
  const usable = Math.max(120, width - 2 * PAD_X);

  return Math.max(2, Math.min(5, Math.floor(usable / MIN_SLOT)));
}

/** En cuántas sub-filas acaba repartiéndose la lista con este ancho. */
function countSubRows<T extends PitchItem>(items: T[], width: number) {
  const perRow = perSubRow(width);

  const counts = new Map<PitchRowKey, number>();

  items.forEach((item) => {
    const key = detectRow(item.position);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  let rows = 0;

  counts.forEach((total) => {
    rows += Math.ceil(total / perRow);
  });

  return rows;
}

/**
 * Alto que necesita el campo para que nadie se pise.
 *
 * Con la plantilla entera y una pantalla estrecha no hay forma de meter 44
 * fichas legibles en una sola vista: en vez de amontonarlas, el campo crece
 * y se desplaza. Con los valorados —el caso normal— devuelve el alto de base.
 */
export function recommendedHeight<T extends PitchItem>(
  items: T[],
  width: number,
  base: number
) {
  if (items.length === 0 || width < 120) return base;

  const rows = countSubRows(items, width);

  /* Foto cómoda (44) + pie compacto + aire entre líneas. */
  const perRowHeight = 44 + LABEL_COMPACT + ROW_GAP;

  return Math.max(base, Math.round(rows * perRowHeight + 2 * PAD_Y));
}

/** Reparte `total` elementos en `count` grupos que difieren como mucho en uno. */
function chunkSizes(total: number, count: number) {
  const base = Math.floor(total / count);
  const extra = total % count;

  return Array.from({ length: count }, (_, index) =>
    index < extra ? base + 1 : base
  );
}

export function layoutPitch<T extends PitchItem>(
  items: T[],
  width: number,
  height: number
): PitchLayout<T> {
  if (items.length === 0 || width < 120 || height < 200) return empty<T>();

  /* 1 · Agrupar por línea. */

  const grouped = new Map<PitchRowKey, T[]>();

  items.forEach((item) => {
    const key = detectRow(item.position);
    const list = grouped.get(key);

    if (list) list.push(item);
    else grouped.set(key, [item]);
  });

  /* 2 · Partir cada línea en sub-filas: las mejores notas, delante. */

  const usableWidth = Math.max(120, width - 2 * PAD_X);

  const maxPerSubRow = perSubRow(width);

  const subRows: { items: T[]; band: number; top: number }[] = [];

  PITCH_ROWS.forEach((row) => {
    const list = grouped.get(row.key);

    if (!list || list.length === 0) return;

    const count = Math.ceil(list.length / maxPerSubRow);

    /* Por nota descendente: la sub-fila 0 —la de delante— se lleva a los mejores. */
    const byRank = [...list].sort((a, b) => {
      const diff = (b.rank ?? 0) - (a.rank ?? 0);

      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    let cursor = 0;

    chunkSizes(byRank.length, count).forEach((size, index) => {
      const chunk = byRank.slice(cursor, cursor + size);

      cursor += size;

      /* Dentro de la sub-fila mandan las bandas: izquierda → derecha. */
      chunk.sort((a, b) => {
        const prefA = horizontalPreference(a.position);
        const prefB = horizontalPreference(b.position);

        if (prefA !== prefB) return prefA - prefB;

        return a.id.localeCompare(b.id);
      });

      const maxPreference = chunk.reduce(
        (max, item) => Math.max(max, Math.abs(horizontalPreference(item.position))),
        0
      );

      const band = Math.min(
        1,
        Math.max(0.34, maxPreference + 0.2, 0.22 * chunk.length)
      );

      subRows.push({
        items: chunk,
        band,
        top: (row.top + (index - (count - 1) / 2) * SUB_ROW_SPREAD) * height,
      });
    });
  });

  if (subRows.length === 0) return empty<T>();

  subRows.sort((a, b) => a.top - b.top);

  /* 3 · Tamaño de ficha con el que todas las sub-filas caben a la vez. */

  const rows = subRows.length;

  const spacePerRow = (height - 2 * PAD_Y - ROW_GAP * (rows - 1)) / rows;

  /*
  | El pie de ficha (PJ · minutos) se sacrifica antes que el tamaño de la foto:
  | sólo se mantiene si con él la foto sigue siendo grande de verdad.
  */
  const compact = spacePerRow - LABEL_FULL < 44;
  const labelHeight = compact ? LABEL_COMPACT : LABEL_FULL;

  const narrowestSlot = subRows.reduce((min, row) => {
    const slot = (usableWidth * row.band) / row.items.length;

    return Math.min(min, slot);
  }, Infinity);

  const avatar = Math.max(
    MIN_AVATAR,
    Math.min(MAX_AVATAR, spacePerRow - labelHeight, narrowestSlot * 0.82)
  );

  /* La foto se centra en `y` y el nombre cuelga por debajo: no es simétrico. */
  const cardHeight = avatar + labelHeight;
  const gap = cardHeight + ROW_GAP;

  /* 4 · Relajar alturas: hueco mínimo garantizado y todo dentro del campo. */

  const minTop = PAD_Y + avatar / 2;
  const maxTop = height - PAD_Y - avatar / 2 - labelHeight;

  const tops = subRows.map((row) => row.top);

  tops[0] = Math.max(tops[0], minTop);

  for (let index = 1; index < rows; index += 1) {
    tops[index] = Math.max(tops[index], tops[index - 1] + gap);
  }

  /* Si el empujón hacia abajo se sale del campo, se recoloca de abajo arriba. */
  if (tops[rows - 1] > maxTop) {
    tops[rows - 1] = maxTop;

    for (let index = rows - 2; index >= 0; index -= 1) {
      tops[index] = Math.min(tops[index], tops[index + 1] - gap);
    }
  }

  /* Última red: si ni así cabe todo, reparto uniforme de arriba abajo. */
  if (tops[0] < minTop) {
    const span = Math.max(0, maxTop - minTop);

    for (let index = 0; index < rows; index += 1) {
      tops[index] =
        rows === 1 ? (minTop + maxTop) / 2 : minTop + (span * index) / (rows - 1);
    }
  }

  /* 5 · Posición horizontal: reparto uniforme dentro de la banda de la sub-fila. */

  const placed: PlacedItem<T>[] = [];

  subRows.forEach((row, rowIndex) => {
    const count = row.items.length;
    const y = tops[rowIndex];
    const bandWidth = usableWidth * row.band;
    const slot = bandWidth / count;

    if (count === 1) {
      placed.push({
        item: row.items[0],
        row: detectRow(row.items[0].position),
        x: width / 2,
        y,
        slot: Math.min(usableWidth, MIN_SLOT * 1.6),
      });

      return;
    }

    const start = width / 2 - bandWidth / 2;

    row.items.forEach((item, index) => {
      placed.push({
        item,
        row: detectRow(item.position),
        x: start + slot * (index + 0.5),
        y,
        slot,
      });
    });
  });

  return { placed, avatar, compact };
}
