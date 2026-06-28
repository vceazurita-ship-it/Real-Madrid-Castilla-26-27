"use client";

import Image from "next/image";
import { usePlayers } from "@/hooks/usePlayers";
import { useLineup } from "@/context/LineupContext";
import PitchPosition from "./PitchPosition";
import { formations } from "@/lib/formations";

export default function FootballPitch() {
  const { players } = usePlayers();

  const { lineup, formation } = useLineup();

  const currentFormation =
    formations[formation as keyof typeof formations] ?? [];

  return (
    <div
      className="
        relative
        h-full
        w-full
        overflow-hidden
        rounded-[28px]
        border
        border-[#C8A96B]/20
        shadow-[0_25px_80px_rgba(0,0,0,.45)]
        bg-cover
        bg-center
        bg-no-repeat
      "
      style={{
        backgroundImage: "url('/pizarra-field-bg.png')",
      }}
    >
      {/* Oscurecer ligeramente el fondo */}
      <div className="absolute inset-0 bg-black/35" />

      {/* Viñeta */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.45))]" />

      {/* Campo */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g
          stroke="rgba(255,255,255,.22)"
          strokeWidth="0.35"
          fill="none"
        >
          <rect x="2" y="2" width="96" height="96" />

          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
          />

          <circle
            cx="50"
            cy="50"
            r="8"
          />

          <circle
            cx="50"
            cy="50"
            r="0.7"
            fill="rgba(255,255,255,.25)"
          />

          {/* Arriba */}

          <rect
            x="20"
            y="2"
            width="60"
            height="15"
          />

          <rect
            x="35"
            y="2"
            width="30"
            height="6"
          />

          <path d="M42 17 A8 8 0 0 0 58 17" />

          {/* Abajo */}

          <rect
            x="20"
            y="83"
            width="60"
            height="15"
          />

          <rect
            x="35"
            y="92"
            width="30"
            height="6"
          />

          <path d="M42 83 A8 8 0 0 1 58 83" />
        </g>
      </svg>

      {/* Jugadores */}
      {currentFormation.map((position) => {
        const slot = lineup.find(
          (s) => s.positionId === position.id
        );

        const player = players.find(
          (p) => p.id === slot?.playerId
        );

        return (
          <div
            key={position.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            <PitchPosition id={position.id}>
              {player ? (
                <div className="flex flex-col items-center">

                  <Image
                    src={player.foto}
                    alt={player.nombre}
                    width={66}
                    height={66}
                    unoptimized
                    className="
                      rounded-full
                      border-[3px]
                      border-[#C8A96B]
                      object-cover
                      shadow-[0_0_22px_rgba(200,169,107,.45)]
                      transition-all
                      duration-300
                      hover:scale-110
                    "
                  />

                  <div
                    className="
                      mt-2
                      rounded-full
                      border
                      border-[#C8A96B]/40
                      bg-black/70
                      backdrop-blur-md
                      px-3
                      py-1
                      text-[11px]
                      font-semibold
                      text-white
                      whitespace-nowrap
                    "
                  >
                    {player.nombre}
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center">

                  <div
                    className="
                      flex
                      h-16
                      w-16
                      items-center
                      justify-center
                      rounded-full
                      border-2
                      border-dashed
                      border-[#C8A96B]
                      bg-black/45
                      backdrop-blur-sm
                      shadow-[0_0_18px_rgba(200,169,107,.25)]
                      transition-all
                      duration-300
                      hover:scale-110
                    "
                  >
                    <span className="text-[#C8A96B] text-lg">
                      +
                    </span>
                  </div>

                  <div
                    className="
                      mt-2
                      rounded-full
                      bg-black/60
                      px-3
                      py-1
                      text-[10px]
                      font-semibold
                      tracking-wide
                      text-white/90
                    "
                  >
                    {position.nombre}
                  </div>

                </div>
              )}
            </PitchPosition>
          </div>
        );
      })}
    </div>
  );
}