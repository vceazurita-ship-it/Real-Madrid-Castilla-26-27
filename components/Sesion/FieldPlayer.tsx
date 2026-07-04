"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMicroLineup } from "@/context/MicroLineupContext";
import { EstadoJugador } from "@/types/player";

interface Props {
  id: string;
  positionId: string;
  nombre: string;
  estado?: EstadoJugador;
}

export default function SessionFieldPlayer({
  id,
  positionId,
  nombre,
  estado = "ÓPTIMO",
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `field-${id}`,
  });

  const {
    selectedPlayer,
    assignPlayer,
    setSelectedPlayer,
    removePlayer,
  } = useMicroLineup();

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  function borderColor() {
    switch (estado) {
      case "ÓPTIMO":
        return "border-emerald-500";

      case "CONTROL DE CARGA":
        return "border-yellow-400";

      case "TOCADO":
        return "border-orange-500";

      case "REINCORPORACIÓN":
        return "border-sky-500";

      case "SANCIONADO":
        return "border-red-500";

      default:
        return "border-[#C8A96B]";
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      title="Doble clic para quitar"
      onDoubleClick={(e) => {
        e.stopPropagation();
        removePlayer(id);
      }}
      onClick={(e) => {
        e.stopPropagation();

        if (!selectedPlayer) return;

        assignPlayer(positionId, selectedPlayer.id);
        setSelectedPlayer(null);
      }}
      className="touch-none select-none"
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing"
      >
        <div
          className={`
            min-w-[92px]
            rounded-xl
            border-2
            ${borderColor()}
            bg-black/75
            px-3
            py-2

            text-center
            text-[11px]
            font-semibold
            text-white

            backdrop-blur-md
            shadow-lg

            transition-all
            duration-200

            hover:scale-105
          `}
        >
          {nombre}
        </div>
      </div>
    </div>
  );
}