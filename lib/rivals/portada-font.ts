import { Barlow_Condensed } from "next/font/google";

/*
|--------------------------------------------------------------------------
| TIPOGRAFÍA DE LA PORTADA DEL JUGADOR
|--------------------------------------------------------------------------
|
| La plantilla de la que sale la portada (`public/INDIVIDUAL.pptx`) está
| escrita entera en **Barlow Condensed**: el "ANÁLISIS INDIVIDUAL" a 130 pt
| sólo cabe de lado a lado de la diapositiva porque la letra es condensada, y
| con la Geist de la app el mismo texto se sale de la hoja. Así que la portada
| se lleva su propia fuente.
|
| Va en un módulo aparte por dos razones. `next/font` exige que la llamada
| esté en el nivel superior de un módulo, y el CSS con la `@font-face` sólo
| entra en la página que importa ese módulo: teniéndolo suelto, la portada
| puede importarlo tanto desde el lienzo como desde la página de rivales sin
| duplicar la descarga.
|
| No es variable en Google Fonts, así que hay que pedir los pesos a mano.
| Sólo se usan tres: el 700 de los titulares, el 600 de las chapas y el 500
| de los pies.
*/

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * La familia tal y como la entiende `ctx.font` del `<canvas>`.
 *
 * `next/font` devuelve el nombre con hash más su respaldo ajustado
 * (`'__Barlow_Condensed_abc123', '__Barlow_Condensed_Fallback_abc123'`), que
 * es justo lo que quiere la abreviatura `font` del contexto 2D.
 */
export const FAMILIA_PORTADA = barlowCondensed.style.fontFamily;

/**
 * Espera a que la fuente esté descargada antes de medir o pintar.
 *
 * En el `<canvas>` no hay `font-display: swap` que valga: si se pinta antes de
 * tiempo, el texto sale con la fuente de respaldo y **además** mal medido,
 * porque los anchos con los que se han centrado las chapas son los de la
 * condensada. Un fallo no tumba la exportación —queda el respaldo, que es una
 * Arial con las métricas ajustadas—, sólo la afea.
 */
export async function esperaFuentePortada() {
  if (typeof document === "undefined" || !document.fonts) return;

  try {
    await Promise.all([
      document.fonts.load(`700 200px ${FAMILIA_PORTADA}`),
      document.fonts.load(`600 40px ${FAMILIA_PORTADA}`),
      document.fonts.load(`500 24px ${FAMILIA_PORTADA}`),
    ]);
  } catch (error) {
    console.warn("[portada] no se ha podido cargar Barlow Condensed", error);
  }
}
