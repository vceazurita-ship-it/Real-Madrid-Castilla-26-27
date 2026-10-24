"use client";

import { useEffect, useState } from "react";

/**
 * `true` si `espera` lleva más de `ms` sin dejar de ser verdadero.
 *
 * Es el aviso «tarda más de lo normal» de las pantallas de rival (24/10/2026):
 * la hoja de Google a veces tarda 30-70 s en frío y, sin esto, la pantalla se
 * quedaba en un «Cargando…» sin decir nada ni dejar reintentar. El contador
 * arranca de nuevo cada vez que `espera` pasa a verdadero (por ejemplo, al
 * reintentar).
 */
export function useLento(espera: boolean, ms = 25_000) {
  const [lento, setLento] = useState(false);

  useEffect(() => {
    if (!espera) return;

    const t = window.setTimeout(() => setLento(true), ms);

    return () => {
      window.clearTimeout(t);
      setLento(false);
    };
  }, [espera, ms]);

  return espera && lento;
}

export default useLento;
