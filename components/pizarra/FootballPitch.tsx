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
    formations[formation as keyof typeof formations];

  return (
    <div
      className="
        relative
        h-full
        w-full
        overflow-hidden
        rounded-[28px]
        bg-gradient-to-b
        from-[#2F7A3F]
        via-[#2A6E39]
        to-[#235E31]
        shadow-[0_0_80px_rgba(0,0,0,.35)]
      "
    >
      {/* Rayas del césped */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0px, transparent 90px, rgba(255,255,255,.05) 90px, rgba(255,255,255,.05) 180px)",
        }}
      />

      {/* Iluminación */}
      <div
        className="
          absolute
          inset-0
          pointer-events-none
          bg-[radial-gradient(circle_at_center,rgba(255,255,255,.10),transparent_70%)]
        "
      />

      {/* Campo */}
      <div
        className="
          absolute
          inset-0
          shadow-[inset_0_0_120px_rgba(0,0,0,.35)]
        "
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="2"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
            stroke="white"
            strokeWidth="0.6"
          />

          <circle
            cx="50"
            cy="50"
            r="8"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <circle
            cx="50"
            cy="50"
            r="1.2"
            fill="white"
          />

          {/* Área superior */}
          <rect
            x="20"
            y="2"
            width="60"
            height="15"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <rect
            x="35"
            y="2"
            width="30"
            height="6"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <circle
            cx="50"
            cy="11"
            r="0.8"
            fill="white"
          />

          <path
            d="M42 17 A8 8 0 0 0 58 17"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          {/* Área inferior */}
          <rect
            x="20"
            y="83"
            width="60"
            height="15"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <rect
            x="35"
            y="92"
            width="30"
            height="6"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />

          <circle
            cx="50"
            cy="89"
            r="0.8"
            fill="white"
          />

          <path
            d="M42 83 A8 8 0 0 1 58 83"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />
        </svg>
      </div>

      {/* Posiciones */}
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
                <div className="flex flex-col items-center transition-all duration-200 hover:scale-105">

                  <Image
                    src={player.foto}
                    alt={player.nombre}
                    width={64}
                    height={64}
                    className="
                      rounded-full
                      border-[3px]
                      border-white
                      shadow-2xl
                    "
                  />

                  <div
                    className="
                      mt-2
                      rounded-full
                      bg-black/75
                      px-3
                      py-1
                      text-[11px]
                      font-semibold
                      text-white
                      whitespace-nowrap
                      shadow-lg
                    "
                  >
                    {player.nombre}
                  </div>

                </div>
              ) : (
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
                    border-white/40
                    bg-white/10
                    backdrop-blur-sm
                    text-xs
                    font-bold
                    text-white
                    transition-all
                    hover:scale-105
                    hover:border-white
                    hover:bg-white/20
                  "
                >
                  {position.nombre}
                </div>
              )}
            </PitchPosition>
          </div>
        );
      })}
    </div>
  );
}