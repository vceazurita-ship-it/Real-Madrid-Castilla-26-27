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
        `https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=alineaciones`
      );

      const data = await res.json();

      setLineups(data);
    } catch {
      console.log("Error");
    }
  }
function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
  return (
    <div className="rounded-2xl border border-[#C8A96B]/20 bg-[#10161D] p-4">

      <h3 className="mb-4 text-sm font-semibold text-[#C8A96B]">
        Alineaciones guardadas
      </h3>

      <div
 className="
 flex
 gap-3
 overflow-x-auto
 pb-2
 snap-x
 scrollbar-thin
 scrollbar-thumb-[#C8A96B]/40
 "
>

        {lineups.map((item) => (

          <button
            key={item.ID}
            onClick={() => onLoad(item.ID)}
            className="
min-w-[220px]
w-[220px]
shrink-0
rounded-xl
border
border-white/10
bg-black/30
p-3
text-left
transition
hover:border-[#C8A96B]
"
          >

            <div className="font-semibold">
              {item.Nombre}
            </div>

            <div className="text-xs text-white/60">
              {formatDate(item.Fecha)}
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