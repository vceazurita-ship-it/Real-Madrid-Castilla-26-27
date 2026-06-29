"use client";

import Image from "next/image";

import { usePlayers } from "@/hooks/usePlayers";
import { useMicroLineup } from "@/context/MicroLineupContext";

import { microFormation } from "@/lib/microFormation";

import MicroSlot from "./MicroSlot";
import MicroPlayer from "./MicroPlayer";

export default function MicroPitch() {
  const { players } = usePlayers();

  const { lineup } = useMicroLineup();

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-[30px]
        border
        border-[#C8A96B]/20
        bg-[#11161D]
        shadow-[0_30px_80px_rgba(0,0,0,.45)]
        aspect-[9/16]
        w-full
      "
    >
      {/* Fondo */}

      <Image
        src="/emotional-field-bg.png"
        alt="Campo"
        fill
        priority
        unoptimized
        className="object-cover"
      />

      <div className="absolute inset-0 bg-black/30" />

      {/* Posiciones */}

      {microFormation.map((position) => {
        const slot = lineup.find(
          (s) => s.positionId === position.id
        );

        const player = players.find(
          (p) => p.id === slot?.playerId
        );

        return (
          <div
            key={position.id}
            className="
              absolute
              -translate-x-1/2
              -translate-y-1/2
            "
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            <MicroSlot id={position.id}>
              {player ? (
                <MicroPlayer player={player} />
              ) : null}
            </MicroSlot>
          </div>
        );
      })}
    </div>
  );
}