"use client";

import { useEffect, useState } from "react";

import { INFORME_KEY, type InformeDoc } from "@/lib/rivals/informe";

/*
| Carga (sólo lectura) el documento del informe del rival.
|
| Lo escribe `scripts/rivals-informe.mjs`, no la app: aquí nunca se guarda.
|
| Trae la clasificación del grupo y la temporada entera de los diecinueve
| equipos, así que no se pide desde cualquier sitio: quien sólo lo necesita al
| pulsar un botón lo baja entonces con `pide()`, y se queda en la pestaña, de
| modo que un segundo informe sale sin volver a pedir nada.
|
| `{ alEntrar: true }` lo baja al montar. Lo usa la pantalla de plantillas
| rivales, que desde que el campograma se pinta con lo que el equipo lleva
| jugado —`lib/rivals/posiciones-temporada.ts`— lo necesita para dibujar, no
| para exportar: esperar a un clic sería enseñar primero el reparto viejo y
| moverlo todo después, delante de quien lo está mirando.
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

export function useRivalInforme({ alEntrar = false } = {}) {
  const [estado, setEstado] = useState<Estado>({
    doc: null,
    cargando: false,
    falta: false,
  });

  /*
  | Si otra pantalla ya lo bajó, se enseña sin pedir nada; y con `alEntrar` se
  | empieza a bajar aquí mismo. En los dos casos se espera a la **misma**
  | promesa: `cargaInforme()` guarda la que está en vuelo, así que dos
  | pantallas abiertas no se bajan dos copias.
  */
  useEffect(() => {
    const promesa = alEntrar ? cargaInforme() : enVuelo;

    if (!promesa) return;

    let cancelado = false;

    promesa.then((doc) => {
      if (cancelado) return;

      setEstado({ doc, cargando: false, falta: !doc?.porId });
    });

    return () => {
      cancelado = true;
    };
  }, [alEntrar]);

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
