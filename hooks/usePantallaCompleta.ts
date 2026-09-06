"use client";

/**
 * PANTALLA COMPLETA · un trozo de la página ocupando toda la pantalla.
 *
 * Lo pide la pizarra: dibujar sobre un campo de doce centímetros mientras el
 * menú, la barra de arriba y el marco del navegador se comen media pantalla no
 * sirve para enseñar nada. En el vestuario y en la tablet se quiere el campo y
 * nada más.
 *
 * Se envuelve el navegador porque hay tres realidades distintas:
 *
 *   - Chrome, Edge y Firefox llevan `requestFullscreen` sin prefijo.
 *   - Safari —el de la tablet del cuerpo técnico— sólo entiende las versiones
 *     con `webkit`, y las tiene desde hace años.
 *   - El Safari del **iPhone** no deja poner un elemento cualquiera a pantalla
 *     completa: sólo los vídeos. Por eso esto dice si se puede o no, y quien
 *     lo usa esconde el botón en vez de enseñar uno que no hace nada.
 *
 * Una regla que se aprende a la primera: **entrar exige un gesto de la
 * persona**. Vale el clic que se está atendiendo; no vale un efecto al cargar
 * la página. Por eso desde la portada se pide la pantalla completa en el
 * propio clic del enlace y se navega después: la navegación de Next no recarga
 * el documento, así que se llega a la pizarra ya en grande.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

/* Los nombres con prefijo no están en los tipos del DOM, así que se declaran. */
interface ElementoConPrefijos extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface DocumentoConPrefijos extends Document {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}

const SUCESOS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "MSFullscreenChange",
] as const;

/** El elemento que está a pantalla completa ahora mismo, si hay alguno. */
function elQueManda(): Element | null {
  if (typeof document === "undefined") return null;

  const doc = document as DocumentoConPrefijos;

  return (
    doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null
  );
}

/*
| Esto es **estado de fuera de React** —lo lleva el navegador, y cambia también
| cuando alguien pulsa Escape—, así que se lee con `useSyncExternalStore` y no
| con un `useState` que un efecto va persiguiendo. Además de ser la forma
| recomendada, resuelve dos cosas de una: en el servidor no hay `document` y la
| instantánea de servidor devuelve `false`, y salir con Escape se refleja solo
| sin que el botón se quede diciendo lo contrario de lo que se ve.
*/

function suscribe(avisa: () => void) {
  for (const suceso of SUCESOS) document.addEventListener(suceso, avisa);

  return () => {
    for (const suceso of SUCESOS) document.removeEventListener(suceso, avisa);
  };
}

/**
 * Si el navegador permite la pantalla completa no cambia nunca... pero **sólo
 * se sabe en el navegador**, y en el servidor la respuesta es que no.
 *
 * De ahí el aviso de una sola vez al suscribirse: sin él React se quedaba con
 * el `false` con el que pintó el servidor y el botón no llegaba a aparecer
 * nunca, aunque `document.fullscreenEnabled` dijera que sí. Comprobado en el
 * coding el 06/09/2026: la barra salía sin él.
 */
function seSabeAlLlegar(avisa: () => void) {
  const aviso = setTimeout(avisa, 0);

  return () => clearTimeout(aviso);
}

function seCoge(): boolean {
  const doc = document as DocumentoConPrefijos;

  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

const enVentana = () => false;

/** Llama a `pedir` sin que un rechazo del navegador rompa nada. */
function intenta(pide: (() => Promise<void> | void) | undefined, quien: object) {
  try {
    const hecho = pide?.call(quien);

    if (hecho && typeof hecho === "object" && "catch" in hecho) {
      (hecho as Promise<void>).catch(() => {});
    }
  } catch {
    /* Si el navegador dice que no, se sigue en ventana: no es un error que
       merezca interrumpir a nadie a mitad de una charla. */
  }
}

/**
 * Pone a pantalla completa el elemento que se le pase, o el que guarde `marco`.
 *
 * Devuelve `alterna`, que es lo que se cuelga del botón, y `enPantallaCompleta`
 * para cambiarle el icono y el texto.
 */
export function usePantallaCompleta<T extends HTMLElement = HTMLDivElement>() {
  const marco = useRef<T | null>(null);

  const enPantallaCompleta = useSyncExternalStore(
    suscribe,
    () => Boolean(elQueManda()),
    enVentana,
  );

  const disponible = useSyncExternalStore(seSabeAlLlegar, seCoge, enVentana);

  const entra = useCallback((elemento?: HTMLElement | null) => {
    const destino = (elemento ?? marco.current) as ElementoConPrefijos | null;

    if (!destino) return;

    intenta(
      destino.requestFullscreen ??
        destino.webkitRequestFullscreen ??
        destino.msRequestFullscreen,
      destino,
    );
  }, []);

  const sale = useCallback(() => {
    if (!elQueManda()) return;

    const doc = document as DocumentoConPrefijos;

    intenta(
      doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen,
      document,
    );
  }, []);

  const alterna = useCallback(
    (elemento?: HTMLElement | null) => {
      if (elQueManda()) sale();
      else entra(elemento);
    },
    [entra, sale],
  );

  return { marco, enPantallaCompleta, disponible, entra, sale, alterna };
}

/**
 * Pide la pantalla completa de toda la página desde el clic de un enlace.
 *
 * Es para la portada: se pide **antes** de navegar, aprovechando el gesto que
 * el navegador está atendiendo, y como Next navega sin recargar el documento,
 * la pantalla completa sigue puesta al llegar a la pizarra. Hacerlo al otro
 * lado, con un efecto de carga, lo rechaza el navegador por falta de gesto.
 */
export function pantallaCompletaAlNavegar() {
  if (typeof document === "undefined") return;

  if (elQueManda()) return;

  const raiz = document.documentElement as ElementoConPrefijos;

  intenta(
    raiz.requestFullscreen ?? raiz.webkitRequestFullscreen ?? raiz.msRequestFullscreen,
    raiz,
  );
}
