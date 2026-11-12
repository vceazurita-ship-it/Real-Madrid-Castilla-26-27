"use client";

/*
| LAS LÁMINAS DEL INFORME DE ABP, EN GRANDE (12/11/2026, fútbol, análisis y
| marketing): en la vista previa la pizarra va en miniaturas; al tocar una se
| abre aquí a pantalla completa, con «Anterior» y «Siguiente», su título y su
| leyenda. Con el teléfono en vertical, la lámina se gira para usar el lado
| largo (como `VerEnGrande` del informe del partido). Se cierra con la X,
| tocando fuera o con Esc, sin cerrar el diálogo de debajo; las flechas pasan
| de lámina.
*/

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LaminaGrande = { imagen: string; titulo: string; leyenda: string };

/* Colores fijos a propósito: van sobre un fondo oscuro en los dos modos, como la lámina. */
const BOTON: CSSProperties = { background: "rgba(8,17,31,0.78)", color: "#F4EBDD", border: "1px solid rgba(200,169,107,0.55)" };

export function LaminasEnGrande({ laminas, abierta, onCambia }: { laminas: LaminaGrande[]; abierta: number | null; onCambia: (indice: number | null) => void }) {
  const [vista, setVista] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ src: string; w: number; h: number } | null>(null);

  const lamina = abierta !== null ? laminas[abierta] : undefined;

  const total = laminas.length;

  useEffect(() => {
    if (!lamina) return;

    const mide = () => setVista({ w: window.innerWidth, h: window.innerHeight });

    mide();

    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (e.key === "Escape") onCambia(null);
      else if (abierta !== null) onCambia((abierta + (e.key === "ArrowRight" ? 1 : total - 1)) % total);
    };

    window.addEventListener("resize", mide);
    window.addEventListener("keydown", tecla, true);

    return () => {
      window.removeEventListener("resize", mide);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [lamina, abierta, total, onCambia]);

  if (!lamina || !vista || typeof document === "undefined") return null;

  const medida = natural?.src === lamina.imagen ? natural : { w: 16, h: 9 };

  const girada = vista.h > vista.w * 1.15;

  /* Arriba, la barra (56 px); abajo, la leyenda y los botones (96 px). */
  const largo = girada ? vista.h - 160 : vista.w - 16;
  const corto = girada ? vista.w - 16 : vista.h - 160;

  const escala = Math.max(0.05, Math.min(largo / medida.w, corto / medida.h));

  const w = medida.w * escala;
  const h = medida.h * escala;

  const pasa = (paso: number) => onCambia(((abierta ?? 0) + paso + total) % total);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${lamina.titulo}, en grande`}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden"
      style={{ background: "rgba(4,9,16,0.96)" }}
      onClick={() => onCambia(null)}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-3">
        <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: "#F4EBDD" }}>
          {total > 1 ? `${(abierta ?? 0) + 1} de ${total} · ` : ""}
          {lamina.titulo}
        </span>
        <button type="button" autoFocus onClick={() => onCambia(null)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={BOTON}>
          <X size={15} /> Cerrar
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <div style={{ width: girada ? h : w, height: girada ? w : h, position: "relative" }} onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element -- es un data: del informe, no una imagen que optimizar */}
          <img
            src={lamina.imagen}
            alt={lamina.titulo}
            onLoad={(e) => setNatural({ src: lamina.imagen, w: e.currentTarget.naturalWidth || 16, h: e.currentTarget.naturalHeight || 9 })}
            style={{
              position: "absolute",
              left: girada ? h : 0,
              top: 0,
              width: w,
              height: h,
              maxWidth: "none",
              transform: girada ? "rotate(90deg)" : undefined,
              transformOrigin: "top left",
              borderRadius: 10,
            }}
          />
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3" onClick={(e) => e.stopPropagation()}>
        {lamina.leyenda ? (
          <p className="mx-auto mb-2 line-clamp-2 max-w-3xl text-center text-[13px] leading-snug" style={{ color: "#C9D2DF" }}>
            {lamina.leyenda}
          </p>
        ) : null}
        {total > 1 ? (
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => pasa(-1)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-4 py-2 text-[13px] font-semibold" style={BOTON}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <button type="button" onClick={() => pasa(1)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-4 py-2 text-[13px] font-semibold" style={BOTON}>
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
