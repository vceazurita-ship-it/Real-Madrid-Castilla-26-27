"use client";

import { useMemo, useState } from "react";

export type ABPRow = {
  jornada?: string;
  rival?: string;
  minuto?: number | string;
  tipoAccion: string;
  tipoEnvio?: string;
  zonaRemate?: string;
  xG?: number | string;
  rematador?: string;
  tipoRemate?: string;
  resultadoFinal?: string;
};

const zoneCoords: Record<string, { x: number; y: number; lane?: "Exterior" | "Interior" | "Centrado" }> = {
// Córner
"Córner": { x: 6, y: 6, lane: "Exterior" },

// Penalti
"Penalti": { x: 70, y: 16, lane: "Centrado" },

// Diagonal
"Falta diagonal": { x: 22, y: 18, lane: "Exterior" },

// Pasillo exterior
"Falta lateral exterior Z1": { x: 8, y: 22, lane: "Exterior" },
"Falta lateral exterior Z2": { x: 8, y: 30, lane: "Exterior" },
"Falta lateral exterior Z3": { x: 8, y: 38, lane: "Exterior" },
"Falta lateral exterior Z4": { x: 8, y: 46, lane: "Exterior" },
"Falta lateral exterior Z5": { x: 8, y: 54, lane: "Exterior" },
"Falta lateral exterior Z6": { x: 8, y: 62, lane: "Exterior" },

// Pasillo interior
"Falta lateral interior Z1": { x: 18, y: 22, lane: "Interior" },
"Falta lateral interior Z2": { x: 18, y: 30, lane: "Interior" },
"Falta lateral interior Z3": { x: 18, y: 38, lane: "Interior" },
"Falta lateral interior Z4": { x: 18, y: 46, lane: "Interior" },
"Falta lateral interior Z5": { x: 18, y: 54, lane: "Interior" },
"Falta lateral interior Z6": { x: 18, y: 62, lane: "Interior" },

// Pasillo centrado
"Falta lateral centrada Z1": { x: 34, y: 22, lane: "Centrado" },
"Falta lateral centrada Z2": { x: 34, y: 30, lane: "Centrado" },
"Falta lateral centrada Z3": { x: 34, y: 38, lane: "Centrado" },
"Falta lateral centrada Z4": { x: 34, y: 46, lane: "Centrado" },
"Falta lateral centrada Z5": { x: 34, y: 54, lane: "Centrado" },
"Falta lateral centrada Z6": { x: 34, y: 62, lane: "Centrado" },

// Directas perfiladas
"Falta directa perfilada Z3": { x: 24, y: 38, lane: "Interior" },
"Falta directa perfilada Z4": { x: 26, y: 46, lane: "Interior" },
"Falta directa perfilada Z5": { x: 28, y: 54, lane: "Interior" },
"Falta directa perfilada Z6": { x: 30, y: 62, lane: "Interior" },

// Directas centradas
"Falta directa centrada Z3": { x: 70, y: 38, lane: "Centrado" },
"Falta directa centrada Z4": { x: 70, y: 46, lane: "Centrado" },
"Falta directa centrada Z5": { x: 70, y: 54, lane: "Centrado" },
"Falta directa centrada Z6": { x: 70, y: 62, lane: "Centrado" },

// Indirectas
"Falta indirecta en área": { x: 46, y: 16, lane: "Centrado" },
"Falta indirecta Z3": { x: 44, y: 38, lane: "Centrado" },
"Falta indirecta Z4": { x: 46, y: 46, lane: "Centrado" },
"Falta indirecta Z5": { x: 48, y: 54, lane: "Centrado" },
"Falta indirecta Z6": { x: 50, y: 62, lane: "Centrado" },
};

const remateCoords: Record<string, { x: number; y: number }> = {
"1P": { x: 50, y: 8 },
"Primer Palo": { x: 50, y: 8 },
"6m": { x: 70, y: 10 },
"Segundo Palo": { x: 88, y: 8 },
"2P": { x: 88, y: 8 },
"Penalti": { x: 70, y: 16 },
"Fuera de área": { x: 70, y: 24 },
"No aplica": { x: 96, y: 28 },
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

function normalizeZonaRemate(v?: string): string | null {
if (!v) return null;
if (remateCoords[v]) return v;

const t = v.toLowerCase();

if (t === "1p" || t.includes("primer")) return "1P";
if (t === "2p" || t.includes("segundo")) return "2P";
if (t.includes("6m")) return "6m";
if (t.includes("penal")) return "Penalti";
if (t.includes("fuera")) return "Fuera de área";
if (t.includes("no aplica")) return "No aplica";

return null;
}

export default function ABPFlowField({ rows }: { rows: ABPRow[] }) {
const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
const [selectedRemate, setSelectedRemate] = useState<string | null>(null);

const { originCounts, originEnvios, remateStats } = useMemo(() => {
  const originCounts: Record<string, number> = {};
  const originEnvios: Record<string, Record<string, number>> = {};
  const remateStats: Record<string, { xg: number; actions: ABPRow[] }> = {};

  rows.forEach((r) => {
    const origen = normalizeTipoAccion(r.tipoAccion);

    if (origen) {
      originCounts[origen] = (originCounts[origen] || 0) + 1;

      const envio = (r.tipoEnvio || "Directo").trim();
      if (!originEnvios[origen]) originEnvios[origen] = {};
      originEnvios[origen][envio] = (originEnvios[origen][envio] || 0) + 1;
    }

    const remate = normalizeZonaRemate(r.zonaRemate);
    if (remate) {
      if (!remateStats[remate]) {
        remateStats[remate] = { xg: 0, actions: [] };
      }

      const xg =
        typeof r.xG === "number"
          ? r.xG
          : parseFloat(String(r.xG || 0).replace(",", "."));

      remateStats[remate].xg += Number.isFinite(xg) ? xg : 0;
      remateStats[remate].actions.push(r);
    }
  });

  return { originCounts, originEnvios, remateStats };
}, [rows]);

const maxOrigin = Math.max(...Object.values(originCounts), 1);
const maxXG = Math.max(
...Object.values(remateStats).map((v) => v.xg),
0.01
);
return (
<div className="relative w-full max-w-[980px] mx-auto aspect-[8/5]">
<svg viewBox="0 0 140 70" className="w-full h-full">
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.35" />
  </filter>

  <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="1.6" result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>

  <radialGradient id="goldNode" cx="50%" cy="40%" r="65%">
    <stop offset="0%" stopColor="#E7D2A0" />
    <stop offset="65%" stopColor="#C8A96B" />
    <stop offset="100%" stopColor="#A8894D" />
  </radialGradient>

  <linearGradient id="goldPath" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stopColor="#8A6A35" stopOpacity="0.15" />
    <stop offset="40%" stopColor="#C8A96B" stopOpacity="0.55" />
    <stop offset="100%" stopColor="#F5E7C8" stopOpacity="0.95" />
  </linearGradient>

  <linearGradient id="bluePath" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.15" />
    <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.55" />
    <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.9" />
  </linearGradient>

  {/* Flecha oro muy pequeña */}
<marker
  id="arrowGold"
  markerWidth="3.2"
  markerHeight="3.2"
  refX="2.9"
  refY="1.6"
  orient="auto"
  markerUnits="userSpaceOnUse"
>
  <path
    d="M0,0 L3.2,1.6 L0,3.2 L0.9,1.6 Z"
    fill="#E7D2A0"
    stroke="#FFF4DA"
    strokeWidth="0.18"
  />
</marker>

{/* Flecha azul muy pequeña */}
<marker
  id="arrowBlue"
  markerWidth="3.2"
  markerHeight="3.2"
  refX="2.9"
  refY="1.6"
  orient="auto"
  markerUnits="userSpaceOnUse"
>
  <path
    d="M0,0 L3.2,1.6 L0,3.2 L0.9,1.6 Z"
    fill="#BFDBFE"
    stroke="#FFFFFF"
    strokeWidth="0.18"
  />
</marker>
</defs>

    {/* Fondo */}
    <rect
      x="2"
      y="2"
      width="136"
      height="66"
      rx="2.5"
      fill="#07111F"
      stroke="#E5E7EB"
      strokeWidth="0.5"
    />

    {/* Área grande */}
    <rect
      x="32"
      y="2"
      width="76"
      height="18"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Área pequeña */}
    <rect
      x="56"
      y="2"
      width="28"
      height="7"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Punto de penalti */}
    <circle cx="70" cy="12" r="0.9" fill="#F4F4F5" />

    {/* Galleta */}
    <path
      d="M58 20 A12 12 0 0 0 82 20"
      fill="none"
      stroke="#F4F4F5"
      strokeWidth="0.45"
    />

    {/* Portería */}
    <line x1="64" y1="2" x2="76" y2="2" stroke="#F4F4F5" strokeWidth="1" />

    {/* Referencias Z dentro del campo */}
    {[22, 30, 38, 46, 54, 62].map((y, i) => (
      <g key={i}>
        <line
          x1="3"
          y1={y}
          x2="16"
          y2={y}
          stroke="#233248"
          strokeWidth="0.3"
          strokeDasharray="1.5 2"
        />
        <text
          x="4"
          y={y + 0.8}
          textAnchor="start"
          fill="#64748B"
          fontSize="1.8"
          fontWeight="500"
        >
          Z{i + 1}
        </text>
      </g>
    ))}

    {/* Carriles */}
    <line x1="14" y1="20" x2="14" y2="66" stroke="#1F2937" strokeWidth="0.25" />
    <line x1="26" y1="20" x2="26" y2="66" stroke="#1F2937" strokeWidth="0.25" />
    <line x1="42" y1="20" x2="42" y2="66" stroke="#1F2937" strokeWidth="0.25" />

    {/* Leyenda carriles */}
    <text x="8" y="18" fill="#94A3B8" fontSize="2" fontWeight="600">
      Exterior
    </text>
    <text x="18" y="18" fill="#94A3B8" fontSize="2" fontWeight="600">
      Interior
    </text>
    <text x="34" y="18" fill="#94A3B8" fontSize="2" fontWeight="600">
      Centrado
    </text>

    {/* Nodos de origen */}
       {/* Nodos de origen + dirección del envío */}
   {Object.entries(originCounts).map(([name, value]) => {
  const p = zoneCoords[name];
  if (!p) return null;

  const r = 3 + Math.sqrt(value) * 2.2;

  const envios = originEnvios[name] || {};
  const corto = envios["Corto"] || 0;
  const directo =
    (envios["Tenso"] || 0) +
    (envios["Bombeado"] || 0) +
    (envios["Directo"] || 0);

  const total = corto + directo;
  const ratioCorto = total ? corto / total : 0;
  const ratioDirecto = total ? directo / total : 0;

  return (
    <g
      key={name}
      filter="url(#shadow)"
      onClick={() => setSelectedOrigin(name)}
      style={{ cursor: "pointer" }}
    >
      {/* Trayectoria directa */}
     {ratioDirecto > 0 && (
  <>
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + 70) / 2} ${Math.max(8, p.y - 10)} 70 16`}
      fill="none"
      stroke="#F5E7C8"
      strokeWidth={2.8 + ratioDirecto * 1.2}
      strokeLinecap="round"
      opacity="0.12"
      filter="url(#pathGlow)"
    />
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + 70) / 2} ${Math.max(8, p.y - 10)} 70 16`}
      fill="none"
      stroke="url(#goldPath)"
      strokeWidth={1.4 + ratioDirecto * 1.1}
      strokeLinecap="round"
      opacity={0.7 + ratioDirecto * 0.2}
      markerEnd="url(#arrowGold)"
    />
  </>
)}

      {/* Trayectoria corto */}
      {ratioCorto > 0 && (
  <>
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + 42) / 2} ${p.y - 4} 42 28`}
      fill="none"
      stroke="#DBEAFE"
      strokeWidth={2.4 + ratioCorto * 1.0}
      strokeLinecap="round"
      opacity="0.10"
      filter="url(#pathGlow)"
    />
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + 42) / 2} ${p.y - 4} 42 28`}
      fill="none"
      stroke="url(#bluePath)"
      strokeWidth={1.2 + ratioCorto * 0.9}
      strokeLinecap="round"
      strokeDasharray="3 2.5"
      opacity={0.7 + ratioCorto * 0.2}
      markerEnd="url(#arrowBlue)"
    />
  </>
)}

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

    {/* Zonas de remate */}
    {Object.entries(remateStats).map(([name, stat]) => {
      const p = remateCoords[name];
      if (!p) return null;

      const r = 2.5 + Math.sqrt(stat.xg / maxXG) * 4;

      return (
        <g
          key={name}
          filter="url(#shadow)"
          onClick={() => setSelectedRemate(name)}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={p.x}
            cy={p.y}
            r={r + 0.6}
            fill="none"
            stroke="#A7F3D0"
            strokeWidth="0.5"
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill="#10B981"
            fillOpacity="0.9"
            stroke="#D1FAE5"
            strokeWidth="0.3"
          />
          <text
            x={p.x}
            y={p.y + 0.7}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="1.9"
            fontWeight="700"
          >
            {stat.xg.toFixed(2)}
          </text>
        </g>
      );
    })}
  </svg>

  {/* Popup origen */}
  {selectedOrigin && (
    <div className="absolute left-2 right-2 top-2 sm:left-auto sm:right-2 sm:w-72 max-h-[58vw] sm:max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#07111F]/95 p-3 sm:p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{selectedOrigin}</h3>
        <button
          onClick={() => setSelectedOrigin(null)}
          className="text-slate-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <p className="mb-3 text-sm text-slate-300">
        {originCounts[selectedOrigin]} acciones registradas
      </p>

      <div className="space-y-2">
        {rows
          .filter((r) => normalizeTipoAccion(r.tipoAccion) === selectedOrigin)
          .map((r, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
            >
              <div className="font-medium">
                {r.jornada || "Partido"}
                {r.rival ? ` · ${r.rival}` : ""}
              </div>
              <div className="text-slate-300">
                Min {r.minuto ?? "-"}
              </div>
              <div className="text-slate-300">
                Resultado: {r.resultadoFinal || "-"}
              </div>
            </div>
          ))}
      </div>
    </div>
  )}

  {/* Popup remate */}
  {selectedRemate && (
    <div className="absolute left-2 right-2 bottom-2 sm:left-auto sm:right-2 sm:w-80 max-h-[58vw] sm:max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#07111F]/95 p-3 sm:p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{selectedRemate}</h3>
        <button
          onClick={() => setSelectedRemate(null)}
          className="text-slate-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <p className="mb-3 text-sm text-slate-300">
        xG acumulado: {remateStats[selectedRemate].xg.toFixed(2)}
      </p>

      <div className="space-y-2">
        {remateStats[selectedRemate].actions.map((r, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
          >
            <div className="font-medium">
              {r.rematador || "Sin rematador"}
            </div>
            <div className="text-slate-300">
              {r.tipoRemate || "Remate"} · xG {Number(r.xG || 0).toFixed(2)}
            </div>
            <div className="text-slate-300">
              Min {r.minuto ?? "-"}
              {r.resultadoFinal ? ` · ${r.resultadoFinal}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

);
}