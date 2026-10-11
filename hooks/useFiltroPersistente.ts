"use client";

/**
 * UN FILTRO QUE NO SE OLVIDA AL CAMBIAR DE PANTALLA.
 *
 * Los filtros de las pantallas grandes —el microciclo en Microciclos, por
 * ejemplo— vivían en un `useState` y se perdían a cada vuelta: ir al informe
 * del partido y volver era empezar otra vez en «Todos». Y una URL con el
 * filtro puesto no existía, así que no se podía mandar a nadie «mira el
 * micro 13».
 *
 * Aquí el valor vive en dos sitios a la vez, por este orden:
 *
 * 1. **La barra de direcciones** (`?clave=valor`). Si viene en la URL, manda:
 *    es lo que hace que un enlace o un marcador abran la pantalla como se
 *    quería compartir.
 * 2. **`sessionStorage`** (`rmcf-filtro:<ruta>:<clave>`), para volver a la
 *    pantalla dentro de la misma pestaña y encontrarla como se dejó. Es de la
 *    pestaña y no del aparato a propósito: un filtro no es una preferencia,
 *    y al día siguiente se quiere el de hoy.
 *
 * Cambiarlo escribe en los dos, con `replaceState` y sin navegar: no se añade
 * un paso al historial por cada clic en un desplegable.
 *
 * Mientras no haya nada guardado, el valor es `porDefecto`, **que puede
 * cambiar**: Microciclos lo pasa como el micro de hoy, que sólo se sabe
 * cuando llega la hoja. Se lee de la barra y del almacén con
 * `useSyncExternalStore`, como en la pizarra: `useSearchParams` obligaría a
 * un `Suspense` y la instantánea de servidor (nada guardado) no desajusta al
 * hidratar.
 */

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const PREFIJO = "rmcf-filtro:";

const oyentes = new Set<() => void>();

function avisa() {
  for (const oye of oyentes) oye();
}

function suscribe(oye: () => void) {
  oyentes.add(oye);
  window.addEventListener("popstate", oye);

  return () => {
    oyentes.delete(oye);
    window.removeEventListener("popstate", oye);
  };
}

function claveAlmacen(ruta: string, clave: string) {
  return `${PREFIJO}${ruta}:${clave}`;
}

/** Lo elegido a mano, o `null` si nunca se ha tocado en esta pestaña. */
function leeElegido(ruta: string, clave: string): string | null {
  const enUrl = new URLSearchParams(window.location.search).get(clave);

  if (enUrl !== null) return enUrl;

  try {
    return window.sessionStorage.getItem(claveAlmacen(ruta, clave));
  } catch {
    /* Ventana privada o almacenamiento bloqueado: sólo vale la URL. */
    return null;
  }
}

function nadaElegido() {
  return null;
}

/**
 * `[valor, setValor]` como un `useState`, pero el valor sobrevive a la
 * navegación y se puede compartir en la URL.
 */
export function useFiltroPersistente<T extends string>(
  clave: string,
  porDefecto: T,
): [T, (valor: T) => void] {
  const ruta = usePathname() ?? "";

  const elegido = useSyncExternalStore(
    suscribe,
    () => leeElegido(ruta, clave),
    nadaElegido,
  );

  const setValor = useCallback(
    (valor: T) => {
      const url = new URL(window.location.href);

      url.searchParams.set(clave, valor);

      /* Se conserva `history.state`: Next guarda ahí el árbol de la ruta. */
      window.history.replaceState(window.history.state, "", url);

      try {
        window.sessionStorage.setItem(claveAlmacen(ruta, clave), valor);
      } catch {
        /* Sin almacén se queda en la URL, que es lo que manda de todas formas. */
      }

      avisa();
    },
    [clave, ruta],
  );

  return [(elegido ?? porDefecto) as T, setValor];
}

export default useFiltroPersistente;
