"use client";

import { useState } from "react";
import { Minus, Plus, SlashIcon } from "lucide-react";

import { ratingColor } from "@/lib/ratings/compute";
import { RATING_MAX, RATING_STEP, clampRating } from "@/lib/ratings/types";

/**
 * Control de nota 0-10 en pasos de 0,5.
 *
 * Tres formas de poner la misma nota, porque cada una gana en un sitio:
 * escribirla (lo más rápido con teclado), arrastrar la barra (móvil) y los
 * botones ± para afinar medio punto sin depender del pulso.
 *
 * Con `onUnrated` aparece además el botón **S/V**: dejar a alguien sin valorar
 * a propósito —tres minutos de revulsivo, un partido que no da para juzgarle—.
 * No es lo mismo que la casilla vacía: la vacía está por rellenar y ésta es una
 * decisión tomada, y por eso apaga el control entero en vez de poner un cero.
 */
export function RatingSlider({
  value,
  onChange,
  label,
  compact = false,
  unrated = false,
  onUnrated,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  compact?: boolean;
  /** Marcado como «sin valorar» a propósito. */
  unrated?: boolean;
  /** Sin esto no se pinta el botón: las notas por área no lo llevan. */
  onUnrated?: (unrated: boolean) => void;
}) {
  const color = ratingColor(value);

  /* Mientras se escribe manda el texto crudo: si no, "7," se comería la coma. */
  const [typing, setTyping] = useState<string | null>(null);

  const shown = unrated
    ? ""
    : typing ?? (value > 0 ? value.toFixed(1).replace(".", ",") : "");

  const step = (delta: number) => onChange(clampRating(value + delta));

  const commit = (raw: string) => {
    setTyping(null);

    const parsed = Number(raw.replace(",", ".").trim());

    onChange(Number.isFinite(parsed) ? clampRating(parsed) : 0);
  };

  const percent = unrated ? 0 : (value / RATING_MAX) * 100;

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
          disabled={unrated || value <= 0}
          aria-label={label ? `Bajar ${label}` : "Bajar nota"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/45"
        >
          <Minus size={13} />
        </button>

        <input
          type="text"
          inputMode="decimal"
          value={shown}
          placeholder={unrated ? "S/V" : "—"}
          disabled={unrated}
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
          className={`shrink-0 rounded-lg border border-transparent bg-transparent text-center font-semibold tabular-nums outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#C8A96B]/70 focus:bg-black/40 ${compact ? "w-11 py-0.5 text-sm" : "w-14 py-0.5 text-xl"} ${
            unrated
              ? "cursor-default placeholder:text-white/45 hover:border-transparent"
              : ""
          }`}
          style={{ color: !unrated && value > 0 ? color : undefined }}
        />

        <button
          type="button"
          onClick={() => step(RATING_STEP)}
          disabled={unrated || value >= RATING_MAX}
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
          value={unrated ? 0 : value}
          disabled={unrated}
          onChange={(event) => onChange(clampRating(Number(event.target.value)))}
          aria-label={label ? `${label} (barra)` : "Nota (barra)"}
          className="h-1.5 min-w-0 flex-1 cursor-pointer disabled:cursor-default appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, rgba(255,255,255,0.08) ${percent}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />

        {onUnrated && (
          <button
            type="button"
            onClick={() => onUnrated(!unrated)}
            aria-pressed={unrated}
            title={
              unrated
                ? "Quitar «sin valorar» y poder poner nota"
                : "Sin valorar: jugó unos minutos residuales y no se le pone nota"
            }
            className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              unrated
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]"
                : "border-white/10 text-white/30 hover:border-white/30 hover:text-white/70"
            }`}
          >
            <SlashIcon size={11} />
            S/V
          </button>
        )}
      </div>
    </div>
  );
}
