"use client";

import {
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { usePlayers } from "@/hooks/usePlayers";
import PlayerToken from "./PlayerToken";

export default function PlayerSidebar() {
  const { players } = usePlayers();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");

  const filteredPlayers = useMemo(() => {
    return players.filter((player) =>
      player.nombre
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [players, search]);
function scrollLeft() {
  scrollRef.current?.scrollBy({
    left: -300,
    behavior: "smooth",
  });
}

function scrollRight() {
  scrollRef.current?.scrollBy({
    left: 300,
    behavior: "smooth",
  });
}
  return (
    <div
      className="
        flex
        h-full
        
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

<div className="relative flex-1 min-h-0">

  <div
  ref={scrollRef}
  className="
      h-full
      overflow-x-auto
      overflow-y-hidden

      lg:overflow-y-auto
      lg:overflow-x-hidden

      p-2

      scrollbar-thin
      scrollbar-track-transparent
      scrollbar-thumb-[#C8A96B]/40
    "
  >
    <div
      className="
        flex
        gap-2
        w-max

        lg:w-auto
        lg:flex-col
        lg:gap-1.5
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

 <div
  className="
    absolute
    inset-y-0
    left-0
    right-0
    flex
    items-center
    justify-between
    px-2
    pointer-events-none
    lg:hidden
    z-20
  "
>
  <button
  onClick={scrollLeft}
  className="
      pointer-events-auto

    ml-3

    flex
    h-10
    w-10
    items-center
    justify-center

    rounded-full

    border
    border-[#C8A96B]/40

    bg-[#11161D]/85
    backdrop-blur

    text-2xl
    text-[#C8A96B]

    transition-all
    duration-200

    active:scale-90
    hover:bg-[#C8A96B]
    hover:text-black
  "
>
  ←<ChevronRight size={24}/>

</button>
<button
  onClick={scrollRight}
  className="
      pointer-events-auto

    mr-3

    flex
    h-10
    w-10
    items-center
    justify-center

    rounded-full

    border
    border-[#C8A96B]/40

    bg-[#11161D]/85
    backdrop-blur

    text-2xl
    text-[#C8A96B]

    transition-all
    duration-200

    active:scale-90
    hover:bg-[#C8A96B]
    hover:text-black
  "
>
  →<ChevronRight size={24}/>
</button>
</div>

</div>

    </div>
  );
}