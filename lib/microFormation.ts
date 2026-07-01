export interface MicroFormationPosition {
  id: string;
  nombre: string;
  posicion: string;
  left: string;
  top: string;

  // Si es false la posición no se dibuja
  visible?: boolean;
}

export const microFormations: Record<
  string,
  MicroFormationPosition[]
> = {
  // ===================================================
  // 4-4-2
  // ===================================================
  "4-4-2": [
    { id: "POR", nombre: "Portero", posicion: "PORTERO", left: "50%", top: "90%" },

    { id: "LD", nombre: "Lateral D.", posicion: "LATERAL D.", left: "18%", top: "70%" },
    { id: "DFC1", nombre: "Central", posicion: "CENTRAL", left: "39%", top: "74%" },
    { id: "DFC2", nombre: "Central", posicion: "CENTRAL", left: "61%", top: "74%" },
    { id: "LI", nombre: "Lateral I.", posicion: "LATERAL I.", left: "82%", top: "70%" },

    { id: "MC6", nombre: "6", posicion: "MEDIOCENTRO", left: "38%", top: "50%" },
    { id: "MC8", nombre: "8", posicion: "MEDIOCENTRO", left: "62%", top: "50%" },
    { id: "MC10", nombre: "", posicion: "", left: "50%", top: "120%",visible: false },

    { id: "EI", nombre: "11", posicion: "EXTREMO I.", left: "18%", top: "28%" },
    { id: "ED", nombre: "7", posicion: "EXTREMO D.", left: "82%", top: "28%" },

    { id: "DC1", nombre: "9", posicion: "DELANTERO", left: "40%", top: "15%" },
    {
  id: "DC2",
  nombre: "10",
  posicion: "DELANTERO",
  left: "60%",
  top: "15%",
},
  ],

  // ===================================================
  // 4-3-3
  // ===================================================
  "4-3-3": [
    { id: "POR", nombre: "Portero", posicion: "PORTERO", left: "50%", top: "90%" },

    { id: "LD", nombre: "Lateral D.", posicion: "LATERAL D.", left: "18%", top: "70%" },
    { id: "DFC1", nombre: "Central", posicion: "CENTRAL", left: "39%", top: "74%" },
    { id: "DFC2", nombre: "Central", posicion: "CENTRAL", left: "61%", top: "74%" },
    { id: "LI", nombre: "Lateral I.", posicion: "LATERAL I.", left: "82%", top: "70%" },

    { id: "MC6", nombre: "6", posicion: "PIVOTE", left: "50%", top: "56%" },
    { id: "MC8", nombre: "8", posicion: "INTERIOR", left: "38%", top: "40%" },
    { id: "MC10", nombre: "10", posicion: "INTERIOR", left: "62%", top: "40%" },

    { id: "EI", nombre: "11", posicion: "EXTREMO I.", left: "15%", top: "18%" },
    { id: "ED", nombre: "7", posicion: "EXTREMO D.", left: "85%", top: "18%" },

    { id: "DC1", nombre: "9", posicion: "DELANTERO", left: "50%", top: "10%" },
  ],

  // ===================================================
  // 4-2-3-1
  // ===================================================
  "4-2-3-1": [
    { id: "POR", nombre: "Portero", posicion: "PORTERO", left: "50%", top: "90%" },

    { id: "LD", nombre: "Lateral D.", posicion: "LATERAL D.", left: "18%", top: "70%" },
    { id: "DFC1", nombre: "Central", posicion: "CENTRAL", left: "39%", top: "74%" },
    { id: "DFC2", nombre: "Central", posicion: "CENTRAL", left: "61%", top: "74%" },
    { id: "LI", nombre: "Lateral I.", posicion: "LATERAL I.", left: "82%", top: "70%" },

    { id: "MC6", nombre: "6", posicion: "PIVOTE", left: "40%", top: "55%" },
    { id: "MC8", nombre: "8", posicion: "PIVOTE", left: "60%", top: "55%" },
    { id: "MC10", nombre: "10", posicion: "MEDIAPUNTA", left: "50%", top: "34%" },

    { id: "EI", nombre: "11", posicion: "EXTREMO I.", left: "18%", top: "26%" },
    { id: "ED", nombre: "7", posicion: "EXTREMO D.", left: "82%", top: "26%" },

    { id: "DC1", nombre: "9", posicion: "DELANTERO", left: "50%", top: "10%" },
  ],

  // ===================================================
  // 3-5-2
  // ===================================================
  "3-5-2": [
    { id: "POR", nombre: "Portero", posicion: "PORTERO", left: "50%", top: "93%" },

    { id: "LD", nombre: "Carrilero D.", posicion: "CARRILERO D.", left: "88%", top: "48%" },
    { id: "DFC1", nombre: "Central", posicion: "CENTRAL", left: "28%", top: "76%" },
    { id: "DFC2", nombre: "Central", posicion: "CENTRAL", left: "50%", top: "77%" },
    { id: "LI", nombre: "Carrilero I.", posicion: "CARRILERO I.", left: "12%", top: "48%" },

    { id: "MC6", nombre: "6", posicion: "MEDIOCENTRO", left: "38%", top: "52%" },
    { id: "MC8", nombre: "8", posicion: "MEDIOCENTRO", left: "62%", top: "52%" },
    { id: "MC10", nombre: "", posicion: "", left: "50%", top: "120%",visible: false },

    { id: "EI", nombre: "", posicion: "", left: "-20%", top: "50%" },
    { id: "ED", nombre: "10", posicion: "SEGUNDO PUNTA", left: "40%", top: "20%" },

    { id: "DC1", nombre: "9", posicion: "DELANTERO", left: "60%", top: "20%" },
    {
  id: "DFC3",
  nombre: "Central",
  posicion: "CENTRAL",
  left: "72%",
  top: "74%",
},
  ],

  // ===================================================
  // 3-4-3
  // ===================================================
  "3-4-3": [
    { id: "POR", nombre: "Portero", posicion: "PORTERO", left: "50%", top: "93%" },

    { id: "LD", nombre: "", posicion: "", left: "50%", top: "120%", visible: false},
    { id: "DFC1", nombre: "Central", posicion: "CENTRAL", left: "28%", top: "76%" },
    { id: "DFC2", nombre: "Central", posicion: "CENTRAL", left: "50%", top: "77%" },
    { id: "LI", nombre: "", posicion: "", left: "50%", top: "120%", visible: false },

    { id: "MC6", nombre: "6", posicion: "MEDIOCENTRO", left: "38%", top: "48%" },
    { id: "MC8", nombre: "8", posicion: "MEDIOCENTRO", left: "62%", top: "48%" },
    { id: "MC10", nombre: "", posicion: "", left: "50%", top: "120%", visible: false},

    { id: "EI", nombre: "11", posicion: "EXTREMO I.", left: "16%", top: "18%" },
    { id: "ED", nombre: "7", posicion: "EXTREMO D.", left: "84%", top: "18%" },

    { id: "DC1", nombre: "9", posicion: "DELANTERO", left: "50%", top: "10%" },
    {
  id: "LD",
  nombre: "Carrilero D.",
  posicion: "CARRILERO D.",
  left: "88%",
  top: "48%",
},

{
  id: "LI",
  nombre: "Carrilero I.",
  posicion: "CARRILERO I.",
  left: "12%",
  top: "48%",
},
{
  id: "DFC3",
  nombre: "Central",
  posicion: "CENTRAL",
  left: "72%",
  top: "74%",
},
  ],
};