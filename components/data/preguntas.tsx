"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { METRICA_POR_KEY } from "@/lib/data-analisis/metricas";
import {
  MOMENTOS,
  PREGUNTAS_VALIDAS,
  type Momento,
  type Pregunta,
} from "@/lib/data-analisis/preguntas";

/**
 * La batería de preguntas, en pantalla.
 *
 * Va **al lado** del bloque de dos métricas, no dentro: son dos maneras de
 * llegar al mismo dibujo y ninguna manda sobre la otra. Aquí se elige por
 * momento del juego —con balón, sin balón, las dos transiciones, el balón
 * parado por sus dos lados— y la pregunta rellena los dos ejes de al lado. A
 * partir de ahí se pueden cambiar a mano: en cuanto se toca un selector, la
 * pregunta se apaga y el rótulo lo dice.
 */
export function BateriaDePreguntas({
  activa,
  onElegir,
  /** Se pinta bajo las preguntas: el par que está puesto ahora mismo. */
  metricaX,
  metricaY,
  contraX,
  contraY,
}: {
  activa: string | null;
  onElegir: (pregunta: Pregunta) => void;
  metricaX: string;
  metricaY: string;
  contraX: boolean;
  contraY: boolean;
}) {
  /* Se abre por el momento de la pregunta puesta, si la hay. */
  const [momento, setMomento] = useState<Momento>(
    () => PREGUNTAS_VALIDAS.find((p) => p.key === activa)?.momento ?? "con",
  );

  const suyas = PREGUNTAS_VALIDAS.filter((p) => p.momento === momento);

  const elegida = PREGUNTAS_VALIDAS.find((p) => p.key === activa) ?? null;

  const metX = METRICA_POR_KEY.get(metricaX);
  const metY = METRICA_POR_KEY.get(metricaY);

  return (
    <div className="min-w-0">
      {/* Los seis momentos del juego. */}
      <div className="flex flex-wrap gap-1.5">
        {MOMENTOS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMomento(m.key)}
            aria-pressed={momento === m.key}
            title={m.pregunta}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
              momento === m.key
                ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
            }`}
          >
            {m.corto}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-white/35">
        {MOMENTOS.find((m) => m.key === momento)?.pregunta}
      </p>

      {/* Las preguntas de ese momento. */}
      <div className="mt-3 space-y-1.5">
        {suyas.map((p) => {
          const puesta = p.key === activa;

          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onElegir(p)}
              aria-pressed={puesta}
              className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                puesta
                  ? "border-[#C8A96B]/40 bg-[#C8A96B]/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <HelpCircle
                size={14}
                className={`mt-0.5 shrink-0 ${
                  puesta ? "text-[#C8A96B]" : "text-white/30"
                }`}
              />

              <span
                className={`text-[12.5px] leading-snug ${
                  puesta ? "text-white" : "text-white/65"
                }`}
              >
                {p.texto}
              </span>
            </button>
          );
        })}
      </div>

      {/* El par que está puesto, venga de donde venga. */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          {elegida ? "La contesta este cruce" : "Cruce puesto a mano"}
        </p>

        <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
          <span className="text-white/40">Eje X · </span>
          <strong className="font-semibold text-white/85">
            {metX?.nombre ?? "—"}
          </strong>
          {contraX && <span className="text-[#C8A96B]"> (del rival)</span>}
          <br />
          <span className="text-white/40">Eje Y · </span>
          <strong className="font-semibold text-white/85">
            {metY?.nombre ?? "—"}
          </strong>
          {contraY && <span className="text-[#C8A96B]"> (del rival)</span>}
        </p>

        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11.5px] leading-relaxed text-white/45">
          {elegida
            ? elegida.comoSeLee
            : "Elige una pregunta o cambia los dos selectores del gráfico: los dos caminos llevan al mismo dibujo."}
        </p>
      </div>
    </div>
  );
}
