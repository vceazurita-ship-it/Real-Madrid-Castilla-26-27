"use client";

/*
| Once titular probable del equipo rival que se está viendo.
|
| Se apoya en `useRemoteDoc`, así que ya trae autoguardado y caché local: se
| marca un titular y se queda marcado sin pulsar nada. Un equipo, un documento.
*/

import { useCallback, useMemo } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";

import {
  ONCE_VACIO,
  RIVAL_ONCE_KIND,
  conEstado,
  estadoDe,
  normalizarOnce,
  rivalOnceKey,
  siguienteEstado,
  type OnceEstado,
  type RivalOnceDoc,
} from "@/lib/rivals/once";

export function useRivalOnce(equipo: string) {
  const { value, setValue, status, localOnly } = useRemoteDoc<RivalOnceDoc>({
    key: rivalOnceKey(equipo || "sin-equipo"),
    kind: RIVAL_ONCE_KIND,
    fallback: ONCE_VACIO,
    /* Marcar un once son clics sueltos, no escritura seguida: no hace falta
       esperar casi un segundo a que "termine de escribir". */
    debounce: 400,
  });

  const doc = useMemo(() => normalizarOnce(value), [value]);

  const estado = useCallback(
    (key: string): OnceEstado => estadoDe(doc, key),
    [doc]
  );

  const marcar = useCallback(
    (key: string, siguiente: OnceEstado) => {
      setValue((actual) => conEstado(normalizarOnce(actual), key, siguiente));
    },
    [setValue]
  );

  const ciclar = useCallback(
    (key: string) => {
      setValue((actual) => {
        const base = normalizarOnce(actual);

        return conEstado(base, key, siguienteEstado(estadoDe(base, key)));
      });
    },
    [setValue]
  );

  const limpiar = useCallback(() => setValue(ONCE_VACIO), [setValue]);

  return { doc, estado, marcar, ciclar, limpiar, status, localOnly };
}

export default useRivalOnce;
