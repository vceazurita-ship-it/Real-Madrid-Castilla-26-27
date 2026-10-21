"use client";

/*
| Un botón que abre un panel pequeño (21/10/2026).
|
| La pizarra tenía todas sus opciones a la vista, en cuatro filas de botones
| encima del campo: el campo empezaba a media pantalla y en el portátil había
| que bajar para verlo. Lo que se toca una vez por pizarra —el encuadre, el
| césped, cómo se exporta— va ahora dentro de uno de éstos.
|
| Se cierra al pinchar fuera, con Escape y al elegir algo (si quien lo usa
| llama a `cierra`). Va dentro del tablero, no en un portal, para que se vea
| también a pantalla completa.
*/

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export default function Desplegable({
  etiqueta,
  icono,
  titulo,
  lado = "izquierda",
  ancho = "w-72",
  activo = false,
  deshabilitado = false,
  children,
}: {
  etiqueta: string;
  icono?: ReactNode;
  /** Lo que dice al pasar por encima. */
  titulo?: string;
  /** Hacia qué lado se abre el panel. */
  lado?: "izquierda" | "derecha";
  ancho?: string;
  activo?: boolean;
  deshabilitado?: boolean;
  children: (cierra: () => void) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;

    const fuera = (event: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
    };

    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setAbierto(false);
      }
    };

    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("keydown", tecla, true);

    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        disabled={deshabilitado}
        title={titulo}
        aria-expanded={abierto}
        aria-controls={id}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
          abierto || activo
            ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-[#C8A96B]"
            : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white",
        )}
      >
        {icono}
        {etiqueta}
        <ChevronDown size={12} className={cn("transition", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div
          id={id}
          role="dialog"
          aria-label={etiqueta}
          className={cn(
            /* En el teléfono, una hoja abajo a todo el ancho: anclado al botón se salía de la pantalla por un lado. */
            "absolute top-full z-[60] mt-1.5 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#11161D] p-3 shadow-[0_20px_60px_rgba(0,0,0,.45)]",
            "max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto max-sm:mt-0 max-sm:max-h-[75svh] max-sm:w-auto max-sm:max-w-none max-sm:overflow-y-auto",
            ancho,
            lado === "derecha" ? "right-0" : "left-0",
          )}
        >
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}
