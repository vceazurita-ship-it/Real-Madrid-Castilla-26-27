"use client";

/**
 * LLEVAR A LO NUEVO DE UNA IDEA DE X (22/11/2026, petición del analista:
 * «que el enlace me lleve exactamente a ver lo nuevo, no sólo a la sección»).
 *
 * Si la dirección acaba en `#x-idea-<id>`, espera a que ese elemento aparezca
 * (las pantallas cargan sus datos después: hasta 20 s), baja hasta él y lo
 * resalta unos segundos con un marco dorado. Si no aparece, no hace nada:
 * la pantalla ya está abierta en su pestaña. Ver lib/x-ideas.ts (`anclaDe`).
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PLAZO_MS = 20_000;
const RESALTE_MS = 4_500;

export function ResaltaAncla() {
  const ruta = usePathname();

  useEffect(() => {
    let parado = false;
    let reloj: number | undefined;

    const busca = () => {
      const ancla = decodeURIComponent(window.location.hash.slice(1));

      if (!/^x-idea-[A-Za-z0-9_-]+$/.test(ancla)) return;

      const empezo = Date.now();

      const prueba = () => {
        if (parado) return;

        const el = document.getElementById(ancla);

        if (!el) {
          if (Date.now() - empezo < PLAZO_MS) reloj = window.setTimeout(prueba, 400);
          return;
        }

        /* Si lo nuevo está dentro de un bloque plegado (<details>), se despliega antes de bajar (23/11/2026). */
        for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
          if (!d.open) d.open = true;
        }

        el.scrollIntoView({ behavior: "smooth", block: "center" });

        const antes = { outline: el.style.outline, offset: el.style.outlineOffset, transition: el.style.transition };

        el.style.transition = "outline-color 0.6s ease";
        el.style.outline = "3px solid #C8A96B";
        el.style.outlineOffset = "4px";

        reloj = window.setTimeout(() => {
          el.style.outline = antes.outline;
          el.style.outlineOffset = antes.offset;
          el.style.transition = antes.transition;
        }, RESALTE_MS);
      };

      prueba();
    };

    busca();
    window.addEventListener("hashchange", busca);

    return () => {
      parado = true;
      window.clearTimeout(reloj);
      window.removeEventListener("hashchange", busca);
    };
  }, [ruta]);

  return null;
}
