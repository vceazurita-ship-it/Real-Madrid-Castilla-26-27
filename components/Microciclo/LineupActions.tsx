"use client";

import { Save, FolderOpen, Trash2 } from "lucide-react";

interface Props {
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
}

export default function LineupActions({
  onSave,
  onLoad,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">

      <button
        onClick={onSave}
        className="
          flex items-center gap-2
          rounded-xl
          bg-[#C8A96B]
          px-4 py-2.5
          text-sm font-semibold
          text-black
          transition
          hover:scale-105
        "
      >
        <Save size={18} />
        Guardar alineación
      </button>

      <button
        onClick={onLoad}
        className="
          flex items-center gap-2
          rounded-xl
          border border-[#C8A96B]/40
          bg-[#151B23]
          px-4 py-2.5
          text-sm
          transition
          hover:border-[#C8A96B]
        "
      >
        <FolderOpen size={18} />
        Cargar alineación
      </button>

      <button
        onClick={onReset}
        className="
          flex items-center gap-2
          rounded-xl
          border border-red-500/40
          bg-red-500/10
          px-4 py-2.5
          text-sm
          transition
          hover:bg-red-500/20
        "
      >
        <Trash2 size={18} />
        Vaciar
      </button>

    </div>
  );
}