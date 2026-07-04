export interface MatchResult {
  original: string;
  matched: string | null;
  confidence: number;
}

function normalize(text: string) {
  return text
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

  if (A === B) return 100;

  if (A.includes(B) || B.includes(A)) return 95;

  const wordsA = A.split(" ");
  const wordsB = B.split(" ");

  let common = 0;

  for (const w of wordsA) {
    if (wordsB.includes(w)) common++;
  }

  return Math.round((common / Math.max(wordsA.length, wordsB.length)) * 100);
}

export function matchPlayers(
  detected: string[],
  squad: string[]
): MatchResult[] {
  return detected.map((player) => {
    let best = "";
    let bestScore = 0;

    for (const official of squad) {
      const s = score(player, official);

      if (s > bestScore) {
        bestScore = s;
        best = official;
      }
    }

    return {
      original: player,
      matched: bestScore >= 70 ? best : null,
      confidence: bestScore,
    };
  });
}