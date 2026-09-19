"use client";

/**
 * EL TAMAÑO DEL VISOR · lo grande que se ve el vídeo del coding.
 *
 * El vídeo ocupaba siempre todo el ancho de su columna, y eso sólo le venía
 * bien a una pantalla: en un portátil la imagen se comía la altura y la barra
 * de marcar quedaba por debajo, y en el monitor grande de la sala sobraba
 * vídeo y faltaba sitio para la lista. Ahora cada uno lo pone a su medida:
 *
 *   - **Un porcentaje** del ancho de la columna, del 35 al 100.
 *   - **A la pantalla**: el vídeo mide lo que cabe en la altura de la ventana
 *     dejando sitio para los mandos. Lo calcula el CSS —con `dvh`—, así que
 *     se recoloca solo al girar la tablet o al cambiar la ventana de tamaño.
 *   - **A lo ancho**: los paneles de la derecha pasan abajo y el vídeo se
 *     queda con todo el ancho de la página. Es para proyectar.
 *
 * Se guarda en `localStorage` y no en la sesión de coding: es cosa de la
 * pantalla y de quien la usa, no del partido. Cada ordenador recuerda el suyo.
 *
 * Como la pantalla completa, es **estado de fuera de React** —lo lleva el
 * navegador— y se lee con `useSyncExternalStore`: en el
 * servidor sale el de siempre y no hay parpadeo de hidratación.
 */

import { useCallback, useSyncExternalStore } from "react";

/** El porcentaje más pequeño: por debajo ya no se distingue un dorsal. */
export const VISOR_MINIMO = 35;

/** El más grande: toda la columna. Para más está «a lo ancho». */
export const VISOR_MAXIMO = 100;

/** Lo que sube o baja cada pulsación de − y +. */
export const VISOR_PASO = 10;

/**
 * Lo que se deja libre por debajo del vídeo en el modo «a la pantalla»: la
 * barra de mandos y la de marcar, que es lo que se tiene que ver a la vez que
 * la imagen para codificar sin bajar la página.
 */
const RESERVA_MANDOS_PX = 230;

export interface Visor {
  /**
   * El porcentaje del ancho de la columna, o `0` para **a la pantalla**.
   */
  tamaño: number;
  /** Si los paneles de la derecha se van abajo. */
  aLoAncho: boolean;
}

const CLAVE = "rmcf:coding:visor";

const DE_SIEMPRE: Visor = { tamaño: VISOR_MAXIMO, aLoAncho: false };

/** Mete un porcentaje en los límites, dejando pasar el `0` de «a la pantalla». */
export function acota(tamaño: number): number {
  if (tamaño === 0) return 0;

  return Math.round(Math.min(VISOR_MAXIMO, Math.max(VISOR_MINIMO, tamaño)));
}

/* ------------------------------------------------------------ el almacén */

const avisos = new Set<() => void>();

/*
| La instantánea tiene que ser **el mismo objeto** mientras no cambie lo
| guardado, o `useSyncExternalStore` entra en un bucle de pintar. Por eso se
| recuerda el texto crudo y sólo se vuelve a leer cuando es otro.
*/
let crudoLeido: string | null = null;
let visorLeido: Visor = DE_SIEMPRE;

function lee(): Visor {
  let crudo: string | null = null;

  try {
    crudo = window.localStorage.getItem(CLAVE);
  } catch {
    /* Navegación privada o almacenamiento bloqueado: se usa el de siempre. */
  }

  if (crudo === crudoLeido) return visorLeido;

  crudoLeido = crudo;

  try {
    const guardado = crudo ? (JSON.parse(crudo) as Partial<Visor>) : {};

    visorLeido = {
      tamaño:
        typeof guardado.tamaño === "number"
          ? acota(guardado.tamaño)
          : DE_SIEMPRE.tamaño,
      aLoAncho: guardado.aLoAncho === true,
    };
  } catch {
    visorLeido = DE_SIEMPRE;
  }

  return visorLeido;
}

function escribe(visor: Visor) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(visor));
  } catch {
    /* Si no se puede guardar, se queda en memoria hasta recargar. */
    crudoLeido = JSON.stringify(visor);
    visorLeido = visor;
  }

  for (const avisa of avisos) avisa();
}

function suscribe(avisa: () => void) {
  avisos.add(avisa);

  /* Otra pestaña del coding abierta en el mismo ordenador. */
  const deOtraPestaña = (evento: StorageEvent) => {
    if (evento.key === CLAVE) avisa();
  };

  window.addEventListener("storage", deOtraPestaña);

  return () => {
    avisos.delete(avisa);
    window.removeEventListener("storage", deOtraPestaña);
  };
}

const enServidor = () => DE_SIEMPRE;

/* -------------------------------------------------------------- el gancho */

/**
 * El tamaño elegido y cómo cambiarlo.
 *
 * `anchoMaximo` es lo que va en el `max-width` del marco del vídeo: se aplica
 * al marco y no al `<video>` porque la pizarra se ancla a la esquina del
 * marco, y los dos tienen que medir siempre lo mismo.
 */
export function useVisor() {
  const visor = useSyncExternalStore(suscribe, lee, enServidor);

  const ponTamaño = useCallback((tamaño: number) => {
    escribe({ ...lee(), tamaño: acota(tamaño) });
  }, []);

  const alternaAncho = useCallback(() => {
    const ahora = lee();

    escribe({ ...ahora, aLoAncho: !ahora.aLoAncho });
  }, []);

  const anchoMaximo =
    visor.tamaño === 0
      ? `max(${VISOR_MINIMO}%, calc((100dvh - ${RESERVA_MANDOS_PX}px) * 16 / 9))`
      : `${visor.tamaño}%`;

  return { ...visor, anchoMaximo, ponTamaño, alternaAncho };
}
