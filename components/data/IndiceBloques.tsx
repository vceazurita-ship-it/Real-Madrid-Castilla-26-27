"use client";

/**
 * Índice fijo de los bloques de la pantalla (29/10/2026).
 *
 * La pantalla de Data análisis cambia de contenido con el área elegida y cada
 * área trae sus propios paneles. En vez de mantener a mano una lista por área,
 * el índice lee del DOM los títulos (h2) de los paneles que hay dentro del
 * contenedor `#data-bloques`, les pone un ancla y marca el que está a la vista.
 * Si el área sólo tiene un panel (o ninguno) no se pinta nada.
 */

import { useEffect, useState } from "react";

type Ancla = { id: string; titulo: string };

export function IndiceBloques({ clave }: { clave: string }) {
  const [anclas, setAnclas] = useState<Ancla[]>([]);
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    const raiz = document.getElementById("data-bloques");
    if (!raiz) return;

    let observador: IntersectionObserver | null = null;

    const lee = () => {
      const lista: Ancla[] = [];
      const secciones: HTMLElement[] = [];

      raiz.querySelectorAll<HTMLElement>("section > header h2").forEach((h2, i) => {
        const seccion = h2.closest("section") as HTMLElement | null;
        const titulo = h2.textContent?.trim();
        if (!seccion || !titulo) return;
        // Sólo los paneles de primer nivel: uno dentro de otro no es un bloque.
        const padre = seccion.parentElement?.closest("section");
        if (padre && raiz.contains(padre)) return;

        const id = seccion.id || `bloque-${clave}-${i}`;
        seccion.id = id;
        seccion.style.scrollMarginTop = "170px";
        secciones.push(seccion);
        lista.push({ id, titulo });
      });

      setAnclas((previo) =>
        previo.length === lista.length && previo.every((p, i) => p.id === lista[i].id && p.titulo === lista[i].titulo)
          ? previo
          : lista,
      );

      observador?.disconnect();
      observador = new IntersectionObserver(
        (entradas) => {
          const dentro = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (dentro[0]) setVisible(dentro[0].target.id);
        },
        { rootMargin: "-170px 0px -55% 0px" },
      );
      secciones.forEach((s) => observador?.observe(s));
    };

    // Los paneles se montan después (datos que llegan): se vuelve a leer al cambiar el DOM.
    lee();
    const mutacion = new MutationObserver(() => lee());
    mutacion.observe(raiz, { childList: true, subtree: true });
    const tardio = window.setTimeout(lee, 600);

    return () => {
      mutacion.disconnect();
      observador?.disconnect();
      window.clearTimeout(tardio);
    };
  }, [clave]);

  if (anclas.length < 2) return null;

  return (
    <nav
      aria-label="Bloques de esta pantalla"
      className="sticky top-[80px] z-20 -mx-4 mt-3 border-b border-white/10 bg-[#0B0F14]/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-[96px] lg:-mx-10 lg:px-10"
    >
      <div className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-none">
        {anclas.map((a) => {
          const activo = visible === a.id;

          return (
            <button
              key={a.id}
              type="button"
              aria-current={activo ? "true" : undefined}
              onClick={() => document.getElementById(a.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activo ? "bg-[#C8A96B] text-black" : "border border-white/10 text-white/55 hover:border-white/25 hover:text-white"
              }`}
            >
              {a.titulo}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
