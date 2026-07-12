export interface Player {
  ID_JUGADOR: string;
  NOMBRE: string;
  APODO?: string;
  FOTO_URL?: string;
}

export interface MatchResult {
  original: string;
  player: Player | null;
  confidence: number;
  ambiguous: boolean;
  candidates: {
    player: Player;
    confidence: number;
  }[];
}

function normalize(text: string) {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'.]/g, "")
    .replace(/\b(fco|frco)\b/g, "francisco")
    .replace(/\bmtnez\b/g, "martinez")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras demasiado genéricas para aceptar por apodo
const GENERIC_NAMES = new Set([
  "diego",
  "alvaro",
  "carlos",
  "pedro",
  "juan",
  "javi",
  "david",
  "gabriel",
  "manuel",
  "mario",
  "alex",
  "alexis",
  "leo",
  "ferran",
  "fran",
  "jaime",
  "angel",
  "jesus",
  "thiago",
  "cristian",
  "daniel",
  "ignacio",
  "sergio",
]);

export function matchPlayers(
  detected: string[],
  squad: Player[]
): MatchResult[] {

  return detected.map((original) => {

    const originalNorm = normalize(original);

    //--------------------------------------------------
    // 1. Nombre exacto
    //--------------------------------------------------

    let player = squad.find(
      p => normalize(p.NOMBRE) === originalNorm
    );

    if (player) {
      return {
        original,
        player,
        confidence: 100,
        ambiguous: false,
        candidates: [],
      };
    }

    //--------------------------------------------------
    // 2. Apodo exacto SOLO si no es un nombre genérico
    //--------------------------------------------------

    player = squad.find(p => {

      if (!p.APODO) return false;

      const alias = normalize(p.APODO);

      if (GENERIC_NAMES.has(alias)) return false;

      if (alias.length < 4) return false;

      return alias === originalNorm;

    });

    if (player) {
      return {
        original,
        player,
        confidence: 100,
        ambiguous: false,
        candidates: [],
      };
    }

    //--------------------------------------------------
    // 3. Coincidencias por nombre completo contenido
    //--------------------------------------------------

    const candidates = squad
      .map(player => {

        const name = normalize(player.NOMBRE);

        let confidence = 0;

        if (
          name.includes(originalNorm) ||
          originalNorm.includes(name)
        ) {
          confidence = 95;
        }

        return {
          player,
          confidence,
        };

      })
      .filter(c => c.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    //--------------------------------------------------
    // 4. Match automático SOLO si es único
    //--------------------------------------------------

    if (candidates.length === 1) {

      return {
        original,
        player: candidates[0].player,
        confidence: candidates[0].confidence,
        ambiguous: false,
        candidates: [],
      };

    }

    //--------------------------------------------------
    // 5. Varias opciones -> preguntar
    //--------------------------------------------------

    if (candidates.length > 1) {

      return {
        original,
        player: null,
        confidence: candidates[0].confidence,
        ambiguous: true,
        candidates: candidates.slice(0, 5),
      };

    }

    //--------------------------------------------------
    // 6. Jugador nuevo
    //--------------------------------------------------

    return {
      original,
      player: null,
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };

  });

}