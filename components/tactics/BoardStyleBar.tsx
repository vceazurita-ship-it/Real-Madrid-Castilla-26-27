"use client";

/**
 * Selector de estilo del trazo: color, grosor y tipo de línea.
 *
 * En pantalla grande va anclado abajo a la izquierda del campo; en móvil se
 * pinta en una fila dentro del muelle (`dock`), y solo mientras hay una
 * herramienta de dibujo activa.
 *
 * Lo que se elija aquí es lo que se aplica al siguiente dibujo: las formas ya
 * pintadas guardan su propio estilo.
 */

import {
  DRAW_COLORS,
  LINE_DASH_LABEL,
  LINE_WIDTHS,
  LINE_WIDTH_LABEL,
  LineDash,
} from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

interface Props {
  color: string;
  onColorChange: (color: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
  dash: LineDash;
  onDashChange: (dash: LineDash) => void;
  disabled?: boolean;
  /** Versión en fila para el muelle del móvil. */
  dock?: boolean;
}

const DASHES: LineDash[] = ["solid", "dashed", "dotted"];

export default function BoardStyleBar({
  color,
  onColorChange,
  width,
  onWidthChange,
  dash,
  onDashChange,
  disabled = false,
  dock = false,
}: Props) {
  const colors = (
    <div className={cn("flex gap-1", dock && "gap-1.5")}>
      {DRAW_COLORS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onColorChange(option)}
          title="Color del trazo"
          style={{ backgroundColor: option }}
          className={cn(
            "rounded-full border-2 transition",
            dock ? "h-7 w-7" : "h-5 w-5",
            color === option
              ? "scale-110 border-white"
              : "border-white/20 hover:border-white/55"
          )}
        />
      ))}
    </div>
  );

  const widths = (
    <div className="flex items-center gap-1">
      {LINE_WIDTHS.map((option, index) => (
        <button
          key={option}
          type="button"
          onClick={() => onWidthChange(option)}
          title={`Grosor ${LINE_WIDTH_LABEL[index]}`}
          className={cn(
            "flex items-center justify-center rounded-lg transition",
            dock ? "h-8 w-8" : "h-6 w-6",
            width === option
              ? "bg-[#C8A96B]/18 ring-1 ring-[#C8A96B]/45"
              : "hover:bg-white/[0.09]"
          )}
        >
          <span
            className="w-4 rounded-full"
            style={{
              height: `${Math.max(1, option * 2.4)}px`,
              backgroundColor:
                width === option ? "#C8A96B" : "rgba(255,255,255,.6)",
            }}
          />
        </button>
      ))}
    </div>
  );

  const dashes = (
    <div className="flex items-center gap-1">
      {DASHES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onDashChange(option)}
          title={LINE_DASH_LABEL[option]}
          className={cn(
            "flex items-center justify-center rounded-lg px-1 transition",
            dock ? "h-8 w-10" : "h-6 flex-1",
            dash === option
              ? "bg-[#C8A96B]/18 ring-1 ring-[#C8A96B]/45"
              : "hover:bg-white/[0.09]"
          )}
        >
          <svg width={22} height={6} viewBox="0 0 22 6" aria-hidden>
            <line
              x1={1}
              y1={3}
              x2={21}
              y2={3}
              stroke={dash === option ? "#C8A96B" : "rgba(255,255,255,.6)"}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray={
                option === "dashed"
                  ? "5 3"
                  : option === "dotted"
                  ? "0.1 3.4"
                  : undefined
              }
            />
          </svg>
        </button>
      ))}
    </div>
  );

  if (dock) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 transition",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        {colors}

        <span className="h-6 w-px bg-white/10" />

        {widths}

        <span className="h-6 w-px bg-white/10" />

        {dashes}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border border-white/12 bg-[#0B0F14]/85 p-1.5 backdrop-blur-md transition",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {colors}

      <div className="h-px bg-white/10" />

      {widths}

      {dashes}
    </div>
  );
}
