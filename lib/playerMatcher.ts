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

export function matchPlayers(
  detected: string[],
  squad: Player[]
): MatchResult[] {
  return detected.map((original) => {
    const originalNorm = normalize(original);

    // --------------------------------------------------
    // 1. Si Gemini detectó un apodo entre comillas
    // Ej: Diego Martínez "Beto"
    // --------------------------------------------------

    const quotedAlias = original.match(/"([^"]+)"/);

    if (quotedAlias) {
      const alias = normalize(quotedAlias[1]);

      const player = squad.find(
        (p) => normalize(p.APODO ?? "") === alias
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
    }

    // --------------------------------------------------
    // 2. Coincidencia EXACTA por nombre
    // --------------------------------------------------

    let player = squad.find(
      (p) => normalize(p.NOMBRE) === originalNorm
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

    // --------------------------------------------------
    // 3. Coincidencia EXACTA por apodo
    // --------------------------------------------------

    player = squad.find(
      (p) =>
        p.APODO &&
        normalize(p.APODO) === originalNorm
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

    // --------------------------------------------------
    // No encontrado
    // --------------------------------------------------

    return {
      original,
      player: null,
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };
  });
}