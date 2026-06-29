"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Player } from "@/types/player";

interface Props {
  player: Player;
}

export default function MicroPlayer({
  player,
}: Props) {
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
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  const disponible =
    player.estado === "DISPONIBLE";

  const licenciaColor =
    player.licencia === "RMCF Castilla"
      ? "bg-emerald-600"
      : player.licencia === "RMC"
      ? "bg-blue-600"
      : "bg-orange-600";

  const estadoColor =
    player.estado === "LESIONADO"
      ? "bg-red-600"
      : player.estado === "PRIMER EQUIPO"
      ? "bg-indigo-600"
      : player.estado === "SELECCIÓN"
      ? "bg-green-600"
      : player.estado === "SANCIONADO"
      ? "bg-yellow-600"
      : "bg-gray-600";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="
        flex
        flex-col
        items-center
        cursor-grab
        active:cursor-grabbing
        touch-none
        select-none
      "
    >
      <div className="relative">

        <Image
          src={player.foto}
          alt={player.nombre}
          width={68}
          height={68}
          unoptimized
          draggable={false}
          className={`
            rounded-full
            border-[3px]
            border-[#C8A96B]
            object-cover
            shadow-[0_0_18px_rgba(200,169,107,.35)]
            transition-all

            ${
              disponible
                ? ""
                : "grayscale opacity-50"
            }
          `}
        />

        {/* Licencia */}

        {player.licencia !==
          "RMCF Castilla" && (
          <span
            className={`
              absolute
              -bottom-2
              left-1/2
              -translate-x-1/2
              rounded-full
              px-2
              py-[2px]
              text-[9px]
              font-bold
              text-white
              ${licenciaColor}
            `}
          >
            {player.licencia}
          </span>
        )}
      </div>

      <div className="mt-3 text-center">

        <div className="text-[11px] font-semibold text-white">
          {player.nombre}
        </div>

        {!disponible && (
          <span
            className={`
              mt-1
              inline-block
              rounded-full
              px-2
              py-[2px]
              text-[9px]
              font-bold
              text-white
              ${estadoColor}
            `}
          >
            {player.estado}
          </span>
        )}

      </div>
    </div>
  );
}