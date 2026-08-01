"use client";

import { useMemo } from "react";

export type ABPRow = {
zonaCaida: string;
tipoAccion: string;
tipoCarrera: string;
zonaRemate: string;
};

const zoneCoords: Record<string, { x: number; y: number }> = {
// =========================
// ORIGEN DEL SAQUE
// =========================

// Córners
"Córner": { x: 5, y: 100 },

// Penalti
"Penalti": { x: 50, y: 18 },

// Falta diagonal
"Falta diagonal": { x: 25, y: 20 },

// Faltas laterales exteriores
"Falta lateral exterior Z1": { x: 8, y: 82 },
"Falta lateral exterior Z2": { x: 10, y: 72 },
"Falta lateral exterior Z3": { x: 12, y: 62 },
"Falta lateral exterior Z4": { x: 14, y: 52 },
"Falta lateral exterior Z5": { x: 16, y: 42 },
"Falta lateral exterior Z6": { x: 18, y: 32 },

// Faltas laterales interiores
"Falta lateral interior Z1": { x: 18, y: 82 },
"Falta lateral interior Z2": { x: 20, y: 72 },
"Falta lateral interior Z3": { x: 22, y: 62 },
"Falta lateral interior Z4": { x: 24, y: 52 },
"Falta lateral interior Z5": { x: 26, y: 42 },
"Falta lateral interior Z6": { x: 28, y: 32 },

// Faltas laterales centradas
"Falta lateral centrada Z1": { x: 32, y: 82 },
"Falta lateral centrada Z2": { x: 34, y: 72 },
"Falta lateral centrada Z3": { x: 36, y: 62 },
"Falta lateral centrada Z4": { x: 38, y: 52 },
"Falta lateral centrada Z5": { x: 40, y: 42 },
"Falta lateral centrada Z6": { x: 42, y: 32 },

// Faltas directas perfiladas
"Falta directa perfilada Z3": { x: 14, y: 60 },
"Falta directa perfilada Z4": { x: 16, y: 50 },
"Falta directa perfilada Z5": { x: 18, y: 40 },
"Falta directa perfilada Z6": { x: 20, y: 30 },

// Faltas directas centradas
"Falta directa centrada Z3": { x: 50, y: 60 },
"Falta directa centrada Z4": { x: 50, y: 50 },
"Falta directa centrada Z5": { x: 50, y: 40 },
"Falta directa centrada Z6": { x: 50, y: 30 },

// Faltas indirectas
"Falta indirecta en área": { x: 32, y: 18 },
"Falta indirecta Z3": { x: 24, y: 60 },
"Falta indirecta Z4": { x: 26, y: 50 },
"Falta indirecta Z5": { x: 28, y: 40 },
"Falta indirecta Z6": { x: 30, y: 30 },

// =========================
// ACTIVACIÓN
// =========================
Directo: { x: 50, y: 66 },
Corto: { x: 32, y: 66 },
Bombeado: { x: 68, y: 66 },
Tenso: { x: 84, y: 66 },
"Segundo balón": { x: 16, y: 66 },

// =========================
// INTENCIÓN
// =========================
"Primer palo": { x: 34, y: 42 },
PenaltiObjetivo: { x: 50, y: 34 },
"Segundo palo": { x: 66, y: 42 },
"Rechace frontal": { x: 50, y: 50 },
"Corto + centro": { x: 22, y: 42 },
"Corto + Tiro": { x: 78, y: 42 },
"Directa P.Barrera": { x: 50, y: 26 },
"6m": { x: 50, y: 20 },

// =========================
// REMATE
// =========================
"1P": { x: 36, y: 12 },
"2P": { x: 64, y: 12 },
"6m Remate": { x: 50, y: 10 },
"Fuera de área": { x: 50, y: 22 },
};

export default function ABPFlowField({ rows }: { rows: ABPRow[] }) {
const { nodes, links } = useMemo(() => {
const nodes: Record<string, number> = {};
const links: Record<string, number> = {};

const mapIntencion = (v: string) => {
  const t = (v || "").toLowerCase();
  if (t.includes("primer palo")) return "Primer palo";
  if (t.includes("penal")) return "PenaltiObjetivo";
  if (t.includes("segundo palo")) return "Segundo palo";
  if (t.includes("frontal")) return "Rechace frontal";
  if (t.includes("corto + centro")) return "Corto + centro";
  if (t.includes("corto + tiro")) return "Corto + Tiro";
  if (t.includes("barrera")) return "Directa P.Barrera";
  if (t.includes("6m")) return "6m";
  return "PenaltiObjetivo";
};

const mapRemate = (v: string) => {
  const t = (v || "").toLowerCase();
  if (t === "1p" || t.includes("primer")) return "1P";
  if (t === "2p" || t.includes("segundo")) return "2P";
  if (t.includes("6m")) return "6m Remate";
  if (t.includes("fuera")) return "Fuera de área";
  return "6m Remate";
};

rows.forEach((r) => {
  const origen = zoneCoords[r.tipoAccion] ? r.tipoAccion : null;
  const activacion = zoneCoords[r.zonaCaida] ? r.zonaCaida : null;
  const intencion = zoneCoords[mapIntencion(r.tipoCarrera)] ? mapIntencion(r.tipoCarrera) : null;
  const remate = zoneCoords[mapRemate(r.zonaRemate)] ? mapRemate(r.zonaRemate) : null;

  const chain = [origen, activacion, intencion, remate].filter(Boolean) as string[];

  chain.forEach((k) => {
    nodes[k] = (nodes[k] || 0) + 1;
  });

  for (let i = 0; i < chain.length - 1; i++) {
    const key = chain[i] + "->" + chain[i + 1];
    links[key] = (links[key] || 0) + 1;
  }
});

return { nodes, links };

}, [rows]);

const maxNode = Math.max(...Object.values(nodes), 1);
const maxLink = Math.max(...Object.values(links), 1);

return (
<div className="w-full aspect-[4/5]">
<svg viewBox="0 0 100 110" className="w-full h-full">
<rect x="5" y="5" width="90" height="100" rx="2" fill="#0F1720" stroke="#FFFFFF" strokeWidth="0.4" />
<rect x="22" y="5" width="56" height="18" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
<rect x="34" y="5" width="32" height="7" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
<circle cx="50" cy="15" r="0.8" fill="#FFFFFF" />

    <line x1="5" y1="52" x2="95" y2="52" stroke="#334155" strokeWidth="0.3" />
    <line x1="5" y1="74" x2="95" y2="74" stroke="#334155" strokeWidth="0.3" />

    <text x="50" y="104" textAnchor="middle" fill="#94A3B8" fontSize="3">
      Origen
    </text>
    <text x="50" y="78" textAnchor="middle" fill="#94A3B8" fontSize="3">
      Activación
    </text>
    <text x="50" y="52" textAnchor="middle" fill="#94A3B8" fontSize="3">
      Intención
    </text>
    <text x="50" y="26" textAnchor="middle" fill="#94A3B8" fontSize="3">
      Remate
    </text>

    {Object.entries(links).map(([key, value]) => {
      const [from, to] = key.split("->");
      const a = zoneCoords[from];
      const b = zoneCoords[to];
      if (!a || !b) return null;

      return (
        <line
          key={key}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#C8A96B"
          strokeOpacity={0.75}
          strokeWidth={0.6 + (value / maxLink) * 3.5}
          strokeLinecap="round"
        />
      );
    })}

    {Object.entries(nodes).map(([name, value]) => {
      const p = zoneCoords[name];
      if (!p) return null;

      return (
        <g key={name}>
          <circle
            cx={p.x}
            cy={p.y}
            r={2 + (value / maxNode) * 5}
            fill="#C8A96B"
            fillOpacity={0.28 + (value / maxNode) * 0.5}
            stroke="#F5E7C8"
            strokeWidth="0.4"
          />
          <text
            x={p.x}
            y={p.y + 0.7}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="1.8"
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