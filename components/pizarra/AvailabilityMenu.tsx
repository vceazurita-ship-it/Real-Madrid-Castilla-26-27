"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  REASON_LABEL,
  REASON_SHORT,
  REASON_STATUS,
  UNAVAILABLE_REASONS,
  useAvailability,
  type UnavailableReason,
} from "@/context/AvailabilityContext";
import { statusTheme } from "@/lib/session-board/status";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
  /** Nombre para el `aria-label`, que si no sólo dice "Disponible". */
  playerName: string;
  /** `compact` cabe en la ficha del campo; `full` es el de la plantilla. */
  size?: "compact" | "full";
}

/**
 * Interruptor de disponibilidad: un clic la quita o la devuelve, y el
 * desplegable permite matizar el motivo de la baja.
 */
export default function AvailabilityMenu({
  playerId,
  playerName,
  size = "full",
}: Props) {
  const { reasonFor, setReason } = useAvailability();
  const [open, setOpen] = useState(false);

  const wrapper = useRef<HTMLDivElement>(null);

  const reason = reasonFor(playerId);
  const available = reason === null;

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const theme = statusTheme(reason ? REASON_STATUS[reason] : "DISPONIBLE");

  const choose = (next: UnavailableReason | null) => {
    setReason(playerId, next);
    setOpen(false);
  };

  return (
    <div ref={wrapper} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Disponibilidad de ${playerName}: ${
          available ? "disponible" : REASON_LABEL[reason]
        }`}
        title={
          available
            ? "Disponible · pulsa para marcar una baja"
            : `${REASON_LABEL[reason]} · pulsa para cambiar`
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide transition",
          theme.chip,
          "hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]",
          size === "compact"
            ? "px-1.5 py-[1px] text-[8px]"
            : "px-2 py-[3px] text-[10px]"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", theme.dot)} />
        {available ? "OK" : REASON_SHORT[reason]}
        <ChevronDown size={size === "compact" ? 9 : 11} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#141B24] p-1 shadow-2xl"
        >
          <MenuItem
            label="Disponible"
            active={available}
            dot="bg-emerald-400"
            onSelect={() => choose(null)}
          />

          <div className="my-1 border-t border-white/10" />

          {UNAVAILABLE_REASONS.map((option) => (
            <MenuItem
              key={option}
              label={REASON_LABEL[option]}
              active={reason === option}
              dot={statusTheme(REASON_STATUS[option]).dot}
              onSelect={() => choose(option)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  active,
  dot,
  onSelect,
}: {
  label: string;
  active: boolean;
  dot: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition",
        active ? "bg-[#C8A96B]/15 text-white" : "text-white/70 hover:bg-white/5"
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      <span className="flex-1 truncate">{label}</span>
      {active && <Check size={13} className="text-[#C8A96B]" />}
    </button>
  );
}
