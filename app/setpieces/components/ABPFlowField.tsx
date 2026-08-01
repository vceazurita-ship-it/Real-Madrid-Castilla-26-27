"use client";

import { useMemo } from "react";

export type ABPRow = {
tipoAccion: string;
};

const zoneCoords: Record<string, { x: number; y: number }> = {
// Córner
"Córner": { x: 5, y: 5 },

// Penalti
"Penalti": { x: 60, y: 18 },

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
"Falta lateral interior Z1": { x: 18, y: 24 },
"Falta lateral interior Z2": { x: 18, y: 34 },
"Falta lateral interior Z3": { x: 18, y: 46 },
"Falta lateral interior Z4": { x: 18, y: 58 },
"Falta lateral interior Z5": { x: 18, y: 72 },
"Falta lateral interior Z6": { x: 18, y: 86 },

// Pasillo centrado
"Falta lateral centrada Z1": { x: 34, y: 24 },
"Falta lateral centrada Z2": { x: 34, y: 34 },
"Falta lateral centrada Z3": { x: 34, y: 46 },
"Falta lateral centrada Z4": { x: 34, y: 58 },
"Falta lateral centrada Z5": { x: 34, y: 72 },
"Falta lateral centrada Z6": { x: 34, y: 86 },

// Directas perfiladas
"Falta directa perfilada Z3": { x: 22, y: 46 },
"Falta directa perfilada Z4": { x: 24, y: 58 },
"Falta directa perfilada Z5": { x: 26, y: 72 },
"Falta directa perfilada Z6": { x: 28, y: 86 },

// Directas centradas
"Falta directa centrada Z3": { x: 60, y: 46 },
"Falta directa centrada Z4": { x: 60, y: 58 },
"Falta directa centrada Z5": { x: 60, y: 72 },
"Falta directa centrada Z6": { x: 60, y: 86 },

// Indirectas
"Falta indirecta en área": { x: 42, y: 18 },
"Falta indirecta Z3": { x: 40, y: 46 },
"Falta indirecta Z4": { x: 42, y: 58 },
"Falta indirecta Z5": { x: 44, y: 72 },
"Falta indirecta Z6": { x: 46, y: 86 },
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
<div className="w-full max-w-[980px] mx-auto aspect-[8/5]">
<svg viewBox="0 0 120 70" className="w-full h-full">
<defs>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="0" dy="0.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.35" />
</filter>
<radialGradient id="goldNode" cx="50%" cy="40%" r="65%">
<stop offset="0%" stopColor="#E7D2A0" />
<stop offset="65%" stopColor="#C8A96B" />
<stop offset="100%" stopColor="#A8894D" />
</radialGradient>
</defs>

    {/* Fondo */}
    <rect
      x="2"
      y="2"
      width="116"
      height="66"
      rx="2.5"
      fill="#07111F"
      stroke="#E5E7EB"
      strokeWidth="0.5"
    />

    {/* Área grande */}
    <rect
      x="26"
      y="2"
      width="68"
      height="18"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Área pequeña */}
    <rect
      x="44"
      y="2"
      width="32"
      height="7"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Punto de penalti */}
    <circle cx="60" cy="12" r="0.9" fill="#F4F4F5" />

    {/* Galleta / arco */}
    <path
      d="M48 20 A12 12 0 0 0 72 20"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Portería */}
    <line x1="54" y1="2" x2="66" y2="2" stroke="#F4F4F5" strokeWidth="1" />

    {/* Referencias Z1-Z6 */}
    {[24, 34, 44, 54, 64, 74].map((_, i) => {
      const y = 24 + i * 8;
      return (
        <g key={i}>
          <line
            x1="2"
            y1={y}
            x2="14"
            y2={y}
            stroke="#233248"
            strokeWidth="0.3"
            strokeDasharray="1.5 2"
          />
          <text
            x="1.5"
            y={y + 0.8}
            textAnchor="end"
            fill="#64748B"
            fontSize="1.9"
            fontWeight="500"
          >
            Z{i + 1}
          </text>
        </g>
      );
    })}

    {/* Pasillos */}
    <line x1="12" y1="20" x2="12" y2="66" stroke="#1F2937" strokeWidth="0.25" />
    <line x1="24" y1="20" x2="24" y2="66" stroke="#1F2937" strokeWidth="0.25" />
    <line x1="40" y1="20" x2="40" y2="66" stroke="#1F2937" strokeWidth="0.25" />

    {/* Leyenda superior */}
    <g>
      <circle cx="10" cy="68.5" r="1" fill="#C8A96B" />
      <text x="12" y="69.2" fill="#94A3B8" fontSize="2.1">Exterior</text>

      <circle cx="28" cy="68.5" r="1" fill="#C8A96B" />
      <text x="30" y="69.2" fill="#94A3B8" fontSize="2.1">Interior</text>

      <circle cx="48" cy="68.5" r="1" fill="#C8A96B" />
      <text x="50" y="69.2" fill="#94A3B8" fontSize="2.1">Centrado</text>
    </g>

    {/* Nodos */}
    {Object.entries(nodes).map(([name, value]) => {
      const p = zoneCoords[name];
      if (!p) return null;

      const r = 3 + Math.sqrt(value) * 2.2;

      return (
        <g key={name} filter="url(#shadow)">
          <circle
            cx={p.x}
            cy={p.y}
            r={r + 0.7}
            fill="none"
            stroke="#F5E7C8"
            strokeWidth="0.6"
            opacity="0.95"
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill="url(#goldNode)"
            stroke="#F5E7C8"
            strokeWidth="0.35"
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