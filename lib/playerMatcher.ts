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

function score(a: string, b: string) {
  const A = normalize(a);
  const B = normalize(b);

  if (!A || !B) return 0;

  if (A === B) return 100;

  if (A.includes(B) || B.includes(A)) {
    const wa = A.split(" ").length;
    const wb = B.split(" ").length;

    return Math.abs(wa - wb) <= 1 ? 98 : 95;
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
  squad: Player[]
): MatchResult[] {

  return detected.map(original => {

const ranked = squad
  .map(player => {

    const originalNorm = normalize(original);
    const aliasNorm = normalize(player.APODO ?? "");

    // --------------------------------------------------
    // 1. Prioridad máxima:
    // Si Gemini detectó un apodo entre comillas
    // Ej: Diego Mtnez. "Beto"
    // --------------------------------------------------

    const quotedAlias = original.match(/"([^"]+)"/);

    if (
      quotedAlias &&
      aliasNorm === normalize(quotedAlias[1])
    ) {
      return {
        player,
        score: 101,
      };
    }

    // --------------------------------------------------
    // 2. Si el alias aparece dentro del nombre detectado
    // Ej: Francisco Javier Bailón
    // --------------------------------------------------

    if (
      aliasNorm &&
      originalNorm.includes(aliasNorm)
    ) {
      return {
        player,
        score: 100,
      };
    }

    // --------------------------------------------------
    // 3. Comparación normal
    // --------------------------------------------------

    const nameScore = score(original, player.NOMBRE);

    const aliasScore = score(original, player.APODO ?? "");

    return {
      player,
      score: Math.max(nameScore, aliasScore),
    };

  })
  .sort((a, b) => b.score - a.score);

    const best = ranked[0];

    const second = ranked[1];
  
    const candidates = ranked
  .filter(r => r.score >= 70)
  .slice(0, 3)
  .map(r => ({
    player: r.player,
    confidence: r.score
  }));

    if (!best || best.score < 70) {

      return {
        original,
        player:null,
        confidence:best?.score ?? 0,
        ambiguous:false,
        candidates:[]
      };

    }

    if (
  best.score < 100 &&
  second &&
  second.score >= 90 &&
  best.score - second.score <= 2
){

      return{

        original,

        player:null,

        confidence:best.score,

        ambiguous:true,

        candidates

      };

    }

    return{

      original,

      player:best.player,

      confidence:best.score,

      ambiguous:false,

      candidates

    };

  });

}