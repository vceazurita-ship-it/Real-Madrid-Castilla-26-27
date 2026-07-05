"use client";

import Image from "next/image";
import { forwardRef, useEffect } from "react";

import { useTrainingPlayers } from "@/hooks/useTrainingPlayers";
import { useSessionLineup } from "../../context/SesionLineUpContext";

import SesionGroup from "../Sesion/SessionGroup";
import PitchPosition from "../Sesion/PitchPosition";

import { layouts } from "@/lib/training/layouts";

const FootballPitch = forwardRef<
  HTMLDivElement,
  Record<string, never>
>(function FootballPitch(_, ref) {
  const { allPlayers } = useTrainingPlayers();

const {
  lineup,
  playersPerTeam,
  loadedLineupId,
  initializeFromPlayers,
} = useSessionLineup();


  const layout = layouts[playersPerTeam];

  const positions = [
    ...layout.blue,
    ...layout.red,
  ];
  useEffect(() => {
  // Si hay una sesión cargada no la tocamos
  if (loadedLineupId !== null) return;

  if (allPlayers.length === 0) return;

  initializeFromPlayers(allPlayers);
}, [
  allPlayers,
  playersPerTeam,
  loadedLineupId,
  initializeFromPlayers,
]);

  return (
    <div
      id="football-pitch"
      ref={ref}
      className="
        relative
        h-full
        w-full
        overflow-hidden
        rounded-[28px]
        border
        border-[#C8A96B]/20
        shadow-[0_25px_80px_rgba(0,0,0,.45)]
      "
    >
      {/* Fondo del campo */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/field2.png"
          alt="Campo"
          fill
          priority
          unoptimized
          draggable={false}
          className="
            object-cover
            pointer-events-none
            select-none
          "
        />
      </div>

      {/* Oscurecer */}
      <div className="absolute inset-0 bg-black/35" />

      {/* Viñeta */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.45))]" />

      {/* Jugadores */}
      {positions
        
        .map((position) => {
          const slot = lineup.find(
            (s) => s.positionId === position.id
          );

          const groupPlayers = allPlayers.filter((player) =>
            slot?.playerIds?.includes(player.id)
          );
          const isBlueTeam = position.id.startsWith("B_");
const isGoalkeeper = position.id.endsWith("GK");

const teamStyle = isBlueTeam
  ? {
      badge: "bg-[#C8A96B] text-[#111827]",
      keeper:
        "border-[#C8A96B] bg-[#C8A96B]/20 shadow-[0_0_18px_rgba(200,169,107,.35)]",
    }
  : {
      badge: "bg-[#2A3646] text-white",
      keeper:
        "border-[#5D728C] bg-[#2A3646]/60 shadow-[0_0_18px_rgba(93,114,140,.35)]",
    };
    function getPositionLabel(id: string) {
  const position = id.replace(/^B_|^R_/, "");

  if (position.startsWith("GK")) return "POR";
  if (position.startsWith("DEF")) return "DEF";
  if (position.startsWith("MID")) return "MED";
  if (position.startsWith("ATT")) return "DEL";

  return position;
}
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
                {groupPlayers.length > 0 ? (
                  <SesionGroup
                    players={groupPlayers}
                    positionId={position.id}
                    mobile={false}
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <div
  className={`
    flex
    h-16
    w-16
    items-center
    justify-center
    rounded-full
    border-2
    border-dashed
    backdrop-blur-sm
    transition
    duration-300
    hover:scale-110

    ${
      isGoalkeeper
        ? teamStyle.keeper
        : "border-[#C8A96B] bg-black/45 shadow-[0_0_18px_rgba(200,169,107,.25)]"
    }
  `}
>
  <span
    className={
      isGoalkeeper
        ? "text-white text-lg"
        : "text-[#C8A96B] text-lg"
    }
  >
    +
  </span>
</div>

                    <div
  className={`
    mt-2
    rounded-full
    px-3
    py-1
    text-[10px]
    font-semibold
    tracking-wide
    whitespace-nowrap
    backdrop-blur-sm
    ${teamStyle.badge}
  `}
>
  {getPositionLabel(position.id)}
</div>
                  </div>
                )}
              </PitchPosition>
            </div>
          );
        })}
    </div>
  );
});

FootballPitch.displayName = "FootballPitch";

export default FootballPitch;