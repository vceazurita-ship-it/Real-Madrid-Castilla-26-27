"use client";

/**
 * Paleta de herramientas de la pizarra.
 *
 * En pantalla grande va flotando pegada al lado izquierdo del campo. En móvil
 * la misma paleta se pinta en horizontal dentro del muelle que hay bajo el
 * campo (`dock`): en columna medía más que el campo entero de un teléfono y lo
 * tapaba de arriba abajo.
 *
 * Además de las herramientas de dibujo lleva la de cámara, que es la que
 * convierte el arrastre en órbita, paneo y zoom sobre la escena.
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
  /** Nombre corto, el que cabe bajo el icono en el muelle del móvil. */
  short: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "select",
    label: "Mover",
    short: "Mover",
    hint: "Arrastra fichas",
    icon: <MousePointer2 size={15} />,
  },
  {
    id: "camera",
    label: "Cámara",
    short: "Cámara",
    hint: "Arrastra para orbitar · Mayús o botón derecho desplaza · rueda para el zoom · flechas del teclado también",
    icon: <Move3d size={15} />,
  },
  {
    id: "arrow",
    label: "Desplazamiento",
    short: "Flecha",
    hint: "Flecha de conducción",
    icon: <ArrowUpRight size={15} />,
  },
  {
    id: "dashed",
    label: "Pase",
    short: "Pase",
    hint: "Línea discontinua",
    icon: <Spline size={15} />,
  },
  {
    id: "line",
    label: "Línea",
    short: "Línea",
    hint: "Línea recta",
    icon: <Minus size={15} />,
  },
  {
    id: "free",
    label: "Trazo libre",
    short: "Libre",
    hint: "Dibujo a mano alzada",
    icon: <PenLine size={15} />,
  },
  {
    id: "zone",
    label: "Zona",
    short: "Zona",
    hint: "Rectángulo",
    icon: <Square size={15} />,
  },
  {
    id: "text",
    label: "Texto",
    short: "Texto",
    hint: "Etiqueta",
    icon: <TypeIcon size={15} />,
  },
  {
    id: "erase",
    label: "Borrar",
    short: "Borrar",
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
  /** Versión horizontal para el muelle del móvil. */
  dock?: boolean;
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
  dock = false,
}: Props) {
  const actions = [
    {
      id: "undo",
      title: "Deshacer",
      short: "Atrás",
      icon: <Undo2 size={15} />,
      onClick: onUndo,
      disabled: !canUndo,
    },
    {
      id: "redo",
      title: "Rehacer",
      short: "Rehacer",
      icon: <Redo2 size={15} />,
      onClick: onRedo,
      disabled: !canRedo,
    },
    {
      id: "clear",
      title: "Vaciar la escena",
      short: "Vaciar",
      icon: <Trash2 size={15} />,
      onClick: onClear,
      disabled: false,
    },
  ];

  /*
   * Muelle del móvil: doce casillas en dos filas de seis, con el nombre bajo
   * el icono. Sale justo sin desplazamiento lateral en un teléfono estrecho y
   * cada casilla es lo bastante grande para pulsarla con el pulgar.
   */
  if (dock) {
    return (
      <div
        className={cn(
          "grid grid-cols-6 gap-1 transition",
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
              "flex h-13 flex-col items-center justify-center gap-1 rounded-xl transition",
              tool === item.id
                ? "bg-[#C8A96B] text-[#0B0F14]"
                : "bg-white/[0.05] text-white/60"
            )}
          >
            {item.icon}

            <span className="text-[9px] font-semibold leading-none">
              {item.short}
            </span>
          </button>
        ))}

        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.title}
            onClick={action.onClick}
            disabled={action.disabled}
            className="flex h-13 flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.03] text-white/45 transition disabled:opacity-25"
          >
            {action.icon}

            <span className="text-[9px] font-semibold leading-none">
              {action.short}
            </span>
          </button>
        ))}
      </div>
    );
  }

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

      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          title={action.title}
          onClick={action.onClick}
          disabled={action.disabled}
          className="rounded-xl p-2 text-white/45 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
