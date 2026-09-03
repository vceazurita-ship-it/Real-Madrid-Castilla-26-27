/**
 * Una sola descarga de cada hoja publicada mientras dure la pestaña.
 *
 * Las pantallas leen de hojas de Google publicadas en CSV, y cada una se la
 * bajaba entera **cada vez que se entraba**. Como se navega sin recargar,
 * dar una vuelta por el menú —principios, microciclos, ABP, valores— y volver
 * atrás repetía las mismas descargas una y otra vez; Google no es rápido con
 * ellas y son los segundos de reloj de arena que se ven al cambiar de
 * pantalla. Es el mismo remedio que ya llevaba la plantilla en `usePlayers`,
 * aquí para todas las demás hojas.
 *
 * Lo que se guarda es la promesa, no el texto: dos componentes que pidan la
 * misma hoja a la vez comparten una única petición en vuelo.
 *
 * **La memoria dura lo que la pestaña.** Recargar (F5) vuelve a bajarlo todo,
 * y quien tenga un botón de recargar en pantalla —los que escriben en la hoja
 * y se releen para enseñar lo guardado— pide `forzar` y se salta la copia. Un
 * fallo no se guarda nunca: el siguiente intento vuelve a la red.
 */

const enMemoria = new Map<string, Promise<string>>();

export function traeCsv(
  url: string,
  opciones: { forzar?: boolean } = {},
): Promise<string> {
  if (opciones.forzar) enMemoria.delete(url);

  const guardada = enMemoria.get(url);

  if (guardada) return guardada;

  /*
  | Sin `AbortSignal` a propósito: la descarga es de todos los que la esperan,
  | y desmontar una pantalla no puede cortársela a otra que siga pidiéndola.
  */
  const descarga = fetch(url)
    .then((respuesta) => {
      if (!respuesta.ok) {
        throw new Error(`La hoja respondió ${respuesta.status}`);
      }

      return respuesta.text();
    })
    .catch((error: unknown) => {
      enMemoria.delete(url);

      throw error;
    });

  enMemoria.set(url, descarga);

  return descarga;
}

/** Olvida lo bajado de una hoja (o de todas) para que se vuelva a pedir. */
export function olvidaCsv(url?: string) {
  if (url) enMemoria.delete(url);
  else enMemoria.clear();
}
