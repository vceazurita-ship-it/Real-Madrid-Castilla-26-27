"use client";

/*
|--------------------------------------------------------------------------
| LOS SEIS CAMPOS DE LA DEMANDA COGNITIVA, CON SU PROPUESTA (13/10/2026)
|--------------------------------------------------------------------------
|
| NºJug, NºComodines, Normativa, Incertidumbre, Familiaridad (dificultad) y
| Motivación, siempre a la vista (antes iban en un desplegable cerrado). Un
| campo vacío enseña en gris lo que propone la hoja (`propuestaCognitiva`) y
| «Usar la propuesta» rellena los vacíos de una vez. Lo usan el editor de
| microciclos y el pop-up del día de la portada.
*/

import { Sparkles } from "lucide-react";

import { CAMPOS_COGNITIVOS, aplicaPropuesta, cambioCognitivo, valorCognitivo, type Propuesta } from "@/lib/registro/propuesta";
import type { TareaNueva } from "@/lib/registro/hoja";

export function CamposCognitivos({
  tarea,
  propuesta,
  onCambia,
}: {
  tarea: TareaNueva;
  propuesta: Propuesta | null;
  onCambia: (cambio: Partial<TareaNueva>) => void;
}) {
  const vacios = CAMPOS_COGNITIVOS.filter(({ campo }) => valorCognitivo(tarea, campo) === null && propuesta?.[campo] !== undefined);

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Demanda cognitiva
          {propuesta && propuesta.parecidas > 0 ? (
            <span className="ml-1.5 normal-case tracking-normal text-white/30">· en gris, la propuesta ({propuesta.parecidas} tareas parecidas en la hoja)</span>
          ) : null}
        </span>
        {vacios.length > 0 && propuesta ? (
          <button
            type="button"
            onClick={() => onCambia(aplicaPropuesta(tarea, propuesta))}
            className="inline-flex items-center gap-1 rounded-full border border-[#C8A96B]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/15"
            title="Rellena los campos vacíos con lo propuesto"
          >
            <Sparkles size={11} aria-hidden /> Usar la propuesta ({vacios.length})
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {CAMPOS_COGNITIVOS.map(({ campo, rotulo, corto, max }) => {
          const valor = valorCognitivo(tarea, campo);
          const propuesto = propuesta?.[campo];

          return (
            <label key={campo} className="block min-w-0" title={rotulo}>
              <span className="mb-1 block truncate text-[10px] text-white/45">{corto}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                value={valor === null ? "" : String(valor)}
                placeholder={propuesto !== undefined ? String(propuesto) : "—"}
                onChange={(e) => {
                  const bruto = e.target.value;
                  const n = bruto === "" ? null : Math.max(0, Math.min(max, Math.round(Number(bruto) || 0)));

                  onCambia(cambioCognitivo(tarea, campo, n));
                }}
                className={`w-full rounded-lg border bg-white/[0.04] px-2 py-1.5 text-center text-sm tabular-nums text-white outline-none transition placeholder:text-[#C8A96B]/45 focus:border-[#C8A96B]/50 ${
                  valor === null && propuesto !== undefined ? "border-dashed border-[#C8A96B]/30" : "border-white/10"
                }`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
