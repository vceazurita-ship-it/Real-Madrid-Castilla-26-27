"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { usePlayers } from "@/hooks/usePlayers";
import PlayerToken from "./PlayerToken";

export default function PlayerSidebar() {
  const { players } = usePlayers();

  const [search, setSearch] = useState("");

  const filteredPlayers = useMemo(() => {
    return players.filter((player) =>
      player.nombre
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [players, search]);

  return (
    <div
      className="
        flex
        h-full
        max-h-[calc(100vh-260px)]
        flex-col
        overflow-hidden
        bg-[#11161D]
      "
    >
      {/* CABECERA */}

      <div
        className="
          sticky
          top-0
          z-20
          shrink-0
          border-b
          border-[#C8A96B]/15
          bg-[#11161D]
          p-4
        "
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Plantilla
            </h2>

            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              {players.length} jugadores
            </p>
          </div>

          <div
            className="
              rounded-full
              bg-[#C8A96B]/15
              px-3
              py-1
              text-xs
              font-semibold
              text-[#C8A96B]
            "
          >
            STAFF
          </div>
        </div>

        {/* BUSCADOR */}

        <div className="relative mt-4">
          <Search
            size={15}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-white/40
            "
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="
              w-full
              rounded-xl
              border
              border-white/10
              bg-[#1A222C]
              py-2
              pl-9
              pr-3
              text-sm
              text-white
              outline-none
              transition-all
              placeholder:text-white/35
              focus:border-[#C8A96B]/60
            "
          />
        </div>
      </div>

      {/* LISTADO */}

      <div
        className="
          flex-1
          min-h-0
          overflow-y-auto
          p-2
          space-y-1.5
        "
      >
        {filteredPlayers.map((player) => (
          <PlayerToken
            key={player.id}
            player={player}
          />
        ))}
      </div>
    </div>
  );
}