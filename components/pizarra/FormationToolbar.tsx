"use client";

import { useLineup } from "@/context/LineupContext";
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
    setFormation,
    clearLineup,
  } = useLineup();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-zinc-900 px-6 py-4">

      {/* Formaciones */}
      <div className="flex flex-wrap gap-2">

        {formations.map((item) => (
          <button
            key={item}
            onClick={() => setFormation(item)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              formation === item
                ? "bg-white text-black"
                : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            {item}
          </button>
        ))}

      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">

        <button
          onClick={clearLineup}
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          <RotateCcw size={16} />
          Reset
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
          <Save size={16} />
          Guardar
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          <Download size={16} />
          Exportar
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
          <Share2 size={16} />
          Compartir
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">
          <LayoutGrid size={16} />
          Plantillas
        </button>

      </div>

    </div>
  );
}