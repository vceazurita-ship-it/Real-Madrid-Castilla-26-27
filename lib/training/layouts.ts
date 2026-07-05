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

function createTeam(
  prefix: "B" | "R",
  positions: Array<{
    id: string;
    left: number;
    top: number;
  }>
): LayoutPosition[] {
  return positions.map((p) => ({
    id: `${prefix}_${p.id}`,
    left: `${p.left}%`,
    top: `${p.top}%`,
  }));
}

export const layouts: Record<
  5 | 6 | 7 | 8 | 9 | 10 | 11,
  TeamLayout
> = {

  // =====================================================
  // 5 vs 5
  // =====================================================
5: {
  blue: createTeam("B", [
    { id: "GK", left: 50, top: 91 },

    { id: "DEF_1", left: 34, top: 75 },
    { id: "DEF_2", left: 66, top: 75 },

    { id: "MID_1", left: 50, top: 75 },

    { id: "ATT_1", left: 50, top: 53 },
  ]),

  red: createTeam("R", [
    { id: "GK", left: 50, top: 9 },

    { id: "DEF_1", left: 34, top: 25 },
    { id: "DEF_2", left: 66, top: 25 },

    { id: "MID_1", left: 50, top: 25 },

    { id: "ATT_1", left: 50, top: 46 },
  ]),
},

  // =====================================================
  // 6 vs 6
  // =====================================================
  6: {
    blue: createTeam("B", [
      { id: "GK", left: 50, top: 91 },

      { id: "DEF_1", left: 34, top: 80 },
      { id: "DEF_2", left: 66, top: 80 },

      { id: "MID_1", left: 34, top: 61 },
      { id: "MID_2", left: 66, top: 61 },

      { id: "ATT_1", left: 50, top: 58 },
    ]),

    red: createTeam("R", [
      { id: "GK", left: 50, top: 9 },

      { id: "DEF_1", left: 34, top: 20 },
      { id: "DEF_2", left: 66, top: 20 },

      { id: "MID_1", left: 34, top: 39 },
      { id: "MID_2", left: 66, top: 39 },

      { id: "ATT_1", left: 50, top: 42 },
    ]),
  },

  // =====================================================
  // 7 vs 7
  // =====================================================
  7: {
    blue: createTeam("B", [
      { id: "GK", left: 50, top: 91 },

      { id: "DEF_1", left: 34, top: 75 },
      { id: "DEF_2", left: 66, top: 75 },

      { id: "MID_1", left: 22, top: 60 },
      { id: "MID_2", left: 50, top: 70 },
      { id: "MID_3", left: 78, top: 60 },

      { id: "ATT_1", left: 50, top: 55 },
    ]),

    red: createTeam("R", [
      { id: "GK", left: 50, top: 9 },

      { id: "DEF_1", left: 34, top: 25 },
      { id: "DEF_2", left: 66, top: 25 },

      { id: "MID_1", left: 22, top: 44 },
      { id: "MID_2", left: 50, top: 30 },
      { id: "MID_3", left: 78, top: 44 },

      { id: "ATT_1", left: 50, top: 46 },
    ]),
  },

    // =====================================================
  // 8 vs 8
  // =====================================================
  8: {
    blue: createTeam("B", [
      { id: "GK", left: 50, top: 91 },

      { id: "DEF_1", left: 34, top: 82 },
      { id: "DEF_2", left: 66, top: 82 },

      { id: "MID_1", left: 22, top: 65 },
      { id: "MID_2", left: 50, top: 65 },
      { id: "MID_3", left: 78, top: 65 },

      { id: "ATT_1", left: 38, top: 58 },
      { id: "ATT_2", left: 62, top: 58 },
    ]),

    red: createTeam("R", [
      { id: "GK", left: 50, top: 9 },

      { id: "DEF_1", left: 34, top: 20 },
      { id: "DEF_2", left: 66, top: 20 },

      { id: "MID_1", left: 22, top: 35 },
      { id: "MID_2", left: 50, top: 35 },
      { id: "MID_3", left: 78, top: 35 },

      { id: "ATT_1", left: 38, top: 48 },
      { id: "ATT_2", left: 62, top: 48 },
    ]),
  },

  // =====================================================
  // 9 vs 9
  // =====================================================
  9: {
    blue: createTeam("B", [
      { id: "GK", left: 50, top: 91 },

      { id: "DEF_1", left: 18, top: 82 },
      { id: "DEF_2", left: 50, top: 82 },
      { id: "DEF_3", left: 82, top: 82 },

      { id: "MID_1", left: 24, top: 70 },
      { id: "MID_2", left: 50, top: 70 },
      { id: "MID_3", left: 76, top: 70 },

      { id: "ATT_1", left: 38, top: 58 },
      { id: "ATT_2", left: 62, top: 58 },
    ]),

    red: createTeam("R", [
      { id: "GK", left: 50, top: 9 },

      { id: "DEF_1", left: 18, top: 18 },
      { id: "DEF_2", left: 50, top: 18 },
      { id: "DEF_3", left: 82, top: 18 },

      { id: "MID_1", left: 24, top: 30 },
      { id: "MID_2", left: 50, top: 30 },
      { id: "MID_3", left: 76, top: 30 },

      { id: "ATT_1", left: 38, top: 42 },
      { id: "ATT_2", left: 62, top: 42 },
    ]),
  },

  // =====================================================
  // 10 vs 10
  // =====================================================
  10: {
    blue: createTeam("B", [
      { id: "GK", left: 50, top: 91 },

      { id: "DEF_1", left: 14, top: 82 },
      { id: "DEF_2", left: 38, top: 82 },
      { id: "DEF_3", left: 62, top: 82 },
      { id: "DEF_4", left: 86, top: 82 },

      { id: "MID_1", left: 25, top: 70 },
      { id: "MID_2", left: 50, top: 70 },
      { id: "MID_3", left: 75, top: 70 },

      { id: "ATT_1", left: 38, top: 58 },
      { id: "ATT_2", left: 62, top: 58 },
    ]),

    red: createTeam("R", [
      { id: "GK", left: 50, top: 9 },

      { id: "DEF_1", left: 14, top: 18 },
      { id: "DEF_2", left: 38, top: 18 },
      { id: "DEF_3", left: 62, top: 18 },
      { id: "DEF_4", left: 86, top: 18 },

      { id: "MID_1", left: 25, top: 30 },
      { id: "MID_2", left: 50, top: 30 },
      { id: "MID_3", left: 75, top: 30 },

      { id: "ATT_1", left: 38, top: 42 },
      { id: "ATT_2", left: 62, top: 42 },
    ]),
  },

   // =====================================================
  // 11 vs 11
  // =====================================================
  11: {
    blue: createTeam("B", [
      // Portero
      { id: "GK", left: 50, top: 91 },

      // Línea defensiva
      { id: "DEF_1", left: 14, top: 82 },
      { id: "DEF_2", left: 38, top: 82 },
      { id: "DEF_3", left: 62, top: 82 },
      { id: "DEF_4", left: 86, top: 82 },

      // Centro del campo
      { id: "MID_1", left: 24, top: 70 },
      { id: "MID_2", left: 50, top: 70 },
      { id: "MID_3", left: 76, top: 70 },

      // Delantera
      { id: "ATT_1", left: 20, top: 58 },
      { id: "ATT_2", left: 50, top: 58 },
      { id: "ATT_3", left: 80, top: 58 },
    ]),

    red: createTeam("R", [
      // Portero
      { id: "GK", left: 50, top: 9 },

      // Línea defensiva
      { id: "DEF_1", left: 14, top: 18 },
      { id: "DEF_2", left: 38, top: 18 },
      { id: "DEF_3", left: 62, top: 18 },
      { id: "DEF_4", left: 86, top: 18 },

      // Centro del campo
      { id: "MID_1", left: 24, top: 30 },
      { id: "MID_2", left: 50, top: 30 },
      { id: "MID_3", left: 76, top: 30 },

      // Delantera
      { id: "ATT_1", left: 20, top: 42 },
      { id: "ATT_2", left: 50, top: 42 },
      { id: "ATT_3", left: 80, top: 42 },
    ]),
  },

}; 