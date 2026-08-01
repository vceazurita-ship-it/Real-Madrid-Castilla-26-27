"use client";

import { useMemo } from "react";

export type ABPRow = {
tipoAccion: string;
};

const zoneCoords: Record<string, { x: number; y: number }> = {
// Córner
"Córner": { x: 4, y: 4 },

// Penalti
"Penalti": { x: 50, y: 18 },

// Diagonal
"Falta diagonal": { x: 18, y: 22 },

// Pasillo exterior
"Falta lateral exterior Z1": { x: 8, y: 24 },
"Falta lateral exterior Z2": { x: 8, y: 34 },
"Falta lateral exterior Z3": { x: 8, y: 46 },
"Falta lateral exterior Z4": { x: 8, y: 58 },
"Falta lateral exterior Z5": { x: 8, y: 72 },
"Falta lateral exterior Z6": { x: 8, y: 86 },

// Pasillo interior
"Falta lateral interior Z1": { x: 16, y: 24 },
"Falta lateral interior Z2": { x: 16, y: 34 },
"Falta lateral interior Z3": { x: 16, y: 46 },
"Falta lateral interior Z4": { x: 16, y: 58 },
"Falta lateral interior Z5": { x: 16, y: 72 },
"Falta lateral interior Z6": { x: 16, y: 86 },

// Pasillo centrado
"Falta lateral centrada Z1": { x: 28, y: 24 },
"Falta lateral centrada Z2": { x: 28, y: 34 },
"Falta lateral centrada Z3": { x: 28, y: 46 },
"Falta lateral centrada Z4": { x: 28, y: 58 },
"Falta lateral centrada Z5": { x: 28, y: 72 },
"Falta lateral centrada Z6": { x: 28, y: 86 },

// Directas perfiladas
"Falta directa perfilada Z3": { x: 20, y: 44 },
"Falta directa perfilada Z4": { x: 22, y: 56 },
"Falta directa perfilada Z5": { x: 24, y: 70 },
"Falta directa perfilada Z6": { x: 26, y: 84 },

// Directas centradas
"Falta directa centrada Z3": { x: 50, y: 44 },
"Falta directa centrada Z4": { x: 50, y: 56 },
"Falta directa centrada Z5": { x: 50, y: 70 },
"Falta directa centrada Z6": { x: 50, y: 84 },

// Indirectas
"Falta indirecta en área": { x: 34, y: 18 },
"Falta indirecta Z3": { x: 32, y: 44 },
"Falta indirecta Z4": { x: 34, y: 56 },
"Falta indirecta Z5": { x: 36, y: 70 },
"Falta indirecta Z6": { x: 38, y: 84 },
};

function normalizeTipoAccion(v: string): string | null {
if (!v) return null;
if (zoneCoords[v]) return v;

const t = v.toLowerCase();

if (t.includes("córner") || t.includes("corner")) return "Córner";
if (t.includes("penalti")) return "Penalti";
if (t.includes("diagonal")) return "Falta diagonal";

const keys = Object.keys(zoneCoords);
for (const k of keys) {
if (t === k.toLowerCase()) return k;
}

return null;
}

export default function ABPFlowField({ rows }: { rows: ABPRow[] }) {
const nodes = useMemo(() => {
const counts: Record<string, number> = {};

rows.forEach((r) => {
  const origen = normalizeTipoAccion(r.tipoAccion);
  if (!origen) return;
  counts[origen] = (counts[origen] || 0) + 1;
});

return counts;

}, [rows]);

const values = Object.values(nodes);
const maxNode = values.length ? Math.max(...values) : 1;

return (
<div className="w-full max-w-[430px] md:max-w-[360px] lg:max-w-[340px] xl:max-w-[320px] mx-auto aspect-[4/5]">
<svg viewBox="0 0 100 120" className="w-full h-full">
{/* Fondo */}
<rect x="4" y="4" width="92" height="112" rx="2" fill="#07111F" stroke="#F4F4F5" strokeWidth="0.45" />

    {/* Línea de medio campo */}
    <line
      x1="4"
      y1="116"
      x2="96"
      y2="116"
      stroke="#F4F4F5"
      strokeWidth="0.35"
    />

    {/* Área grande */}
    <rect
      x="22"
      y="4"
      width="56"
      height="28"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.4"
    />

    {/* Área pequeña */}
    <rect
      x="36"
      y="4"
      width="28"
      height="10"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.4"
    />

    {/* Punto de penalti */}
    <circle cx="50" cy="18" r="0.9" fill="#F4F4F5" />

    {/* Arco */}
    <path
      d="M40 32 A10 10 0 0 0 60 32"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.35"
    />

    {/* Portería */}
    <line x1="44" y1="4" x2="56" y2="4" stroke="#F4F4F5" strokeWidth="0.8" />

    {/* Referencias Z1-Z6 */}
    {[24, 36, 48, 60, 72, 84].map((y, i) => (
      <g key={i}>
        <line
          x1="4"
          y1={y}
          x2="14"
          y2={y}
          stroke="#233248"
          strokeWidth="0.25"
          strokeDasharray="1 2"
        />
        <text
          x="2.5"
          y={y + 1}
          textAnchor="end"
          fill="#475569"
          fontSize="2"
          fontWeight="500"
        >
          Z{i + 1}
        </text>
      </g>
    ))}

    {/* Título */}
    <text
      x="50"
      y="112"
      textAnchor="middle"
      fill="#94A3B8"
      fontSize="2.8"
      fontWeight="600"
    >
      Origen de las ABP ofensivas
    </text>

    {/* Nodos */}
    {Object.entries(nodes).map(([name, value]) => {
      const p = zoneCoords[name];
      if (!p) return null;

      const r = 2.6 + (value / maxNode) * 5;

      return (
        <g key={name}>
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill="#C8A96B"
            fillOpacity={0.88}
            stroke="#F5E7C8"
            strokeWidth="0.65"
          />
          <text
            x={p.x}
            y={p.y + 0.8}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="2.2"
            fontWeight="700"
          >
            {value}
          </text>
        </g>
      );
    })}
  </svg>
</div>

);
}