"use client";

/**
 * Reproductor de la pizarra.
 *
 * La jugada es una lista de escenas y el tiempo va de la primera a la última.
 * Cada escena es un keyframe, y entre dos keyframes las fichas se interpolan.
 *
 * El hook solo lleva el tiempo: quién dibuja y cómo interpola es cosa de la
 * pizarra. Así el mismo reproductor sirve para cualquier tablero.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Duración de un tramo entre dos escenas, a velocidad 1x. */
export const SEGMENT_MS = 1100;

export const SPEEDS = [0.5, 1, 1.5, 2] as const;

export type PlaybackSpeed = (typeof SPEEDS)[number];

export interface PitchTimeline {
  /** Número de keyframes (escenas). */
  count: number;
  /** Duración total en milisegundos, a velocidad 1x. */
  duration: number;

  playing: boolean;
  loop: boolean;
  speed: PlaybackSpeed;
  /** `true` mientras se arrastra el cursor de la línea de tiempo. */
  scrubbing: boolean;

  /** Tiempo actual en milisegundos. */
  time: number;
  /** Tiempo actual en 0..1 sobre el total. */
  progress: number;
  /** Keyframe de partida del tramo actual. */
  index: number;
  /** Avance dentro del tramo actual, en 0..1. */
  t: number;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setLoop: (loop: boolean) => void;
  setSpeed: (speed: PlaybackSpeed) => void;

  /** Coloca el tiempo en 0..1 del total. */
  seekProgress: (progress: number) => void;
  /** Salta al keyframe indicado. */
  seekKeyframe: (index: number) => void;
  nextKeyframe: () => void;
  prevKeyframe: () => void;
  stopAt: (index: number) => void;

  beginScrub: () => void;
  endScrub: () => void;
}

export function usePitchTimeline(count: number): PitchTimeline {
  const segments = Math.max(0, count - 1);
  const duration = segments * SEGMENT_MS;

  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [scrubbing, setScrubbing] = useState(false);
  const [raw, setRaw] = useState(0);

  /**
   * El tiempo guardado se recorta al leerlo, no al escribirlo.
   *
   * Así, si se borra la última escena y luego se vuelve a añadir, el cursor
   * recupera su sitio en lugar de haberse quedado pegado al final.
   */
  const time = Math.min(raw, duration);

  /** Duración vigente para el bucle de animación, que vive fuera de React. */
  const durationRef = useRef(duration);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // -------------------------------------------------------------
  // Avance del tiempo
  // -------------------------------------------------------------

  useEffect(() => {
    if (!playing || duration === 0) return;

    let frame = 0;
    let last = 0;

    const step = (stamp: number) => {
      const delta = last === 0 ? 0 : Math.min(80, stamp - last);
      last = stamp;

      setRaw((current) => {
        const next = Math.min(current, duration) + delta * speed;

        if (next < duration) return next;

        if (loop) return next % duration;

        // Sin bucle nos quedamos clavados en el último keyframe.
        setPlaying(false);
        return duration;
      });

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [playing, duration, speed, loop]);

  // -------------------------------------------------------------
  // Derivados
  // -------------------------------------------------------------

  const { index, t, progress } = useMemo(() => {
    if (segments === 0) return { index: 0, t: 0, progress: 0 };

    const position = Math.min(segments - 0.000001, Math.max(0, time / SEGMENT_MS));

    return {
      index: Math.floor(position),
      t: position - Math.floor(position),
      progress: duration === 0 ? 0 : time / duration,
    };
  }, [time, segments, duration]);

  // -------------------------------------------------------------
  // Mandos
  // -------------------------------------------------------------

  const play = useCallback(() => {
    if (durationRef.current === 0) return;

    // Volver a dar al play al final de la jugada la rebobina.
    setRaw((current) =>
      Math.min(current, durationRef.current) >= durationRef.current
        ? 0
        : current
    );
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (current) return false;
      if (durationRef.current === 0) return false;

      setRaw((value) =>
        Math.min(value, durationRef.current) >= durationRef.current ? 0 : value
      );

      return true;
    });
  }, []);

  const seekProgress = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    setRaw(clamped * durationRef.current);
  }, []);

  const seekKeyframe = useCallback((target: number) => {
    setRaw(
      Math.min(durationRef.current, Math.max(0, target * SEGMENT_MS))
    );
  }, []);

  const stopAt = useCallback(
    (target: number) => {
      setPlaying(false);
      seekKeyframe(target);
    },
    [seekKeyframe]
  );

  const nextKeyframe = useCallback(() => {
    setPlaying(false);
    setRaw((current) => {
      const at = Math.min(current, durationRef.current);
      const next = Math.floor(at / SEGMENT_MS + 1.000001) * SEGMENT_MS;

      return Math.min(durationRef.current, next);
    });
  }, []);

  const prevKeyframe = useCallback(() => {
    setPlaying(false);
    setRaw((current) => {
      const at = Math.min(current, durationRef.current);
      const previous = Math.ceil(at / SEGMENT_MS - 1.000001) * SEGMENT_MS;

      return Math.max(0, previous);
    });
  }, []);

  const beginScrub = useCallback(() => {
    setPlaying(false);
    setScrubbing(true);
  }, []);

  const endScrub = useCallback(() => setScrubbing(false), []);

  return {
    count,
    duration,
    playing,
    loop,
    speed,
    scrubbing,
    time,
    progress,
    index,
    t,
    play,
    pause,
    toggle,
    setLoop,
    setSpeed,
    seekProgress,
    seekKeyframe,
    nextKeyframe,
    prevKeyframe,
    stopAt,
    beginScrub,
    endScrub,
  };
}
