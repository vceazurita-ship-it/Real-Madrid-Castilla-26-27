"use client";

/*
| NOMBRES Y ESCUDOS EN LOS GRÁFICOS DE PUNTOS (26/11/2026)
|
| El analista: «que salgan los nombres de todos si se quiere y si no los que
| salen ahora, que sea una pestaña que pueda activarse o desactivarse» y,
| después, «que se puedan quitar o poner los escudos de todos los equipos según
| me apetezca visualmente». Va en los mapas de puntos: MapaDosEjes, la nube de
| equipos de DATA (Dispersion), Ocasiones que concede y el cuadrante del
| Laboratorio de ABP.
|
| - Nombres: cada gráfico abre en «Destacados» (no se guarda).
| - Escudos: «Todos» o «Sólo implicados» (el nuestro y el comparado/rival con
|   escudo; el resto, un punto). Se recuerda en este aparato y vale para todos
|   los gráficos a la vez.
*/

import { useSyncExternalStore } from "react";
import { Shield, Tags } from "lucide-react";

const CLAVE = "graficos:escudos";
const EVENTO = "graficos-escudos";

function lee(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) !== "no";
  } catch {
    return true;
  }
}

function suscribe(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** ¿Se pintan los escudos? (true por defecto; el servidor y la primera pintada, con escudos). */
export function useEscudosVisibles(): [boolean, (v: boolean) => void] {
  const visibles = useSyncExternalStore(suscribe, lee, () => true);
  const pon = (v: boolean) => {
    try {
      window.localStorage.setItem(CLAVE, v ? "si" : "no");
    } catch {
      /* sin almacenamiento: dura lo que la página */
    }
    window.dispatchEvent(new Event(EVENTO));
  };
  return [visibles, pon];
}

function Grupo<T extends string | boolean>({ etiqueta, icono, valor, opciones, onCambia }: { etiqueta: string; icono: "nombres" | "escudos"; valor: T; opciones: { v: T; t: string }[]; onCambia: (v: T) => void }) {
  const Icono = icono === "nombres" ? Tags : Shield;
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12px]">
      <Icono className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-white/45" aria-hidden />
      {opciones.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={valor === o.v}
          onClick={() => onCambia(o.v)}
          className={`min-h-[32px] rounded-full px-3 transition-colors ${valor === o.v ? "bg-white/15 font-semibold text-white" : "text-white/60 hover:text-white"}`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function InterruptorNombres({
  todos,
  onCambia,
  cuantos,
  escudos,
  onEscudos,
}: {
  todos?: boolean;
  onCambia?: (v: boolean) => void;
  cuantos?: number;
  /** Si se pasan, sale también «Escudos: Sí · No». */
  escudos?: boolean;
  onEscudos?: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2" data-export-hide>
      {onEscudos && escudos != null && (
        <Grupo
          etiqueta="Qué escudos se ven"
          icono="escudos"
          valor={escudos}
          opciones={[
            { v: true, t: "Todos los escudos" },
            { v: false, t: "Sólo implicados" },
          ]}
          onCambia={onEscudos}
        />
      )}
      {onCambia && todos != null && (
        <Grupo
          etiqueta="Nombres en el gráfico"
          icono="nombres"
          valor={todos}
          opciones={[
            { v: false, t: "Destacados" },
            { v: true, t: cuantos ? `Todos (${cuantos})` : "Todos" },
          ]}
          onCambia={onCambia}
        />
      )}
    </div>
  );
}
