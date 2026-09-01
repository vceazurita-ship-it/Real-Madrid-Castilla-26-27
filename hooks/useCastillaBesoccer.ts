"use client";

import { useEffect, useState } from "react";

import {
  CASTILLA_BESOCCER_KEY,
  type CastillaBesoccerDoc,
} from "@/lib/castilla/besoccer";

/*
| Carga (sólo lectura) lo que BeSoccer sabe de nuestros jugadores.
|
| Lo escribe `scripts/castilla-besoccer.mjs`, no la app: aquí nunca se guarda.
| Un fallo no rompe nada —la ficha se pinta igual, sin el bloque de BeSoccer—
| así que no se avisa con un toast de algo que quien mira no puede arreglar.
|
| La descarga se comparte entre todos los que lo pidan en la misma pestaña, por
| lo mismo que en `useRivalStats`: es un JSON con la temporada entera de la
| plantilla y no tiene sentido bajarlo dos veces.
*/

type Estado = {
  doc: CastillaBesoccerDoc | null;
  cargando: boolean;
  /** No existe todavía: hay que correr el script de descarga. */
  falta: boolean;
};

let enVuelo: Promise<CastillaBesoccerDoc | null> | null = null;

function carga() {
  enVuelo ??= (async () => {
    try {
      const respuesta = await fetch(
        `/api/docs?key=${encodeURIComponent(CASTILLA_BESOCCER_KEY)}`,
      );

      const cuerpo = await respuesta.json();

      return (cuerpo?.data as CastillaBesoccerDoc | null) ?? null;
    } catch (error) {
      console.error("[castilla] besoccer", error);

      /* Un fallo de red no se guarda: la siguiente página vuelve a intentarlo. */
      enVuelo = null;

      return null;
    }
  })();

  return enVuelo;
}

export function useCastillaBesoccer(): Estado {
  const [estado, setEstado] = useState<Estado>({
    doc: null,
    cargando: true,
    falta: false,
  });

  useEffect(() => {
    let cancelado = false;

    carga().then((doc) => {
      if (cancelado) return;

      setEstado({
        doc: doc?.porJugador ? doc : null,
        cargando: false,
        falta: !doc?.porJugador,
      });
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return estado;
}

export default useCastillaBesoccer;
