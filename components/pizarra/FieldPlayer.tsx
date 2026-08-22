"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { useLineup } from "@/context/LineupContext";
import {
  REASON_SHORT,
  REASON_STATUS,
  useAvailability,
} from "@/context/AvailabilityContext";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { statusTheme } from "@/lib/session-board/status";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  positionId: string;
  foto: string;
  nombre: string;
  licencia: string;
  mobile: boolean;
}

/** Ficha de un jugador ya colocado en el campo. */
export default function FieldPlayer({
  id,
  positionId,
  foto,
  nombre,
  licencia,
  mobile,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `field-${id}` });

  const { selectedPlayer, assignPlayer, setSelectedPlayer, removePlayer } =
    useLineup();

  const { reasonFor } = useAvailability();

  const reason = reasonFor(id);

  const licenciaColor =
    licencia === "RMC"
      ? "bg-blue-600 border-blue-300"
      : licencia === "JUV A"
      ? "bg-purple-600 border-purple-300"
      : "bg-[#C8A96B] border-[#E2C38C]";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 999 : 1,
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        removePlayer(id);
      }}
      onClick={(event) => {
        event.stopPropagation();

        if (!selectedPlayer) return;

        assignPlayer(positionId, selectedPlayer);
        setSelectedPlayer(null);
      }}
      className="group touch-none select-none"
    >
      <div className="flex flex-col items-center">
        <div
          {...listeners}
          {...attributes}
          className="relative cursor-grab active:cursor-grabbing"
        >
          {licencia !== "RMCF Castilla" && (
            <span
              className={cn(
                "absolute -right-1 -top-1 z-30 rounded-full border font-bold leading-none shadow-lg",
                mobile ? "px-1 py-[1px] text-[6px]" : "px-2 py-[2px] text-[8px]",
                licenciaColor
              )}
            >
              {licencia}
            </span>
          )}

          {reason && (
            <span
              className={cn(
                "absolute -bottom-1 left-1/2 z-30 -translate-x-1/2 rounded-full border font-bold leading-none shadow-lg",
                mobile ? "px-1 py-[1px] text-[6px]" : "px-2 py-[2px] text-[8px]",
                statusTheme(REASON_STATUS[reason]).chip
              )}
            >
              {REASON_SHORT[reason]}
            </span>
          )}

          <Image
            src={foto || PLAYER_PHOTO_FALLBACK}
            alt={nombre}
            width={mobile ? 36 : 66}
            height={mobile ? 36 : 66}
            unoptimized
            draggable={false}
            className={cn(
              "rounded-full border-[3px] border-[#C8A96B] object-cover shadow-[0_0_22px_rgba(200,169,107,.45)] transition-all duration-200 hover:scale-110",
              reason && "opacity-55 grayscale"
            )}
          />

          {/* Atajo para liberar la posición sin recordar el doble clic */}
          {!mobile && (
            <button
              type="button"
              aria-label={`Quitar a ${nombre} del campo`}
              title="Quitar del campo"
              onClick={(event) => {
                event.stopPropagation();
                removePlayer(id);
              }}
              className="absolute -left-1 -top-1 z-30 hidden h-5 w-5 items-center justify-center rounded-full border border-red-400/60 bg-[#0B0F14] text-red-300 transition hover:bg-red-500 hover:text-white group-hover:flex"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <div
          className={cn(
            "rounded-full border border-[#C8A96B]/40 bg-black/70 font-semibold whitespace-nowrap backdrop-blur-md",
            reason ? "text-white/60" : "text-white",
            mobile
              ? "mt-1 px-2 py-0.5 text-[8px]"
              : "mt-2 px-3 py-1 text-[11px]"
          )}
        >
          {nombre}
        </div>
      </div>
    </div>
  );
}
