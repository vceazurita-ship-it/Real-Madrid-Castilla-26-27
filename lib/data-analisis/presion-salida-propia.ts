/**
 * NUESTRA SALIDA CONTRA LA PRESIÓN (Análisis de datos → Nuestra historia,
 * 18/11/2026). La misma dispersión que «¿Se le rompe la salida si le
 * presionamos?» del Scout colectivo, pero del Castilla: un punto por partido
 * nuestro, con el PPDA del rival en ese partido (X) y nuestras pérdidas en
 * campo propio (`PsLostD3`, Y), la recta y su r.
 *
 * Encima, el próximo rival: su PPDA medio en la temporada cae en la recta y
 * da las pérdidas que cabe esperar de nosotros (a + b·PPDA). Al lado, la
 * referencia de la liga en ese mismo tramo (PPDA del rival ± 1,5): la media
 * de pérdidas en campo propio de los demás equipos del grupo cuando su
 * oponente presionó así.
 *
 * Las cuentas de la recta son las de `lib/rivals/presion-salida.ts` (se
 * reutilizan tal cual): ahí «como nosotros» pasa a ser «como el próximo
 * rival», porque el PPDA de referencia es el suyo.
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { valorDe } from "@/lib/opta-evolucion";
import type { PartidoEquipo } from "@/lib/opta-analisis";
import { MARGEN_PPDA, presionSalida, type PresionSalida } from "@/lib/rivals/presion-salida";

export { MARGEN_PPDA, MIN_PARTIDOS } from "@/lib/rivals/presion-salida";

export type SalidaPropia = PresionSalida & {
  /** PPDA medio del próximo rival en sus partidos (null si no hay rival o dato). */
  ppdaRival: number | null;
  /** Pérdidas nuestras en campo propio que da la recta con su PPDA. */
  esperadas: number | null;
  /** Media de pérdidas de los demás equipos del grupo ante un PPDA en ese tramo. */
  ligaTramo: number | null;
  nLigaTramo: number;
};

const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * `nuestros`: los partidos del Castilla. `rival`: los del próximo rival (vacío
 * si no se sabe). `liga`: los partidos de cada equipo del grupo, sin el
 * Castilla.
 */
export function salidaPropia(nuestros: PartidoEquipo[], rival: PartidoEquipo[], liga: PartidoEquipo[][]): SalidaPropia | null {
  /* El PPDA «de referencia» que usa presionSalida sale de los partidos que se
     le pasan en segundo lugar: aquí, los del próximo rival. */
  const base = presionSalida(nuestros, rival);
  if (!base) return null;

  const ppdaRival = rival.length ? base.nuestroPpda : null;
  const esperadas =
    ppdaRival != null && base.a != null && base.b != null ? Math.max(0, base.a + base.b * ppdaRival) : null;

  const tramo: number[] = [];
  if (ppdaRival != null) {
    for (const partidos of liga) {
      for (const p of partidos) {
        const ppda = p.otra ? valorDe(p.otra, "PPDA") : null;
        const perdidas = valorDe(p.fila, "PsLostD3");
        if (finito(ppda) && finito(perdidas) && Math.abs(ppda - ppdaRival) <= MARGEN_PPDA) tramo.push(perdidas);
      }
    }
  }

  return { ...base, ppdaRival, esperadas, ligaTramo: media(tramo), nLigaTramo: tramo.length };
}
