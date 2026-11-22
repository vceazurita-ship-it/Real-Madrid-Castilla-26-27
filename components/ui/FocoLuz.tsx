"use client";

/**
 * EL FOCO DE LUZ QUE SIGUE AL RATÓN (22/11/2026).
 *
 * Un único oyente pasivo para toda la plataforma: con cada movimiento del
 * ratón busca la `.foco-luz` que hay debajo y, una vez por fotograma
 * (requestAnimationFrame), le escribe --foco-x / --foco-y y la marca
 * `.foco-activo`. El dibujo está en components/ui/efectos.css. Con el dedo o
 * el lápiz no hace nada, y con prefers-reduced-motion tampoco.
 */

import { useEffect } from "react";

export function FocoLuz() {
  useEffect(() => {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
    let actual: HTMLElement | null = null;
    let pendiente: { x: number; y: number; el: Element | null } | null = null;
    let cuadro = 0;

    const suelta = () => {
      actual?.classList.remove("foco-activo");
      actual = null;
    };

    const pinta = () => {
      cuadro = 0;
      const p = pendiente;
      pendiente = null;
      if (!p) return;
      const el = (p.el instanceof Element ? p.el.closest(".foco-luz") : null) as HTMLElement | null;
      if (el !== actual) {
        suelta();
        actual = el;
        el?.classList.add("foco-activo");
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--foco-x", `${Math.round(p.x - r.left)}px`);
      el.style.setProperty("--foco-y", `${Math.round(p.y - r.top)}px`);
    };

    const mueve = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || quieto.matches) return;
      pendiente = { x: e.clientX, y: e.clientY, el: e.target as Element | null };
      if (!cuadro) cuadro = window.requestAnimationFrame(pinta);
    };

    document.addEventListener("pointermove", mueve, { passive: true });
    document.documentElement.addEventListener("pointerleave", suelta, { passive: true });

    return () => {
      window.cancelAnimationFrame(cuadro);
      document.removeEventListener("pointermove", mueve);
      document.documentElement.removeEventListener("pointerleave", suelta);
      suelta();
    };
  }, []);

  return null;
}
