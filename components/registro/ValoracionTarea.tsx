"use client";

/*
|--------------------------------------------------------------------------
| LA VALORACIÓN DE UNA TAREA: EVALUACIÓN Y ANÁLISIS POST
|--------------------------------------------------------------------------
|
| Las dos columnas de la hoja de registro que se rellenan DESPUÉS de la
| sesión (13/10/2026): la nota de la tarea (1-10) y el análisis post, una
| lista cerrada de la hoja (`ANALISIS_POST`). Viajan en `TareaNueva.extra`
| con el nombre exacto de la columna. Lo usan el editor de microciclos y el
| pop-up del día de la portada.
*/

import { ANALISIS_POST } from "@/lib/registro/hoja";

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Color de la nota: rojo hasta 4, ámbar 5-6, verde 7-8, oro 9-10. */
const colorNota = (n: number) => (n >= 9 ? "#C8A96B" : n >= 7 ? "#34D399" : n >= 5 ? "#FBBF24" : "#F87171");

export function evaluacionDe(extra?: Record<string, string | number>) {
  const n = Number(extra?.["Evaluación"]);

  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function analisisDe(extra?: Record<string, string | number>) {
  return String(extra?.["Análisis Post"] ?? "").trim();
}

export function ValoracionTarea({
  extra,
  opciones = ANALISIS_POST,
  onCambia,
  compacta = false,
}: {
  extra?: Record<string, string | number>;
  opciones?: string[];
  /** Devuelve el `extra` entero ya cambiado. */
  onCambia: (extra: Record<string, string | number>) => void;
  compacta?: boolean;
}) {
  const nota = evaluacionDe(extra);
  const analisis = analisisDe(extra);
  const lista = analisis && !opciones.includes(analisis) ? [analisis, ...opciones] : opciones;

  const pon = (cambio: Record<string, string | number>) => onCambia({ ...(extra ?? {}), ...cambio });

  return (
    <div className={`grid gap-2 ${compacta ? "" : "md:grid-cols-[1fr_260px]"} md:items-end`}>
      <div className="min-w-0">
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Evaluación (1-10)</span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Evaluación de la tarea">
          {NOTAS.map((n) => {
            const activa = nota === n;

            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => pon({ "Evaluación": activa ? "" : n })}
                title={activa ? "Quitar la nota" : `Nota ${n}`}
                className={`h-8 w-8 rounded-lg border text-xs font-semibold tabular-nums transition ${activa ? "text-[#0B0F14]" : "border-white/10 text-white/55 hover:border-white/30 hover:text-white"}`}
                style={activa ? { background: colorNota(n), borderColor: colorNota(n) } : undefined}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Análisis post</span>
        <select
          value={analisis}
          onChange={(e) => pon({ "Análisis Post": e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
        >
          <option value="" className="bg-[#11161C]">Sin marcar</option>
          {lista.map((o) => (
            <option key={o} value={o} className="bg-[#11161C]">
              {o}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
