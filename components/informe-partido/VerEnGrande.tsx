"use client";

/*
| «Ver en grande» (07/11/2026, ronda 14 de jueces): en el móvil (390 px) una
| diapositiva de 1920×1080 se veía a una quinta parte y no se leía nada. El
| botón abre la lámina a pantalla completa; con el teléfono en vertical, la
| gira para usar el lado largo. Se cierra con la X, tocando fuera o con Esc
| (sin cerrar el diálogo de debajo).
*/

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

/* Colores fijos a propósito: van sobre la lámina, que es oscura en los dos modos. */
const BOTON: CSSProperties = { background: "rgba(8,17,31,0.78)", color: "#F4EBDD", border: "1px solid rgba(200,169,107,0.55)" };

export function VerEnGrande({
  ancho,
  alto,
  titulo,
  preview,
  children,
  className,
  style,
}: {
  /** Tamaño natural de la lámina, en píxeles. */
  ancho: number;
  alto: number;
  titulo: string;
  /** Lo que se ve en el diálogo (la lámina ya escalada). */
  preview: ReactNode;
  /** La lámina a su tamaño natural. */
  children: ReactNode;
  /** La fuente y sus variables, que el portal no hereda del diálogo. */
  className?: string;
  style?: CSSProperties;
}) {
  const [vista, setVista] = useState<{ w: number; h: number } | null>(null);

  const cierra = () => {
    setVista(null);

    if (typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  };

  const abierto = vista !== null;

  useEffect(() => {
    if (!abierto) return;

    const mide = () => setVista({ w: window.innerWidth, h: window.innerHeight });

    /* En captura y parado aquí: el Esc del diálogo de debajo no llega. */
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      e.preventDefault();
      e.stopImmediatePropagation();
      setVista(null);

      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };

    window.addEventListener("resize", mide);
    window.addEventListener("keydown", tecla, true);

    return () => {
      window.removeEventListener("resize", mide);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [abierto]);

  const grande = (() => {
    if (!vista) return null;

    const girada = vista.h > vista.w * 1.15;

    /* Hueco libre: arriba, la barra de cerrar (56 px); alrededor, 8 px. */
    const largo = girada ? vista.h - 72 : vista.w - 16;
    const corto = girada ? vista.w - 16 : vista.h - 72;

    const escala = Math.max(0.1, Math.min(largo / ancho, corto / alto));

    const w = ancho * escala;
    const h = alto * escala;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${titulo}, en grande`}
        className="fixed inset-0 z-[80] flex flex-col overflow-hidden"
        style={{ background: "rgba(4,9,16,0.96)" }}
        onClick={() => cierra()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-3">
          <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: "#F4EBDD" }}>
            {titulo}
          </span>
          <button type="button" autoFocus onClick={() => cierra()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={BOTON}>
            <X size={15} /> Cerrar
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-2">
          {/* El hueco que ocupa ya girada; dentro, la lámina a su escala y girada 90°. */}
          <div style={{ width: girada ? h : w, height: girada ? w : h, position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <div
              className={className}
              style={{
                ...style,
                position: "absolute",
                left: girada ? h : 0,
                top: 0,
                width: ancho,
                height: alto,
                transform: `${girada ? "rotate(90deg) " : ""}scale(${escala})`,
                transformOrigin: "top left",
                borderRadius: 12 / escala,
                overflow: "hidden",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const abre = () => {
    setVista({ w: window.innerWidth, h: window.innerHeight });

    /*
    | En el móvil, a pantalla completa de verdad (11/11/2026, marketing): sin la
    | barra del navegador la lámina gana casi un tercio. Si el navegador no
    | deja (iPhone), se queda como hasta ahora.
    */
    if (window.matchMedia("(max-width: 767px)").matches && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  };

  /*
  | El botón, debajo de la lámina (10/11/2026, fútbol y marketing): encima tapaba
  | la fecha y la hora del encabezado. Y tocar la lámina ya la abre en grande:
  | en el móvil, a 390 px, no se lee de otra forma.
  */
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${titulo}: abrir en grande`}
        onClick={abre}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abre();
          }
        }}
        className="cursor-zoom-in"
      >
        {preview}
      </div>
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={abre}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[12px] font-semibold text-white/75 hover:border-white/30 hover:text-white"
          title="Ver la lámina a pantalla completa"
        >
          <Maximize2 size={12} /> Ver en grande
        </button>
      </div>
      {grande && typeof document !== "undefined" ? createPortal(grande, document.body) : null}
    </div>
  );
}
