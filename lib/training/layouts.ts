export interface LayoutPosition {
  id: string;
  left: string;
  top: string;

  nombre?: string;
  visible?: boolean;
}

export interface TeamLayout {
  blue: LayoutPosition[];
  red: LayoutPosition[];
}

type Row = {
  top: number;
  cols: number[];
};

const lineNames = ["GK", "DEF", "MID", "ATT"];

function createBlue(rows: Row[]): LayoutPosition[] {
  const positions: LayoutPosition[] = [];

  rows.forEach((row, rowIndex) => {
    const line = lineNames[rowIndex];

    row.cols.forEach((left, colIndex) => {
      let id = `B_${line}`;

      if (line !== "GK") id += `_${colIndex + 1}`;

      positions.push({
        id,
        left: `${left}%`,
        top: `${row.top}%`,
      });
    });
  });

  return positions;
}

function createRed(rows: Row[]): LayoutPosition[] {
  const positions: LayoutPosition[] = [];

  rows.forEach((row, rowIndex) => {
    const line = lineNames[rowIndex];

    row.cols.forEach((left, colIndex) => {
      let id = `R_${line}`;

      if (line !== "GK") id += `_${colIndex + 1}`;

      // espejo con separación extra
      let top = 100 - row.top;

      switch (line) {
        case "GK":
          top = 100 - row.top;
          break;

        case "DEF":
          top = 100 - row.top + 4;
          break;

        case "MID":
          top = 100 - row.top + 8;
          break;

        case "ATT":
          top = 100 - row.top + 12;
          break;
      }

      positions.push({
        id,
        left: `${left}%`,
        top: `${top}%`,
      });
    });
  });

  return positions;
}

function createLayout(rows: Row[]): TeamLayout {
  return {
    blue: createBlue(rows),
    red: createRed(rows),
  };
}

export const layouts: Record<
 5 | 6 | 7 | 8 | 9 | 10 | 11,
 TeamLayout
> = {

  // ==================================================
  // 5 vs 5
  // GK + 2 DEF + 1 MID + 1 ATT
  // ==================================================
  5: createLayout([
    { top: 90, cols: [50] },      // GK
    { top: 72, cols: [32, 68] },  // DEF
    { top: 60, cols: [50] },      // MID (más abajo)
    { top: 42, cols: [50] },      // ATT (por delante del medio)
  ]),

  // ==================================================
  // 6 vs 6
  // GK + 2 DEF + 2 MID + 1 ATT
  // ==================================================
  6: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [32, 68] },
    { top: 54, cols: [32, 68] },
    { top: 54, cols: [50] },      // delantero a la altura de los medios
  ]),

  // ==================================================
  // 7 vs 7
  // GK + 2 DEF + 3 MID + 1 ATT
  // ==================================================
  7: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [30, 70] },
    { top: 54, cols: [20, 50, 80] },
    { top: 72, cols: [50] },      // misma altura que la línea defensiva
  ]),

  // ==================================================
  // 8 vs 8
  // GK + 2 DEF + 3 MID + 2 ATT
  // ==================================================
  8: createLayout([
    { top: 60, cols: [50] },          // DEF (intercambiado)
    { top: 72, cols: [28, 72] },      // DEF real
    { top: 46, cols: [18, 50, 82] },  // MID
    { top: 82, cols: [32, 68] },      // ATT (intercambiado)
  ]),

  // ==================================================
  // 9 vs 9
  // ==================================================
  9: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [15, 50, 85] },
    { top: 52, cols: [22, 50, 78] },
    { top: 34, cols: [32, 68] },
  ]),

  // ==================================================
  // 10 vs 10
  // ==================================================
  10: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [12, 36, 64, 88] },
    { top: 56, cols: [22, 50, 78] },   // medios
    { top: 34, cols: [32, 68] },       // puntas bastante adelantados
  ]),

  // ==================================================
  // 11 vs 11
  // ==================================================
  11: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [12, 36, 64, 88] },
    { top: 56, cols: [20, 50, 80] },   // medios
    { top: 30, cols: [12, 50, 88] },   // tres delanteros claramente separados
  ]),
};