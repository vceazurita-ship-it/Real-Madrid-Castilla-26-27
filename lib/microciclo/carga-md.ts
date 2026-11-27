/**
 * LA CARGA MEDIA DE CADA MD (27/11/2026, fútbol, ronda 9).
 *
 * /micro_calendar decía «sin pasar de 159 UA, la media de 20 MD-1» y
 * /laboratorio/microciclo, «≈ 170 UA · media de 20 MD-1»: cada pantalla
 * contaba a su manera (una sólo los días ya pasados, la otra también los
 * planificados con carga). Una sola regla para las dos:
 *
 * - UA de un día = suma de la «Carga Ponderada» (minutos × intensidad) de sus
 *   tareas de entreno (el partido no cuenta). Quien llama ya ha quitado las
 *   filas de partido.
 * - Sólo días ANTERIORES a `antesDe` (AAAA-MM-DD): lo hecho, no lo previsto.
 * - Por MD, la media de los días con carga; con menos de
 *   `MINIMO_DIAS_MEDIA_MD` días, ese MD no lleva cifra.
 */

export const MINIMO_DIAS_MEDIA_MD = 3;

/** «md-1», «MD - 1» → «MD-1». */
export const mdParaMedia = (md: string) => md.trim().toUpperCase().replace(/\s+/g, "");

export type DiaConCarga = { fecha: string; md: string; ua: number };

export function mediasDeCargaPorMd(dias: Iterable<DiaConCarga>, antesDe?: string): Map<string, { ua: number; n: number }> {
  const suma = new Map<string, { ua: number; n: number }>();

  for (const d of dias) {
    const md = mdParaMedia(d.md);

    if (!md || !(d.ua > 0)) continue;
    if (antesDe && (!d.fecha || d.fecha >= antesDe)) continue;

    const s = suma.get(md) ?? { ua: 0, n: 0 };

    s.ua += d.ua;
    s.n += 1;
    suma.set(md, s);
  }

  return new Map(
    [...suma.entries()]
      .filter(([, s]) => s.n >= MINIMO_DIAS_MEDIA_MD)
      .map(([md, s]) => [md, { ua: Math.round(s.ua / s.n), n: s.n }]),
  );
}
