"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "@/types/player";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { bibTheme } from "@/lib/session-board/bibs";
import { statusTheme } from "@/lib/session-board/status";
import type { BibColor } from "@/lib/session-board/types";
import { cn } from "@/lib/utils";

interface Props {
  player: Player;
  /** Peto del equipo en el que está; sin él se pinta neutro. */
  color?: BibColor;
  /** Origen del arrastre: `pool` o el id del equipo. */
  from: string;
  size?: "sm" | "md";
  dimmed?: boolean;
  onClick?: () => void;
  /** Texto del `title` nativo, para explicar el clic. */
  hint?: string;
}

export default function PlayerChip({
  player,
  color,
  from,
  size = "md",
  dimmed = false,
  onClick,
  hint,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `chip:${from}:${player.id}`,
      data: { playerId: player.id, from },
    });

  const status = statusTheme(player.estado);
  const bib = color ? bibTheme(color) : null;

  const small = size === "sm";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      title={hint}
      className={cn(
        "group flex touch-none select-none items-center gap-2 rounded-full border pr-3 shadow-lg transition",
        small ? "py-0.5 pl-0.5" : "py-1 pl-1",
        bib
          ? bib.chip
          : "border-white/15 bg-[#151B23]/90 text-white backdrop-blur",
        dimmed && "opacity-40 grayscale",
        onClick ? "cursor-pointer hover:-translate-y-0.5" : "cursor-grab",
        isDragging && "cursor-grabbing"
      )}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-black/30 ring-2",
          status.ring,
          small ? "h-6 w-6" : "h-8 w-8"
        )}
      >
        {/* Foto remota o local sin optimizar: el chip es pequeño y cambia mucho. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.foto || PLAYER_PHOTO_FALLBACK}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      </span>

      <span
        className={cn(
          "min-w-0 truncate font-semibold",
          small ? "max-w-[86px] text-[10px]" : "max-w-[120px] text-xs"
        )}
      >
        {player.apodo || player.nombre}
      </span>
    </div>
  );
}
