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
  velocidad: number;
  listo: boolean;
};

export const VELOCIDADES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

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
  const [estado, setEstado] = useState<EstadoReproductor>({
    tiempoMs: 0,
    duracionMs: 0,
    reproduciendo: false,
    velocidad: 1,
    listo: false,
  });

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
    const video = videoRef.current as VideoConFotogramas | null;

    if (!video) return;

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

    const alCargar = () =>
      setEstado((actual) => ({
        ...actual,
        duracionMs: Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : 0,
        listo: true,
      }));

    const alReproducir = () =>
      setEstado((actual) => ({ ...actual, reproduciendo: true }));

    const alParar = () =>
      setEstado((actual) => ({ ...actual, reproduciendo: false }));

    const alCambiarVelocidad = () =>
      setEstado((actual) => ({ ...actual, velocidad: video.playbackRate }));

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
  }, [apunta, videoRef]);

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

  const ponVelocidad = useCallback(
    (valor: number) => {
      const video = videoRef.current;

      if (!video) return;

      video.playbackRate = valor;

      setEstado((actual) => ({ ...actual, velocidad: valor }));
    },
    [videoRef],
  );

  /** Sube o baja al siguiente escalón de la lista de velocidades. */
  const cambiaVelocidad = useCallback(
    (direccion: 1 | -1) => {
      const video = videoRef.current;

      if (!video) return;

      const actual = video.playbackRate;

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
    play,
    pausa,
    alterna,
    salta,
    mueve,
    fotograma,
    ponVelocidad,
    cambiaVelocidad,
    tiempoAhoraMs,
  };
}
