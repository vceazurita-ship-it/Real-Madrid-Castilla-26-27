"use client";

/**
 * DESHACER Y REHACER SOBRE UN VALOR DE ESTADO.
 *
 * Es `useState` con memoria: cada cambio guarda la foto anterior y
 * `deshaz()`/`rehaz()` se mueven por ellas. Lo escrito a golpe de tecla en un
 * mismo campo se junta en un solo paso (`agrupa` con la misma clave y menos
 * de un segundo entre cambios): deshacer no puede ser borrar letra a letra.
 *
 * `reinicia()` pone un valor nuevo SIN historia —cargar, abrir otro registro—:
 * deshacer no debe devolver el microciclo que había antes de abrir otro.
 *
 * Lo usa el editor de microciclos (21/10/2026), donde copiar una semana o
 * arrastrar una tarea al día equivocado no tenía vuelta atrás.
 */

import { useCallback, useState } from "react";

const TOPE = 100;

const JUNTAR_MS = 1000;

type Estado<T> = {
  pasado: T[];
  presente: T;
  futuro: T[];
  /** Con qué clave y cuándo se hizo el último cambio, para juntar tecleos. */
  ultimo: { clave: string; hora: number } | null;
};

export type OpcionesCambio = {
  /** Cambios seguidos con la misma clave se deshacen de una vez. */
  agrupa?: string;
};

export function useHistorial<T>(inicial: T) {
  const [estado, setEstado] = useState<Estado<T>>({ pasado: [], presente: inicial, futuro: [], ultimo: null });

  const cambia = useCallback((siguiente: T | ((actual: T) => T), opciones: OpcionesCambio = {}) => {
    const hora = Date.now();

    setEstado((actual) => {
      const nuevo =
        typeof siguiente === "function" ? (siguiente as (valor: T) => T)(actual.presente) : siguiente;

      if (Object.is(nuevo, actual.presente)) return actual;

      const junta =
        Boolean(opciones.agrupa) &&
        actual.ultimo?.clave === opciones.agrupa &&
        hora - (actual.ultimo?.hora ?? 0) < JUNTAR_MS &&
        actual.pasado.length > 0;

      return {
        pasado: junta ? actual.pasado : [...actual.pasado, actual.presente].slice(-TOPE),
        presente: nuevo,
        futuro: [],
        ultimo: opciones.agrupa ? { clave: opciones.agrupa, hora } : null,
      };
    });
  }, []);

  const deshaz = useCallback(() => {
    setEstado((actual) => {
      if (actual.pasado.length === 0) return actual;

      return {
        pasado: actual.pasado.slice(0, -1),
        presente: actual.pasado[actual.pasado.length - 1],
        futuro: [actual.presente, ...actual.futuro].slice(0, TOPE),
        ultimo: null,
      };
    });
  }, []);

  const rehaz = useCallback(() => {
    setEstado((actual) => {
      if (actual.futuro.length === 0) return actual;

      return {
        pasado: [...actual.pasado, actual.presente].slice(-TOPE),
        presente: actual.futuro[0],
        futuro: actual.futuro.slice(1),
        ultimo: null,
      };
    });
  }, []);

  const reinicia = useCallback((valor: T) => {
    setEstado({ pasado: [], presente: valor, futuro: [], ultimo: null });
  }, []);

  return {
    valor: estado.presente,
    cambia,
    deshaz,
    rehaz,
    reinicia,
    puedeDeshacer: estado.pasado.length > 0,
    puedeRehacer: estado.futuro.length > 0,
    pasos: estado.pasado.length,
  };
}
