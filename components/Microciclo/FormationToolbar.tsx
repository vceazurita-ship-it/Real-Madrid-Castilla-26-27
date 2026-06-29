"use client";

import { useLineup } from "@/context/LineupContext";
import { saveLineup } from "@/lib/saveLineup";
import { usePlayers } from "@/hooks/usePlayers";
import { toPng } from "html-to-image";
import {
  Save,
  RotateCcw,
  Share2,
  Download,
  LayoutGrid,
} from "lucide-react";

const formations = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
];

export default function FormationToolbar() {
  const {
  formation,
  lineup,
  setFormation,
  clearLineup,
} = useLineup();

const { players } = usePlayers();
async function guardar() {

  const nombre =
    prompt("Nombre de la alineación");

  if (!nombre) return;

  const rival =
    prompt("Rival") || "";

  await saveLineup({

    nombre,

    rival,

    fecha:new Date()
      .toLocaleDateString(),

    sistema:formation,

alineacion: lineup.map((slot) => ({

  positionId: slot.positionId,

  playerIds: slot.playerIds,

  jugadores: slot.playerIds.map((id) => ({
    id,
    nombre:
      players.find((p) => p.id === id)?.nombre || "",
  })),

})),
    observaciones:""

  });

  alert("Alineación guardada");

}
async function exportPitch() {
  const node = document.getElementById("football-pitch");

  if (!node) return;

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
  });

  const link = document.createElement("a");

  link.download = "alineacion.png";
  link.href = dataUrl;
  link.click();
}
async function sharePitch() {
  const node = document.getElementById("football-pitch");

  if (!node) return;

  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
    });

    const blob = await (await fetch(dataUrl)).blob();

    const file = new File(
      [blob],
      "alineacion.png",
      {
        type: "image/png",
      }
    );

    if (
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({
        title: "Alineación RMCF Castilla",
        text: "Alineación creada con la Pizarra RMCF Castilla",
        files: [file],
      });
    } else {
      window.open(dataUrl, "_blank");
    }
  } catch (err) {
    console.error(err);
  }
}
  return (
    <div
      className="
        flex
        flex-col
        gap-3
        rounded-2xl
        border
        border-[#C8A96B]/20
        bg-[#121820]
        p-4
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      {/* FORMACIONES */}

      <div className="flex flex-wrap gap-2">

        {formations.map((item) => (

          <button
            key={item}
            onClick={() => setFormation(item)}
            className={`
              rounded-xl
              border
              px-4
              py-2
              text-sm
              font-semibold
              transition-all
              duration-300

              ${
                formation === item
                  ? "border-[#C8A96B] bg-[#C8A96B] text-[#111]"
                  : "border-white/10 bg-[#1A222C] text-white hover:border-[#C8A96B]/60 hover:bg-[#232D39]"
              }
            `}
          >
            {item}
          </button>

        ))}

      </div>

      {/* ACCIONES */}

      <div className="flex flex-wrap gap-2">

        <button
          onClick={clearLineup}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-white/10
            bg-[#1A222C]
            px-4
            py-2
            text-sm
            text-white
            transition-all
            hover:border-[#C8A96B]/50
            hover:bg-[#232D39]
          "
        >
          <RotateCcw size={16} />
          Reset
        </button>

        <button
  onClick={guardar}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-[#C8A96B]
            bg-[#C8A96B]
            px-4
            py-2
            text-sm
            font-semibold
            text-[#111]
            transition-all
            hover:brightness-110
          "
        >
          <Save size={16} />
          Guardar
        </button>

        <button
  onClick={exportPitch}
  className="
    flex
    items-center
    gap-2
    rounded-xl
    border
    border-white/10
    bg-[#1A222C]
    px-4
    py-2
    text-sm
    text-white
    transition-all
    hover:border-[#C8A96B]/50
    hover:bg-[#232D39]
  "
>
  <Download size={16} />
  Exportar
</button>

        <button
  onClick={sharePitch}
  className="
    flex
    items-center
    gap-2
    rounded-xl
    border
    border-white/10
    bg-[#1A222C]
    px-4
    py-2
    text-sm
    text-white
    transition-all
    hover:border-[#C8A96B]/50
    hover:bg-[#232D39]
  "
>
  <Share2 size={16} />
  Compartir
</button>

        <button
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-white/10
            bg-[#1A222C]
            px-4
            py-2
            text-sm
            text-white
            transition-all
            hover:border-[#C8A96B]/50
            hover:bg-[#232D39]
          "
        >
          <LayoutGrid size={16} />
          Plantillas
        </button>

      </div>
    </div>
  );
}