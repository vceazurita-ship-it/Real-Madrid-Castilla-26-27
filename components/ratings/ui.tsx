"use client";

import type { ComponentType, ReactNode } from "react";

import {
  formatRating,
  ratingColor,
  ratingColorAlpha,
} from "@/lib/ratings/compute";

export const GOLD = "#C8A96B";

/* ------------------------------------------------------------------ */
/*  CONTENEDORES                                                       */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  className = "",
  bodyClassName = "p-4 sm:p-5",
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <Icon size={15} className="shrink-0 text-[#C8A96B]" />}

            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">
                {title}
              </h3>

              {subtitle && (
                <p className="truncate text-[11px] text-white/35">{subtitle}</p>
              )}
            </div>
          </div>

          {action}
        </header>
      )}

      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3.5">
      <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>

      <p
        className="mt-1.5 truncate text-2xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>

      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-white/30">{hint}</p>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      {Icon && <Icon size={26} className="text-white/20" />}

      <div>
        <p className="text-sm font-medium text-white/70">{title}</p>

        {description && (
          <p className="mx-auto mt-1 max-w-md text-xs text-white/35">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NOTAS                                                              */
/* ------------------------------------------------------------------ */

/** Píldora con la nota, coloreada por tramos. */
export function RatingBadge({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  const color = ratingColor(value);

  const dimensions =
    size === "lg"
      ? "h-11 min-w-[3rem] text-lg"
      : size === "sm"
        ? "h-6 min-w-[2rem] text-[11px]"
        : "h-8 min-w-[2.5rem] text-sm";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border px-2 font-semibold tabular-nums ${dimensions}`}
      style={{
        color,
        borderColor: ratingColorAlpha(value, 33),
        backgroundColor: ratingColorAlpha(value, 10),
      }}
    >
      {formatRating(value)}
    </span>
  );
}

/** Barra 0-10 para comparar de un vistazo dentro de una tabla. */
export function RatingBar({ value }: { value: number }) {
  const color = ratingColor(value);

  return (
    <span className="flex h-1.5 w-full min-w-[52px] overflow-hidden rounded-full bg-white/[0.06]">
      <span
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(0, Math.min(100, value * 10))}%`,
          backgroundColor: color,
        }}
      />
    </span>
  );
}

export function TrendPill({ value }: { value: number }) {
  if (!value) {
    return <span className="text-[11px] tabular-nums text-white/25">—</span>;
  }

  const positive = value > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        positive
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-rose-400/25 bg-rose-400/10 text-rose-300"
      }`}
    >
      {positive ? "▲" : "▼"}
      {Math.abs(value).toFixed(1).replace(".", ",")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTROLES                                                          */
/* ------------------------------------------------------------------ */

export function GoldButton({
  icon: Icon,
  onClick,
  disabled,
  type = "button",
  children,
}: {
  icon?: ComponentType<{ size?: number }>;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2 text-xs font-semibold text-black transition hover:bg-[#d8bc85] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function GhostButton({
  icon: Icon,
  onClick,
  active,
  disabled,
  children,
}: {
  icon?: ComponentType<{ size?: number }>;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-[#C8A96B]"
          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-1">
      {options.map((option) => {
        const active = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              active
                ? "bg-[#C8A96B] text-black"
                : "text-white/45 hover:bg-white/5 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </span>

      {children}

      {hint && (
        <span className="mt-1 block text-[10px] text-white/25">{hint}</span>
      )}
    </label>
  );
}

export const inputClass =
  "w-full min-w-0 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/60";
