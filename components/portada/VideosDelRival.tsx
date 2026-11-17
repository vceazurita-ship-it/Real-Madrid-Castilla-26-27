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
import { Clapperboard, Play, X } from "lucide-react";

import { GolesDelRivalEnVideo, type LadoGoles, type Tipo } from "@/components/rivals/GolesDelRivalEnVideo";
import { cargaResumenesRfef, mismoEquipo, urlResumen } from "@/lib/rivals/resumen-de-partido";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { trackModuleVisit } from "@/lib/module-usage";

/* Mismo canto y sombra que los demás accesos de la portada (`.portada-viva`), en oro: es lo del rival en vídeo. */
const CHIP =
  "portada-viva group flex min-h-[52px] min-w-0 items-center gap-2.5 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-left text-[13.5px] font-semibold leading-tight text-[#C8A96B] hover:bg-[#C8A96B]/20";

/* El rótulo y lo que enseña, en la misma línea si cabe (y si no, debajo, entero: nunca cortado). */
const TEXTO_CHIP = "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2";
const SUB_CHIP = "block text-[12px] font-medium opacity-80";

/* Chip suelto para la tira de accesos del área rival (AccesosDelRival). */
const CHIP_TIRA =
  "inline-flex min-h-9 min-w-0 shrink-0 items-center whitespace-nowrap justify-center rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-center text-[13px] font-semibold leading-tight text-[#C8A96B] transition-colors hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20 sm:min-h-0";

/** El botón de reproducir, en su círculo de oro. */
function Icono() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110" style={{ background: "#D8B45A", color: "#0B0F14" }} aria-hidden>
      <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
    </span>
  );
}

export function VideosDelRival({
  rival,
  etiqueta = "Próximo rival · vídeo",
  tipo = "todos",
  apilado = false,
}: {
  rival: string;
  /** En la tarjeta estrecha del rival (portada): un vídeo por fila en todos los tamaños. */
  apilado?: boolean;
  /** Fuera de la portada (tira de accesos del área rival, 16/11/2026) el rival no tiene por qué ser el próximo. */
  etiqueta?: string;
  /** «abp»: desde ABP del rival, los goles a balón parado. */
  tipo?: Tipo;
}) {
  const [abierto, setAbierto] = useState<LadoGoles | null>(null);
  const [sinGoles, setSinGoles] = useState(false);
  const [resumenes, setResumenes] = useState<ResumenRfef[]>([]);
  /* 17/11/2026 (ronda 21, fútbol): hasta que llega la lista, el hueco de «Su último partido» se guarda; así el móvil y el escritorio enseñan lo mismo. */
  const [conResumenes, setConResumenes] = useState(false);

  useEffect(() => {
    let cancelado = false;

    cargaResumenesRfef().then((lista) => {
      if (cancelado) return;
      setResumenes(lista);
      setConResumenes(true);
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

  const hayAlgo = !sinGoles || Boolean(ultimo);
  /* En la portada, bloque propio con rótulo; en la tira de accesos del área rival, chips sueltos. */
  const enPortada = etiqueta === "Próximo rival · vídeo";

  return (
    <>
      {enPortada ? (
        <>
      {/* 16/11/2026 (rediseño): bloque propio con rótulo, tres botones con el icono de reproducir y lo que enseña cada uno debajo. */}
      {hayAlgo && (
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <Clapperboard className="h-3.5 w-3.5" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
            {rival} en vídeo
          </p>
          {/*
            17/11/2026 (ronda 21, los tres jueces): una fila por vídeo, a todo
            lo ancho, con lo que enseña al lado (no debajo): en la tarjeta del
            rival (440 px en escritorio, 390 en el móvil) tres columnas cortaban
            «Cómo le marcan · por dónde dañarle».
          */}
          <div className={apilado ? "grid gap-1.5" : "grid grid-cols-1 gap-1.5 sm:grid-cols-3"}>
            {!sinGoles && (
              <>
                <button type="button" className={CHIP} onClick={() => abre("favor")} title={`Los goles de ${rival}, de seguido o uno a uno`}>
                  <Icono />
                  <span className={TEXTO_CHIP}>
                    <span className="block">{tipo === "abp" ? "Sus goles a balón parado" : "Sus goles"}</span>
                    <span className={SUB_CHIP}>lo que marca</span>
                  </span>
                </button>
                <button type="button" className={CHIP} onClick={() => abre("contra")} title={`Los goles que le han marcado a ${rival}: por dónde hacerle daño`}>
                  <Icono />
                  <span className={TEXTO_CHIP}>
                    <span className="block">{tipo === "abp" ? "Cómo le marcan a balón parado" : "Cómo le marcan"}</span>
                    <span className={SUB_CHIP}>por dónde dañarle</span>
                  </span>
                </button>
              </>
            )}
            {ultimo ? (
              <a
                href={urlResumen(ultimo)}
                target="_blank"
                rel="noreferrer"
                className={CHIP}
                title={`Resumen de la RFEF · J${ultimo.jornada}: ${ultimo.local} ${ultimo.golesLocal}-${ultimo.golesVisitante} ${ultimo.visitante}`}
              >
                <Icono />
                <span className={TEXTO_CHIP}>
                  <span className="block">Su último partido</span>
                  <span className={`${SUB_CHIP} tabular-nums`}>
                    J{ultimo.jornada} · {ultimo.golesLocal}-{ultimo.golesVisitante}
                  </span>
                </span>
              </a>
            ) : !conResumenes ? (
              <span aria-hidden className="block min-h-[52px] animate-pulse rounded-2xl border border-[#C8A96B]/20 bg-[#C8A96B]/[0.06]" />
            ) : null}
          </div>
        </div>
      )}
        </>
      ) : (
        <>
      {!sinGoles && (
        <>
          <button type="button" className={CHIP_TIRA} onClick={() => abre("favor")} title={`Los goles de ${rival}, de seguido o uno a uno`}>
            {tipo === "abp" ? "▶ Sus goles a balón parado" : "▶ Sus goles en vídeo"}
          </button>
          <button type="button" className={CHIP_TIRA} onClick={() => abre("contra")} title={`Los goles que le han marcado a ${rival}: por dónde hacerle daño`}>
            {tipo === "abp" ? "▶ Cómo le marcan a balón parado" : "▶ Cómo le marcan"}
          </button>
        </>
      )}
      {ultimo && (
        <a
          href={urlResumen(ultimo)}
          target="_blank"
          rel="noreferrer"
          className={CHIP_TIRA}
          title={`Resumen de la RFEF · J${ultimo.jornada}: ${ultimo.local} ${ultimo.golesLocal}-${ultimo.golesVisitante} ${ultimo.visitante}`}
        >
          ▶ Su último partido
        </a>
      )}
        </>
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
