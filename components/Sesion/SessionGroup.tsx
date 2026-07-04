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
}: Props) {
  if (!players.length) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      {players.map((player) => (
        <SessionFieldPlayer
          key={player.id}
          id={player.id}
          positionId={positionId}
          nombre={player.apodo ?? player.nombre}
          estado={player.estado}
        />
      ))}
    </div>
  );
}