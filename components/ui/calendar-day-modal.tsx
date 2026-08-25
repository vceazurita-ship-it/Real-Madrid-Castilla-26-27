"use client";

import { ReactNode, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatLongDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

type CalendarDayModalProps = {
  date: Date;
  subtitle?: ReactNode;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  /** Desactiva Esc y flechas (por ejemplo con un visor a pantalla completa encima). */
  keyboardEnabled?: boolean;
  /** Ancho máximo del panel. */
  size?: "md" | "lg";
  /** Acciones fijas bajo la cabecera. */
  actions?: ReactNode;
  children: ReactNode;
};

export function CalendarDayModal({
  date,
  subtitle,
  onClose,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  keyboardEnabled = true,
  size = "md",
  actions,
  children,
}: CalendarDayModalProps) {
  // Bloquea el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!keyboardEnabled) return;

    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      const typing =
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (typing) return;

      if (e.key === "ArrowLeft" && onPrev && canPrev) {
        e.preventDefault();
        onPrev();
      }

      if (e.key === "ArrowRight" && onNext && canNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [keyboardEnabled, onClose, onPrev, onNext, canPrev, canNext]);

  return (
    <div
      className="modal-veil fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141B24] shadow-2xl",
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        )}
      >
        {/* Cabecera fija */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#141B24] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {onPrev && (
              <button
                type="button"
                aria-label="Día anterior"
                disabled={!canPrev}
                onClick={onPrev}
                className="shrink-0 rounded-full border border-white/10 p-2 transition hover:border-[#C8A96B] disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold capitalize md:text-2xl">
                {formatLongDate(date)}
              </h2>

              {subtitle && (
                <p className="truncate text-sm text-white/50">{subtitle}</p>
              )}
            </div>

            {onNext && (
              <button
                type="button"
                aria-label="Día siguiente"
                disabled={!canNext}
                onClick={onNext}
                className="shrink-0 rounded-full border border-white/10 p-2 transition hover:border-[#C8A96B] disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/10 p-2 text-white/60 transition hover:border-[#C8A96B] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {actions && (
          <div className="border-b border-white/10 px-6 py-3">{actions}</div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function CalendarEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-[#10151C] px-4 py-8 text-center text-sm text-white/45">
      {children}
    </div>
  );
}
