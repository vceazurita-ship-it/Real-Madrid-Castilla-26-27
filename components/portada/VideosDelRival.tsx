"use client";

/**
 * EL RIVAL EN VÍDEO, A UN TOQUE DESDE LA PORTADA (16/11/2026, petición del
 * analista). En la fila «Del rival» de la tarjeta del próximo partido:
 *
 * - «▶ Sus goles en vídeo»: los goles que marca, de seguido o uno a uno
 *   (`GolesDelRivalEnVideo`, en un modal; Opta no se pide hasta abrirlo).
 * - «▶ Cómo le marcan»: lo mismo con los que encaja, que es por dónde
 *   hacerle daño.
 * - «Su último partido»: el resumen oficial de la RFEF de su último partido
 *   de liga, en YouTube (`/api/rivals/resumenes`, cacheado en el servidor).
 *
 * Lo que no tiene dato no sale: sin resumen no hay enlace, y si Opta no tiene
 * goles del equipo, los dos botones se van.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { GolesDelRivalEnVideo, type LadoGoles, type Tipo } from "@/components/rivals/GolesDelRivalEnVideo";
import { cargaResumenesRfef, mismoEquipo, urlResumen } from "@/lib/rivals/resumen-de-partido";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { trackModuleVisit } from "@/lib/module-usage";

const CHIP =
  "inline-flex min-h-9 min-w-0 shrink-0 items-center whitespace-nowrap justify-center rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-center text-[13px] font-semibold leading-tight text-[#C8A96B] transition-colors hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20 sm:min-h-0";

export function VideosDelRival({
  rival,
  etiqueta = "Próximo rival · vídeo",
  tipo = "todos",
}: {
  rival: string;
  /** Fuera de la portada (tira de accesos del área rival, 16/11/2026) el rival no tiene por qué ser el próximo. */
  etiqueta?: string;
  /** «abp»: desde ABP del rival, los goles a balón parado. */
  tipo?: Tipo;
}) {
  const [abierto, setAbierto] = useState<LadoGoles | null>(null);
  const [sinGoles, setSinGoles] = useState(false);
  const [resumenes, setResumenes] = useState<ResumenRfef[]>([]);

  useEffect(() => {
    let cancelado = false;

    cargaResumenesRfef().then((lista) => {
      if (!cancelado) setResumenes(lista);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  /* Su último partido de liga con resumen: la temporada más reciente y, dentro, la jornada más alta. */
  const ultimo = useMemo(() => {
    const suyos = resumenes.filter((r) => mismoEquipo(r.local, rival) || mismoEquipo(r.visitante, rival));

    return suyos.sort((a, b) => b.temporada - a.temporada || b.jornada - a.jornada)[0] ?? null;
  }, [resumenes, rival]);

  /* Escape cierra el modal. */
  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(null);
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [abierto]);

  const alVacio = useCallback(() => {
    setSinGoles(true);
    setAbierto(null);
  }, []);

  const abre = (lado: LadoGoles) => {
    trackModuleVisit("/analisis-goles");
    setAbierto(lado);
  };

  return (
    <>
      {!sinGoles && (
        <>
          <button type="button" className={CHIP} onClick={() => abre("favor")} title={`Los goles de ${rival}, de seguido o uno a uno`}>
            {tipo === "abp" ? "▶ Sus goles a balón parado" : "▶ Sus goles en vídeo"}
          </button>
          <button type="button" className={CHIP} onClick={() => abre("contra")} title={`Los goles que le han marcado a ${rival}: por dónde hacerle daño`}>
            {tipo === "abp" ? "▶ Cómo le marcan a balón parado" : "▶ Cómo le marcan"}
          </button>
        </>
      )}
      {ultimo && (
        <a
          href={urlResumen(ultimo)}
          target="_blank"
          rel="noreferrer"
          className={CHIP}
          title={`Resumen de la RFEF · J${ultimo.jornada}: ${ultimo.local} ${ultimo.golesLocal}-${ultimo.golesVisitante} ${ultimo.visitante}`}
        >
          ▶ Su último partido
        </a>
      )}

      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            /* El fondo lo pone `.modal-veil`, no `bg-black/NN` (modo día: ver memoria tema-dia-noche). */
            className="modal-veil fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto p-3 backdrop-blur-sm sm:p-6"
            data-export-hide
            role="dialog"
            aria-modal="true"
            aria-label={abierto === "favor" ? `Goles de ${rival} en vídeo` : `Goles que encaja ${rival} en vídeo`}
            onClick={() => setAbierto(null)}
          >
            <div
              className="my-auto w-full max-w-3xl min-w-0 overflow-hidden rounded-[22px] border border-white/12 bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-[#C8A96B]">{etiqueta}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{rival}, gol a gol</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(null)}
                  aria-label="Cerrar"
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 px-4 py-4 sm:px-5">
                <GolesDelRivalEnVideo equipo={rival} ladoInicial={abierto} tipoInicial={tipo} alVacio={alVacio} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
