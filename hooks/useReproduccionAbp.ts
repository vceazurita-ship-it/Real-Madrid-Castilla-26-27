"use client";

/**
 * El reloj de la jugada: reproduce las fases de una diapositiva de ABP.
 *
 * `tiempo` va en FASES —de 0 a N—, no en segundos: la fase 2 ocurre entre el 1
 * y el 2, y así `lib/abp/trazos.ts` sabe cuánto lleva cada flecha sin conocer
 * el reloj. `null` es la foto fija, que es lo que se edita y lo que se exporta.
 *
 * Dos formas de usarlo, que son las dos de la sala:
 * - `reproduce()` la jugada entera, de corrido (el botón ▶ de la pantalla);
 * - `siguiente()` / `anterior()` fase a fase, que es como se explica con el
 *   proyector: se para en cada fase para hablar de ella.
 *
 * Con «reducir movimiento» activado en el sistema no hay animación: cada fase
 * aparece entera de golpe. La jugada se entiende igual y no marea a nadie.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Cuánto dura cada fase al reproducir. */
const MS_POR_FASE = 1400;

function sinMovimiento() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function useReproduccionAbp(
  fases: number,
  /** Dónde arranca: `null` (foto fija) o 0 (la salida, flechas sin dibujar). */
  inicio: number | null = null,
) {
  const [tiempo, setTiempo] = useState<number | null>(inicio);

  const cuadro = useRef<number | null>(null);

  /* El instante de verdad, para encadenar pasos sin esperar a un render. */
  const ahora = useRef<number | null>(inicio);

  const corta = useCallback(() => {
    if (cuadro.current != null) cancelAnimationFrame(cuadro.current);

    cuadro.current = null;
  }, []);

  const pon = useCallback((valor: number | null) => {
    ahora.current = valor;
    setTiempo(valor);
  }, []);

  /** Anima de `desde` a `hasta` (en fases) y se queda en `hasta`. */
  const anima = useCallback(
    (desde: number, hasta: number) => {
      corta();

      if (sinMovimiento() || hasta <= desde) {
        pon(hasta);

        return;
      }

      const inicio = performance.now();
      const duracion = (hasta - desde) * MS_POR_FASE;

      const paso = (instante: number) => {
        const avance = Math.min(1, (instante - inicio) / duracion);

        pon(desde + (hasta - desde) * avance);

        cuadro.current = avance < 1 ? requestAnimationFrame(paso) : null;
      };

      pon(desde);
      cuadro.current = requestAnimationFrame(paso);
    },
    [corta, pon],
  );

  /** La jugada entera, desde la posición de salida. */
  const reproduce = useCallback(() => {
    if (fases > 0) anima(0, fases);
  }, [anima, fases]);

  /** La fase siguiente: desde donde esté hasta el final de la próxima. */
  const siguiente = useCallback(() => {
    if (fases === 0) return false;

    const actual = ahora.current ?? 0;
    const meta = Math.min(fases, Math.floor(actual + 1e-6) + 1);

    if (actual >= fases - 1e-6) return false;

    anima(actual, meta);

    return true;
  }, [anima, fases]);

  /** Vuelve al principio de la fase en la que está (sin animar). */
  const anterior = useCallback(() => {
    const actual = ahora.current;

    if (actual == null || actual <= 1e-6) return false;

    corta();
    pon(Math.max(0, Math.ceil(actual - 1e-6) - 1));

    return true;
  }, [corta, pon]);

  /** Vuelve a la foto fija. */
  const para = useCallback(() => {
    corta();
    pon(null);
  }, [corta, pon]);

  /** Salta a un instante sin animar: al principio o al final de la jugada. */
  const ponEn = useCallback(
    (valor: number | null) => {
      corta();
      pon(valor);
    },
    [corta, pon],
  );

  useEffect(() => corta, [corta]);

  return {
    tiempo,
    /* Leído del estado, no de la ref: las refs no se leen al pintar. */
    reproduciendo: tiempo != null && tiempo < fases,
    reproduce,
    siguiente,
    anterior,
    para,
    ponEn,
  };
}
