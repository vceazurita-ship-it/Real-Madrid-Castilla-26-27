"use client";

import { useMemo } from "react";

import { usePlayers } from "@/hooks/usePlayers";
import { useMicroLineup } from "@/context/MicroLineupContext";

import MicroPlayer from "./MicroPlayer";

export default function MicroPlayerSidebar() {
  const { players } = usePlayers();

  const { lineup } = useMicroLineup();

  const availablePlayers = useMemo(() => {
    return players.filter(
      (player) =>
        !lineup.some(
          (slot) => slot.playerId === player.id
        )
    );
  }, [players, lineup]);

  const grouped = useMemo(
    () => ({
      Porteros: availablePlayers.filter(
        (p) => p.posicion === "Portero"
      ),

      Defensa: availablePlayers.filter((p) =>
        ["LATERAL D.", "LATERAL I.", "CENTRAL"].includes(
          p.posicion
        )
      ),

      Centro: availablePlayers.filter((p) =>
        ["6", "8", "10"].includes(
          p.posicion
        )
      ),

      Ataque: availablePlayers.filter((p) =>
        ["7", "11", "9"].includes(
          p.posicion
        )
      ),
    }),
    [availablePlayers]
  );

  return (
    <div
      className="
        h-full
        overflow-y-auto
        rounded-2xl
        border
        border-[#C8A96B]/15
        bg-[#11161D]/90
        p-4
      "
    >
      <h2 className="mb-4 text-lg font-semibold text-white">
        Jugadores
      </h2>

      {Object.entries(grouped).map(
        ([title, list]) => (
          <div key={title} className="mb-8">
            <h3
              className="
                mb-3
                border-b
                border-[#C8A96B]/20
                pb-2
                text-sm
                font-bold
                uppercase
                tracking-widest
                text-[#C8A96B]
              "
            >
              {title}
            </h3>

            <div className="space-y-5">
              {list.map((player) => (
                <MicroPlayer
                  key={player.id}
                  player={player}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}