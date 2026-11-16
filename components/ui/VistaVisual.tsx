"use client";

/*
| VISUAL / DETALLE (16/11/2026, petición del analista: «nuestras áreas de
| análisis deberían ser mucho más visuales por defecto y que exista la opción
| de verlo también como ahora»).
|
| Un conmutador común a las pantallas de análisis: «Visual» (lo que se abre:
| gráficos con su conclusión en el título, campogramas, el Castilla en oro y el
| próximo rival en azul) y «Detalle» (la pantalla de antes, tal cual, sin
| quitarle nada). Se recuerda por pantalla en este aparato; sin almacenamiento
| (ventana privada) se queda en Visual.
|
| Leído con useSyncExternalStore (nada de setState en un efecto, regla del
| linter) y avisando a las demás instancias de la pestaña con un evento propio.
*/

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { BarChart3, ListTree } from "lucide-react";

export type VistaAnalisis = "visual" | "detalle";

const EVENTO = "rmcf:vista-analisis";
const clave = (pantalla: string) => `rmcf:vista:${pantalla}`;

const suscribe = (avisa: () => void) => {
  window.addEventListener("storage", avisa);
  window.addEventListener(EVENTO, avisa);
  return () => {
    window.removeEventListener("storage", avisa);
    window.removeEventListener(EVENTO, avisa);
  };
};

function lee(pantalla: string): VistaAnalisis {
  try {
    return localStorage.getItem(clave(pantalla)) === "detalle" ? "detalle" : "visual";
  } catch {
    return "visual";
  }
}

/** La vista elegida para una pantalla (por defecto, Visual) y cómo cambiarla. */
export function useVistaAnalisis(pantalla: string): [VistaAnalisis, (v: VistaAnalisis) => void] {
  const vista = useSyncExternalStore(
    suscribe,
    () => lee(pantalla),
    () => "visual" as VistaAnalisis,
  );
  const cambia = useCallback(
    (v: VistaAnalisis) => {
      try {
        localStorage.setItem(clave(pantalla), v);
      } catch {
        /* sin almacenamiento: vale para esta visita */
      }
      window.dispatchEvent(new Event(EVENTO));
    },
    [pantalla],
  );
  return [vista, cambia];
}

/** Los dos botones. `pantalla` es la clave con la que se recuerda (p. ej. "analisis-goles"). */
export function ConmutadorVista({ vista, onCambia, className = "" }: { vista: VistaAnalisis; onCambia: (v: VistaAnalisis) => void; className?: string }) {
  const opciones: { v: VistaAnalisis; label: string; icono: ReactNode; titulo: string }[] = [
    { v: "visual", label: "Visual", icono: <BarChart3 size={13} aria-hidden />, titulo: "Gráficos con su conclusión" },
    { v: "detalle", label: "Detalle", icono: <ListTree size={13} aria-hidden />, titulo: "La pantalla completa, con todas las cifras y tablas" },
  ];
  return (
    <div role="group" aria-label="Cómo ver la pantalla" className={`inline-flex shrink-0 rounded-full border border-white/15 bg-white/[0.03] p-0.5 text-xs font-semibold ${className}`}>
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onCambia(o.v)}
          aria-pressed={vista === o.v}
          title={o.titulo}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${vista === o.v ? "bg-[#C8A96B]/20 text-white" : "text-white/60 hover:text-white"}`}
        >
          {o.icono}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * La pieza entera: el conmutador y, debajo, lo visual o el detalle.
 * Si `visual` no trae nada que dibujar (null), se enseña el detalle sin
 * conmutador: nunca una pantalla vacía.
 */
export function VistaVisualDetalle({
  pantalla,
  visual,
  detalle,
  barra,
}: {
  pantalla: string;
  visual: ReactNode;
  detalle: ReactNode;
  /** Lo que va a la izquierda del conmutador (un título, un filtro). */
  barra?: ReactNode;
}) {
  const [vista, setVista] = useVistaAnalisis(pantalla);
  if (visual == null || visual === false) return <>{detalle}</>;
  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{barra}</div>
        <ConmutadorVista vista={vista} onCambia={setVista} />
      </div>
      {vista === "visual" ? visual : detalle}
    </div>
  );
}

/** Título-conclusión de un gráfico: la frase arriba, en grande; la pregunta, pequeña encima. */
export function TituloConclusion({ pregunta, children, fuente }: { pregunta: string; children: ReactNode; fuente?: string }) {
  return (
    <header className="mb-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{pregunta}</p>
      <h3 className="mt-0.5 text-base font-bold leading-snug text-white sm:text-lg">{children}</h3>
      {fuente && <p className="mt-0.5 text-[11px] text-white/45">{fuente}</p>}
    </header>
  );
}

/** El marco de una lámina del modo Visual. */
export function Lamina({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`}>{children}</section>;
}
