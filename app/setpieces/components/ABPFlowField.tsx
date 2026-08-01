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

<div className="w-full aspect-[3/4]"> <svg viewBox="0 0 100 120" className="w-full h-full"> {/* Fondo */} <rect x="4" y="4" width="92" height="112" rx="2" fill="#0B1220" stroke="#F5F5F5" strokeWidth="0.4" />

  {/* Línea de medio campo */}
  <line
    x1="4"
    y1="116"
    x2="96"
    y2="116"
    stroke="#F5F5F5"
    strokeWidth="0.35"
  />

  {/* Área grande */}
  <rect
    x="22"
    y="4"
    width="56"
    height="28"
    fill="none"
    stroke="#F5F5F5"
    strokeWidth="0.35"
  />

  {/* Área pequeña */}
  <rect
    x="36"
    y="4"
    width="28"
    height="10"
    fill="none"
    stroke="#F5F5F5"
    strokeWidth="0.35"
  />

  {/* Punto de penalti */}
  <circle cx="50" cy="18" r="0.9" fill="#F5F5F5" />

  {/* Arco de penalti */}
  <path
    d="M40 32 A10 10 0 0 0 60 32"
    fill="none"
    stroke="#F5F5F5"
    strokeWidth="0.35"
  />

  {/* Portería */}
  <line x1="44" y1="4" x2="56" y2="4" stroke="#F5F5F5" strokeWidth="0.8" />

  {/* Divisiones visuales Z1-Z6 */}
  {[30, 42, 54, 66, 78, 90].map((y, i) => (
    <g key={i}>
      <line
        x1="4"
        y1={y}
        x2="18"
        y2={y}
        stroke="#334155"
        strokeWidth="0.3"
        strokeDasharray="1 1"
      />
      <text
        x="2"
        y={y + 1}
        textAnchor="end"
        fill="#64748B"
        fontSize="2.4"
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
    fontSize="3"
    fontWeight="600"
  >
    Origen del saque (ABP ofensivo)
  </text>

  {/* Nodos */}
  {Object.entries(nodes).map(([name, value]) => {
    const p = zoneCoords[name];
    if (!p) return null;

    const r = 2.5 + (value / maxNode) * 6;

    return (
      <g key={name}>
        <circle
          cx={p.x}
          cy={p.y}
          r={r}
          fill="#C8A96B"
          fillOpacity={0.35 + (value / maxNode) * 0.35}
          stroke="#F5E7C8"
          strokeWidth="0.5"
        />
        <text
          x={p.x}
          y={p.y + 0.8}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="2.1"
          fontWeight="700"
        >
          {value}
        </text>
      </g>
    );
  })}
</svg>

</div> );
}