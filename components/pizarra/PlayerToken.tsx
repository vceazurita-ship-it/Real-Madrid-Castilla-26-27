"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Player } from "@/types/player";
import StatusBadge from "./StatusBadge";

interface PlayerTokenProps {
  player: Player;
}

export default function PlayerToken({
  player,
}: PlayerTokenProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: player.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="
        flex
        w-56
        cursor-grab
        items-center
        gap-3
        rounded-xl
        border
        border-white/10
        bg-zinc-800
        p-3
        shadow-lg
        transition
        hover:bg-zinc-700
        active:cursor-grabbing
        select-none
      "
    >
      <Image
        src={player.foto}
        alt={player.nombre}
        width={48}
        height={48}
        className="rounded-full border border-white/20 object-cover"
      />

      <div className="flex-1">

        <div className="font-semibold text-white">
          {player.nombre}
        </div>

        <div className="text-xs text-zinc-400">
          {player.posicion}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <StatusBadge estado={player.estado} />

          <span className="rounded bg-white/10 px-2 py-1 text-[10px] text-white">
            {player.licencia}
          </span>
        </div>

      </div>
    </div>
  );
}