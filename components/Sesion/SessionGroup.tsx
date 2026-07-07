"use client";

import { Player } from "@/types/player";
import SessionFieldPlayer from "./FieldPlayer";

interface Props {
  players: Player[];
  positionId: string;
  mobile?: boolean;
}

export default function SessionGroup({
  players,
  positionId,
  mobile = false,
}: Props) {
  if (!players.length) return null;

  const isBlueTeam = positionId.startsWith("B_");

  const teamStyle = isBlueTeam
    ? {
        badge: "bg-[#C8A96B] text-[#111827]",
        keeper:
          "border-[#C8A96B] bg-[#C8A96B]/20 ",
      }
    : {
        badge: "bg-[#2A3646] text-white",
        keeper:
          "border-[#5D728C] bg-[#2A3646]/60 ",
      };

  return (
    <div className="flex flex-col items-center gap-1">
      {players.map((player) => (
        <SessionFieldPlayer
  key={player.id}
  id={player.id}
  positionId={positionId}
  nombre={player.apodo ?? player.nombre}
  estado={player.estado}
  badgeClass={teamStyle.badge}
  keeperClass={teamStyle.keeper}
  mobile={mobile}
/>
      ))}
    </div>
  );
}