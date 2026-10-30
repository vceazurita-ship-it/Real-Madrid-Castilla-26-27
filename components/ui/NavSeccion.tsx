"use client";

/*
|--------------------------------------------------------------------------
| LA NAVEGACIÓN DENTRO DE CADA SECCIÓN (14/10/2026)
|--------------------------------------------------------------------------
|
| Debajo de la cabecera, las pantallas de la misma sección del menú (ABP
| ofensivo, defensivo, saques de banda, microciclo, pizarra…) para saltar de
| una a otra sin abrir el menú. Sale de `SECCIONES` del menú lateral: lo que
| se mueva allí se mueve aquí, y una sección de una sola pantalla no pinta
| nada. Va dentro de la cabecera, que está pegada arriba, así que se alcanza
| desde cualquier punto del scroll.
|
| Además mide lo que ocupa la cabecera y lo deja en `--alto-cabecera`: las
| pestañas pegadas de cada pantalla (`components/analisis/Pestanas.tsx`) se
| quedan justo debajo en vez de esconderse detrás.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SECCIONES } from "@/components/ui/sidebar";

/** La sección de una ruta: la entrada que coincide, o la más larga que la contiene (/laboratorio/microciclo?micro=3). */
function seccionDe(ruta: string) {
  let mejor: { seccion: (typeof SECCIONES)[number]; largo: number } | null = null;

  for (const seccion of SECCIONES) {
    if (seccion.titulo === "Inicio" || seccion.titulo === "En obras" || seccion.titulo === "Ajustes") continue;

    for (const e of seccion.entradas) {
      if (e.obras || !e.href.startsWith("/")) continue;

      const casa = ruta === e.href || ruta.startsWith(`${e.href}/`);

      if (casa && (!mejor || e.href.length > mejor.largo)) mejor = { seccion, largo: e.href.length };
    }
  }

  return mejor?.seccion ?? null;
}

export function NavSeccion() {
  const ruta = usePathname() ?? "";
  const yo = useRef<HTMLElement>(null);
  const tira = useRef<HTMLDivElement>(null);
  const seccion = seccionDe(ruta);
  const entradas = (seccion?.entradas ?? []).filter((e) => !e.obras && e.href.startsWith("/"));

  /* La altura de la cabecera entera (con esta tira o sin ella), para las pestañas pegadas. */
  useEffect(() => {
    const cabecera = yo.current?.closest("header") ?? document.querySelector("header");

    if (!cabecera) return;

    const mide = () => document.documentElement.style.setProperty("--alto-cabecera", `${cabecera.getBoundingClientRect().height}px`);
    const observador = new ResizeObserver(mide);

    mide();
    observador.observe(cabecera);

    return () => observador.disconnect();
  }, []);

  /*
  | La pestaña activa, a la vista (30/10/2026): en el móvil, a 390 px, la de
  | «Crear o editar microciclo» salía cortada («Crear o e…») al final de la
  | tira. Se centra moviendo sólo la tira —no con `scrollIntoView`, que
  | arrastraría también la página— y un degradado a la derecha avisa de que
  | hay más pestañas.
  */
  useEffect(() => {
    const caja = tira.current;
    const activa = caja?.querySelector<HTMLElement>('[aria-current="page"]');

    if (!caja || !activa || caja.scrollWidth <= caja.clientWidth) return;

    caja.scrollLeft = Math.max(0, activa.offsetLeft - (caja.clientWidth - activa.offsetWidth) / 2);
  }, [ruta]);

  /*
  | El degradado, en el borde que tiene pestañas detrás (30/10/2026): al
  | centrar la activa, las de la izquierda quedaban cortadas sin señal
  | («Calendario Operativa» desaparecía a 390 px). Se mira al desplazar y al
  | cambiar de tamaño; el primer cálculo va en un fotograma, fuera del efecto.
  */
  const [bordes, setBordes] = useState({ izq: false, der: false });

  useEffect(() => {
    const caja = tira.current;

    if (!caja) return;

    const mira = () =>
      setBordes((antes) => {
        const izq = caja.scrollLeft > 2;
        const der = caja.scrollLeft + caja.clientWidth < caja.scrollWidth - 2;

        return antes.izq === izq && antes.der === der ? antes : { izq, der };
      });

    const fotograma = requestAnimationFrame(mira);
    const observador = new ResizeObserver(mira);

    caja.addEventListener("scroll", mira, { passive: true });
    observador.observe(caja);

    return () => {
      cancelAnimationFrame(fotograma);
      caja.removeEventListener("scroll", mira);
      observador.disconnect();
    };
  }, [ruta]);

  const mascara =
    bordes.izq || bordes.der
      ? `linear-gradient(to right, ${bordes.izq ? "transparent, black 32px" : "black"}, ${bordes.der ? "black calc(100% - 32px), transparent" : "black"})`
      : undefined;

  if (entradas.length < 2) return <span ref={yo} hidden />;

  return (
    <nav ref={yo} aria-label={`Sección ${seccion!.titulo}`} className="min-w-0 border-t border-white/[0.06] px-4 md:px-10">
      <div
        ref={tira}
        className="relative flex min-w-0 items-center gap-1 overflow-x-auto py-1.5 scrollbar-none"
        style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      >
        <span className="mr-2 hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B] sm:inline">{seccion!.titulo}</span>
        {entradas.map(({ href, label, icon: Icono }) => {
          const activa = ruta === href || ruta.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                activa ? "bg-[#C8A96B] text-black" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icono size={13} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
