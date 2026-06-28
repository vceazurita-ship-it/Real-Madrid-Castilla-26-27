export interface FormationPosition {
  id: string;
  nombre: string;
  left: string;
  top: string;
}

export const formations: Record<string, FormationPosition[]> = {
  "4-4-2": [
    { id: "POR", nombre: "POR", left: "50%", top: "92%" },

    { id: "LI", left: "18%", top: "74%", nombre: "LI" },
    { id: "DFC1", left: "39%", top: "78%", nombre: "DFC" },
    { id: "DFC2", left: "61%", top: "78%", nombre: "DFC" },
    { id: "LD", left: "82%", top: "74%", nombre: "LD" },

    { id: "MI", left: "16%", top: "50%", nombre: "MI" },
    { id: "MC1", left: "39%", top: "54%", nombre: "MC" },
    { id: "MC2", left: "61%", top: "54%", nombre: "MC" },
    { id: "MD", left: "84%", top: "50%", nombre: "MD" },

    { id: "DC1", left: "42%", top: "22%", nombre: "DC" },
    { id: "DC2", left: "58%", top: "22%", nombre: "DC" },
  ],

  "4-3-3": [
    { id: "POR", left: "50%", top: "92%", nombre: "POR" },

    { id: "LI", left: "18%", top: "74%", nombre: "LI" },
    { id: "DFC1", left: "39%", top: "78%", nombre: "DFC" },
    { id: "DFC2", left: "61%", top: "78%", nombre: "DFC" },
    { id: "LD", left: "82%", top: "74%", nombre: "LD" },

    { id: "MC1", left: "32%", top: "53%", nombre: "MC" },
    { id: "MC2", left: "50%", top: "59%", nombre: "MC" },
    { id: "MC3", left: "68%", top: "53%", nombre: "MC" },

    { id: "EI", left: "20%", top: "22%", nombre: "EI" },
    { id: "DC", left: "50%", top: "16%", nombre: "DC" },
    { id: "ED", left: "80%", top: "22%", nombre: "ED" },
  ],

  "4-2-3-1": [
    { id: "POR", left: "50%", top: "92%", nombre: "POR" },

    { id: "LI", left: "18%", top: "74%", nombre: "LI" },
    { id: "DFC1", left: "39%", top: "78%", nombre: "DFC" },
    { id: "DFC2", left: "61%", top: "78%", nombre: "DFC" },
    { id: "LD", left: "82%", top: "74%", nombre: "LD" },

    { id: "MCD1", left: "42%", top: "60%", nombre: "MCD" },
    { id: "MCD2", left: "58%", top: "60%", nombre: "MCD" },

    { id: "EI", left: "20%", top: "36%", nombre: "EI" },
    { id: "MCO", left: "50%", top: "33%", nombre: "MCO" },
    { id: "ED", left: "80%", top: "36%", nombre: "ED" },

    { id: "DC", left: "50%", top: "15%", nombre: "DC" },
  ],

  "3-5-2": [
    { id: "POR", left: "50%", top: "92%", nombre: "POR" },

    { id: "DFC1", left: "30%", top: "77%", nombre: "DFC" },
    { id: "DFC2", left: "50%", top: "81%", nombre: "DFC" },
    { id: "DFC3", left: "70%", top: "77%", nombre: "DFC" },

    { id: "CAI", left: "12%", top: "53%", nombre: "CAI" },
    { id: "MC1", left: "35%", top: "54%", nombre: "MC" },
    { id: "MC2", left: "50%", top: "48%", nombre: "MC" },
    { id: "MC3", left: "65%", top: "54%", nombre: "MC" },
    { id: "CAD", left: "88%", top: "53%", nombre: "CAD" },

    { id: "DC1", left: "42%", top: "20%", nombre: "DC" },
    { id: "DC2", left: "58%", top: "20%", nombre: "DC" },
  ],

  "3-4-3": [
    { id: "POR", left: "50%", top: "92%", nombre: "POR" },

    { id: "DFC1", left: "30%", top: "77%", nombre: "DFC" },
    { id: "DFC2", left: "50%", top: "81%", nombre: "DFC" },
    { id: "DFC3", left: "70%", top: "77%", nombre: "DFC" },

    { id: "MI", left: "22%", top: "50%", nombre: "MI" },
    { id: "MC1", left: "40%", top: "55%", nombre: "MC" },
    { id: "MC2", left: "60%", top: "55%", nombre: "MC" },
    { id: "MD", left: "78%", top: "50%", nombre: "MD" },

    { id: "EI", left: "20%", top: "20%", nombre: "EI" },
    { id: "DC", left: "50%", top: "15%", nombre: "DC" },
    { id: "ED", left: "80%", top: "20%", nombre: "ED" },
  ],
};