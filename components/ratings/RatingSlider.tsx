"use client";

import { Minus, Plus } from "lucide-react";

import { formatRating, ratingColor } from "@/lib/ratings/compute";
import { RATING_MAX, RATING_STEP, clampRating } from "@/lib/ratings/types";

/**
 * Control de nota 0-10 en pasos de 0,5.
 *
 * El número grande manda: la barra sirve para moverse rápido y los botones
 * para afinar sin depender del pulso, que es como se rellena desde el móvil.
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

  const step = (delta: number) => onChange(clampRating(value + delta));

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
          aria-label="Bajar nota"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white"
        >
          <Minus size={13} />
        </button>

        <span
          className={`shrink-0 text-center font-semibold tabular-nums ${
            compact ? "w-9 text-sm" : "w-12 text-xl"
          }`}
          style={{ color }}
        >
          {formatRating(value)}
        </span>

        <button
          type="button"
          onClick={() => step(RATING_STEP)}
          aria-label="Subir nota"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white"
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
          aria-label={label ?? "Nota"}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${
              (value / RATING_MAX) * 100
            }%, rgba(255,255,255,0.08) ${
              (value / RATING_MAX) * 100
            }%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
      </div>
    </div>
  );
}
