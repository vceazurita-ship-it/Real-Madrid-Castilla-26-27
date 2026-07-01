"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMicroLineup } from "@/context/MicroLineupContext";
import { EstadoJugador } from "@/types/player";

interface Props {
  id: string;
  positionId: string;
  foto: string;
  nombre: string;
  licencia: string;
  mobile: boolean;
  estado?: EstadoJugador;
  showName?: boolean;
}

export default function FieldPlayer({
  id,
  positionId,
  foto,
  nombre,
  licencia,
  mobile,
  estado = "DISPONIBLE",
  showName = true,
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
}  = useMicroLineup();

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  const disabled =
    estado === "LESIONADO" ||
    estado === "PRIMER EQUIPO" ||
    estado === "SELECCIÓN";

  function estadoColor() {
    switch (estado) {
      case "LESIONADO":
        return "bg-red-600 border-red-300";

      case "PRIMER EQUIPO":
        return "bg-slate-700 border-slate-300";

      case "SELECCIÓN":
        return "bg-green-600 border-green-300";

      default:
        return "";
    }
  }

  function licenciaColor() {
    switch (licencia) {
      case "RMC":
        return "bg-blue-600 border-blue-300";

      case "JUV A":
        return "bg-purple-600 border-purple-300";

      default:
        return "bg-[#C8A96B] border-[#E2C38C]";
    }
  }

  return (
   <div
  ref={setNodeRef}
  style={style}
  title="Doble clic para quitar del campo"
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
      <div className="flex flex-col items-center">

        <div
          {...listeners}
          {...attributes}
          className="relative cursor-grab active:cursor-grabbing"
        >

          {/* LICENCIA */}
          {licencia !== "RMCF Castilla" && (
            <div
              className={`
                absolute
                -top-1
                -right-1
                z-30
                rounded-full
                border
                px-2
                py-[2px]
                text-[8px]
                font-bold
                leading-none
                text-white
                shadow-lg
                ${licenciaColor()}
              `}
            >
              {licencia}
            </div>
          )}

          {/* ESTADO */}
          {disabled && (
            <div
              className={`
                absolute
                -bottom-1
                left-1/2
                -translate-x-1/2
                z-30
                rounded-full
                border
                px-2
                py-[2px]
                text-[8px]
                font-bold
                leading-none
                text-white
                shadow-lg
                ${estadoColor()}
              `}
            >
              {estado === "LESIONADO"
                ? "LES"
                : estado === "PRIMER EQUIPO"
                ? "1º"
                : "SEL"}
            </div>
          )}

          <Image
            src={foto}
            alt={nombre}
            width={mobile ? 48 : 66}
            height={mobile ? 48 : 66}
            unoptimized
            draggable={false}
            className={`
              rounded-full
              border-[3px]
              border-[#C8A96B]
              object-cover
              shadow-[0_0_22px_rgba(200,169,107,.45)]
              transition-all
              duration-300
              hover:scale-110

              ${
                disabled
                  ? "grayscale opacity-55"
                  : ""
              }
            `}
          />

        </div>

        {showName && (
  <div
    className={`
      mt-2
      rounded-full
      border
      border-[#C8A96B]/40
      bg-black/70
      backdrop-blur-md
      px-3
      py-1
      font-semibold
      whitespace-nowrap
      ${
        disabled
          ? "text-white/60"
          : "text-white"
      }
      ${mobile ? "text-[9px]" : "text-[11px]"}
    `}
  >
    {nombre}
  </div>
)}

      </div>
    </div>
  );
}