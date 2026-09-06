"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { msPorFotograma } from "@/lib/coding/modelo";

/**
 * El mando del reproductor de coding.
 *
 * Envuelve un `<video>` en algo que se pueda pilotar desde el teclado sin
 * pensar en la etiqueta: milisegundos en vez de segundos decimales, saltos de
 * fotograma, velocidades y un tiempo que se actualiza de verdad.
 *
 * **El tiempo no se sigue con `timeupdate`.** Ese evento llega cuatro veces
 * por segundo, y con él en pantalla se ve «37:14» cuando el vídeo va por
 * «37:14.230»: al marcar el IN, el número que se guarda no es el que el
 * analista estaba leyendo. Se usa `requestVideoFrameCallback` —que dispara una
 * vez por fotograma pintado— y, donde no exista, un bucle de animación.
 */

export type EstadoReproductor = {
  /** Posición actual en milisegundos. */
  tiempoMs: number;
  duracionMs: number;
  reproduciendo: boolean;
  /** La velocidad **pedida**, que por encima de ×16 no es la del elemento. */
  velocidad: number;
  /**
   * Lo que el navegador no puede dar y hay que poner a mano.
   *
   * 0 cuando la etiqueta llega sola a la velocidad pedida. Ver `TOPES_NATIVOS`.
   */
  extra: number;
  listo: boolean;
};

/**
 * Los escalones de velocidad, hasta ×20.
 *
 * De ×0,25 a ×4 se revisa una acción; de ×6 en adelante se atraviesa el
 * partido buscando la siguiente. El salto grande del final es a propósito: por
 * encima de ×8 ya no se ve fútbol, se busca un minuto.
 */
export const VELOCIDADES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 20];

/**
 * Lo que un navegador acepta de verdad en `playbackRate`.
 *
 * Chrome corta en ×16 —y por encima **lanza**, no recorta—, y otros se quedan
 * antes. Se prueba de mayor a menor hasta que uno se queda puesto, y lo que
 * falte para la velocidad pedida se añade adelantando el vídeo a mano.
 */
const TOPES_NATIVOS = [16, 8, 4, 2];

/**
 * Cada cuánto se adelanta el vídeo cuando la velocidad pasa del tope.
 *
 * Un segundo, y está medido: cada adelanto es una búsqueda, y una búsqueda
 * para el decodificador un instante. Con saltos cada 200 ms, el ×20 medido
 * salía a **×14** —peor que dejarlo en ×16—; con saltos de un segundo, a ×19.
 */
const PASO_TURBO_MS = 1000;

/**
 * Le pone al elemento la velocidad más alta que acepte sin pasarse de la
 * pedida, y devuelve cuál se quedó.
 */
function aplicaVelocidad(video: HTMLVideoElement, valor: number) {
  for (const candidato of [valor, ...TOPES_NATIVOS.filter((tope) => tope < valor)]) {
    try {
      video.playbackRate = candidato;
    } catch {
      continue;
    }

    if (Math.abs(video.playbackRate - candidato) < 0.01) return candidato;
  }

  return video.playbackRate;
}

type VideoConFotogramas = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (ahora: number, datos: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function useReproductor(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  fps: number,
) {
  /*
  | El `<video>` vive en un ESTADO, no sólo en la `ref`.
  |
  | Una `ref` no avisa de que ha cambiado, así que un efecto que la lea sólo se
  | ejecuta cuando cambian sus dependencias. Y el `<video>` del coding no está
  | montado en el primer render: la fuente sale del documento guardado, que
  | contesta después de pintar, y hasta entonces la pantalla enseña el hueco de
  | «elige el vídeo». El efecto de seguimiento se ejecutaba con `null`, se iba
  | de vacío y **no volvía a ejecutarse nunca**: con el partido corriendo, el
  | reloj se quedaba en 00:00.000, la duración en cero y la línea de tiempo sin
  | una sola marca. Apuntando el elemento en un estado, el efecto se rearma en
  | cuanto aparece.
  */
  const [elemento, setElemento] = useState<HTMLVideoElement | null>(null);

  const [estado, setEstado] = useState<EstadoReproductor>({
    tiempoMs: 0,
    duracionMs: 0,
    reproduciendo: false,
    velocidad: 1,
    extra: 0,
    listo: false,
  });

  /* La velocidad pedida, para volver a ponerla cuando cambie el vídeo. */
  const pedida = useRef(1);

  /* El último tiempo pintado, para no re-renderizar por décimas iguales. */
  const ultimo = useRef(-1);

  const apunta = useCallback((segundos: number) => {
    const ms = Math.max(0, Math.round(segundos * 1000));

    if (ms === ultimo.current) return;

    ultimo.current = ms;

    setEstado((actual) => ({ ...actual, tiempoMs: ms }));
  }, []);

  /* ------------------------------------------------------ seguimiento */

  useEffect(() => {
    const video = elemento as VideoConFotogramas | null;

    if (!video) return;

    /* Elemento nuevo: el tiempo del anterior no vale como «ya pintado». */
    ultimo.current = -1;

    let vivo = true;
    let manoFotograma = 0;
    let manoAnimacion = 0;

    const conFotogramas = typeof video.requestVideoFrameCallback === "function";

    const porFotograma = (_ahora: number, datos: { mediaTime: number }) => {
      if (!vivo) return;

      apunta(datos.mediaTime);

      manoFotograma = video.requestVideoFrameCallback!(porFotograma);
    };

    const porAnimacion = () => {
      if (!vivo) return;

      apunta(video.currentTime);

      manoAnimacion = requestAnimationFrame(porAnimacion);
    };

    if (conFotogramas) manoFotograma = video.requestVideoFrameCallback!(porFotograma);
    else manoAnimacion = requestAnimationFrame(porAnimacion);

    /* `seeked` y `timeupdate` cubren lo que los otros dos no ven: el vídeo
       parado, que no pinta fotogramas nuevos. */
    const alSaltar = () => apunta(video.currentTime);

    const alCargar = () => {
      /* Un vídeo recién cargado arranca siempre a ×1: se le vuelve a poner la
         velocidad que el analista tenía elegida. */
      if (pedida.current !== 1) aplicaVelocidad(video, pedida.current);

      setEstado((actual) => ({
        ...actual,
        duracionMs: Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : 0,
        listo: true,
      }));
    };

    const alReproducir = () =>
      setEstado((actual) => ({ ...actual, reproduciendo: true }));

    const alParar = () =>
      setEstado((actual) => ({ ...actual, reproduciendo: false }));

    /*
    | Con turbo puesto, la etiqueta va a su tope y no a la velocidad pedida:
    | hacerle caso aquí dejaría el marcador en «16x» con el vídeo yendo a 20.
    */
    const alCambiarVelocidad = () =>
      setEstado((actual) =>
        actual.extra > 0 ? actual : { ...actual, velocidad: video.playbackRate },
      );

    video.addEventListener("seeked", alSaltar);
    video.addEventListener("timeupdate", alSaltar);
    video.addEventListener("loadedmetadata", alCargar);
    video.addEventListener("durationchange", alCargar);
    video.addEventListener("play", alReproducir);
    video.addEventListener("pause", alParar);
    video.addEventListener("ratechange", alCambiarVelocidad);

    if (video.readyState >= 1) alCargar();

    return () => {
      vivo = false;

      if (manoFotograma && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(manoFotograma);
      }

      if (manoAnimacion) cancelAnimationFrame(manoAnimacion);

      video.removeEventListener("seeked", alSaltar);
      video.removeEventListener("timeupdate", alSaltar);
      video.removeEventListener("loadedmetadata", alCargar);
      video.removeEventListener("durationchange", alCargar);
      video.removeEventListener("play", alReproducir);
      video.removeEventListener("pause", alParar);
      video.removeEventListener("ratechange", alCambiarVelocidad);
    };
  }, [apunta, elemento]);

  /**
   * La `ref` que hay que ponerle al `<video>`.
   *
   * Rellena la `ref` que trae la pantalla —el resto de la página la usa para
   * hablarle a la etiqueta— y además apunta el elemento en el estado, que es
   * lo que rearma el seguimiento del tiempo.
   */
  const montaVideo = useCallback(
    (nodo: HTMLVideoElement | null) => {
      videoRef.current = nodo;

      setElemento(nodo);
    },
    [videoRef],
  );

  /* ---------------------------------------------------------- mandos */

  const play = useCallback(() => {
    void videoRef.current?.play().catch(() => undefined);
  }, [videoRef]);

  const pausa = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  const alterna = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, [videoRef]);

  /** Salta a un milisegundo exacto del vídeo. */
  const salta = useCallback(
    (ms: number) => {
      const video = videoRef.current;

      if (!video) return;

      const tope = Number.isFinite(video.duration) ? video.duration : Infinity;

      const destino = Math.min(Math.max(0, ms / 1000), tope);

      video.currentTime = destino;

      apunta(destino);
    },
    [apunta, videoRef],
  );

  const mueve = useCallback(
    (deltaMs: number) => {
      const video = videoRef.current;

      if (!video) return;

      salta(video.currentTime * 1000 + deltaMs);
    },
    [salta, videoRef],
  );

  /**
   * Avanza o retrocede fotogramas.
   *
   * Se pausa antes: con el vídeo corriendo, el salto lo pisa el propio avance
   * y la posición final no es la que se pidió.
   */
  const fotograma = useCallback(
    (cuantos: number) => {
      const video = videoRef.current;

      if (!video) return;

      video.pause();

      mueve(cuantos * msPorFotograma(fps));
    },
    [fps, mueve, videoRef],
  );

  /**
   * Pone la velocidad, saltándose el tope del navegador si hace falta.
   *
   * Se intenta primero la pedida; si el navegador se niega —o la recorta sin
   * decir nada— se va bajando por `TOPES_NATIVOS` hasta que una se queda
   * puesta, y la diferencia se guarda en `extra` para que el efecto de turbo
   * la cubra adelantando el vídeo. Así ×20 es ×20 de verdad y no un ×16
   * disfrazado.
   */
  const ponVelocidad = useCallback(
    (valor: number) => {
      const video = videoRef.current;

      if (!video) return;

      pedida.current = valor;

      const aplicada = aplicaVelocidad(video, valor);

      setEstado((actual) => ({
        ...actual,
        velocidad: valor,
        extra: Math.max(0, valor - aplicada),
      }));
    },
    [videoRef],
  );

  /*
  | El turbo: lo que el navegador no da, se adelanta a mano.
  |
  | No se hace fotograma a fotograma. Mover `currentTime` sesenta veces por
  | segundo obliga al decodificador a buscar sesenta veces y el vídeo se queda
  | congelado dando tirones; cinco saltos por segundo sobre una reproducción
  | que ya va al tope se ve como un pase rápido de verdad. Y no se toca nada
  | mientras el vídeo está parado: adelantar un vídeo en pausa sería moverlo
  | solo delante del analista.
  */
  useEffect(() => {
    if (estado.extra <= 0 || !estado.reproduciendo) return;

    const reloj = window.setInterval(() => {
      const video = videoRef.current;

      if (!video || video.paused || video.seeking) return;

      const destino = video.currentTime + (estado.extra * PASO_TURBO_MS) / 1000;

      if (Number.isFinite(video.duration) && destino >= video.duration) {
        video.pause();
        return;
      }

      video.currentTime = destino;
    }, PASO_TURBO_MS);

    return () => window.clearInterval(reloj);
  }, [estado.extra, estado.reproduciendo, videoRef]);

  /**
   * Vuelve a poner la velocidad que estaba pedida.
   *
   * La usa la lanzadera al soltar: el gesto toca `playbackRate` directamente
   * —tiene que responder al dedo sin pasar por el estado de React— y al
   * terminar hay que devolver el elemento a donde lo dejó la barra. No es un
   * ×1 a secas: quien estaba revisando a ×0,5 no puede acabar a velocidad
   * normal por haber adelantado diez segundos con el dedo.
   */
  const restauraVelocidad = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    aplicaVelocidad(video, pedida.current);
  }, [videoRef]);

  /** Sube o baja al siguiente escalón de la lista de velocidades. */
  const cambiaVelocidad = useCallback(
    (direccion: 1 | -1) => {
      const video = videoRef.current;

      if (!video) return;

      /* La pedida, no la del elemento: con turbo son distintas y bajar un
         escalón desde ×20 tiene que llevar a ×16, no a ×12. */
      const actual = pedida.current;

      const indice = VELOCIDADES.reduce(
        (mejor, valor, posicion) =>
          Math.abs(valor - actual) < Math.abs(VELOCIDADES[mejor] - actual)
            ? posicion
            : mejor,
        0,
      );

      const siguiente = Math.min(
        VELOCIDADES.length - 1,
        Math.max(0, indice + direccion),
      );

      ponVelocidad(VELOCIDADES[siguiente]);
    },
    [ponVelocidad, videoRef],
  );

  /** El tiempo exacto de ahora mismo, sin esperar al siguiente render. */
  const tiempoAhoraMs = useCallback(() => {
    const video = videoRef.current;

    return video ? Math.round(video.currentTime * 1000) : estado.tiempoMs;
  }, [estado.tiempoMs, videoRef]);

  return {
    estado,
    /** El `<video>` de verdad, para quien necesite el elemento y no el mando. */
    elemento,
    montaVideo,
    play,
    pausa,
    alterna,
    salta,
    mueve,
    fotograma,
    ponVelocidad,
    restauraVelocidad,
    cambiaVelocidad,
    tiempoAhoraMs,
  };
}
