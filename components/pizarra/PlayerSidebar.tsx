"use client";

import { usePlayers } from "@/hooks/usePlayers";
import PlayerToken from "./PlayerToken";

export default function PlayerSidebar() {
  const { players } = usePlayers();

  return (
    <div className="h-full overflow-y-auto bg-zinc-900">

      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-900 p-4">

        <h2 className="text-xl font-bold text-white">
          Plantilla
        </h2>

        <p className="text-sm text-zinc-400">
          {players.length} jugadores
        </p>

      </div>

      <div className="space-y-3 p-3">

        {players.map((player) => (
          <PlayerToken
            key={player.id}
            player={player}
          />
        ))}

      </div>

    </div>
  );
}