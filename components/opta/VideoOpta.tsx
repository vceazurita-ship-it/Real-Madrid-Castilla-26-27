"use client";

/**
 * «▶ Vídeo» de UN evento de Opta (16/11/2026; corte de B2 desde el 18/11/2026).
 *
 * 1. Si el ordenador del club ya bajó el corte de ese evento a B2
 *    (`opta:goles-video` / `opta:acciones-video`, `lib/opta-cortes.ts`), el
 *    botón lo abre aquí mismo, en un pop-up, sin sesión de Opta; debajo va
 *    «Abrir en Opta» por si se quiere ver más.
 * 2. Si no, abre en ProVision el Event Log de ese partido filtrado a esa
 *    parte y ese segundo, con el vídeo del evento abierto (8 s antes y 8 s
 *    después; `lib/opta-video.ts`). Hace falta la sesión de Opta abierta.
 *
 * Sin reloj (segundo 0) o sin partido, no sale nada.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

import { useCortesOpta } from "@/hooks/useCortesOpta";
import { corteOpta } from "@/lib/opta-cortes";
import { urlVideoOpta, type EventoOpta, type TipoEventoOpta } from "@/lib/opta-video";

const POR_DEFECTO = "▶ Vídeo en Opta";

/** La etiqueta con el corte a mano: el vídeo se ve aquí, no «en Opta». */
const etiquetaDeCorte = (etiqueta: string) => (etiqueta === "▶ Opta" ? "▶ Vídeo" : etiqueta.replace(/ en Opta$/, ""));

export function VideoOpta({
  evento,
  tipo = "touches",
  etiqueta = POR_DEFECTO,
  descripcion,
  soloCorte = false,
}: {
  evento: EventoOpta;
  tipo?: TipoEventoOpta;
  etiqueta?: string;
  /** Qué es, para el título al pasar el ratón («Córner de Fortuny, 34′»). */
  descripcion?: string;
  /** Sólo el corte de B2 (la pantalla ya tiene su propio enlace a ProVision). */
  soloCorte?: boolean;
}) {
  const cortes = useCortesOpta();
  const [abierto, setAbierto] = useState(false);
  const corte = corteOpta(evento, cortes);
  const url = urlVideoOpta(evento, tipo);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [abierto]);

  if (corte) {
    const que = descripcion ?? "El evento";

    return (
      <>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/60 bg-[#C8A96B]/15 px-2.5 py-1 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25"
          title={`${descripcion ? `${descripcion}: ` : ""}el corte de Opta (10 s antes y 6 s después), aquí mismo y sin sesión de Opta.`}
        >
          {etiquetaDeCorte(etiqueta)}
        </button>
        {abierto &&
          typeof document !== "undefined" &&
          createPortal(
            <div role="dialog" aria-modal="true" aria-label={que} className="modal-veil fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setAbierto(false)}>
              <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#11161D] p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 text-[13px] font-semibold text-white/85">{que}</p>
                  <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el vídeo" className="rounded-lg p-1.5 text-white/60 hover:bg-white/[0.06] hover:text-white">
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <video src={corte} controls autoPlay playsInline preload="auto" className="aspect-video w-full rounded-xl bg-black" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/55">
                  <span>Corte de Opta ProVision · 10 s antes y 6 s después</span>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#C8A96B] hover:underline" title="Abre el Event Log de ProVision en este segundo (hace falta la sesión de Opta)">
                      <ExternalLink size={12} aria-hidden /> Abrir en Opta
                    </a>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  if (!url || soloCorte) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/40 px-2.5 py-1 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
      title={`${descripcion ? `${descripcion}: ` : ""}abre en Opta ProVision este evento con su vídeo (8 s antes y 8 s después). Hace falta tener la sesión de Opta abierta.`}
    >
      {etiqueta}
    </a>
  );
}
