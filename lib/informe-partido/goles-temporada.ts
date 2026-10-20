/*
| LOS GOLES DE LA TEMPORADA, PARA EL POST (25/10/2026, experto de análisis y
| de fútbol). «Cerramos los partidos con ventaja» salía de un solo gol, y los
| goles en contra iban sin fase. El documento `goles:analisis` (lo arma cada
| noche scripts/goles-liga.mjs desde BeSoccer y el timeline de Hudl) ya trae
| todos nuestros partidos y, por gol, su tipología. Aquí sólo se lee.
*/
import { CASTILLA, DOC_GOLES, DOC_TIPOLOGIA_MANUAL, type GolesDoc, type TipoGol, type TipologiaManual } from "@/lib/goles/analisis";
import { mismoClub } from "@/lib/rivals/mismoClub";

export type GolesTemporada = {
  /** En cuántos partidos (hasta esta jornada) nos marcaron a partir del 80′ yendo por delante. */
  cerradosConVentaja: { veces: number; partidos: number };
  /** La fase de cada gol en contra de ESTE partido, por minuto («90+1» → «transición tras pérdida en campo propio»). */
  fases: Record<string, string>;
};

/* Cómo se dice cada tipo cuando el gol es en contra (su ataque). */
const FASE_EN_CONTRA: Record<TipoGol, string> = {
  dentro: "ataque organizado por dentro",
  bandaD: "ataque organizado por banda",
  bandaI: "ataque organizado por banda",
  espalda: "balón a nuestra espalda",
  caida: "segunda jugada",
  error: "tras un error nuestro",
  transContrario: "transición tras pérdida en su campo",
  transPropio: "transición tras pérdida en nuestro campo",
  corner: "córner",
  faltaLateral: "falta lateral",
  faltaDirecta: "falta directa",
  banda: "saque de banda",
  penalti: "penalti",
};

async function doc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });

    const j = (await r.json()) as { data?: T | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

/** «90+1», «57»: como escribe el minuto la crónica de BeSoccer. */
const minutoDe = (min: number, extra: number) => (extra ? `${min}+${extra}` : String(min));

/** Los goles de la temporada hasta la jornada dada. `null` si no hay documento o no está el partido. */
export async function golesTemporadaDe(jornada: number | null): Promise<GolesTemporada | null> {
  if (!jornada) return null;

  const [goles, manual] = await Promise.all([doc<GolesDoc>(DOC_GOLES), doc<TipologiaManual>(DOC_TIPOLOGIA_MANUAL)]);

  const nuestros = (goles?.partidos ?? []).filter((p) => p.jornada <= jornada && (mismoClub(p.local, CASTILLA) || mismoClub(p.visitante, CASTILLA)));

  if (!nuestros.length) return null;

  let veces = 0;

  const fases: Record<string, string> = {};

  for (const p of nuestros) {
    const lado = mismoClub(p.local, CASTILLA) ? "local" : "visitante";

    let nos = 0;
    let ellos = 0;
    let tarde = false;

    /* Por orden de juego: el documento los guarda como los da BeSoccer. */
    const orden = p.goles.map((g, i) => ({ g, i })).sort((a, b) => a.g.parte - b.g.parte || a.g.min - b.g.min || a.g.extra - b.g.extra);

    for (const { g, i } of orden) {
      const nuestro = g.lado === lado;

      if (!nuestro && nos > ellos && g.parte === 2 && g.min >= 80) tarde = true;

      if (nuestro) nos += 1;
      else ellos += 1;

      if (!nuestro && p.jornada === jornada) {
        const tipo = (manual?.[`${p.id}:${i}`] || goles?.tipologia?.[`${p.id}:${i}`]?.tipo) as TipoGol | null | undefined;

        if (tipo && FASE_EN_CONTRA[tipo]) fases[minutoDe(g.min, g.extra)] = FASE_EN_CONTRA[tipo];
      }
    }

    if (tarde) veces += 1;
  }

  return { cerradosConVentaja: { veces, partidos: nuestros.length }, fases };
}
