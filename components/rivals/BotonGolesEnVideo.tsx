"use client";

/**
 * LOS GOLES EN VÍDEO, EN UN POP-UP, EN TODA LA APP (18/11/2026, petición del
 * analista: «el enlace de sus goles en vídeo… debe abrir el pop up como el de
 * la portada para verlos, no llevar a la sección de análisis de goles; eso
 * debe ser otra opción, algo del tipo ver todos sus goles o cómo son sus
 * goles»).
 *
 * - `ModalGolesEnVideo`: el pop-up de la portada (antes dentro de
 *   `components/portada/VideosDelRival.tsx`), con `GolesDelRivalEnVideo`
 *   dentro, Esc y clic fuera para cerrar. En la cabecera, la ida aparte y
 *   secundaria a /analisis-goles: «Cómo son sus goles ›».
 * - `BotonGolesEnVideo`: un botón que lo abre con el equipo y el lado ya
 *   puestos; la apariencia la pone quien lo usa (`className` y `children`),
 *   así cada pantalla conserva la suya. Si Opta no tiene goles del equipo, el
 *   pop-up se cierra y el botón se va.
 * - Con `partido` (id de Opta), los goles de ESE partido y de los dos equipos
 *   (Análisis de datos → «El partido»).
 *
 * Opta no se pide hasta abrirlo.
 */

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { GolesDelRivalEnVideo, type LadoGoles, type Tipo } from "@/components/rivals/GolesDelRivalEnVideo";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import { trackModuleVisit } from "@/lib/module-usage";

/** Lo que necesita un enlace para abrir el pop-up en vez de llevar a /analisis-goles. */
export type GolesEnVideo = {
  equipo: string;
  lado?: LadoGoles;
  tipo?: Tipo;
  /** Id de Opta de un partido: sólo sus goles, los de los dos equipos. */
  partido?: string;
  /** O el día (AAAA-MM-DD) de ese partido contra `equipo`, si no se sabe su id. */
  fecha?: string;
};

/** El enlace aparte a /analisis-goles, discreto (texto en oro, sin caja). */
export const CLASE_ENLACE_SECUNDARIO =
  "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-1.5 text-[12px] font-semibold text-[#C8A96B] underline-offset-2 hover:underline sm:min-h-0";

/** «Cómo son sus goles ›»: la ida a Análisis de goles con el equipo y «En el campo» puestos. */
export function EnlaceComoSonSusGoles({
  equipo,
  lado = "favor",
  texto = "Cómo son sus goles ›",
  className = CLASE_ENLACE_SECUNDARIO,
}: {
  equipo: string;
  lado?: LadoGoles;
  texto?: string;
  className?: string;
}) {
  if (!equipo.trim()) return null;

  return (
    <Link
      href={urlGolesDelEquipo(equipo, lado)}
      className={className}
      title={`Todos los goles de ${equipo}, en el campo: de dónde, cómo y cuándo (Análisis de goles)`}
      onClick={() => trackModuleVisit("/analisis-goles")}
    >
      {texto}
    </Link>
  );
}

export function ModalGolesEnVideo({
  equipo,
  lado,
  tipo = "todos",
  partido,
  fecha,
  etiqueta = "Goles en vídeo",
  titulo,
  alCerrar,
  alVacio,
}: GolesEnVideo & {
  lado: LadoGoles;
  /** Lo pequeño en oro sobre el título («Próximo rival · vídeo»). */
  etiqueta?: string;
  /** Por defecto «<equipo>, gol a gol» (con `partido`, «El partido, gol a gol»). */
  titulo?: string;
  alCerrar: () => void;
  /** Cuando ya se sabe que no hay goles que enseñar. */
  alVacio?: () => void;
}) {
  /* Escape cierra el pop-up. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  if (typeof document === "undefined") return null;

  const delPartido = Boolean(partido || fecha);
  const rotulo = titulo ?? (delPartido ? "El partido, gol a gol" : `${equipo}, gol a gol`);

  return createPortal(
    <div
      /* El fondo lo pone `.modal-veil`, no `bg-black/NN` (modo día: ver memoria tema-dia-noche). Sin backdrop-blur: parpadeaba en Mac. */
      className="modal-veil fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      data-export-hide
      role="dialog"
      aria-modal="true"
      aria-label={delPartido ? "Los goles del partido en vídeo" : lado === "favor" ? `Goles de ${equipo} en vídeo` : `Goles que encaja ${equipo} en vídeo`}
      /* Los eventos de un portal suben por el árbol de React: sin parar aquí, el clic abriría la casilla del calendario que lo contiene. */
      onClick={(e) => {
        e.stopPropagation();
        alCerrar();
      }}
    >
      <div
        className="my-auto w-full max-w-3xl min-w-0 overflow-hidden rounded-[22px] border border-white/12 bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.28em] text-[#C8A96B]">{etiqueta}</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-white">{rotulo}</h2>
            {/* La otra opción, aparte y secundaria (18/11/2026): todos sus goles, en el campo. */}
            <EnlaceComoSonSusGoles equipo={equipo} lado={delPartido ? "favor" : lado} className={`${CLASE_ENLACE_SECUNDARIO} -ml-1.5 mt-0.5`} />
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0 px-4 py-4 sm:px-5">
          <GolesDelRivalEnVideo equipo={equipo} ladoInicial={lado} tipoInicial={tipo} partido={partido} fecha={fecha} alVacio={alVacio} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Un botón que abre el pop-up; la apariencia, de quien lo usa. */
export function BotonGolesEnVideo({
  equipo,
  lado = "favor",
  tipo = "todos",
  partido,
  fecha,
  etiqueta,
  titulo,
  className = "",
  title,
  children,
}: GolesEnVideo & {
  etiqueta?: string;
  titulo?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  /* De qué equipo (y partido) se supo que no hay goles: al cambiar, el botón vuelve. */
  const clave = `${equipo}|${partido ?? ""}|${fecha ?? ""}`;
  const delPartido = Boolean(partido || fecha);
  const [sinGolesDe, setSinGolesDe] = useState<string | null>(null);

  const cierra = useCallback(() => setAbierto(false), []);
  const alVacio = useCallback(() => {
    setSinGolesDe(clave);
    setAbierto(false);
  }, [clave]);

  if (!equipo.trim() || sinGolesDe === clave) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        title={title ?? (delPartido ? "Los goles del partido, de seguido o uno a uno" : lado === "favor" ? `Los goles de ${equipo}, de seguido o uno a uno` : `Los goles que le han marcado a ${equipo}: por dónde hacerle daño`)}
        aria-haspopup="dialog"
        onClick={(e) => {
          /* Dentro de una casilla o una tarjeta que se abre al tocarla: el botón no la abre. */
          e.stopPropagation();
          trackModuleVisit("/analisis-goles");
          setAbierto(true);
        }}
      >
        {children}
      </button>
      {abierto && (
        <ModalGolesEnVideo
          equipo={equipo}
          lado={lado}
          tipo={tipo}
          partido={partido}
          fecha={fecha}
          etiqueta={etiqueta ?? (delPartido ? "El partido · vídeo" : `${equipo} · vídeo`)}
          titulo={titulo}
          alCerrar={cierra}
          alVacio={alVacio}
        />
      )}
    </>
  );
}
