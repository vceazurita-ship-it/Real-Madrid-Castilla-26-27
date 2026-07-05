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

function createTeam(
  prefix: "B" | "R",
  rows: Row[],
  mirror = false
): LayoutPosition[] {
  const positions: LayoutPosition[] = [];

  const lineNames = ["GK", "DEF", "MID", "ATT"];

  rows.forEach((row, rowIndex) => {
    const line = lineNames[rowIndex];

    row.cols.forEach((left, colIndex) => {
      let id = `${prefix}_${line}`;

      // Solo DEF/MID/ATT llevan numeración
      if (line !== "GK") {
        id += `_${colIndex + 1}`;
      }

      positions.push({
        id,
        left: `${left}%`,
        top: `${mirror ? 100 - row.top : row.top}%`,
      });
    });
  });

  return positions;
}

function createLayout(rows: Row[]): TeamLayout {
  return {
    blue: createTeam("B", rows),
    red: createTeam("R", rows, true),
  };
}

export const layouts: Record<
  5 | 6 | 7 | 8 | 9 | 10 | 11,
  TeamLayout
> = {
  // ==========================================
  // 5 vs 5
  // GK + 2 DEF + 1 MID + 1 ATT
  // ==========================================
  5: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [35, 65] },
    { top: 56, cols: [50] },
    { top: 24, cols: [50] },
  ]),

  // ==========================================
  // 6 vs 6
  // GK + 2 DEF + 2 MID + 1 ATT
  // ==========================================
  6: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [35, 65] },
    { top: 56, cols: [35, 65] },
    { top: 24, cols: [50] },
  ]),

  // ==========================================
  // 7 vs 7
  // GK + 2 DEF + 3 MID + 1 ATT
  // ==========================================
  7: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [35, 65] },
    { top: 56, cols: [25, 50, 75] },
    { top: 24, cols: [50] },
  ]),

  // ==========================================
  // 8 vs 8
  // GK + 2 DEF + 3 MID + 2 ATT
  // ==========================================
  8: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [35, 65] },
    { top: 56, cols: [25, 50, 75] },
    { top: 24, cols: [35, 65] },
  ]),

  // ==========================================
  // 9 vs 9
  // GK + 3 DEF + 3 MID + 2 ATT
  // ==========================================
  9: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [20, 50, 80] },
    { top: 56, cols: [25, 50, 75] },
    { top: 24, cols: [35, 65] },
  ]),

  // ==========================================
  // 10 vs 10
  // GK + 4 DEF + 3 MID + 2 ATT
  // ==========================================
  10: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [15, 38, 62, 85] },
    { top: 56, cols: [30, 50, 70] },
    { top: 24, cols: [35, 65] },
  ]),

  // ==========================================
  // 11 vs 11
  // GK + 4 DEF + 3 MID + 3 ATT
  // ==========================================
  11: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [15, 38, 62, 85] },
    { top: 56, cols: [30, 50, 70] },
    { top: 24, cols: [20, 50, 80] },
  ]),
};