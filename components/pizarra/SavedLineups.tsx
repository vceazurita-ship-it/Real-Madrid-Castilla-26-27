"use client";

import { useEffect, useState } from "react";

type SavedLineup = {
  ID: number;
  Nombre: string;
  Fecha: string;
  Rival: string;
  Sistema: string;
};

interface Props {
  onLoad: (id: number) => void;
}

export default function SavedLineups({
  onLoad,
}: Props) {
  const [lineups, setLineups] = useState<SavedLineup[]>([]);

  useEffect(() => {
    loadLineups();
  }, []);

  async function loadLineups() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}?action=alineaciones`
      );

      const data = await res.json();

      setLineups(data);
    } catch {
      console.log("Error");
    }
  }

  return (
    <div className="rounded-2xl border border-[#C8A96B]/20 bg-[#10161D] p-4">

      <h3 className="mb-4 text-sm font-semibold text-[#C8A96B]">
        Alineaciones guardadas
      </h3>

      <div className="space-y-2">

        {lineups.map((item) => (

          <button
            key={item.ID}
            onClick={() => onLoad(item.ID)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-[#C8A96B]"
          >

            <div className="font-semibold">
              {item.Nombre}
            </div>

            <div className="text-xs text-white/60">
              {item.Fecha}
            </div>

            <div className="text-xs text-[#C8A96B]">
              {item.Rival}
            </div>

            <div className="text-xs">
              {item.Sistema}
            </div>

          </button>

        ))}

      </div>

    </div>
  );
}