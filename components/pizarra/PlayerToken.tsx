"use client";

import Image from "next/image";
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
  } = useDraggable({
    id: player.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

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
      hover:bg-zinc-700
      transition
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