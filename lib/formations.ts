export interface FormationPosition {
  id: string;
  nombre: string;
  left: string;
  top: string;
}

export const formations: Record<string, FormationPosition[]> = {
  // ==========================================
  // 4-4-2
  // ==========================================
  "4-4-2": [
    { id: "POR", nombre: "POR", left: "12%", top: "50%" },

    { id: "LI", nombre: "LI", left: "23%", top: "18%" },
    { id: "DFC1", nombre: "DFC", left: "23%", top: "38%" },
    { id: "DFC2", nombre: "DFC", left: "23%", top: "62%" },
    { id: "LD", nombre: "LD", left: "23%", top: "82%" },

    { id: "MI", nombre: "MI", left: "46%", top: "18%" },
    { id: "MC1", nombre: "MC", left: "46%", top: "38%" },
    { id: "MC2", nombre: "MC", left: "46%", top: "62%" },
    { id: "MD", nombre: "MD", left: "46%", top: "82%" },

    { id: "DC1", nombre: "DC", left: "82%", top: "40%" },
    { id: "DC2", nombre: "DC", left: "82%", top: "60%" },
  ],

  // ==========================================
  // 4-3-3
  // ==========================================
  "4-3-3": [
    { id: "POR", nombre: "POR", left: "12%", top: "50%" },

    { id: "LI", nombre: "LI", left: "23%", top: "18%" },
    { id: "DFC1", nombre: "DFC", left: "23%", top: "38%" },
    { id: "DFC2", nombre: "DFC", left: "23%", top: "62%" },
    { id: "LD", nombre: "LD", left: "23%", top: "82%" },

    { id: "MC3", nombre: "MC", left: "48%", top: "28%" },
    { id: "MC2", nombre: "MC", left: "42%", top: "50%" },
    { id: "DC2", nombre: "MC", left: "48%", top: "72%" },

    { id: "MI", nombre: "EI", left: "82%", top: "18%" },
    { id: "DC1", nombre: "DC", left: "86%", top: "50%" },
    { id: "MD", nombre: "ED", left: "82%", top: "82%" },
  ],

  // ==========================================
  // 4-2-3-1
  // ==========================================
  "4-2-3-1": [
    { id: "POR", nombre: "POR", left: "12%", top: "50%" },

    { id: "LI", nombre: "LI", left: "23%", top: "18%" },
    { id: "DFC1", nombre: "DFC", left: "23%", top: "38%" },
    { id: "DFC2", nombre: "DFC", left: "23%", top: "62%" },
    { id: "LD", nombre: "LD", left: "23%", top: "82%" },

    { id: "MCD1", nombre: "MCD", left: "42%", top: "40%" },
    { id: "MCD2", nombre: "MCD", left: "42%", top: "60%" },

    { id: "MI", nombre: "EI", left: "63%", top: "20%" },
    { id: "DC2", nombre: "MCO", left: "60%", top: "50%" },
    { id: "MD", nombre: "ED", left: "63%", top: "80%" },

    { id: "DC1", nombre: "DC", left: "87%", top: "50%" },
  ],

  // ==========================================
  // 3-5-2
  // ==========================================
  "3-5-2": [
    { id: "POR", nombre: "POR", left: "12%", top: "50%" },

    { id: "LI", nombre: "DFC", left: "24%", top: "28%" },
    { id: "DFC1", nombre: "DFC", left: "20%", top: "50%" },
    { id: "DFC2", nombre: "DFC", left: "24%", top: "72%" },

    { id: "MI", nombre: "CAI", left: "45%", top: "15%" },
    { id: "MC1", nombre: "MC", left: "45%", top: "35%" },
    { id: "DC2", nombre: "MC", left: "55%", top: "50%" },
    { id: "MC2", nombre: "MC", left: "45%", top: "65%" },
    { id: "LD", nombre: "CAD", left: "45%", top: "85%" },

    { id: "DC1", nombre: "DC", left: "82%", top: "40%" },
    { id: "MD", nombre: "DC", left: "82%", top: "60%" },
  ],

  // ==========================================
  // 3-4-3
  // ==========================================
  "3-4-3": [
    { id: "POR", nombre: "POR", left: "12%", top: "50%" },

    { id: "LI", nombre: "DFC", left: "24%", top: "28%" },
    { id: "DFC1", nombre: "DFC", left: "20%", top: "50%" },
    { id: "DFC2", nombre: "DFC", left: "24%", top: "72%" },

    { id: "MI", nombre: "MI", left: "48%", top: "20%" },
    { id: "MC1", nombre: "MC", left: "42%", top: "40%" },
    { id: "MC2", nombre: "MC", left: "42%", top: "60%" },
    { id: "LD", nombre: "MD", left: "48%", top: "80%" },

    { id: "MD", nombre: "EI", left: "82%", top: "20%" },
    { id: "DC1", nombre: "DC", left: "87%", top: "50%" },
    { id: "DC2", nombre: "ED", left: "82%", top: "80%" },
  ],
};