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
  // ==================================================
  // 5 vs 5
  // ==================================================
  5: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [34, 66] },
    { top: 58, cols: [50] },
    { top: 18, cols: [50] },
  ]),

  // ==================================================
  // 6 vs 6
  // ==================================================
  6: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [34, 66] },
    { top: 58, cols: [34, 66] },
    { top: 18, cols: [50] },
  ]),

  // ==================================================
  // 7 vs 7
  // ==================================================
  7: createLayout([
    { top: 92, cols: [50] },
    { top: 74, cols: [34, 66] },
    { top: 58, cols: [24, 50, 76] },
    { top: 18, cols: [50] },
  ]),

  // ==================================================
  // 8 vs 8
  // Mucho más separados en el centro
  // ==================================================
  8: createLayout([
    { top: 92, cols: [50] },
    { top: 76, cols: [34, 66] },
    { top: 60, cols: [24, 50, 76] },
    { top: 14, cols: [34, 66] },
  ]),

  // ==================================================
  // 9 vs 9
  // ==================================================
  9: createLayout([
    { top: 92, cols: [50] },
    { top: 77, cols: [18, 50, 82] },
    { top: 61, cols: [24, 50, 76] },
    { top: 13, cols: [34, 66] },
  ]),

  // ==================================================
  // 10 vs 10
  // Aquí era donde más se solapaban
  // ==================================================
  10: createLayout([
    { top: 92, cols: [50] },
    { top: 78, cols: [14, 38, 62, 86] },
    { top: 62, cols: [28, 50, 72] },
    { top: 12, cols: [34, 66] },
  ]),

  // ==================================================
  // 11 vs 11
  // Más parecido a un campo real
  // ==================================================
  11: createLayout([
    { top: 92, cols: [50] },
    { top: 79, cols: [14, 38, 62, 86] },
    { top: 63, cols: [28, 50, 72] },
    { top: 11, cols: [20, 50, 80] },
  ]),
};