/*
|--------------------------------------------------------------------------
| LÍNEAS Y PUESTOS DE LA HOJA RIVALES
|--------------------------------------------------------------------------
| Sacado de app/rivals/page.tsx (08/11/2026) para que Scout Individual
| nombre los puestos igual que Plantillas rivales: «MEDIO CENTRO» de la hoja
| es «Mediocentro» en las dos pantallas (jueces, ronda 14).
*/

export type LineKey = "portero" | "defensa" | "medio" | "ataque";

/*
| Cada línea se parte en "slots": la posición canónica con su código corto
| (POR, LD, DFC…). El orden de los slots manda en la aparición de los
| subgrupos dentro de la línea; para clasificar un texto libre no vale ese
| orden, sino el patrón más largo que encaje (ver getSlot).
*/

export type PositionSlot = {
  key: string;
  code: string;
  label: string;
  match: string[];
};

export const LINE_DEFINITIONS: {
  key: LineKey;
  title: string;
  slots: PositionSlot[];
  color: string;
}[] = [
  {
    key: "portero",
    title: "PORTEROS",
    color: "#D4A017",
    slots: [
      {
        key: "por",
        code: "POR",
        label: "Portero",
        match: ["portero", "arquero", "guardameta", "guardavallas"],
      },
    ],
  },
  {
    key: "defensa",
    title: "DEFENSAS",
    color: "#7DA6D9",
    slots: [
      {
        key: "ld",
        code: "LD",
        label: "Lateral derecho",
        match: [
          "lateral derecho",
          "lateral der",
          "lateral d",
          "defensa derecho",
          "carrilero derecho",
          "carrilero der",
        ],
      },
      {
        key: "dfc",
        code: "DFC",
        label: "Central",
        match: ["central", "zaguero", "defensa central", "libero"],
      },
      {
        key: "li",
        code: "LI",
        label: "Lateral izquierdo",
        match: [
          "lateral izquierdo",
          "lateral izq",
          "lateral i",
          "defensa izquierdo",
          "carrilero izquierdo",
          "carrilero izq",
        ],
      },
      {
        key: "car",
        code: "CAR",
        label: "Carrilero",
        match: ["carrilero"],
      },
      {
        key: "def",
        code: "DEF",
        label: "Defensa",
        match: ["lateral", "defensa"],
      },
    ],
  },
  {
    key: "medio",
    title: "CENTROCAMPISTAS",
    color: "#52B788",
    slots: [
      {
        key: "mcd",
        code: "MCD",
        label: "Pivote",
        match: [
          "mediocentro defensivo",
          "medio centro defensivo",
          "mediocampista defensivo",
          /* La hoja abrevia: "MEDIO CENTRO DEF". */
          "mediocentro def",
          "medio centro def",
          "pivote",
        ],
      },
      {
        key: "mc",
        code: "MC",
        label: "Mediocentro",
        match: [
          "mediocentro",
          "medio centro",
          "centrocampista",
          "mediocampista",
        ],
      },
      {
        key: "int",
        code: "INT",
        label: "Interior",
        /* "interir" es una errata que trae la hoja. */
        match: ["interior", "interir", "volante"],
      },
      {
        key: "mp",
        code: "MP",
        label: "Mediapunta",
        match: [
          "media punta",
          "mediapunta",
          "enganche",
          "mediocentro ofensivo",
          "medio centro ofensivo",
          /* La hoja abrevia: "MEDIO CENTRO OF". */
          "mediocentro of",
          "medio centro of",
        ],
      },
      {
        key: "med",
        code: "MED",
        label: "Medio",
        match: ["medio"],
      },
    ],
  },
  {
    key: "ataque",
    title: "ATACANTES",
    color: "#D46A6A",
    slots: [
      {
        key: "ed",
        code: "ED",
        label: "Extremo derecho",
        match: ["extremo derecho", "extremo der", "extremo d", "banda derecha"],
      },
      {
        key: "ei",
        code: "EI",
        label: "Extremo izquierdo",
        match: [
          "extremo izquierdo",
          "extremo izq",
          "extremo i",
          "banda izquierda",
        ],
      },
      {
        key: "ext",
        code: "EXT",
        label: "Extremo",
        match: ["extremo", "exterior"],
      },
      {
        key: "sd",
        code: "SD",
        label: "Segundo punta",
        match: ["segundo delantero", "segunda punta", "segundo punta"],
      },
      {
        key: "dc",
        code: "DC",
        label: "Delantero",
        match: ["delantero", "punta", "ariete", "killer"],
      },
    ],
  },
];

const normaliza = (v: unknown) =>
  String(v || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

const INDICE = LINE_DEFINITIONS.flatMap((line) => line.slots.map((slot) => ({ slot, patrones: slot.match.map(normaliza).filter(Boolean) })));

/** El puesto de la hoja con el rótulo de Plantillas rivales (gana el patrón más largo); sin encaje, el texto tal cual. */
export function rotuloDePuesto(posicion: string): string {
  const valor = normaliza(posicion);

  if (!valor) return "";

  let mejor: (typeof INDICE)[number] | null = null;
  let largo = 0;

  for (const entrada of INDICE) {
    for (const patron of entrada.patrones) {
      if (patron.length > largo && valor.includes(patron)) {
        mejor = entrada;
        largo = patron.length;
      }
    }
  }

  return mejor?.slot.label ?? posicion;
}
