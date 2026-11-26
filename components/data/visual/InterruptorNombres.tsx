"use client";

/*
| NOMBRES: LOS QUE DICEN ALGO O TODOS (26/11/2026)
|
| El analista: «que salgan los nombres de todos si se quiere y si no los que
| salen ahora, que sea una pestaña que pueda activarse o desactivarse». Va en
| los mapas de puntos (MapaDosEjes, la nube de equipos de DATA y el cuadrante
| del Laboratorio de ABP). Sin guardar nada: cada vez abre como estaba.
*/

import { Tags } from "lucide-react";

export function InterruptorNombres({ todos, onCambia, cuantos }: { todos: boolean; onCambia: (v: boolean) => void; cuantos?: number }) {
  return (
    <div className="flex justify-end" data-export-hide>
      <div role="group" aria-label="Nombres en el gráfico" className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12px]">
        <Tags className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-white/45" aria-hidden />
        {[
          { v: false, t: "Destacados" },
          { v: true, t: cuantos ? `Todos (${cuantos})` : "Todos" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={todos === o.v}
            onClick={() => onCambia(o.v)}
            className={`min-h-[32px] rounded-full px-3 transition-colors ${todos === o.v ? "bg-white/15 font-semibold text-white" : "text-white/60 hover:text-white"}`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}
