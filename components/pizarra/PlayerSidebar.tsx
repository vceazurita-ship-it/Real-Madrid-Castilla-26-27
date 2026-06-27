"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";

import { usePlayers } from "@/hooks/usePlayers";
import StatusBadge from "./StatusBadge";

function DraggablePlayer({ player }: any) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
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
      rounded-xl
      bg-zinc-800
      p-3
      transition
      hover:bg-zinc-700
      active:cursor-grabbing
      cursor-grab
      select-none
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

          <div className="mt-2 flex flex-wrap gap-2">

            <StatusBadge estado={player.estado} />

            <span
              className="
              rounded-full
              bg-white/10
              px-2
              py-1
              text-[10px]
              text-white
              "
            >
              {player.licencia}
            </span>

          </div>

        </div>

      </div>
    </div>
  );
}

export default function PlayerSidebar() {
  const { players } = usePlayers();

  return (
    <div className="h-full overflow-y-auto bg-zinc-900">

      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-900 p-4">

        <h2 className="text-xl font-bold text-white">
          Plantilla
        </h2>

        <p className="text-sm text-zinc-400">
          {players.length} jugadores
        </p>

      </div>

      <div className="space-y-3 p-3">

        {players.map((player) => (
          <DraggablePlayer
            key={player.id}
            player={player}
          />
        ))}

      </div>

    </div>
  );
}