export interface MatchResult {
  original: string;
  matched: string | null;
  confidence: number;
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

function score(a: string, b: string) {
  const A = normalize(a);
  const B = normalize(b);

  if (!A || !B) return 0;

  if (A === B) return 100;

  // Coincidencia completa
  if (A.includes(B) || B.includes(A)) {
    const wordsA = A.split(" ").length;
    const wordsB = B.split(" ").length;

    // Premiamos cuando coincide el nombre completo
    if (Math.abs(wordsA - wordsB) <= 1) {
      return 98;
    }

    return 95;
  }

  const wordsA = A.split(" ");
  const wordsB = B.split(" ");

  let common = 0;

  for (const w of wordsA) {
    if (wordsB.includes(w)) common++;
  }

  return Math.round(
    (common / Math.max(wordsA.length, wordsB.length)) * 100
  );
}

export function matchPlayers(
  detected: string[],
  squad: string[]
): MatchResult[] {
  return detected.map((player) => {
    const candidates = squad
      .map((official) => ({
        official,
        score: score(player, official),
      }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const second = candidates[1];

    if (!best || best.score < 70) {
      return {
        original: player,
        matched: null,
        confidence: best?.score ?? 0,
      };
    }

    // Si hay empate casi perfecto, no asignamos automáticamente
    if (
      second &&
      second.score >= 90 &&
      best.score - second.score <= 2
    ) {
      return {
        original: player,
        matched: null,
        confidence: best.score,
      };
    }

    return {
      original: player,
      matched: best.official,
      confidence: best.score,
    };
  });
}