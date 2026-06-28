export interface FormationPosition {
  id: string;
  nombre: string;
  left: string;
  top: string;
}

export const formations: Record<string, FormationPosition[]> = {
  "4-4-2": [
    { id: "POR", nombre: "POR", left: "50%", top: "92%" },

    { id: "LI", nombre: "LI", left: "15%", top: "72%" },
    { id: "DFC1", nombre: "DFC", left: "38%", top: "74%" },
    { id: "DFC2", nombre: "DFC", left: "62%", top: "74%" },
    { id: "LD", nombre: "LD", left: "85%", top: "72%" },

    { id: "MI", nombre: "MI", left: "15%", top: "47%" },
    { id: "MC1", nombre: "MC", left: "40%", top: "50%" },
    { id: "MC2", nombre: "MC", left: "60%", top: "50%" },
    { id: "MD", nombre: "MD", left: "85%", top: "47%" },

    { id: "DC1", nombre: "DC", left: "38%", top: "18%" },
    { id: "DC2", nombre: "DC", left: "62%", top: "18%" },
  ],

  "4-3-3": [
    { id: "POR", nombre: "POR", left: "50%", top: "92%" },

    { id: "LI", nombre: "LI", left: "15%", top: "72%" },
    { id: "DFC1", nombre: "DFC", left: "38%", top: "74%" },
    { id: "DFC2", nombre: "DFC", left: "62%", top: "74%" },
    { id: "LD", nombre: "LD", left: "85%", top: "72%" },

    { id: "MC1", nombre: "MC", left: "30%", top: "48%" },
    { id: "MC2", nombre: "MC", left: "50%", top: "55%" },
    { id: "MC3", nombre: "MC", left: "70%", top: "48%" },

    { id: "EI", nombre: "EI", left: "18%", top: "20%" },
    { id: "DC", nombre: "DC", left: "50%", top: "15%" },
    { id: "ED", nombre: "ED", left: "82%", top: "20%" },
  ],

  "4-2-3-1": [],

  "3-5-2": [],

  "3-4-3": [],
};