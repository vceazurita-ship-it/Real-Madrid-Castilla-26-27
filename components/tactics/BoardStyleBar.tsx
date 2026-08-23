"use client";

/**
 * Selector de estilo del trazo, anclado abajo a la izquierda del campo.
 *
 * Color, grosor y tipo de línea. Lo que se elija aquí es lo que se aplica al
 * siguiente dibujo: las formas ya pintadas guardan su propio estilo.
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
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border border-white/12 bg-[#0B0F14]/85 p-1.5 backdrop-blur-md transition",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {/* COLOR */}

      <div className="flex gap-1">
        {DRAW_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onColorChange(option)}
            title="Color del trazo"
            style={{ backgroundColor: option }}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition",
              color === option
                ? "scale-110 border-white"
                : "border-white/20 hover:border-white/55"
            )}
          />
        ))}
      </div>

      <div className="h-px bg-white/10" />

      {/* GROSOR */}

      <div className="flex items-center gap-1">
        {LINE_WIDTHS.map((option, index) => (
          <button
            key={option}
            type="button"
            onClick={() => onWidthChange(option)}
            title={`Grosor ${LINE_WIDTH_LABEL[index]}`}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-lg transition",
              width === option
                ? "bg-[#C8A96B]/18 ring-1 ring-[#C8A96B]/45"
                : "hover:bg-white/[0.09]"
            )}
          >
            <span
              className="w-4 rounded-full"
              style={{
                height: `${Math.max(1, option * 2.4)}px`,
                backgroundColor: width === option ? "#C8A96B" : "rgba(255,255,255,.6)",
              }}
            />
          </button>
        ))}
      </div>

      {/* TIPO DE LÍNEA */}

      <div className="flex items-center gap-1">
        {DASHES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDashChange(option)}
            title={LINE_DASH_LABEL[option]}
            className={cn(
              "flex h-6 flex-1 items-center justify-center rounded-lg px-1 transition",
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
    </div>
  );
}
