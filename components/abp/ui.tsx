"use client";

/**
 * Piezas compartidas de las páginas de ABP.
 *
 * Las cuatro páginas de balón parado habían crecido cada una por su lado: una
 * abría con cinco desplegables sin etiqueta y otra con dieciocho, y las
 * tarjetas de cabecera no se parecían entre sí. Todo eso vive aquí para que
 * las páginas se lean igual y se arreglen una sola vez.
 */

import { ChevronDown, Info } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useId, useState } from "react";

/* ------------------------------------------------------------------ */
/*  CABECERA                                                           */
/* ------------------------------------------------------------------ */

export function AbpHeader({
  area,
  title,
  lead,
  aside,
}: {
  area: string;
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#C8A96B] sm:text-[11px]">
            {area}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
        </div>

        {aside}
      </div>

      {lead && (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
          {lead}
        </p>
      )}

      <div className="mt-5 h-px bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTENEDORES                                                       */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}: {
  title?: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <Icon size={15} className="shrink-0 text-[#C8A96B]" />}

            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">
                {title}
              </h2>

              {subtitle && (
                <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                  {subtitle}
                </p>
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

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
      <p className="text-sm font-medium text-white/60">{title}</p>

      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-white/35">
          {description}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  INDICADORES                                                        */
/* ------------------------------------------------------------------ */

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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <p
        className="mt-1.5 truncate text-2xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>

      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-white/35">{hint}</p>
      )}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {children}
    </div>
  );
}

/**
 * Barra de proporción. Se usa para comparar volumen o peligro entre filas sin
 * montar una gráfica: en una tabla de ocho tipos de ABP se lee antes.
 */
export function Meter({
  value,
  max,
  color = "#C8A96B",
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <span
      className="flex h-1.5 w-full min-w-[48px] overflow-hidden rounded-full bg-white/[0.08]"
      role="img"
      aria-label={label}
    >
      <span
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  ORIGEN DEL DATO                                                    */
/* ------------------------------------------------------------------ */

/**
 * Distintivo de procedencia. En ABP rival importa mucho: no es lo mismo un
 * dato observado en sus partidos que uno deducido de lo que hizo contra
 * nosotros, y quien lee la página tiene que saberlo sin preguntar.
 */
export function SourceBadge({
  tone,
  children,
}: {
  tone: "scout" | "derivado";
  children: ReactNode;
}) {
  const styles =
    tone === "scout"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : "border-amber-400/30 bg-amber-400/10 text-amber-300";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children?: ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-amber-400/25 bg-amber-400/[0.07]"
      : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3.5 ${styles}`}>
      <Info size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />

      <div className="min-w-0">
        <p className="text-sm font-medium text-white/85">{title}</p>

        {children && (
          <div className="mt-1 text-[12px] leading-relaxed text-white/50">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTROLES                                                          */
/* ------------------------------------------------------------------ */

/**
 * Grupo de filtros plegable.
 *
 * El motivo de existir: la página de saques de banda abría con dieciocho
 * desplegables ocupando la primera pantalla entera. Plegados por defecto, el
 * contenido empieza arriba y el recuento de filtros activos evita que alguien
 * lea una gráfica filtrada sin darse cuenta.
 */
export function FilterDrawer({
  activeCount,
  summary,
  children,
  defaultOpen = false,
}: {
  activeCount: number;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="text-sm font-medium text-white">Filtros</span>

          {activeCount > 0 ? (
            <span className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#C8A96B]">
              {activeCount} activo{activeCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="truncate text-[11px] text-white/35">
              {summary ?? "Sin filtrar"}
            </span>
          )}
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-white/40 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3 xl:grid-cols-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Una opción suelta vale como valor y etiqueta a la vez. */
export type SelectOption = string | { value: string; label: string };

/** Desplegable con etiqueta visible: sin ella no se sabe qué filtra. */
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();

  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
      >
        {normalized.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#11161C]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Conmutador de dos o más vistas; sustituye a un desplegable de 2 opciones. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 scrollbar-none"
    >
      {options.map((option) => {
        const active = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-[#C8A96B] text-black"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selector horizontal de equipo: más rápido que abrir un desplegable. */
export function TeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: string[];
  value: string;
  onChange: (team: string) => void;
}) {
  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
      {teams.map((team) => {
        const active = team === value;

        return (
          <button
            key={team}
            type="button"
            onClick={() => onChange(team)}
            aria-pressed={active}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              active
                ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
                : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            {team}
          </button>
        );
      })}
    </div>
  );
}
