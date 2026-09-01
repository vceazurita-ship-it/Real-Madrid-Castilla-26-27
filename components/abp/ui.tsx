"use client";

/**
 * Piezas compartidas de las páginas de ABP.
 *
 * Las cuatro páginas de balón parado habían crecido cada una por su lado: una
 * abría con cinco desplegables sin etiqueta y otra con dieciocho, y las
 * tarjetas de cabecera no se parecían entre sí. Todo eso vive aquí para que
 * las páginas se lean igual y se arreglen una sola vez.
 */

import {
  Check,
  ChevronDown,
  CloudOff,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";

/* ------------------------------------------------------------------ */
/*  CABECERA                                                           */
/* ------------------------------------------------------------------ */

export function AbpHeader({
  area,
  title,
  crest,
  lead,
  aside,
}: {
  area: string;
  title: string;
  /** Escudo del club del que va la página, delante del título. */
  crest?: ReactNode;
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

          <h1 className="mt-2 flex min-w-0 items-center gap-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {crest}
            <span className="min-w-0">{title}</span>
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
  analisis,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}: {
  title?: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  /**
   * La lectura del panel: qué dice lo filtrado frente al global y hacia dónde
   * va. Va **fuera** del cuerpo a propósito, para que un panel con
   * `bodyClassName="p-0"` —una tabla a sangre— no se lleve el pie pegado al
   * borde. Se pasa como prop y no como último hijo porque así ningún panel se
   * queda sin él por descuido al reordenar su contenido.
   */
  analisis?: ReactNode;
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

      {analisis}
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

/** Quita acentos y mayúsculas para que "atletico" encuentre al "Atlético". */
function normalizeTeamText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Selector de equipo con buscador.
 *
 * Era una tira horizontal con la barra de scroll oculta: con veinte rivales de
 * liga los últimos quedaban fuera de pantalla, la rueda del ratón no mueve un
 * contenedor horizontal y no había forma de buscar por nombre, así que a media
 * lista no se llegaba. Ahora los equipos fluyen en varias líneas dentro de una
 * caja que sí scrollea en vertical y encima hay un campo de búsqueda que filtra
 * ignorando acentos; Enter elige la primera coincidencia.
 */
export function TeamPicker({
  teams,
  value,
  onChange,
  countOf,
  escudoDe,
}: {
  teams: string[];
  value: string;
  onChange: (team: string) => void;
  /** Acciones ya registradas del equipo: marca en el chip los que tienen datos. */
  countOf?: (team: string) => number;
  /**
   * Escudo del club, si se conoce. Con diecinueve chips de texto en tres
   * líneas se acaba leyendo nombre por nombre; con el escudo delante el rival
   * de la semana se encuentra de un vistazo. Ver `hooks/useEscudos`.
   */
  escudoDe?: (team: string) => string | undefined;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  /* Con pocos equipos el buscador estorba más de lo que ayuda. */
  const searchable = teams.length > 6;

  const matches = useMemo(() => {
    const needle = normalizeTeamText(query);

    if (!needle) return teams;

    return teams.filter((team) => normalizeTeamText(team).includes(needle));
  }, [teams, query]);

  /* El elegido se pinta siempre, aunque el filtro no lo alcance: si no, al
     escribir se pierde de vista con qué rival se está trabajando. */
  const visible = useMemo(
    () => (value && !matches.includes(value) ? [value, ...matches] : matches),
    [matches, value],
  );

  /* El rival de la semana puede caer en una línea que no se ve al abrir. Se
     mueve la caja a mano, no con `scrollIntoView`, para no arrastrar también
     la página entera si el selector queda fuera de pantalla. */
  useEffect(() => {
    const box = listRef.current;
    const chip = selectedRef.current;

    if (!box || !chip) return;

    const boxRect = box.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();

    if (chipRect.top < boxRect.top || chipRect.bottom > boxRect.bottom) {
      box.scrollTop +=
        chipRect.top - boxRect.top - (boxRect.height - chipRect.height) / 2;
    }
  }, [value]);

  const pickFirstMatch = () => {
    const first = matches[0];

    if (!first) return;

    onChange(first);
    setQuery("");
  };

  return (
    <div className="min-w-0 space-y-2.5">
      {searchable && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              type="text"
              value={query}
              placeholder="Buscar equipo…"
              aria-label="Buscar equipo"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  pickFirstMatch();
                } else if (event.key === "Escape") {
                  setQuery("");
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-8 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar la búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/35 transition hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <span className="text-[11px] tabular-nums text-white/35">
            {query
              ? `${matches.length} de ${teams.length} equipos`
              : `${teams.length} equipos`}
          </span>
        </div>
      )}

      {query && matches.length === 0 && (
        <p className="text-[11px] text-white/40">
          Ningún equipo coincide con «{query}».
        </p>
      )}

      <div
        ref={listRef}
        className="flex max-h-[10.5rem] min-w-0 flex-wrap content-start gap-2 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-2"
      >
        {visible.map((team) => {
          const active = team === value;
          const registradas = countOf?.(team) ?? 0;

          return (
            <button
              key={team}
              ref={active ? selectedRef : undefined}
              type="button"
              onClick={() => onChange(team)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
              }`}
            >
              {escudoDe && (
                <EscudoEquipo nombre={team} escudo={escudoDe(team)} lado={18} />
              )}

              {team}

              {registradas > 0 && (
                <span
                  title={`${registradas} acciones registradas`}
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    active
                      ? "bg-[#C8A96B]/25 text-[#C8A96B]"
                      : "bg-emerald-400/15 text-emerald-300"
                  }`}
                >
                  {registradas}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FORMULARIO                                                         */
/* ------------------------------------------------------------------ */

/**
 * Campo de texto con la misma etiqueta y el mismo marco que `Select`.
 *
 * `suggestions` monta un `datalist`: sugiere sin cerrar la puerta a escribir
 * otra cosa, que es lo que hace falta para el sacador o el rematador —la
 * plantilla ayuda, pero a veces remata alguien que no está en la lista—.
 */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  hint?: string;
  suggestions?: string[];
}) {
  const id = useId();
  const listId = `${id}-list`;

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        list={suggestions?.length ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />

      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}

      {hint && <span className="mt-1 block text-[10px] text-white/30">{hint}</span>}
    </label>
  );
}

/** Área de texto para la observación libre de una acción. */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />
    </label>
  );
}

export function Button({
  children,
  onClick,
  tone = "ghost",
  type = "button",
  disabled,
  icon: Icon,
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  icon?: ComponentType<{ size?: number; className?: string }>;
  title?: string;
}) {
  const styles = {
    primary:
      "border-[#C8A96B] bg-[#C8A96B] text-black hover:bg-[#d8bc82] disabled:bg-[#C8A96B]/40",
    ghost:
      "border-white/12 text-white/70 hover:border-white/25 hover:text-white",
    danger:
      "border-red-400/30 text-red-300/80 hover:border-red-400/60 hover:text-red-300",
  }[tone];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DIÁLOGO                                                            */
/* ------------------------------------------------------------------ */

/**
 * Panel modal para editar una acción.
 *
 * Cierra con Escape salvo que el foco esté dentro de un campo, donde Escape
 * suele significar «descartar lo que estoy escribiendo» y perder el formulario
 * entero sería peor que no cerrar.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const target = event.target as HTMLElement | null;

      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (!typing) onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="modal-veil fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#11161C] shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{title}</h2>

            {subtitle && (
              <p className="mt-0.5 text-[11px] text-white/40">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ESTADO DE GUARDADO                                                 */
/* ------------------------------------------------------------------ */

/** Qué está pasando con el documento remoto, en una línea discreta. */
export function SaveState({
  status,
  localOnly,
  savedAt,
}: {
  status: "loading" | "saved" | "saving" | "offline" | "error";
  localOnly?: boolean;
  savedAt?: string | null;
}) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
        <Loader2 size={12} className="animate-spin" />
        Guardando…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-300">
        <CloudOff size={12} />
        No se pudo guardar
      </span>
    );
  }

  if (status === "offline" || localOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-300">
        <CloudOff size={12} />
        Sólo en este navegador
      </span>
    );
  }

  if (status === "loading") {
    return <span className="text-[11px] text-white/35">Cargando…</span>;
  }

  const hora = savedAt
    ? new Date(savedAt).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
      <Check size={12} className="text-emerald-400" />
      {hora ? `Guardado ${hora}` : "Guardado"}
    </span>
  );
}
