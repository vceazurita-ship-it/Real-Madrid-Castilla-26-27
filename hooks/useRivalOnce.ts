"use client";

/*
| Once titular probable del equipo rival que se está viendo.
|
| Se apoya en `useRemoteDoc`, así que ya trae autoguardado y caché local: se
| marca un titular y se queda marcado sin pulsar nada. Un equipo, un documento.
|
| Guarda además cómo se quiere ver el once en el PDF —qué dudas se pintan en
| el campo y dónde ha quedado cada uno—, que es lo que se decide en el pop-up
| de antes de exportar.
*/

import { useCallback, useMemo } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";

import {
  ONCE_VACIO,
  RIVAL_ONCE_KIND,
  conEnCampo,
  conEstado,
  conOnce,
  conPosicion,
  conSustitucion,
  estadoDe,
  normalizarOnce,
  rivalOnceKey,
  siguienteEstado,
  sinPosiciones,
  type OnceEstado,
  type OncePos,
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

  /* Arrastrar en el pop-up del PDF: un jugador, un sitio. */
  const mover = useCallback(
    (key: string, pos: OncePos | null) => {
      setValue((actual) => conPosicion(normalizarOnce(actual), key, pos));
    },
    [setValue]
  );

  /* Meter o sacar del campo a una duda, también desde el pop-up. */
  const alCampo = useCallback(
    (key: string, meter: boolean) => {
      setValue((actual) => conEnCampo(normalizarOnce(actual), key, meter));
    },
    [setValue]
  );

  /* Quitar a alguien del once del todo: se va del campo, de la lista de
     dudas y del PDF. Es lo que hace el pop-up de antes de exportar. */
  const quitar = useCallback(
    (key: string) => {
      setValue((actual) => conEstado(normalizarOnce(actual), key, null));
    },
    [setValue]
  );

  /* Cambiar a uno por otro heredando su sitio y su estado. */
  const sustituir = useCallback(
    (saliente: string, entrante: string) => {
      setValue((actual) =>
        conSustitucion(normalizarOnce(actual), saliente, entrante)
      );
    },
    [setValue]
  );

  /*
  | Dejar puesto de una vez el once que se propone a partir de los que ha
  | sacado el rival. Lo que se escribe aquí se edita después como cualquier
  | otro once: se cicla a un jugador, se arrastra en el pop-up o se sustituye.
  */
  const proponer = useCallback(
    (titulares: string[], campo: Record<string, OncePos>) => {
      setValue((actual) => conOnce(normalizarOnce(actual), titulares, campo));
    },
    [setValue]
  );

  /* Volver a la colocación automática sin tocar quién está en el once. */
  const recolocar = useCallback(() => {
    setValue((actual) => sinPosiciones(normalizarOnce(actual)));
  }, [setValue]);

  const limpiar = useCallback(() => setValue(ONCE_VACIO), [setValue]);

  return {
    doc,
    estado,
    marcar,
    ciclar,
    mover,
    alCampo,
    quitar,
    sustituir,
    proponer,
    recolocar,
    limpiar,
    status,
    localOnly,
  };
}

export default useRivalOnce;
