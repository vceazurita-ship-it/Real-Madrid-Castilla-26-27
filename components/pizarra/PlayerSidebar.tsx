"use client";

import { usePlayers } from "@/hooks/usePlayers";
import StatusBadge from "./StatusBadge";
import Image from "next/image";

export default function PlayerSidebar() {

  const { players } = usePlayers();

  return (

    <div className="h-full overflow-y-auto">

      <div className="sticky top-0 bg-zinc-900 border-b border-white/10 p-4">

        <h2 className="text-xl font-bold text-white">
          Plantilla
        </h2>

        <p className="text-sm text-zinc-400">

          {players.length} jugadores

        </p>

      </div>

      <div className="space-y-2 p-3">

        {players.map(player => (

          <div
            key={player.id}
            className="
            rounded-xl
            bg-zinc-800
            p-3
            hover:bg-zinc-700
            transition
            cursor-grab
            "
          >

            <div className="flex items-center gap-3">

              <Image
                src={player.foto}
                alt={player.nombre}
                width={48}
                height={48}
                className="rounded-full border border-white/20 object-cover"
              />

              <div className="flex-1">

                <div className="font-semibold text-white">

                  {player.nombre}

                </div>

                <div className="text-xs text-zinc-400">

                  {player.posicion}

                </div>

                <div className="mt-1 flex gap-2">

                  <StatusBadge estado={player.estado}/>

                  <span className="
                  rounded-full
                  bg-white/10
                  px-2
                  py-1
                  text-[10px]
                  ">

                    {player.licencia}

                  </span>

                </div>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}