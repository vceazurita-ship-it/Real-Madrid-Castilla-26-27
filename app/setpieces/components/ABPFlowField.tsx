"use client";

import { useMemo } from "react";

export type ABPRow = {
tipoAccion: string;
};

const zoneCoords: Record<string, { x: number; y: number }> = {
// Córner
"Córner": { x: 6, y: 6 },

// Penalti
"Penalti": { x: 50, y: 20 },

// Diagonal
"Falta diagonal": { x: 16, y: 22 },

// Pasillo exterior
"Falta lateral exterior Z1": { x: 6, y: 26 },
"Falta lateral exterior Z2": { x: 6, y: 36 },
"Falta lateral exterior Z3": { x: 6, y: 48 },
"Falta lateral exterior Z4": { x: 6, y: 60 },
"Falta lateral exterior Z5": { x: 6, y: 74 },
"Falta lateral exterior Z6": { x: 6, y: 88 },

// Pasillo interior
"Falta lateral interior Z1": { x: 14, y: 26 },
"Falta lateral interior Z2": { x: 14, y: 36 },
"Falta lateral interior Z3": { x: 14, y: 48 },
"Falta lateral interior Z4": { x: 14, y: 60 },
"Falta lateral interior Z5": { x: 14, y: 74 },
"Falta lateral interior Z6": { x: 14, y: 88 },

// Pasillo centrado
"Falta lateral centrada Z1": { x: 28, y: 26 },
"Falta lateral centrada Z2": { x: 28, y: 36 },
"Falta lateral centrada Z3": { x: 28, y: 48 },
"Falta lateral centrada Z4": { x: 28, y: 60 },
"Falta lateral centrada Z5": { x: 28, y: 74 },
"Falta lateral centrada Z6": { x: 28, y: 88 },

// Directas perfiladas
"Falta directa perfilada Z3": { x: 20, y: 48 },
"Falta directa perfilada Z4": { x: 22, y: 60 },
"Falta directa perfilada Z5": { x: 24, y: 74 },
"Falta directa perfilada Z6": { x: 26, y: 88 },

// Directas centradas
"Falta directa centrada Z3": { x: 50, y: 48 },
"Falta directa centrada Z4": { x: 50, y: 60 },
"Falta directa centrada Z5": { x: 50, y: 74 },
"Falta directa centrada Z6": { x: 50, y: 88 },

// Indirectas
"Falta indirecta en área": { x: 34, y: 20 },
"Falta indirecta Z3": { x: 32, y: 48 },
"Falta indirecta Z4": { x: 34, y: 60 },
"Falta indirecta Z5": { x: 36, y: 74 },
"Falta indirecta Z6": { x: 38, y: 88 },
};

function normalizeTipoAccion(v: string): string | null {
if (!v) return null;
if (zoneCoords[v]) return v;

const t = v.toLowerCase();

if (t.includes("córner") || t.includes("corner")) return "Córner";
if (t.includes("penalti")) return "Penalti";
if (t.includes("diagonal")) return "Falta diagonal";

for (const k of Object.keys(zoneCoords)) {
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
<div className="w-full max-w-[720px] md:max-w-[700px] lg:max-w-[680px] xl:max-w-[720px] mx-auto aspect-[6/5]">
<svg viewBox="0 0 100 120" className="w-full h-full">
{/* Fondo */}
<rect x="3" y="3" width="94" height="114" rx="2" fill="#07111F" stroke="#F4F4F5" strokeWidth="0.45" />

    {/* Línea de medio campo */}
    <line
      x1="3"
      y1="117"
      x2="97"
      y2="117"
      stroke="#F4F4F5"
      strokeWidth="0.35"
    />

    {/* Área grande */}
    <rect
      x="18"
      y="3"
      width="64"
      height="30"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.4"
    />

    {/* Área pequeña */}
    <rect
      x="36"
      y="3"
      width="28"
      height="10"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.4"
    />

    {/* Punto de penalti */}
    <circle cx="50" cy="18" r="0.9" fill="#F4F4F5" />

    {/* Galleta / arco completo */}
    <path
      d="M40 33 A10 10 0 0 0 60 33"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.4"
    />

    {/* Portería */}
    <line
      x1="44"
      y1="3"
      x2="56"
      y2="3"
      stroke="#F4F4F5"
      strokeWidth="0.9"
    />

    {/* Referencias Z1-Z6 */}
    {[26, 38, 50, 62, 76, 90].map((y, i) => (
      <g key={i}>
        <line
          x1="3"
          y1={y}
          x2="14"
          y2={y}
          stroke="#233248"
          strokeWidth="0.25"
          strokeDasharray="1 2"
        />
        <text
          x="2.2"
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

      const r = 2.8 + (value / maxNode) * 4.5;

      return (
        <g key={name}>
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill="#C8A96B"
            fillOpacity={0.9}
            stroke="#F5E7C8"
            strokeWidth="0.7"
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