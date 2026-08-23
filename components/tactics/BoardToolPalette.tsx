"use client";

/**
 * Paleta flotante de herramientas.
 *
 * Va anclada al lado izquierdo del campo. Además de las herramientas de
 * dibujo lleva la de cámara, que es la que convierte el arrastre en órbita,
 * paneo y zoom sobre la escena.
 */

import {
  ArrowUpRight,
  Eraser,
  Minus,
  MousePointer2,
  Move3d,
  PenLine,
  Redo2,
  Spline,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
} from "lucide-react";

import type { ToolId } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

export const BOARD_TOOLS: {
  id: ToolId;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "select",
    label: "Mover",
    hint: "Arrastra fichas",
    icon: <MousePointer2 size={15} />,
  },
  {
    id: "camera",
    label: "Cámara",
    hint: "Arrastra para orbitar · Mayús o botón derecho para desplazar · rueda para zoom",
    icon: <Move3d size={15} />,
  },
  {
    id: "arrow",
    label: "Desplazamiento",
    hint: "Flecha de conducción",
    icon: <ArrowUpRight size={15} />,
  },
  {
    id: "dashed",
    label: "Pase",
    hint: "Línea discontinua",
    icon: <Spline size={15} />,
  },
  { id: "line", label: "Línea", hint: "Línea recta", icon: <Minus size={15} /> },
  {
    id: "free",
    label: "Trazo libre",
    hint: "Dibujo a mano alzada",
    icon: <PenLine size={15} />,
  },
  { id: "zone", label: "Zona", hint: "Rectángulo", icon: <Square size={15} /> },
  { id: "text", label: "Texto", hint: "Etiqueta", icon: <TypeIcon size={15} /> },
  {
    id: "erase",
    label: "Borrar",
    hint: "Toca lo que sobre",
    icon: <Eraser size={15} />,
  },
];

interface Props {
  tool: ToolId;
  onToolChange: (tool: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** El reproductor en marcha bloquea la edición. */
  disabled?: boolean;
}

export default function BoardToolPalette({
  tool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  disabled = false,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-2xl border border-white/12 bg-[#0B0F14]/85 p-1.5 backdrop-blur-md transition",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {BOARD_TOOLS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onToolChange(item.id)}
          title={`${item.label} — ${item.hint}`}
          aria-pressed={tool === item.id}
          className={cn(
            "rounded-xl p-2 transition",
            tool === item.id
              ? "bg-[#C8A96B] text-[#0B0F14]"
              : "text-white/55 hover:bg-white/[0.09] hover:text-white"
          )}
        >
          {item.icon}
        </button>
      ))}

      <div className="my-0.5 h-px bg-white/10" />

      <PaletteAction
        title="Deshacer"
        onClick={onUndo}
        disabled={!canUndo}
        icon={<Undo2 size={15} />}
      />
      <PaletteAction
        title="Rehacer"
        onClick={onRedo}
        disabled={!canRedo}
        icon={<Redo2 size={15} />}
      />
      <PaletteAction
        title="Vaciar la escena"
        onClick={onClear}
        icon={<Trash2 size={15} />}
      />
    </div>
  );
}

function PaletteAction({
  title,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl p-2 text-white/45 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {icon}
    </button>
  );
}
