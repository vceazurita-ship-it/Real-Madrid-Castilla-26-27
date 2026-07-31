"use client";

import { useMemo } from "react";

export type ABPRow = {
  zonaCaida: string;
  tipoAccion: string;
  tipoCarrera: string;
  zonaRemate: string;
};

const zoneCoords: Record<string, { x: number; y: number; label: string }> = {
  // ORIGEN
  "Córner izquierdo": { x: 15, y: 95, label: "CI" },
  "Córner derecho": { x: 85, y: 95, label: "CD" },
  "Falta lateral izquierda": { x: 22, y: 84, label: "FLI" },
  "Falta lateral derecha": { x: 78, y: 84, label: "FLD" },
  Frontal: { x: 50, y: 84, label: "F" },

  // ACTIVACIÓN
  Directo: { x: 50, y: 64, label: "DIR" },
  Corto: { x: 32, y: 64, label: "COR" },
  "Segundo balón": { x: 68, y: 64, label: "2B" },
  Bloqueo: { x: 20, y: 64, label: "BLQ" },
  Arrastre: { x: 80, y: 64, label: "ARR" },

  // INTENCIÓN
  "Primer palo": { x: 34, y: 40, label: "1P" },
  "Punto de penalti": { x: 50, y: 34, label: "PP" },
  "Segundo palo": { x: 66, y: 40, label: "2P" },
  "Rechace frontal": { x: 50, y: 48, label: "RF" },

  // REMATE
  "Área pequeña izquierda": { x: 40, y: 18, label: "API" },
  "Área pequeña derecha": { x: 60, y: 18, label: "APD" },
  "Primer palo remate": { x: 36, y: 11, label: "R1P" },
  "Segundo palo remate": { x: 64, y: 11, label: "R2P" },
};

export default function ABPFlowField({ rows }: { rows: ABPRow[] }) {
  const { nodes, links } = useMemo(() => {
    const nodes: Record<string, number> = {};
    const links: Record<string, number> = {};

    rows.forEach((r) => {
      const chain = [
        r.zonaCaida,
        r.tipoAccion,
        r.tipoCarrera,
        r.zonaRemate,
      ].filter((v) => zoneCoords[v]) as string[];

      chain.forEach((k) => {
        nodes[k] = (nodes[k] || 0) + 1;
      });

      for (let i = 0; i < chain.length - 1; i++) {
        const key = `${chain[i]}->${chain[i + 1]}`;
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
              strokeWidth={0.5 + (value / maxLink) * 3.5}
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
                fillOpacity={0.25 + (value / maxNode) * 0.55}
                stroke="#F5E7C8"
                strokeWidth="0.4"
              />
              <text
                x={p.x}
                y={p.y + 0.7}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="1.9"
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