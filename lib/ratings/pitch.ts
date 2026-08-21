/**
 * Campograma de la plantilla propia.
 *
 * A diferencia del de rivales —que adivina la línea de un texto libre—, aquí
 * las posiciones vienen de nuestra hoja y son un juego cerrado: PORTERO,
 * CENTRAL, LATERAL D./I. y los dorsales de rol 6, 8, 10, 7, 11 y 9.
 *
 * El reparto es el mismo en espíritu: cada línea se abre en sub-filas cuando
 * hay demasiada gente, el tamaño de ficha se despeja para que todo quepa y
 * luego se relajan las alturas para garantizar la separación mínima.
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
  { key: "por", top: 0.93 },
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

function normalize(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  if (p === "LATERAL D." || p.startsWith("LATERAL D")) return 0.78;
  if (p === "LATERAL I." || p.startsWith("LATERAL I")) return -0.78;
  if (p === "7") return 0.62;
  if (p === "11") return -0.62;

  return 0;
}

export type PitchItem = {
  id: string;
  position: string;
};

export type PlacedItem<T extends PitchItem> = {
  item: T;
  x: number;
  y: number;
};

export type PitchLayout<T extends PitchItem> = {
  placed: PlacedItem<T>[];
  avatar: number;
};

export function layoutPitch<T extends PitchItem>(
  items: T[],
  width: number,
  height: number
): PitchLayout<T> {
  if (items.length === 0 || width < 120 || height < 200) {
    return { placed: [], avatar: 0 };
  }

  /* 1 · Agrupar por línea y ordenar de izquierda a derecha. */

  const grouped = new Map<PitchRowKey, T[]>();

  items.forEach((item) => {
    const key = detectRow(item.position);
    const list = grouped.get(key);

    if (list) list.push(item);
    else grouped.set(key, [item]);
  });

  grouped.forEach((list) => {
    list.sort((a, b) => {
      const prefA = horizontalPreference(a.position);
      const prefB = horizontalPreference(b.position);

      if (prefA !== prefB) return prefA - prefB;

      return a.id.localeCompare(b.id);
    });
  });

  /* 2 · Repartir cada línea en sub-filas que cubran todo el ancho. */

  const maxPerSubRow = Math.max(3, Math.min(6, Math.floor(width / 104)));

  const subRows: { items: T[]; band: number; top: number }[] = [];

  PITCH_ROWS.forEach((row) => {
    const list = grouped.get(row.key);

    if (!list || list.length === 0) return;

    const count = Math.ceil(list.length / maxPerSubRow);
    const chunks: T[][] = Array.from({ length: count }, () => []);

    /* Alternamos en vez de trocear: cada sub-fila mantiene el abanico entero. */
    list.forEach((item, index) => chunks[index % count].push(item));

    chunks.forEach((chunk, index) => {
      const maxPreference = chunk.reduce(
        (max, item) => Math.max(max, Math.abs(horizontalPreference(item.position))),
        0
      );

      const band = Math.min(
        1,
        Math.max(0.4, maxPreference + 0.14, 0.24 * chunk.length)
      );

      subRows.push({
        items: chunk,
        band,
        top: row.top * height + (index - (count - 1) / 2),
      });
    });
  });

  if (subRows.length === 0) return { placed: [], avatar: 0 };

  subRows.sort((a, b) => a.top - b.top);

  /* 3 · Tamaño de ficha con el que todas las sub-filas caben. */

  const rows = subRows.length;

  const padY = 18;
  const padX = 26;
  const labelHeight = 40;
  const rowGapExtra = 6;

  const byHeight =
    (height - 2 * padY - rowGapExtra * (rows - 1)) / rows - labelHeight;

  const narrowestSlot = subRows.reduce((min, row) => {
    const slot = ((width - 2 * padX) * row.band) / row.items.length;

    return Math.min(min, slot);
  }, Infinity);

  const avatar = Math.max(26, Math.min(64, byHeight, narrowestSlot * 0.76));

  const cardHeight = avatar + labelHeight;
  const gap = cardHeight + rowGapExtra;

  /* 4 · Relajar alturas: separación mínima y todo dentro del campo. */

  const minTop = padY + cardHeight / 2;
  const maxTop = height - padY - cardHeight / 2;

  const tops = subRows.map((row) => row.top);

  tops[0] = Math.max(tops[0], minTop);

  for (let index = 1; index < rows; index += 1) {
    tops[index] = Math.max(tops[index], tops[index - 1] + gap);
  }

  if (tops[rows - 1] > maxTop) {
    tops[rows - 1] = maxTop;

    for (let index = rows - 2; index >= 0; index -= 1) {
      tops[index] = Math.min(tops[index], tops[index + 1] - gap);
    }

    for (let index = 0; index < rows; index += 1) {
      tops[index] = Math.max(tops[index], minTop + index * gap);
    }
  }

  for (let index = 0; index < rows; index += 1) {
    tops[index] = Math.min(Math.max(tops[index], minTop), maxTop);
  }

  /* 5 · Posición horizontal: reparto uniforme dentro de la banda. */

  const usableWidth = Math.max(80, width - 2 * padX);

  const placed: PlacedItem<T>[] = [];

  subRows.forEach((row, rowIndex) => {
    const count = row.items.length;
    const y = tops[rowIndex];

    if (count === 1) {
      placed.push({ item: row.items[0], x: width / 2, y });
      return;
    }

    const bandWidth = usableWidth * row.band;
    const start = width / 2 - bandWidth / 2;

    row.items.forEach((item, index) => {
      placed.push({
        item,
        x: start + (bandWidth * (index + 0.5)) / count,
        y,
      });
    });
  });

  return { placed, avatar };
}
