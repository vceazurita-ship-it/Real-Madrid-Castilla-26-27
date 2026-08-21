"use client";

/**
 * Piezas compartidas por las páginas de conocimiento
 * (team-values, game-model, identidad-posicional).
 *
 * Todas siguen el lenguaje visual RMCF: fondo #0B0F14, oro #C8A96B,
 * tarjetas de cristal y foco visible siempre en oro.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  Check,
  Inbox,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const GOLD = "#C8A96B";

/** Anillo de foco consistente en toda la sección. */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F14]";

/* ------------------------------------------------------------------ texto */

/**
 * Normaliza acentos y mayúsculas conservando la longitud de la cadena,
 * para poder buscar "tactica" y resaltar "táctica" en el texto original.
 */
export function fold(value: string) {
  return Array.from(value)
    .map((char) => {
      const stripped = char
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      return stripped.length === char.length ? stripped : char.toLowerCase();
    })
    .join("");
}

/** ¿Alguno de los campos contiene la búsqueda (sin acentos ni mayúsculas)? */
export function matches(query: string, ...fields: (string | undefined)[]) {
  const needle = fold(query.trim());
  if (!needle) return true;

  return fields.some((field) => fold(field ?? "").includes(needle));
}

/** Resalta las coincidencias de `query` dentro de `text`. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = fold(query.trim());

  if (!needle) return <>{text}</>;

  const haystack = fold(text);
  const nodes: ReactNode[] = [];

  let cursor = 0;
  let found = haystack.indexOf(needle, cursor);

  while (found !== -1) {
    if (found > cursor) nodes.push(text.slice(cursor, found));

    nodes.push(
      <mark
        key={`${found}-${nodes.length}`}
        className="rounded bg-[#C8A96B]/30 px-0.5 text-[#F2E2C0]"
      >
        {text.slice(found, found + needle.length)}
      </mark>,
    );

    cursor = found + needle.length;
    found = haystack.indexOf(needle, cursor);
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}

/* ------------------------------------------------------------------ estados */

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />
  );
}

export function LoadingState({
  rows = 4,
  label = "Cargando contenidos…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/10" />

            <div className="flex-1 space-y-3 py-1">
              <div className="h-3 w-1/3 rounded-full bg-white/10" />
              <div className="h-3 w-full rounded-full bg-white/[0.06]" />
              <div className="h-3 w-4/5 rounded-full bg-white/[0.06]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6 text-center"
    >
      <TriangleAlert className="mx-auto h-8 w-8 text-red-400" aria-hidden />

      <p className="mt-4 font-semibold text-white">
        No se han podido cargar los datos
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{message}</p>

      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={cn(
          "mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60",
          focusRing,
        )}
      >
        {retrying ? <Spinner /> : <RotateCcw className="h-4 w-4" aria-hidden />}
        Reintentar
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-gray-500">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>

      <p className="mt-4 font-semibold text-white">{title}</p>

      {hint && (
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">{hint}</p>
      )}

      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
};

/** Textarea que crece con el contenido: nunca recorta lo escrito. */
export function AutoTextarea({
  minRows = 3,
  className,
  value,
  ...props
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={cn(
        "w-full resize-none overflow-hidden rounded-xl border border-white/10 bg-black/40 p-3 text-sm leading-relaxed text-white transition-colors placeholder:text-gray-600 hover:border-white/20 focus:border-[#C8A96B]/60 lg:text-base",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        aria-hidden
      />

      <input
        type="text"
        value={value}
        aria-label={label ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-9 text-sm text-white transition-colors placeholder:text-gray-500 hover:border-white/20 focus:border-[#C8A96B]/60",
          focusRing,
        )}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white",
            focusRing,
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ navegación */

/** Botón de la lista lateral (sección / posición / bloque) con contador. */
export function NavButton({
  active,
  onClick,
  label,
  count,
  sublabel,
  dimmed,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  sublabel?: string;
  dimmed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex w-full shrink-0 snap-start items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all",
        "min-w-[150px] lg:min-w-0",
        focusRing,
        active
          ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
          : "border border-white/10 text-gray-200 hover:border-[#C8A96B]/40 hover:bg-white/[0.04] hover:text-white",
        dimmed && !active && "opacity-40",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>

        {sublabel && (
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px]",
              active ? "text-black/60" : "text-gray-500",
            )}
          >
            {sublabel}
          </span>
        )}
      </span>

      {count !== undefined && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-black/15 text-black" : "bg-white/[0.07] text-gray-400",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ edición */

/**
 * Barra Editar / Guardar / Descartar con contador de cambios pendientes
 * y estado de guardado. Evita el doble envío y el guardado en vacío.
 */
export function EditToolbar({
  editing,
  dirtyCount,
  saving,
  onEdit,
  onCancel,
  onSave,
  extra,
}: {
  editing: boolean;
  dirtyCount: number;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  extra?: ReactNode;
}) {
  if (!editing) {
    return (
      <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
        {extra}

        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/60 px-4 py-2.5 text-sm font-medium text-[#C8A96B] transition-colors hover:bg-[#C8A96B]/10 lg:flex-none",
            focusRing,
          )}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
      <span
        aria-live="polite"
        className={cn(
          "order-last w-full rounded-full px-3 py-1 text-center text-xs font-medium lg:order-first lg:w-auto",
          dirtyCount > 0
            ? "bg-[#C8A96B]/15 text-[#C8A96B]"
            : "bg-white/[0.05] text-gray-500",
        )}
      >
        {dirtyCount > 0
          ? `${dirtyCount} cambio${dirtyCount === 1 ? "" : "s"} sin guardar`
          : "Sin cambios"}
      </span>

      {extra}

      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50 lg:flex-none",
          focusRing,
        )}
      >
        <X className="h-4 w-4" aria-hidden />
        {dirtyCount > 0 ? "Descartar" : "Salir"}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || dirtyCount === 0}
        title="Guardar (Ctrl+S)"
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#d8bd85] disabled:cursor-not-allowed disabled:opacity-40 lg:flex-none",
          focusRing,
        )}
      >
        {saving ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />}
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ modales */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#11161D] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:rounded-3xl sm:p-8",
          size === "sm" ? "sm:max-w-md" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>

            {description && (
              <p className="mt-2 text-sm text-gray-400">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              "shrink-0 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white",
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {children && <div className="mt-6">{children}</div>}

        {footer && (
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  busy,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cn(
              "rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50",
              focusRing,
            )}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
              destructive
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-[#C8A96B] text-black hover:bg-[#d8bd85]",
              focusRing,
            )}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ hooks */

/** Avisa antes de cerrar la pestaña si quedan cambios sin guardar. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Ctrl/Cmd+S guarda, Escape sale del modo edición. */
export function useEditShortcuts({
  editing,
  onSave,
  onCancel,
}: {
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!editing) return;

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      if (e.key === "Escape") {
        // Si hay un modal abierto, Escape le pertenece a él.
        if (document.querySelector("[role='dialog']")) return;

        onCancel();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onSave, onCancel]);
}
