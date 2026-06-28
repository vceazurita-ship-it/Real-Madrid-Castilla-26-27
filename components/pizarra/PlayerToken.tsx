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
  style={{
    ...style,
    touchAction: "none",
  }}
  {...listeners}
  {...attributes}
      className="
        group
        cursor-grab
        active:cursor-grabbing
        select-none
        rounded-2xl
        border
        border-[#C8A96B]/10
        bg-gradient-to-r
        from-[#181F27]
        to-[#10161D]
        p-2.5
        transition-all
        duration-300
        hover:border-[#C8A96B]/45
        hover:shadow-[0_0_22px_rgba(200,169,107,.22)]
        hover:-translate-y-[2px]
      "
    >
      <div className="flex items-center gap-3">

        <Image
          src={player.foto}
          alt={player.nombre}
          width={46}
          height={46}
          unoptimized
          className="
            h-11
            w-11
            rounded-full
            border-2
            border-[#C8A96B]
            object-cover
            shadow-md
            transition-transform
            duration-300
            group-hover:scale-105
          "
        />

        <div className="min-w-0 flex-1">

          <div className="truncate text-[13px] font-semibold text-white">
            {player.nombre}
          </div>

          <div className="mt-0.5 flex items-center gap-2">

            <span
              className="
                rounded-full
                bg-[#C8A96B]/15
                px-2
                py-[2px]
                text-[10px]
                font-semibold
                uppercase
                tracking-wide
                text-[#E2C38C]
              "
            >
              {player.posicion}
            </span>

            {player.dorsal && (
              <span
                className="
                  text-[11px]
                  font-bold
                  text-white/70
                "
              >
                #{player.dorsal}
              </span>
            )}

          </div>

        </div>

        <div
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-full
            border
            border-[#C8A96B]/30
            bg-[#C8A96B]/10
            text-[#C8A96B]
            text-lg
            transition-all
            duration-300
            group-hover:bg-[#C8A96B]
            group-hover:text-black
          "
        >
          +
        </div>

      </div>
    </div>
  );
}