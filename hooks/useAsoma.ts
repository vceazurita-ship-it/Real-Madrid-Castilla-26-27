"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ¿YA ASOMA? (16/11/2026)
 *
 * Los bloques pesados del Scout colectivo (Evolución comparada, Reparto del
 * xG, Datos del rival) no piden nada hasta que asoman por la pantalla. En el
 * móvil eso dejaba dos tarjetas vacías y los otros dos bloques sin pintar si
 * nadie bajaba (jueces, ronda 16: la captura de página entera no hace
 * scroll), y lo mismo pasaba al exportar.
 *
 * Ahora se abren al asomar o, como muy tarde, a los `esperaMs` de entrar:
 * quien baja deprisa los tiene antes y quien no baja los tiene igual.
 */
export function useAsoma<T extends Element>(esperaMs = 2500, margen = "300px 0px") {
  const caja = useRef<T>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (abierto) return;

    const reloj = window.setTimeout(() => setAbierto(true), esperaMs);
    const el = caja.current;
    let io: IntersectionObserver | null = null;

    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setAbierto(true);
      }, { rootMargin: margen });
      io.observe(el);
    }

    return () => {
      window.clearTimeout(reloj);
      io?.disconnect();
    };
  }, [abierto, esperaMs, margen]);

  return { caja, abierto };
}
