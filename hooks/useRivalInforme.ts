"use client";

import { useEffect, useState } from "react";

import { INFORME_KEY, type InformeDoc } from "@/lib/rivals/informe";

/*
| Carga (sólo lectura) el documento del informe del rival.
|
| Lo escribe `scripts/rivals-informe.mjs`, no la app: aquí nunca se guarda.
|
| A diferencia de `useRivalStats`, esto **no se pide al abrir la pantalla**: el
| documento trae la clasificación del grupo y la temporada entera de los
| diecinueve equipos, y lo único que lo necesita es el botón de descargar el
| informe. Se baja cuando se pulsa (`pide()`) y luego se queda en la pestaña,
| así que un segundo informe sale sin volver a pedir nada.
*/

type Estado = {
  doc: InformeDoc | null;
  cargando: boolean;
  /** El documento no existe todavía: hay que correr el script de descarga. */
  falta: boolean;
};

/* La descarga en curso —o ya terminada—, viva mientras dure la pestaña. */
let enVuelo: Promise<InformeDoc | null> | null = null;

export function cargaInforme() {
  enVuelo ??= (async () => {
    try {
      const respuesta = await fetch(
        `/api/docs?key=${encodeURIComponent(INFORME_KEY)}`,
      );

      const cuerpo = await respuesta.json();

      return (cuerpo?.data as InformeDoc | null) ?? null;
    } catch (error) {
      console.error("[rivals] informe", error);

      /* Un fallo de red no se guarda: el siguiente clic vuelve a intentarlo. */
      enVuelo = null;

      return null;
    }
  })();

  return enVuelo;
}

export function useRivalInforme() {
  const [estado, setEstado] = useState<Estado>({
    doc: null,
    cargando: false,
    falta: false,
  });

  /* Si otra pantalla ya lo bajó, se enseña sin pedir nada. */
  useEffect(() => {
    if (!enVuelo) return;

    let cancelado = false;

    enVuelo.then((doc) => {
      if (cancelado) return;

      setEstado({ doc, cargando: false, falta: !doc?.porId });
    });

    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Pide el documento y devuelve lo que haya.
   *
   * Devuelve el documento además de guardarlo en el estado porque quien lo
   * pide lo necesita **en ese mismo clic** para montar el `.pptx`, y el estado
   * de React no está disponible hasta el siguiente render.
   */
  async function pide() {
    setEstado((previo) => ({ ...previo, cargando: true }));

    const doc = await cargaInforme();

    setEstado({ doc, cargando: false, falta: !doc?.porId });

    return doc;
  }

  return { ...estado, pide };
}

export default useRivalInforme;
