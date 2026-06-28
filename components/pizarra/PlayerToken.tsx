"use client";

import Image from "next/image";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";

import { Player } from "@/types/player";

interface Props {
  player: Player;
}

export default function PlayerToken({ player }: Props) {
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
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="
        cursor-grab
        active:cursor-grabbing
        rounded-xl
        bg-zinc-800
        p-3
        transition-all
        duration-200
        hover:bg-zinc-700
        hover:scale-[1.02]
        select-none
        shadow-md
      "
    >
      <div className="flex items-center gap-3">

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

        </div>

      </div>
    </div>
  );
}