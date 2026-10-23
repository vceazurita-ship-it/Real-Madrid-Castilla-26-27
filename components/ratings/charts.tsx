"use client";

import type { ReactNode } from "react";

/** Rejilla, ejes y tooltip compartidos por todos los gráficos del módulo. */

/* Con la tinta del tema: en modo día el blanco fijo no se veía (nombres y
   fechas desaparecían). La variable va también en `style` porque un atributo
   SVG no siempre resuelve var(). */
export const AXIS = {
  stroke: "rgb(var(--rmcf-ink-rgb) / 0.3)",
  tick: {
    fill: "rgb(var(--rmcf-ink-rgb) / 0.7)",
    fontSize: 11,
    style: { fill: "rgb(var(--rmcf-ink-rgb) / 0.7)" },
  },
} as const;

export const GRID_STROKE = "rgb(var(--rmcf-ink-rgb) / 0.1)";

/** Cursor de los gráficos al pasar por encima. */
export const CURSOR_LINEA = { stroke: "rgb(var(--rmcf-ink-rgb) / 0.2)" };
export const CURSOR_BARRA = { fill: "rgb(var(--rmcf-ink-rgb) / 0.06)" };

export function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F14]/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1 text-[11px] font-medium text-white">{title}</p>

      {rows.map((row) => (
        <p
          key={row.label}
          className="flex items-center gap-2 text-[11px] text-white/50"
        >
          {row.color && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          )}

          <span className="min-w-0 truncate">{row.label}</span>

          <span className="ml-auto shrink-0 font-semibold tabular-nums text-white">
            {row.value}
          </span>
        </p>
      ))}
    </div>
  );
}
