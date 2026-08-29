"use client";

/**
 * La carátula que abre un vídeo unificado.
 *
 * Cuando se pegan todos los cortes de un jugador en un solo fichero, lo
 * primero que se ve es la misma diapositiva que ya se exporta desde la ficha
 * del rival: papel blanco, escudo, cara del jugador y su nombre a toda página
 * (`lib/rivals/portada.ts`). Así el vídeo que se manda al jugador o se pone en
 * la sala se reconoce como del club antes de que empiece la primera acción.
 *
 * La diferencia entre los dos casos es **qué datos lleva**:
 *
 * - Del **rival** se pinta lo que el scouting sabe de él, que es justo lo que
 *   hay que enseñar antes de analizarlo.
 * - De **los nuestros** se pinta sólo quién es. Los números de un jugador
 *   propio los tiene el cuerpo técnico en su ficha; repetirlos en la carátula
 *   de un vídeo de trabajo sobra, y la franja de la plantilla se estrecha sola
 *   cuando no hay métricas.
 */

import { pintaPortada, type PortadaData } from "@/lib/rivals/portada";

/**
 * Los datos de la carátula son los de la portada del rival, sin más.
 *
 * Así la del jugador propio y la del rival no pueden separarse: es la misma
 * diapositiva, y lo único que cambia es cuánto se le cuenta. Del rival se pasa
 * su ficha entera —con los números de la temporada—; de los nuestros, sólo
 * quién es.
 */
export type DatosCaratula = PortadaData;

/*
| La carátula viaja a 1920 de ancho y en JPEG, no a pelo desde el lienzo.
|
| `pintaPortada` dibuja a 3840×2160 —el doble, para que la descarga suelta se
| vea bien impresa— y en PNG eso son varios megas. Aquí no hace falta ni uno:
| ffmpeg la va a escalar a la medida del partido (1920×1080 casi siempre), así
| que lo que sobra de lienzo se tira antes de salir. Y sobraba de verdad: la
| carátula ella sola pasaba de los 4,5 MB que aguanta el cuerpo de una
| petición en el despliegue, y por eso el vídeo unificado daba **413** aunque
| no hubiera ni una pizarra que quemar.
*/
const ANCHO_ENVIO = 1920;

/*
| Sobre una diapositiva con una foto dentro, 0,92 no se distingue del PNG.
*/
const CALIDAD = 0.92;

/**
 * Devuelve la carátula como JPEG en `data:` URL, o `null` si no se ha podido.
 *
 * Un fallo aquí no puede impedir la exportación: el vídeo unificado sin
 * carátula sigue sirviendo, así que se avisa y se sigue.
 */
export async function caratulaDeJugador(
  datos: DatosCaratula,
): Promise<string | null> {
  try {
    const lienzo = await pintaPortada(datos);

    if (lienzo.width <= ANCHO_ENVIO) return lienzo.toDataURL("image/jpeg", CALIDAD);

    const reducido = document.createElement("canvas");

    reducido.width = ANCHO_ENVIO;
    reducido.height = Math.round((lienzo.height * ANCHO_ENVIO) / lienzo.width);

    const ctx = reducido.getContext("2d");

    if (!ctx) return lienzo.toDataURL("image/jpeg", CALIDAD);

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(lienzo, 0, 0, reducido.width, reducido.height);

    return reducido.toDataURL("image/jpeg", CALIDAD);
  } catch (error) {
    console.warn("[coding] no se ha podido pintar la carátula", error);

    return null;
  }
}
