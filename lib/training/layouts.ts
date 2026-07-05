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
  // 5v5
  5: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [32, 68] },
    { top: 54, cols: [50] },
    { top: 30, cols: [50] },
  ]),

  // 6v6
  6: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [32, 68] },
    { top: 54, cols: [32, 68] },
    { top: 28, cols: [50] },
  ]),

  // 7v7
  7: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [30, 70] },
    { top: 54, cols: [20, 50, 80] },
    { top: 26, cols: [50] },
  ]),

  // 8v8
  8: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [28, 72] },
    { top: 54, cols: [18, 50, 82] },
    { top: 22, cols: [32, 68] },
  ]),

  // 9v9
  9: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [15, 50, 85] },
    { top: 54, cols: [22, 50, 78] },
    { top: 20, cols: [32, 68] },
  ]),

  // 10v10
  10: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [12, 36, 64, 88] },
    { top: 52, cols: [22, 50, 78] },
    { top: 18, cols: [32, 68] },
  ]),

  // 11v11
  11: createLayout([
    { top: 90, cols: [50] },
    { top: 72, cols: [12, 36, 64, 88] },
    { top: 52, cols: [20, 50, 80] },
    { top: 16, cols: [12, 50, 88] },
  ]),
};