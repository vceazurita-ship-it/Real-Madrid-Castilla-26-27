"use client";

/*
|--------------------------------------------------------------------------
| LA LANZADERA: ACELERAR Y FRENAR EL PARTIDO CON EL DEDO
|--------------------------------------------------------------------------
|
| Lo que en una mesa de edición es la rueda de shuttle y en QuickTime el
| barrido de dos dedos sobre la imagen: se arrastra a la derecha y el partido
| corre cada vez más rápido, se arrastra a la izquierda y va cada vez más
| despacio hasta la cámara lenta, y al soltar vuelve a la velocidad de la barra
| y a lo que estuviera haciendo.
|
| Por qué hace falta, teniendo ya los escalones de velocidad en la barra: para
| encontrar una acción hay que ir, pasarse, volver, frenar y afinar, y con
| botones eso son seis clics mirando la barra en vez de la imagen. Con el dedo
| encima del vídeo la mano no se va de la pantalla y los ojos tampoco.
|
| **Sólo hacia delante, y es una decisión.** Se probó metiendo la marcha atrás
| en el mismo eje —izquierda hasta ×0,1 y de ahí en adelante hacia atrás— y no
| hay forma de que se entienda: al arrastrar a la izquierda no se sabe si se
| está pidiendo cámara lenta o rebobinar, y eran las dos cosas con el mismo
| movimiento. Para volver están las flechas y el paso a paso de fotograma, que
| ya estaban y son exactos.
|
| Dos cosas más que no son obvias:
|
| 1. **El mousepad manda `wheel`, no `pointermove`.** Un barrido de dos dedos
|    llega como una ristra de eventos con `deltaX`, sin principio ni final: el
|    gesto se da por soltado cuando pasan `CALMA_MS` sin recibir ninguno.
| 2. **Se acumula desplazamiento, no velocidad.** El dedo dice *dónde está la
|    palanca*, no cuánto acelerar; si no, soltar no podría volver solo a su
|    sitio y cada barrido dejaría el partido más rápido que el anterior.
|
| Todo el estado del gesto vive en `ref`s a propósito: los escuchadores se
| montan **una vez** y no se vuelven a montar en mitad de un arrastre, que es
| lo que pasaba leyendo el estado de React desde dentro.
*/

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Los escalones de la palanca, del más lento al más rápido.
 *
 * Empieza en ×0,1 —cámara lenta de verdad, para ver un apoyo o un cuerpeo— y
 * acaba en ×8, que es donde ya no se ve fútbol sino que se busca un minuto.
 * Para atravesar el partido siguen estando el ×16 y el ×20 de la barra: eso no
 * es un gesto, es una decisión.
 */
export const ESCALONES_LANZADERA = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/** Dónde cae el ×1: es el centro de la palanca. */
const NEUTRO = ESCALONES_LANZADERA.indexOf(1);

/**
 * Lo que hay que arrastrar para mover la palanca.
 *
 * La zona muerta evita que un clic con un temblor de tres píxeles ponga el
 * partido a ×2 —y deja que un clic siga siendo un clic—; el paso reparte los
 * once escalones en unos 18 cm, que caben en un movimiento de muñeca.
 */
const ZONA_MUERTA = 16;
const PASO_PX = 34;

/** Sin eventos de rueda durante este rato, el barrido se da por soltado. */
const CALMA_MS = 320;

export type EstadoLanzadera = {
  /** Se está tocando. Mientras dure, el indicador manda sobre la barra. */
  activa: boolean;
  /** Lo pedido por el gesto. */
  velocidad: number;
};

const PARADA: EstadoLanzadera = { activa: false, velocidad: 1 };

/** De píxeles arrastrados a velocidad. Derecha sube, izquierda baja. */
export function velocidadDeLanzadera(desplazamiento: number): number {
  const magnitud = Math.abs(desplazamiento);

  if (magnitud <= ZONA_MUERTA) return 1;

  const pasos = Math.floor((magnitud - ZONA_MUERTA) / PASO_PX) + 1;

  const indice =
    desplazamiento > 0
      ? Math.min(ESCALONES_LANZADERA.length - 1, NEUTRO + pasos)
      : Math.max(0, NEUTRO - pasos);

  return ESCALONES_LANZADERA[indice];
}

export function useLanzadera(opciones: {
  /** El `<video>`. Sin él la lanzadera no se arma. */
  video: HTMLVideoElement | null;
  /**
   * Mientras sea falso no se escucha nada: es lo que la apaga con la pizarra
   * en modo edición, donde el dedo está dibujando y no buscando.
   */
  activa: boolean;
  /**
   * Devuelve al vídeo la velocidad de la barra. La sabe `useReproductor`, que
   * es quien la aplicó, así que entra desde fuera.
   */
  alSoltar: () => void;
}) {
  const { video, activa, alSoltar } = opciones;

  const [estado, setEstado] = useState<EstadoLanzadera>(PARADA);

  /* --------------------------------------------------- el gesto vivo */

  /** Dónde está la palanca, en píxeles desde el centro. */
  const palanca = useRef(0);
  /** El puntero que arrastra; `null` si el gesto viene del mousepad. */
  const puntero = useRef<number | null>(null);
  /** Dónde se posó el dedo. */
  const origen = useRef(0);
  /** Si estaba corriendo antes del gesto: al soltar se le devuelve. */
  const corria = useRef(false);
  /** Si hay gesto en curso, sin esperar al render. */
  const enMarcha = useRef(false);

  const relojCalma = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Lo que cambia de render a render, leído desde dentro del gesto. */
  const videoRef = useRef(video);
  const soltarRef = useRef(alSoltar);

  useEffect(() => {
    videoRef.current = video;
    soltarRef.current = alSoltar;
  });

  /** Pone el vídeo a lo que diga la palanca. */
  const aplica = useCallback((pixeles: number) => {
    const elemento = videoRef.current;

    if (!elemento) return;

    palanca.current = pixeles;

    const velocidad = velocidadDeLanzadera(pixeles);

    enMarcha.current = true;

    setEstado({ activa: true, velocidad });

    /*
    | El `try` no sobra: la barra puede haber dejado puesto un ×20, y por
    | encima de ×16 Chrome **lanza** en vez de recortar.
    */
    try {
      elemento.playbackRate = velocidad;
    } catch {
      elemento.playbackRate = 1;
    }

    void elemento.play().catch(() => undefined);
  }, []);

  const suelta = useCallback(() => {
    if (relojCalma.current) {
      clearTimeout(relojCalma.current);
      relojCalma.current = null;
    }

    puntero.current = null;
    palanca.current = 0;

    if (!enMarcha.current) return;

    enMarcha.current = false;

    setEstado(PARADA);

    /* La velocidad vuelve a ser la de la barra, no la del gesto. */
    soltarRef.current();

    const elemento = videoRef.current;

    if (!elemento) return;

    if (corria.current) void elemento.play().catch(() => undefined);
    else elemento.pause();
  }, []);

  /* --------------------------------------------------- los oyentes */

  useEffect(() => {
    if (!video || !activa) return;

    const contenedor = video.parentElement;

    if (!contenedor) return;

    const anota = () => {
      corria.current = !video.paused;
    };

    /* ------------------------------------------------- con el dedo */

    const alBajar = (evento: PointerEvent) => {
      if (evento.button !== 0) return;

      /* Los mandos que van encima del vídeo siguen siendo botones. */
      if ((evento.target as HTMLElement | null)?.closest("button, a, input, canvas")) {
        return;
      }

      anota();

      puntero.current = evento.pointerId;
      origen.current = evento.clientX;
      palanca.current = 0;

      contenedor.setPointerCapture?.(evento.pointerId);
    };

    const alMover = (evento: PointerEvent) => {
      if (puntero.current !== evento.pointerId) return;

      const delta = evento.clientX - origen.current;

      /* Hasta salir de la zona muerta esto sigue siendo un clic. */
      if (!enMarcha.current && Math.abs(delta) <= ZONA_MUERTA) return;

      evento.preventDefault();

      aplica(delta);
    };

    const alLevantar = (evento: PointerEvent) => {
      if (puntero.current !== evento.pointerId) return;

      contenedor.releasePointerCapture?.(evento.pointerId);

      suelta();
    };

    /* ---------------------------------------------- con el mousepad */

    const alRodar = (evento: WheelEvent) => {
      /* Un barrido de dos dedos es horizontal; lo vertical es la página. */
      if (Math.abs(evento.deltaX) <= Math.abs(evento.deltaY)) return;

      evento.preventDefault();

      if (!enMarcha.current) anota();

      aplica(palanca.current + evento.deltaX);

      if (relojCalma.current) clearTimeout(relojCalma.current);

      relojCalma.current = setTimeout(suelta, CALMA_MS);
    };

    contenedor.addEventListener("pointerdown", alBajar);
    contenedor.addEventListener("pointermove", alMover);
    contenedor.addEventListener("pointerup", alLevantar);
    contenedor.addEventListener("pointercancel", alLevantar);
    contenedor.addEventListener("wheel", alRodar, { passive: false });

    return () => {
      contenedor.removeEventListener("pointerdown", alBajar);
      contenedor.removeEventListener("pointermove", alMover);
      contenedor.removeEventListener("pointerup", alLevantar);
      contenedor.removeEventListener("pointercancel", alLevantar);
      contenedor.removeEventListener("wheel", alRodar);
    };
  }, [activa, aplica, suelta, video]);

  /* Si se apaga en mitad de un gesto, que no se quede el partido a ×8. */
  useEffect(() => {
    if (!activa) suelta();
  }, [activa, suelta]);

  /* Y al desmontar, que no quede ningún reloj suelto. */
  useEffect(
    () => () => {
      if (relojCalma.current) clearTimeout(relojCalma.current);
    },
    [],
  );

  return estado;
}

export default useLanzadera;
