"use client";

import { toPng } from "html-to-image";
import {
  RotateCcw,
  Share2,
  Download,
} from "lucide-react";

import { useMicroLineup } from "@/context/MicroLineupContext";

export default function MicroToolbar() {
  const { clearLineup } = useMicroLineup();

  async function exportPitch() {
    const node = document.getElementById("football-pitch");

    if (!node) return;

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
    });

    const link = document.createElement("a");

    link.download = "microciclo.png";
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
        "microciclo.png",
        {
          type: "image/png",
        }
      );

      if (
        navigator.share &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Pizarra Microciclo",
          text: "Microciclo RMCF Castilla",
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
        flex-wrap
        items-center
        justify-end
        gap-2
        rounded-2xl
        border
        border-[#C8A96B]/20
        bg-[#121820]
        p-4
      "
    >
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
    </div>
  );
}