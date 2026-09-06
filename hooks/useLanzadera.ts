"use client";

/*
|--------------------------------------------------------------------------
| LA LANZADERA: ACELERAR, FRENAR Y REBOBINAR CON EL DEDO
|--------------------------------------------------------------------------
|
| Lo que en una mesa de edición es la rueda de shuttle y en QuickTime el
| barrido de dos dedos sobre la imagen. Dos gestos, uno por eje:
|
|   · **En horizontal, la velocidad.** A la derecha el partido corre cada vez
|     más rápido (hasta ×8) y a la izquierda cada vez más despacio (hasta
|     ×0,1). También vale el barrido de dos dedos del mousepad.
|   · **En vertical, hacia atrás.** Arrastrando arriba o abajo el partido
|     rebobina, y cuanto más lejos se lleve la mano, más rápido.
|
| Al soltar, los dos vuelven a la velocidad de la barra y a lo que el vídeo
| estuviera haciendo.
|
| **Los dos ejes no se mezclan.** Al primer movimiento que sale de la zona
| muerta se decide cuál manda y ese manda hasta que se suelta. Sin ese cierre,
| un arrastre en diagonal —que es lo que sale de la mano— pedía acelerar y
| rebobinar a la vez, y el vídeo daba tumbos. Fue exactamente el motivo por el
| que la primera versión llevaba el rebobinado en el mismo eje horizontal y
| hubo que sacarlo: dos cosas distintas no caben en un mismo movimiento.
|
| Tres cosas más que no son obvias:
|
| 1. **Hacia atrás no existe en HTML.** `playbackRate` no acepta negativos —el
|    navegador lanza—, así que el rebobinado se hace a mano: el vídeo se para y
|    se le va restando tiempo. Y no fotograma a fotograma: mover `currentTime`
|    sesenta veces por segundo obliga al descodificador a buscar sesenta veces
|    y la imagen se queda congelada dando tirones (la misma trampa que ya
|    documenta el turbo de `useReproductor`). Se retrocede a
|    `PASOS_ATRAS_POR_SEGUNDO`, que se ve como marcha atrás de verdad.
| 2. **El mousepad manda `wheel`, no `pointermove`.** Un barrido de dos dedos
|    llega como una ristra de eventos con `deltaX`, sin principio ni final: el
|    gesto se da por soltado cuando pasan `CALMA_MS` sin recibir ninguno. Del
|    `wheel` sólo se coge lo horizontal: lo vertical es el desplazamiento de la
|    página y quitárselo dejaría la pantalla sin poder bajar.
| 3. **Se acumula desplazamiento, no velocidad.** El dedo dice *dónde está la
|    palanca*, no cuánto acelerar; si no, soltar no podría volver solo a su
|    sitio y cada barrido dejaría el partido más rápido que el anterior.
|
| Todo el estado del gesto vive en `ref`s a propósito: los escuchadores se
| montan **una vez** y no se vuelven a montar en mitad de un arrastre, que es
| lo que pasaba leyendo el estado de React desde dentro.
*/

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Los escalones del eje horizontal, del más lento al más rápido.
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
 * Los del eje vertical, que es el rebobinado.
 *
 * No hay centro ni cámara lenta hacia atrás: en cuanto se sale de la zona
 * muerta ya se está volviendo, y lo único que se elige es a qué ritmo. Empieza
 * en ×0,5 porque un rebobinado más lento que eso no se distingue de una pausa.
 */
export const ESCALONES_REBOBINADO = [0.5, 1, 2, 4, 8];

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

/** Cuántas veces por segundo se retrocede el vídeo al rebobinar. */
const PASOS_ATRAS_POR_SEGUNDO = 12;

/** Qué eje manda en el gesto en curso. */
type Eje = "horizontal" | "vertical";

export type EstadoLanzadera = {
  /** Se está tocando. Mientras dure, el indicador manda sobre la barra. */
  activa: boolean;
  /** Lo pedido por el gesto, siempre en positivo. */
  velocidad: number;
  /** Rebobinando: el eje vertical. */
  atras: boolean;
};

const PARADA: EstadoLanzadera = { activa: false, velocidad: 1, atras: false };

export type Lanzadera = EstadoLanzadera & {
  /**
   * Sube o baja un escalón sin soltar el gesto. Es lo que le da el teclado a
   * la mano que no está arrastrando.
   *
   * Devuelve si ha hecho algo: con la lanzadera parada no hay nada que
   * ajustar y quien llama tiene que seguir con lo suyo.
   */
  ajusta: (direccion: 1 | -1) => boolean;
};

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

/**
 * De píxeles arrastrados en vertical a ritmo de rebobinado.
 *
 * Arriba y abajo hacen lo mismo a propósito: lo que se pide con el gesto es
 * «vuelve», y obligar a acordarse de hacia dónde sería una regla que hay que
 * aprender para algo que se hace mirando la imagen. Lo que decide el ritmo es
 * cuánto se aleja la mano, sin más.
 */
export function velocidadDeRebobinado(desplazamiento: number): number {
  const magnitud = Math.abs(desplazamiento);

  if (magnitud <= ZONA_MUERTA) return ESCALONES_REBOBINADO[0];

  const pasos = Math.floor((magnitud - ZONA_MUERTA) / PASO_PX);

  return ESCALONES_REBOBINADO[
    Math.min(ESCALONES_REBOBINADO.length - 1, pasos)
  ];
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

  /** Dónde está la palanca, en píxeles desde donde se posó el dedo. */
  const palanca = useRef(0);
  /** Qué eje se quedó con el gesto; `null` hasta el primer movimiento. */
  const eje = useRef<Eje | null>(null);
  /** El puntero que arrastra; `null` si el gesto viene del mousepad. */
  const puntero = useRef<number | null>(null);
  /** Dónde se posó el dedo. */
  const origenX = useRef(0);
  const origenY = useRef(0);
  /** Si estaba corriendo antes del gesto: al soltar se le devuelve. */
  const corria = useRef(false);
  /** Si hay gesto en curso, sin esperar al render. */
  const enMarcha = useRef(false);

  const relojCalma = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relojAtras = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Lo que cambia de render a render, leído desde dentro del gesto. */
  const videoRef = useRef(video);
  const soltarRef = useRef(alSoltar);

  useEffect(() => {
    videoRef.current = video;
    soltarRef.current = alSoltar;
  });

  const paraElRebobinado = useCallback(() => {
    if (relojAtras.current) {
      clearInterval(relojAtras.current);
      relojAtras.current = null;
    }
  }, []);

  /* ------------------------------------------- horizontal: la velocidad */

  const aplicaVelocidad = useCallback(
    (pixeles: number) => {
      const elemento = videoRef.current;

      if (!elemento) return;

      paraElRebobinado();

      palanca.current = pixeles;

      const velocidad = velocidadDeLanzadera(pixeles);

      enMarcha.current = true;

      setEstado({ activa: true, velocidad, atras: false });

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
    },
    [paraElRebobinado],
  );

  /* --------------------------------------------- vertical: rebobinar */

  const aplicaRebobinado = useCallback((pixeles: number) => {
    const elemento = videoRef.current;

    if (!elemento) return;

    palanca.current = pixeles;

    enMarcha.current = true;

    setEstado({
      activa: true,
      velocidad: velocidadDeRebobinado(pixeles),
      atras: true,
    });

    /* Hacia atrás el elemento no puede: se para y el tiempo va a mano. */
    elemento.pause();

    if (relojAtras.current) return;

    const paso = 1000 / PASOS_ATRAS_POR_SEGUNDO;

    relojAtras.current = setInterval(() => {
      const actual = videoRef.current;

      if (!actual) return;

      /* Se lee la palanca en cada latido: mover la mano cambia el ritmo sin
         tener que rehacer el reloj. */
      const cuanto = velocidadDeRebobinado(palanca.current);

      actual.currentTime = Math.max(0, actual.currentTime - (cuanto * paso) / 1000);
    }, paso);
  }, []);

  /* ------------------------------------------- el teclado, sin soltar */

  /**
   * Mueve la palanca un escalón, como si la mano hubiera seguido.
   *
   * Rebobinando a ×8 la mano está abajo del todo y para bajar a ×4 hay que
   * subirla justo lo que mide un escalón: se falla, se pasa uno, y mientras
   * tanto el partido sigue yendo hacia atrás. Con la J y la L eso es un toque,
   * y la mano que arrastra no se mueve.
   *
   * Lo que se mueve es **el origen**, no la palanca: así el siguiente
   * movimiento del dedo sigue contando desde donde está la mano de verdad y
   * el ajuste del teclado no se pierde en cuanto se roza el ratón.
   */
  const ajusta = useCallback(
    (direccion: 1 | -1) => {
      if (!enMarcha.current || !eje.current) return false;

      if (eje.current === "horizontal") {
        const paso = PASO_PX * direccion;

        origenX.current -= paso;

        aplicaVelocidad(palanca.current + paso);

        return true;
      }

      /*
      | En vertical la velocidad va con el **valor absoluto**: arriba y abajo
      | rebobinan igual. Así que acelerar es alejarse del centro en el sentido
      | en el que ya se esté, y frenar, acercarse; y no se cruza el cero, que
      | sería saltar de golpe al otro lado sin que nadie lo haya pedido.
      */
      const sentido = palanca.current >= 0 ? 1 : -1;

      const paso = PASO_PX * direccion * sentido;

      const siguiente = palanca.current + paso;

      if (siguiente * sentido < 0) return true;

      origenY.current -= paso;

      aplicaRebobinado(siguiente);

      return true;
    },
    [aplicaRebobinado, aplicaVelocidad],
  );

  /* ------------------------------------------------------- soltar */

  const suelta = useCallback(() => {
    paraElRebobinado();

    if (relojCalma.current) {
      clearTimeout(relojCalma.current);
      relojCalma.current = null;
    }

    puntero.current = null;
    palanca.current = 0;
    eje.current = null;

    if (!enMarcha.current) return;

    enMarcha.current = false;

    setEstado(PARADA);

    /* La velocidad vuelve a ser la de la barra, no la del gesto. */
    soltarRef.current();

    const elemento = videoRef.current;

    if (!elemento) return;

    if (corria.current) void elemento.play().catch(() => undefined);
    else elemento.pause();
  }, [paraElRebobinado]);

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
      origenX.current = evento.clientX;
      origenY.current = evento.clientY;
      palanca.current = 0;
      eje.current = null;

      contenedor.setPointerCapture?.(evento.pointerId);
    };

    const alMover = (evento: PointerEvent) => {
      if (puntero.current !== evento.pointerId) return;

      const dx = evento.clientX - origenX.current;
      const dy = evento.clientY - origenY.current;

      /*
      | El primer movimiento que sale de la zona muerta se queda con el gesto.
      | Hasta entonces esto sigue siendo un clic, y en cuanto se decide ya no
      | se cambia: un arrastre de verdad va en diagonal y sin este cierre el
      | vídeo estaría acelerando y rebobinando a la vez.
      */
      if (!eje.current) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= ZONA_MUERTA) return;

        eje.current = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
      }

      evento.preventDefault();

      if (eje.current === "horizontal") aplicaVelocidad(dx);
      else aplicaRebobinado(dy);
    };

    const alLevantar = (evento: PointerEvent) => {
      if (puntero.current !== evento.pointerId) return;

      contenedor.releasePointerCapture?.(evento.pointerId);

      suelta();
    };

    /* ---------------------------------------------- con el mousepad */

    const alRodar = (evento: WheelEvent) => {
      /*
      | Sólo el barrido horizontal. Lo vertical es el desplazamiento de la
      | página: quitárselo dejaría la pantalla de coding sin poder bajar hasta
      | la lista de clips, que es donde se trabaja. Para rebobinar con el
      | mousepad se pulsa y se arrastra, que es lo mismo que con el dedo.
      */
      if (Math.abs(evento.deltaX) <= Math.abs(evento.deltaY)) return;

      evento.preventDefault();

      if (!enMarcha.current) anota();

      eje.current = "horizontal";

      aplicaVelocidad(palanca.current + evento.deltaX);

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
  }, [activa, aplicaRebobinado, aplicaVelocidad, suelta, video]);

  /* Si se apaga en mitad de un gesto, que no se quede el partido a ×8. */
  useEffect(() => {
    if (!activa) suelta();
  }, [activa, suelta]);

  /* Y al desmontar, que no quede ningún reloj suelto. */
  useEffect(
    () => () => {
      if (relojCalma.current) clearTimeout(relojCalma.current);
      if (relojAtras.current) clearInterval(relojAtras.current);
    },
    [],
  );

  /* El estado se devuelve con el ajuste dentro: quien lo pinta y quien lo
     mueve con el teclado son la misma pantalla. */
  return { ...estado, ajusta };
}

export default useLanzadera;
