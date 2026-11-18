"use client";

/*
| LOS BOTONES DE CADA GRÁFICO (18/11/2026, el analista: «da la opción en cada
| gráfico de exportar su imagen y de ver en pantalla completa y, en los que
| tenga sentido por filtro de jornadas, que se vea un vídeo de la evolución»).
|
| No hay que tocar cada gráfico: este componente, montado una vez en el
| layout, mira qué tarjeta con un gráfico (un <svg> o <canvas> de verdad, no un
| icono) hay bajo el ratón y le pone en la esquina de arriba tres botones:
|
| - Descargar · PNG HD de la tarjeta (lib/export/elige-zona.ts).
| - Pantalla completa · la tarjeta sola, con el gráfico a todo el alto.
| - Vídeo por jornadas · sólo si la tarjeta lleva un selector de jornada
|   (lib/export/video-jornadas.ts).
|
| En el móvil no hay ratón: salen al tocar la tarjeta y se van a los 6 s.
|
| Fuera: las pizarras y editores (se dibuja encima y los botones estorbarían)
| y todo lo que lleve `data-sin-herramientas` o `data-export-hide`.
*/

import { useEffect, useRef, useState } from "react";
import { Download, Expand, Film, X } from "lucide-react";

import { descargaZona, esCaja, fondoDe } from "@/lib/export/elige-zona";
import { selectorDeJornadas, videoJornadas, type SelectorJornadas } from "@/lib/export/video-jornadas";

const RUTAS_FUERA = /^\/(pizarra|pizarra_sesion|pizarra-tactica|abp-pizarra|coding|laboratorio\/abp(?!\/datos)|laboratorio\/microciclo)(\/|$)/;

function graficoDentro(caja: Element) {
  for (const g of Array.from(caja.querySelectorAll("svg, canvas"))) {
    if (g instanceof SVGElement && (g as SVGElement & { ownerSVGElement: SVGSVGElement | null }).ownerSVGElement) continue;
    const r = g.getBoundingClientRect();
    if (r.width >= 220 && r.height >= 130) return true;
  }
  return false;
}

/** La tarjeta con gráfico más cercana a lo que hay bajo el dedo. */
function tarjetaDe(destino: Element | null): HTMLElement | null {
  if (!destino || destino.closest("[data-export-hide], [data-sin-herramientas], [data-pizarra-pantalla]")) return null;

  const tope = window.innerHeight * 2.4;

  for (let n: Element | null = destino; n && n !== document.body; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue;
    const r = n.getBoundingClientRect();
    if (r.height > tope || r.width > window.innerWidth * 0.99) return null;
    if (esCaja(n) && r.width >= 240 && r.height >= 150 && graficoDentro(n)) return n;
  }

  return null;
}

/** El selector de jornada puede ir en la cabecera de la sección y el gráfico en una caja de dentro: se mira hasta 4 niveles arriba. */
function jornadasCerca(zona: HTMLElement): SelectorJornadas | null {
  let n: HTMLElement | null = zona;
  for (let i = 0; i < 5 && n && n !== document.body; i++, n = n.parentElement) {
    if (n.getBoundingClientRect().height > window.innerHeight * 2.4) break;
    const sel = selectorDeJornadas(n);
    if (sel) return sel;
  }
  return null;
}

type Vista = { zona: HTMLElement; jornadas: SelectorJornadas | null; x: number; y: number };

export function HerramientasGrafico() {
  const [vista, setVista] = useState<Vista | null>(null);
  const [enPantalla, setEnPantalla] = useState<HTMLElement | null>(null);
  const barra = useRef<HTMLDivElement | null>(null);
  const actual = useRef<HTMLElement | null>(null);
  const salida = useRef<number>(0);

  useEffect(() => {
    let pendiente = 0;
    let ultimo: { x: number; y: number; t: EventTarget | null } | null = null;

    const coloca = (zona: HTMLElement | null) => {
      window.clearTimeout(salida.current);
      if (!zona) {
        /* Un respiro para poder llegar a los botones sin que se vayan. */
        salida.current = window.setTimeout(() => {
          actual.current = null;
          setVista(null);
        }, 450);
        return;
      }
      const r = zona.getBoundingClientRect();
      if (r.bottom < 40 || r.top > window.innerHeight - 20) return;
      actual.current = zona;
      setVista({
        zona,
        jornadas: jornadasCerca(zona),
        x: Math.min(window.innerWidth - 12, r.right - 10),
        y: Math.max(6, Math.min(window.innerHeight - 40, r.top - 14)),
      });
    };

    const mira = () => {
      pendiente = 0;
      if (!ultimo || RUTAS_FUERA.test(location.pathname) || document.documentElement.classList.contains("eligiendo-zona")) return;
      if (ultimo.t instanceof Node && barra.current?.contains(ultimo.t)) {
        window.clearTimeout(salida.current);
        return;
      }
      const zona = tarjetaDe(document.elementFromPoint(ultimo.x, ultimo.y));
      if (zona === actual.current && zona) {
        coloca(zona);
        return;
      }
      coloca(zona);
    };

    const alMover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      ultimo = { x: e.clientX, y: e.clientY, t: e.target };
      if (!pendiente) pendiente = requestAnimationFrame(mira);
    };

    let reloj = 0;
    const alTocar = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (e.target instanceof Node && barra.current?.contains(e.target)) return;
      ultimo = { x: e.clientX, y: e.clientY, t: e.target };
      mira();
      window.clearTimeout(reloj);
      reloj = window.setTimeout(() => {
        actual.current = null;
        setVista(null);
      }, 6000);
    };

    const alMoverPagina = () => {
      if (actual.current) coloca(actual.current);
    };

    window.addEventListener("pointermove", alMover, { passive: true });
    window.addEventListener("pointerdown", alTocar, { passive: true });
    window.addEventListener("scroll", alMoverPagina, { passive: true, capture: true });
    window.addEventListener("resize", alMoverPagina);
    return () => {
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerdown", alTocar);
      window.removeEventListener("scroll", alMoverPagina, { capture: true });
      window.removeEventListener("resize", alMoverPagina);
      if (pendiente) cancelAnimationFrame(pendiente);
      window.clearTimeout(reloj);
      window.clearTimeout(salida.current);
    };
  }, []);

  /* Al salir de la pantalla completa (Esc del navegador), quitar lo puesto. */
  useEffect(() => {
    if (!enPantalla) return;
    const el = enPantalla;
    const cierre = document.createElement("button");
    cierre.type = "button";
    cierre.setAttribute("data-export-hide", "");
    cierre.setAttribute("aria-label", "Salir de pantalla completa");
    cierre.className = "grafico-pantalla-cierre";
    cierre.textContent = "✕  Salir";
    el.appendChild(cierre);

    const sal = () => {
      if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => {});
      else setEnPantalla(null);
    };
    cierre.onclick = sal;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && sal();
    const cambio = () => {
      if (document.fullscreenElement !== el) setEnPantalla(null);
    };
    document.addEventListener("fullscreenchange", cambio);
    document.addEventListener("keydown", tecla);
    window.dispatchEvent(new Event("resize"));

    return () => {
      document.removeEventListener("fullscreenchange", cambio);
      document.removeEventListener("keydown", tecla);
      cierre.remove();
      el.classList.remove("grafico-en-pantalla", "grafico-en-pantalla-css");
      el.style.removeProperty("--grafico-fondo");
      window.dispatchEvent(new Event("resize"));
    };
  }, [enPantalla]);

  const pantallaCompleta = async (zona: HTMLElement) => {
    zona.style.setProperty("--grafico-fondo", fondoDe(zona));
    zona.classList.add("grafico-en-pantalla");
    setVista(null);
    try {
      if (!zona.requestFullscreen) throw new Error("sin api");
      await zona.requestFullscreen();
    } catch {
      /* iPhone: sin pantalla completa de elementos; se hace con CSS. */
      zona.classList.add("grafico-en-pantalla-css");
    }
    setEnPantalla(zona);
  };

  if (!vista || enPantalla) return null;

  const boton = "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-white/85 transition hover:bg-white/15 hover:text-white";

  return (
    <div
      ref={barra}
      data-export-hide
      onPointerEnter={() => window.clearTimeout(salida.current)}
      className="fixed z-[58] flex -translate-x-full items-center gap-0.5 rounded-full border border-white/15 bg-[#121820]/95 p-0.5 shadow-lg backdrop-blur print:hidden"
      style={{ left: vista.x, top: vista.y }}
    >
      <button type="button" className={boton} title="Descargar este gráfico en PNG HD" onClick={() => descargaZona(vista.zona)}>
        <Download className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden />
        <span className="hidden sm:inline">PNG HD</span>
        <span className="sr-only sm:hidden">Descargar en PNG HD</span>
      </button>
      <button type="button" className={boton} title="Ver en pantalla completa" onClick={() => void pantallaCompleta(vista.zona)}>
        <Expand className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden />
        <span className="hidden sm:inline">Pantalla completa</span>
        <span className="sr-only sm:hidden">Pantalla completa</span>
      </button>
      {vista.jornadas && (
        <button
          type="button"
          className={boton}
          title={`Vídeo de la evolución: de la jornada ${vista.jornadas.opciones[0].numero} a la ${vista.jornadas.opciones[vista.jornadas.opciones.length - 1].numero}, en MP4`}
          onClick={() => {
            const { zona, jornadas } = vista;
            setVista(null);
            videoJornadas(zona, jornadas!);
          }}
        >
          <Film className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden />
          <span className="hidden sm:inline">Vídeo por jornadas</span>
          <span className="sr-only sm:hidden">Vídeo por jornadas</span>
        </button>
      )}
      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white" aria-label="Quitar los botones" onClick={() => setVista(null)}>
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export default HerramientasGrafico;
