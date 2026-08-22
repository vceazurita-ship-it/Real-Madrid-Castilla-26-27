"use client";

import Image from "next/image";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useLineup } from "@/context/LineupContext";
import { useAvailability } from "@/context/AvailabilityContext";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { Player } from "@/types/player";
import { cn } from "@/lib/utils";
import AvailabilityMenu from "./AvailabilityMenu";

interface Props {
  player: Player;
}

/**
 * Ficha de la plantilla.
 *
 * La foto arrastra al campo y el interruptor de la derecha da de alta o de
 * baja al jugador: la disponibilidad se decide aquí, no viene de la hoja.
 */
export default function PlayerToken({ player }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `bench-${player.id}` });

  const { selectedPlayer, setSelectedPlayer } = useLineup();
  const { isAvailable } = useAvailability();

  const available = isAvailable(player.id);
  const selected = selectedPlayer?.id === player.id;

  const licenciaChip =
    player.licencia === "RMC"
      ? "border-blue-400/40 bg-blue-500/20 text-blue-300"
      : "border-purple-400/40 bg-purple-500/20 text-purple-300";

  return (
    <div
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 999 : 1,
        touchAction: "none",
      }}
      className={cn(
        "group w-[230px] min-w-[230px] shrink-0 select-none rounded-2xl border p-2.5 transition-all duration-200 lg:w-auto lg:min-w-0",
        selected
          ? "border-[#C8A96B] bg-[#1E2630] shadow-[0_0_25px_rgba(200,169,107,.45)]"
          : available
          ? "border-white/10 bg-gradient-to-r from-[#181F27] to-[#10161D] hover:-translate-y-[2px] hover:border-[#C8A96B]/45"
          : "border-white/5 bg-[#14181E]"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Sólo la foto arrastra */}
        <div
          ref={setNodeRef}
          {...(available ? listeners : {})}
          {...(available ? attributes : {})}
          className={cn(
            "relative shrink-0",
            available ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"
          )}
        >
          <Image
            src={player.foto || PLAYER_PHOTO_FALLBACK}
            alt={player.nombre}
            width={46}
            height={46}
            unoptimized
            draggable={false}
            className={cn(
              "h-11 w-11 rounded-full border-2 object-cover shadow-md transition-transform duration-200",
              available
                ? "border-[#C8A96B] group-hover:scale-105"
                : "border-white/20 opacity-45 grayscale"
            )}
          />

          {player.dorsal !== undefined && (
            <span className="absolute -bottom-1 -right-1 rounded-full border border-[#C8A96B]/40 bg-[#0B0F14] px-1.5 text-[9px] font-bold tabular-nums text-[#E2C38C]">
              {player.dorsal}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13px] font-semibold leading-tight",
              available ? "text-white" : "text-white/45"
            )}
          >
            {player.apodo || player.nombre}
          </p>

          {player.apodo && player.apodo !== player.nombre && (
            <p className="truncate text-[10px] leading-tight text-white/35">
              {player.nombre}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide",
                available
                  ? "bg-[#C8A96B]/15 text-[#E2C38C]"
                  : "bg-white/5 text-white/40"
              )}
            >
              {player.posicion}
            </span>

            {player.licencia !== "RMCF Castilla" && (
              <span
                className={cn(
                  "rounded-full border px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide",
                  available ? licenciaChip : "border-white/10 bg-white/5 text-white/40"
                )}
              >
                {player.licencia}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <AvailabilityMenu
            playerId={player.id}
            playerName={player.apodo || player.nombre}
          />

          <button
            type="button"
            disabled={!available}
            aria-label={
              selected
                ? `Cancelar la colocación de ${player.nombre}`
                : `Colocar a ${player.nombre} en el campo`
            }
            title={
              selected
                ? "Pulsa una posición del campo o cancela"
                : "Seleccionar y pulsar una posición del campo"
            }
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPlayer(selected ? null : player);
            }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border transition",
              selected
                ? "border-[#C8A96B] bg-[#C8A96B] text-black"
                : "border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B] hover:bg-[#C8A96B] hover:text-black",
              "disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/25"
            )}
          >
            <Plus size={14} className={cn(selected && "rotate-45")} />
          </button>
        </div>
      </div>
    </div>
  );
}
