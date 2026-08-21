"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { ratingColor } from "@/lib/ratings/compute";
import { RATING_MAX, RATING_STEP, clampRating } from "@/lib/ratings/types";

/**
 * Control de nota 0-10 en pasos de 0,5.
 *
 * Tres formas de poner la misma nota, porque cada una gana en un sitio:
 * escribirla (lo más rápido con teclado), arrastrar la barra (móvil) y los
 * botones ± para afinar medio punto sin depender del pulso.
 */
export function RatingSlider({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  compact?: boolean;
}) {
  const color = ratingColor(value);

  /* Mientras se escribe manda el texto crudo: si no, "7," se comería la coma. */
  const [typing, setTyping] = useState<string | null>(null);

  const shown = typing ?? (value > 0 ? value.toFixed(1).replace(".", ",") : "");

  const step = (delta: number) => onChange(clampRating(value + delta));

  const commit = (raw: string) => {
    setTyping(null);

    const parsed = Number(raw.replace(",", ".").trim());

    onChange(Number.isFinite(parsed) ? clampRating(parsed) : 0);
  };

  const percent = (value / RATING_MAX) * 100;

  return (
    <div className="min-w-0">
      {label && (
        <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
          {label}
        </p>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => step(-RATING_STEP)}
          disabled={value <= 0}
          aria-label={label ? `Bajar ${label}` : "Bajar nota"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/45"
        >
          <Minus size={13} />
        </button>

        <input
          type="text"
          inputMode="decimal"
          value={shown}
          placeholder="—"
          aria-label={label ?? "Nota"}
          onChange={(event) => setTyping(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setTyping(null);
              event.currentTarget.blur();
            }

            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              setTyping(null);
              step(event.key === "ArrowUp" ? RATING_STEP : -RATING_STEP);
            }
          }}
          className={`shrink-0 rounded-lg border border-transparent bg-transparent text-center font-semibold tabular-nums outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#C8A96B]/70 focus:bg-black/40 ${
            compact ? "w-11 py-0.5 text-sm" : "w-14 py-0.5 text-xl"
          }`}
          style={{ color: value > 0 ? color : undefined }}
        />

        <button
          type="button"
          onClick={() => step(RATING_STEP)}
          disabled={value >= RATING_MAX}
          aria-label={label ? `Subir ${label}` : "Subir nota"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/45"
        >
          <Plus size={13} />
        </button>

        <input
          type="range"
          min={0}
          max={RATING_MAX}
          step={RATING_STEP}
          value={value}
          onChange={(event) => onChange(clampRating(Number(event.target.value)))}
          aria-label={label ? `${label} (barra)` : "Nota (barra)"}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, rgba(255,255,255,0.08) ${percent}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
      </div>
    </div>
  );
}
