"use client";

import { Player } from "@/types/player";
import MicroPlayer from "./MicroPlayer";

interface Props {
  title: string;
  players: Player[];
}

export default function MicroColumn({
  title,
  players,
}: Props) {
  return (
    <div className="flex flex-col items-center">

      {/* Título */}
      <div
        className="
          mb-6
          rounded-full
          border
          border-[#C8A96B]/30
          bg-black/60
          px-4
          py-1
          text-[11px]
          font-bold
          uppercase
          tracking-[0.18em]
          text-[#E2C38C]
        "
      >
        {title}
      </div>

      {/* Jugadores */}
      <div
        className="
          flex
          w-full
          flex-wrap
          items-start
          justify-center
          gap-x-8
          gap-y-8
        "
      >
        {players.map((player) => (
          <MicroPlayer
            key={player.id}
            player={player}
          />
        ))}
      </div>

    </div>
  );
}