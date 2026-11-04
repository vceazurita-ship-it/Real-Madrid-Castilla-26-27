/**
 * El vídeo de cada saque de banda (04/11/2026).
 *
 * Lo escribe `scripts/banda-cortes.mjs`: casa cada fila de las hojas de banda
 * con su saque del timeline de Hudl y deja, por fila, el segundo del vídeo del
 * partido en Hudl y nuestro corte del saque. La fila se reconoce por su
 * jornada, el lado y su sitio entre las filas de esa jornada en la hoja (las
 * hojas sólo crecen por abajo: una fila nueva no mueve las de antes).
 */

export const DOC_BANDA = "banda:cortes";

export type AccionBanda = {
  jornada: string;
  lado: "of" | "def";
  /** Su sitio (desde 0) entre las filas de esa jornada en la hoja. */
  fila: number;
  /** Del saque de Hudl, para comprobar que la fila es la misma. */
  tiempo: string;
  minuto: string;
  hudl?: { url: string; seg: number };
  video?: string;
};

export type BandaCortes = { actualizado?: string; acciones: Record<string, AccionBanda> };

export const BANDA_VACIO: BandaCortes = { acciones: {} };

export const claveBanda = (jornada: string, lado: "of" | "def", fila: number) => `${jornada.trim()}|${lado}|${fila}`;

/**
 * La acción de una fila, sólo si sigue siendo la misma: si la hoja dice otra
 * parte, o un minuto a más de dos del de Hudl (fuera del descuento, que la
 * hoja escribe 45 o 90 a secas), no se le pone el vídeo de otro saque.
 */
export function accionDeFila(
  doc: BandaCortes | null | undefined,
  fila: { jornada: string; lado: "of" | "def"; orden: number; tiempo: string; minuto: string },
): AccionBanda | null {
  const a = doc?.acciones?.[claveBanda(fila.jornada, fila.lado, fila.orden)];

  if (!a) return null;

  const parte = fila.tiempo.match(/[12]/)?.[0];

  if (parte && a.tiempo && `T${parte}` !== a.tiempo) return null;

  const m = Number.parseInt(fila.minuto, 10);
  const h = Number.parseInt(a.minuto, 10);

  if (Number.isFinite(m) && Number.isFinite(h) && Math.abs(m - h) > 2 && !((m === 45 || m === 90) && h >= m)) return null;

  return a;
}
