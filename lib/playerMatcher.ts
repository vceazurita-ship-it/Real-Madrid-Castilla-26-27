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

const GENERIC_NAMES = new Set([
  "diego",
  "david",
  "pedro",
  "juan",
  "carlos",
  "alvaro",
  "angel",
  "manuel",
  "gabriel",
  "mario",
  "alex",
  "alexis",
  "leo",
  "javi",
  "jaime",
  "sergio",
  "thiago",
  "daniel",
  "jesus",
  "cristian",
  "ferran",
  "fran",
  "ignacio",
]);

function normalize(text: string) {

  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'.]/g, "")
    .replace(/[(),]/g, " ")
    .replace(/\bmtnez\b/g, "martinez")
    .replace(/\bfco\b/g, "francisco")
    .replace(/\bfrco\b/g, "francisco")
    .replace(/\s+/g, " ")
    .trim();

}

function words(text: string) {

  return normalize(text)
    .split(" ")
    .filter(Boolean);

}

function firstWord(text: string) {

  return words(text)[0] ?? "";

}

function lastWord(text: string) {

  const w = words(text);

  return w[w.length - 1] ?? "";

}

function intersection(a: string[], b: string[]) {

  return a.filter(x => b.includes(x)).length;

}

function jaro(a: string, b: string) {

  if (a === b) return 1;

  const len1 = a.length;
  const len2 = b.length;

  if (!len1 || !len2) return 0;

  const matchDistance =
    Math.floor(Math.max(len1, len2) / 2) - 1;

  const aMatches = new Array(len1).fill(false);
  const bMatches = new Array(len2).fill(false);

  let matches = 0;

  for (let i = 0; i < len1; i++) {

    const start = Math.max(0, i - matchDistance);

    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {

      if (bMatches[j]) continue;

      if (a[i] !== b[j]) continue;

      aMatches[i] = true;
      bMatches[j] = true;
      matches++;

      break;

    }

  }

  if (!matches) return 0;

  let t = 0;

  let k = 0;

  for (let i = 0; i < len1; i++) {

    if (!aMatches[i]) continue;

    while (!bMatches[k]) k++;

    if (a[i] !== b[k]) t++;

    k++;

  }

  t /= 2;

  return (
    (matches / len1 +
      matches / len2 +
      (matches - t) / matches) / 3
  );

}

function jaroWinkler(a: string, b: string) {

  const j = jaro(a, b);

  let prefix = 0;

  for (let i = 0; i < 4; i++) {

    if (a[i] === b[i]) prefix++;

    else break;

  }

  return j + prefix * 0.1 * (1 - j);

}

function scorePlayer(
  detected: string,
  player: Player
) {

  const detectedNorm = normalize(detected);

  const nameNorm = normalize(player.NOMBRE);

  const aliasNorm = normalize(player.APODO ?? "");

  // Exacto
  if (detectedNorm === nameNorm)
    return 100;

  // Apodo exacto (solo si no es nombre común)

  if (
    aliasNorm &&
    aliasNorm.length >= 4 &&
    !GENERIC_NAMES.has(aliasNorm) &&
    detectedNorm === aliasNorm
  ) {
    return 100;
  }

  let score =
    jaroWinkler(detectedNorm, nameNorm) * 100;

  // Coincidencia fuerte de apellido

  if (
    lastWord(detectedNorm) &&
    lastWord(detectedNorm) === lastWord(nameNorm)
  ) {

    score += 4;

  }

  // Coincidencia fuerte de nombre

  if (
    firstWord(detectedNorm) &&
    firstWord(detectedNorm) === firstWord(nameNorm)
  ) {

    score += 3;

  }

  // Palabras comunes

  score +=
    intersection(
      words(detectedNorm),
      words(nameNorm)
    ) * 2;

  return Math.min(score, 100);

}



   export function matchPlayers(
  detected: string[],
  squad: Player[]
): MatchResult[] {

  return detected.map((original) => {

    const detectedNorm = normalize(original);

    // Si Gemini detecta comillas ("Beto"), no usar el nombre
    // para hacer match automático. Solo aceptar alias exacto.
    const quotedAlias = original.match(/"([^"]+)"/);

    if (quotedAlias) {

      const alias = normalize(quotedAlias[1]);

      const player = squad.find(
        p => normalize(p.APODO ?? "") === alias
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

      // Si el alias entre comillas NO existe,
      // NO intentar emparejar automáticamente.
      return {
        original,
        player: null,
        confidence: 0,
        ambiguous: false,
        candidates: [],
      };
    }

    const candidates = squad
      .map(player => ({
        player,
        confidence: scorePlayer(original, player),
      }))
      .filter(c => c.confidence >= 85)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);


      const detectedWords = words(original);

if (
  detectedWords.length === 1 &&
  GENERIC_NAMES.has(detectedWords[0])
) {
  return {
    original,
    player: null,
    confidence: candidates[0]?.confidence ?? 0,
    ambiguous: candidates.length > 0,
    candidates,
  };
}


    // ==================================================
    // 5. Si hay coincidencia muy clara -> aceptar
    // ==================================================

    if (
      candidates.length === 1 &&
      candidates[0].confidence >= 95
    ) {
      return {
        original,
        player: candidates[0].player,
        confidence: candidates[0].confidence,
        ambiguous: false,
        candidates: [],
      };
    }

    // ==================================================
    // 6. Si hay varias parecidas -> pedir al usuario
    // ==================================================

    if (candidates.length > 0) {
      return {
        original,
        player: null,
        confidence: candidates[0].confidence,
        ambiguous: true,
        candidates,
      };
    }

    // ==================================================
    // 7. No encontrado -> jugador nuevo
    // ==================================================

    return {
      original,
      player: null,
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };

  });

}