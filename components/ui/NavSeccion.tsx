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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { SECCIONES } from "@/components/ui/sidebar";
import { conRivalEnUrl, rivalEnCursoActual, rivalEnCursoServidor, suscribeRivalEnCurso } from "@/lib/rivals/rival-en-curso";

/*
| En las secciones del rival y del partido, las pestañas llevan el rival que se
| está mirando (16/11/2026, ronda 18): de Plantillas a Scout colectivo, al Plan
| o a Duelos sin volver a elegirlo. Lo apunta cada pantalla al elegirlo.
*/
const SECCIONES_CON_RIVAL = new Set(["Rival", "Partido"]);

/*
| 18/11/2026 (Data análisis, ronda 22): pantallas que llevan las de su
| sección dentro de su propia fila de pestañas (`EnlacesSeccion`), para que
| haya una sola fila de navegación. En ellas la tira de aquí no sale.
*/
const RUTAS_CON_NAV_PROPIA = new Set(["/data-analisis"]);

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
  const rivalEnCurso = useSyncExternalStore(suscribeRivalEnCurso, rivalEnCursoActual, rivalEnCursoServidor);
  const conRival = !!seccion && SECCIONES_CON_RIVAL.has(seccion.titulo);

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

  /* Un toque en la flecha mueve la tira casi un ancho entero. */
  const mueve = (sentido: 1 | -1) => {
    const caja = tira.current;

    if (caja) caja.scrollBy({ left: sentido * Math.max(160, caja.clientWidth * 0.8), behavior: "smooth" });
  };

  if (entradas.length < 2 || RUTAS_CON_NAV_PROPIA.has(ruta)) return <span ref={yo} hidden />;

  const flecha = "absolute top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[var(--rmcf-surface,#11161C)] text-white/75 shadow hover:text-white lg:hidden";

  return (
    <nav ref={yo} aria-label={`Sección ${seccion!.titulo}`} className="relative min-w-0 border-t border-white/[0.06] px-4 md:px-10">
      {/*
      | 18/11/2026 (Data análisis, ronda 22): a 1440 px la tira se cortaba por
      | la izquierda («·is» en vez de «Análisis») al centrar la activa, la
      | última. En escritorio pasa a otra línea y se ve entera; por debajo
      | sigue deslizando, con flechas visibles en el borde que tiene más.
      */}
      {bordes.izq && (
        <button type="button" onClick={() => mueve(-1)} aria-label="Ver las pantallas anteriores" className={`${flecha} left-1 md:left-6`}>
          <ChevronLeft size={16} />
        </button>
      )}
      {bordes.der && (
        <button type="button" onClick={() => mueve(1)} aria-label="Ver más pantallas de la sección" className={`${flecha} right-1 md:right-6`}>
          <ChevronRight size={16} />
        </button>
      )}
      <div
        ref={tira}
        className="relative flex min-w-0 items-center gap-1 overflow-x-auto py-1.5 scrollbar-none lg:flex-wrap lg:overflow-x-visible"
        style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      >
        <span className="mr-2 hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B] sm:inline">{seccion!.titulo}</span>
        {entradas.map(({ href, label, icon: Icono }) => {
          const activa = ruta === href || ruta.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={conRival && !activa ? conRivalEnUrl(href, rivalEnCurso) : href}
              aria-current={activa ? "page" : undefined}
              /* Más alta en el móvil (14/11/2026): 40 px para el dedo. */
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition lg:min-h-0 ${
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

/**
 * Las otras pantallas de la sección, dentro de la fila de pestañas de la
 * propia pantalla (18/11/2026, Data análisis, ronda 22): un botón con el
 * nombre de la sección que despliega el resto. Va con `RUTAS_CON_NAV_PROPIA`.
 */
export function EnlacesSeccion({ className = "" }: { className?: string }) {
  const ruta = usePathname() ?? "";
  const caja = useRef<HTMLDetailsElement>(null);
  const seccion = seccionDe(ruta);
  const otras = (seccion?.entradas ?? []).filter((e) => !e.obras && e.href.startsWith("/") && e.href !== ruta);

  /* Se cierra al pinchar fuera o con Escape. */
  useEffect(() => {
    const cierra = (e: Event) => {
      const d = caja.current;

      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };

    document.addEventListener("pointerdown", cierra);
    document.addEventListener("keydown", cierra);

    return () => {
      document.removeEventListener("pointerdown", cierra);
      document.removeEventListener("keydown", cierra);
    };
  }, []);

  if (!seccion || !otras.length) return null;

  return (
    <details ref={caja} className={`group relative shrink-0 ${className}`}>
      <summary
        /* 18/11/2026 (ronda 23): el rótulo entero siempre («s de Análisis» salía cortado a 1440 px). */
        className="inline-flex min-h-[40px] shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 px-3 text-[12px] font-semibold text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white [&::-webkit-details-marker]:hidden"
        title={`Las otras pantallas de ${seccion.titulo}`}
      >
        Más de {seccion.titulo}
        <ChevronDown size={14} className="transition group-open:rotate-180" />
      </summary>
      <ul className="absolute right-0 z-40 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-white/10 bg-[var(--rmcf-surface,#11161C)] p-1 shadow-2xl">
        {otras.map(({ href, label, icon: Icono }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={() => caja.current && (caja.current.open = false)}
              className="flex min-h-[40px] items-center gap-2 rounded-lg px-2.5 text-[13px] text-white/80 hover:bg-white/[0.06] hover:text-white"
            >
              <Icono size={14} className="shrink-0 text-[#C8A96B]" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
