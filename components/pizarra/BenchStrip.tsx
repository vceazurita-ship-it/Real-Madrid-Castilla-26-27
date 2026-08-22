"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Users, X } from "lucide-react";
import { useLineup } from "@/context/LineupContext";
import { usePlayers } from "@/hooks/usePlayers";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { REASON_STATUS, useAvailability } from "@/context/AvailabilityContext";
import { statusTheme } from "@/lib/session-board/status";
import type { Player } from "@/types/player";
import { cn } from "@/lib/utils";

/**
 * Banquillo de la convocatoria.
 *
 * Arrastra aquí a un jugador para sentarlo, o desde aquí al campo para
 * meterlo en la alineación.
 */
export default function BenchStrip() {
  const { bench, removeFromBench, clearBench } = useLineup();
  const { players } = usePlayers();

  const { setNodeRef, isOver } = useDroppable({ id: "bench-list" });

  const seated = bench
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-dashed border-white/15 bg-[#11161D] p-3 transition",
        isOver && "border-[#C8A96B]/60 bg-[#C8A96B]/5"
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
          <Users size={13} className="text-[#C8A96B]" />
          Banquillo
        </p>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/55">
            {seated.length}
          </span>

          {seated.length > 0 && (
            <button
              type="button"
              onClick={clearBench}
              className="text-[10px] font-medium text-white/35 transition hover:text-white/75"
            >
              Vaciar
            </button>
          )}
        </div>
      </div>

      {seated.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-white/30">
          Arrastra aquí a los suplentes convocados
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {seated.map((player) => (
            <BenchToken
              key={player.id}
              player={player}
              onRemove={() => removeFromBench(player.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BenchToken({
  player,
  onRemove,
}: {
  player: Player;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `bench-${player.id}` });

  const { reasonFor } = useAvailability();

  const reason = reasonFor(player.id);
  const status = statusTheme(reason ? REASON_STATUS[reason] : "DISPONIBLE");

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-full border border-white/15 bg-[#1A222C] py-1 pl-1 pr-1.5 transition",
        isDragging ? "opacity-40" : "hover:border-[#C8A96B]/50"
      )}
      style={{
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex cursor-grab items-center gap-2 active:cursor-grabbing"
      >
        <span
          className={cn(
            "relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/40 ring-2",
            status.ring
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.foto || PLAYER_PHOTO_FALLBACK}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </span>

        <span className="max-w-[110px] truncate text-xs font-semibold text-white">
          {player.dorsal ? `${player.dorsal} · ` : ""}
          {player.apodo || player.nombre}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        title="Quitar del banquillo"
        className="rounded-full p-1 text-white/30 transition hover:bg-red-500/15 hover:text-red-300"
      >
        <X size={12} />
      </button>
    </div>
  );
}
