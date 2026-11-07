"use client";

/*
| Un solo «Descargar» con su menú (07/11/2026, ronda 14 de jueces): en el
| móvil, seis botones sueltos (Resumen PDF, Resumen PPT, Completo PDF, Vídeo,
| 16:9…) ocupaban tres filas del pie y se comían la vista del informe. El menú
| se abre hacia arriba (va en el pie del diálogo) y se cierra al elegir, al
| tocar fuera o con Esc.
*/

import { useEffect, useRef, useState, type ComponentType } from "react";
import { ChevronDown, Download } from "lucide-react";

export type OpcionDescarga = {
  id: string;
  rotulo: string;
  /** Una línea debajo: qué es y en qué formato. */
  detalle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
  onSelect: () => void;
};

export function MenuDescargar({ opciones, disabled = false, rotulo = "Descargar" }: { opciones: OpcionDescarga[]; disabled?: boolean; rotulo?: string }) {
  const [abierto, setAbierto] = useState(false);

  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };

    /* En captura: el Esc cierra el menú, no el diálogo. */
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      e.preventDefault();
      e.stopImmediatePropagation();
      setAbierto(false);
    };

    window.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", tecla, true);

    return () => {
      window.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((x) => !x)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size={14} />
        {rotulo}
        <ChevronDown size={13} className={`transition ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto ? (
        <div
          role="menu"
          aria-label={rotulo}
          className="absolute bottom-full left-0 z-20 mb-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/12 bg-[#11161C] p-1 shadow-2xl"
        >
          {opciones.map(({ id, rotulo: r, detalle, icon: Icon, disabled: off, onSelect }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              disabled={off}
              onClick={() => {
                setAbierto(false);
                onSelect();
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {Icon ? <Icon size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" /> : null}
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-white/85">{r}</span>
                {detalle ? <span className="block text-[11px] leading-snug text-white/45">{detalle}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
