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

export type PitchRowKey = "del" | "band" | "diez" | "ocho" | "piv" | "def" | "por";

/** Cómo se pinta el campo: atacando hacia arriba o hacia la derecha. */
export type PitchOrientation = "vertical" | "horizontal";

/** Altura preferida de cada línea, en fracción de la profundidad del campo. */
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
const MIN_SLOT_X = 96;

/** Alto mínimo cómodo por ficha: foto pequeña + su pie. */
const MIN_SLOT_Y = 66;

/** Cuánta gente cabe en una sub-fila antes de abrir otra. */
const MAX_PER_SUB_ROW: Record<PitchOrientation, number> = {
  vertical: 5,
  horizontal: 6,
};

/** Separación entre sub-filas de una misma línea, en fracción de profundidad. */
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

/**
 * Cuánto se abre hacia una banda: −1 su izquierda, +1 su derecha.
 *
 * En vertical (atacando arriba) eso es izquierda y derecha de la pantalla; en
 * horizontal (atacando a la derecha) el campo gira en el sentido del reloj, así
 * que la banda derecha queda abajo. La traducción la hace `layoutPitch`.
 */
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
  /** Ancho en píxeles reservado al nombre: lo recorta sin invadir al vecino. */
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
  height: number,
  orientation: PitchOrientation = "vertical"
): PitchLayout<T> {
  if (items.length === 0 || width < 120 || height < 200) return empty<T>();

  const vertical = orientation === "vertical";

  /* 1 · Agrupar por línea. */

  const grouped = new Map<PitchRowKey, T[]>();

  items.forEach((item) => {
    const key = detectRow(item.position);
    const list = grouped.get(key);

    if (list) list.push(item);
    else grouped.set(key, [item]);
  });

  /* 2 · Partir cada línea en sub-filas: las mejores notas, delante. */

  const across = acrossAxis(orientation, width, height);

  const depthExtent = vertical ? height : width;
  const depthPad = vertical ? PAD_Y : PAD_X;

  const maxPerSubRow = perSubRow(orientation, width, height);

  const subRows: { items: T[]; band: number; depth: number }[] = [];

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

      /* Dentro de la sub-fila mandan las bandas: de su izquierda a su derecha. */
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

      const fraction = row.top + (index - (count - 1) / 2) * SUB_ROW_SPREAD;

      /* Vertical ataca hacia arriba; horizontal, hacia la derecha. */
      subRows.push({
        items: chunk,
        band,
        depth: (vertical ? fraction : 1 - fraction) * depthExtent,
      });
    });
  });

  if (subRows.length === 0) return empty<T>();

  subRows.sort((a, b) => a.depth - b.depth);

  /* 3 · Tamaño de ficha con el que todas las sub-filas caben a la vez. */

  const rows = subRows.length;

  const spacePerRow = (depthExtent - 2 * depthPad - ROW_GAP * (rows - 1)) / rows;

  const slotOf = (span: number, row: { band: number; items: T[] }) =>
    (span * row.band) / row.items.length;

  const rawSlot = subRows.reduce(
    (min, row) => Math.min(min, slotOf(across.usable, row)),
    Infinity
  );

  /*
  | El pie de ficha (PJ · minutos) se sacrifica antes que el tamaño de la foto:
  | sólo se mantiene si con él la foto sigue siendo grande de verdad. Lo que lo
  | aprieta es el eje vertical, que en horizontal es el que reparte la línea.
  */
  const compact = (vertical ? spacePerRow : rawSlot) - LABEL_FULL < 44;
  const labelHeight = compact ? LABEL_COMPACT : LABEL_FULL;

  /* El nombre cuelga bajo la foto: en horizontal se come parte de la línea. */
  const acrossSpan = vertical
    ? across.usable
    : Math.max(120, across.usable - labelHeight);

  const narrowestSlot = subRows.reduce(
    (min, row) => Math.min(min, slotOf(acrossSpan, row)),
    Infinity
  );

  const avatar = Math.max(
    MIN_AVATAR,
    Math.min(
      MAX_AVATAR,
      /* En vertical el pie roba profundidad; en horizontal, anchura de línea. */
      vertical ? spacePerRow - labelHeight : spacePerRow,
      vertical ? narrowestSlot * 0.82 : narrowestSlot - labelHeight
    )
  );

  /* La foto se centra y el nombre cuelga por debajo: en Y no es simétrico. */
  const depthSpan = vertical ? avatar + labelHeight : avatar;
  const gap = depthSpan + ROW_GAP;

  /* 4 · Relajar la profundidad: hueco mínimo garantizado y todo dentro del campo. */

  const minDepth = depthPad + avatar / 2;

  const maxDepth =
    depthExtent - depthPad - avatar / 2 - (vertical ? labelHeight : 0);

  const depths = subRows.map((row) => row.depth);

  depths[0] = Math.max(depths[0], minDepth);

  for (let index = 1; index < rows; index += 1) {
    depths[index] = Math.max(depths[index], depths[index - 1] + gap);
  }

  /* Si el empujón hacia el final se sale del campo, se recoloca al revés. */
  if (depths[rows - 1] > maxDepth) {
    depths[rows - 1] = maxDepth;

    for (let index = rows - 2; index >= 0; index -= 1) {
      depths[index] = Math.min(depths[index], depths[index + 1] - gap);
    }
  }

  /* Última red: si ni así cabe todo, reparto uniforme de principio a fin. */
  if (depths[0] < minDepth) {
    const span = Math.max(0, maxDepth - minDepth);

    for (let index = 0; index < rows; index += 1) {
      depths[index] =
        rows === 1
          ? (minDepth + maxDepth) / 2
          : minDepth + (span * index) / (rows - 1);
    }
  }

  /* 5 · Reparto uniforme dentro de la banda de cada sub-fila. */

  /* En horizontal el centro sube media etiqueta: el pie cuelga hacia abajo. */
  const acrossCenter = vertical
    ? across.extent / 2
    : (across.extent - labelHeight) / 2;

  /* En horizontal el nombre dispone del ancho de su columna, no de su hueco. */
  const labelSlot = (slot: number) => (vertical ? slot : spacePerRow);

  const placed: PlacedItem<T>[] = [];

  subRows.forEach((row, rowIndex) => {
    const count = row.items.length;
    const depth = depths[rowIndex];
    const bandSpan = acrossSpan * row.band;
    const slot = bandSpan / count;

    const put = (item: T, position: number, itemSlot: number) => {
      placed.push({
        item,
        row: detectRow(item.position),
        x: vertical ? position : depth,
        y: vertical ? depth : position,
        slot: labelSlot(itemSlot),
      });
    };

    if (count === 1) {
      put(row.items[0], acrossCenter, Math.min(across.usable, MIN_SLOT_X * 1.6));

      return;
    }

    const start = acrossCenter - bandSpan / 2;

    /*
    |--------------------------------------------------------------------------
    | CADA UNO EN SU BANDA, NO REPARTIDOS A PARTES IGUALES
    |--------------------------------------------------------------------------
    |
    | Repartir la línea en huecos iguales coloca bien a un 1-4-3-3 y mal a casi
    | todo lo demás: con cuatro extremos —dos por cada lado, que es lo normal
    | en una plantilla— dos de ellos acababan en el centro del campo, y el
    | campograma dejaba de leerse como un equipo.
    |
    | Así que la línea se parte en tres: los que se abren a su izquierda pegados
    | a esa banda, los de su derecha pegados a la suya y los de dentro
    | centrados. Cada uno conserva su hueco (`slot`), y los tres grupos suman
    | exactamente la anchura de la línea, así que nadie se pisa —que es la
    | primera regla de este motor—.
    */
    const izquierda = row.items.filter(
      (item) => horizontalPreference(item.position) < 0,
    );

    const derecha = row.items.filter(
      (item) => horizontalPreference(item.position) > 0,
    );

    const centro = row.items.filter(
      (item) => horizontalPreference(item.position) === 0,
    );

    /* Sin nadie abriéndose no hay nada que agrupar: reparto de siempre. */
    if (izquierda.length === 0 && derecha.length === 0) {
      row.items.forEach((item, index) => {
        put(item, start + slot * (index + 0.5), slot);
      });

      return;
    }

    izquierda.forEach((item, index) => {
      put(item, start + slot * (index + 0.5), slot);
    });

    derecha.forEach((item, index) => {
      const desde = derecha.length - index - 0.5;

      put(item, start + bandSpan - slot * desde, slot);
    });

    const centroInicio = acrossCenter - (slot * centro.length) / 2;

    centro.forEach((item, index) => {
      put(item, centroInicio + slot * (index + 0.5), slot);
    });
  });

  return { placed, avatar, compact };
}
