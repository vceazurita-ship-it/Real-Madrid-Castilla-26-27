"use client";

import { useEffect, useState } from "react";

import { cargaAlturasBesoccer } from "@/lib/abp/rival";

/**
 * Carga una vez las estaturas de BeSoccer (`rivals:alturas`), que mandan sobre
 * la hoja RIVALES en `buildAerialThreats`. Devuelve cuántas hay: va en las
 * dependencias del `useMemo` para recalcular cuando llegan (11/11/2026).
 */
export function useAlturasBesoccer() {
  const [cuantas, setCuantas] = useState(0);

  useEffect(() => {
    let vivo = true;

    cargaAlturasBesoccer().then((mapa) => {
      if (vivo) setCuantas(Object.keys(mapa).length);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return cuantas;
}
