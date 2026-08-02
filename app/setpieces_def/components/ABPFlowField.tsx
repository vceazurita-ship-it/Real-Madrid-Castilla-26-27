"use client";

import { useMemo, useState } from "react";

export type ABPRow = {
  jornada?: string;
  rival?: string;
  tiempo?: string;
  perfil?: string;

  tipoAccion: string;
  perfilGolpeo?: string;
  tipoEnvio?: string;
  zonaCaida?: string;
  calidadEnvio?: string;

  nAtacantes?: number | string;
  tipoCarrera?: string;

  oc1P?: string;
  ocCentral?: string;
  oc2P?: string;
  ocFrontal?: string;

  remate?: string;
  tipoRemate?: string;
  zonaRemate?: string;

  xG?: number | string;

  segundoBalon?: string;
  resultadoFinal?: string;
};

const Z_Y: Record<string, number> = {
  Z1: 11, // mitad entre línea de fondo (2) y borde del área (20)
  Z2: 20, // borde del área grande
  Z3: 29,
  Z4: 38,
  Z5: 47,
  Z6: 56,
};

function getOriginCoords(tipoAccion: string, perfil?: string) {
  const t = (tipoAccion || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const p = (perfil || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const lado =
    p.includes("izq") || p.includes("izquier")
      ? "I"
      : p.includes("der") || p.includes("derech")
      ? "D"
      : "C";

  // CÓRNER
  if (t.includes("corner")) {
    if (lado === "I") return { x: 2, y: 6, lane: "Exterior" as const };
    if (lado === "D") return { x: 138, y: 6, lane: "Exterior" as const };
    return { x: 70, y: 8, lane: "Centrado" as const };
  }

  // PENALTI
  if (t.includes("penalti")) {
    return { x: 70, y: 16, lane: "Centrado" as const };
  }

  // FALTA DIAGONAL
  if (t.includes("diagonal")) {
    const z = (tipoAccion.match(/Z([3-6])/i)?.[1] || "6") as keyof typeof Z_Y;
    const y = Math.min(Z_Y[z] + 9, 65);

    if (lado === "I") return { x: 22, y, lane: "Interior" as const };
    if (lado === "D") return { x: 118, y, lane: "Interior" as const };
    return { x: 70, y, lane: "Centrado" as const };
  }

  // FALTAS LATERALES
  if (t.includes("falta lateral")) {
    const z = (tipoAccion.match(/Z([1-6])/i)?.[1] || "6") as keyof typeof Z_Y;
    const y = Z_Y[z];

    if (t.includes("exterior")) {
      if (lado === "I") return { x: 8, y, lane: "Exterior" as const };
      if (lado === "D") return { x: 132, y, lane: "Exterior" as const };
      return { x: 8, y, lane: "Exterior" as const };
    }

    if (t.includes("interior")) {
      if (lado === "I") return { x: 30, y, lane: "Interior" as const };
      if (lado === "D") return { x: 110, y, lane: "Interior" as const };
      return { x: 30, y, lane: "Interior" as const };
    }

    if (lado === "I") return { x: 42, y, lane: "Centrado" as const };
    if (lado === "D") return { x: 98, y, lane: "Centrado" as const };
    return { x: 70, y, lane: "Centrado" as const };
  }

  // FALTA DIRECTA PERFILADA
  if (t.includes("falta directa perfilada")) {
    const z = (tipoAccion.match(/Z([3-6])/i)?.[1] || "4") as keyof typeof Z_Y;
    const y = Z_Y[z];

    if (lado === "I") return { x: 56, y, lane: "Interior" as const };
    if (lado === "D") return { x: 84, y, lane: "Interior" as const };
    return { x: 70, y, lane: "Centrado" as const };
  }

  // FALTA DIRECTA CENTRADA
  if (t.includes("falta directa centrada")) {
    const z = (tipoAccion.match(/Z([3-6])/i)?.[1] || "3") as keyof typeof Z_Y;
    return { x: 70, y: Z_Y[z], lane: "Centrado" as const };
  }

  // FALTA INDIRECTA
  if (t.includes("falta indirecta")) {
    if (t.includes("area")) return { x: 46, y: 16, lane: "Centrado" as const };

    const z = (tipoAccion.match(/Z([3-6])/i)?.[1] || "4") as keyof typeof Z_Y;
    return { x: 70, y: Z_Y[z], lane: "Centrado" as const };
  }

  return null;
}

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

function normalizeTipoAccion(tipo: string): string {
  return (tipo || "").trim();
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

    {/* Nodos de origen + dirección del envío */}
    {Object.entries(originCounts).map(([name, value]) => {
  const perfil = rows.find(
    (r) => normalizeTipoAccion(r.tipoAccion) === name
  )?.perfil;

  const p = getOriginCoords(name, perfil);
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
          {/* Flecha directa hacia el área */}
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

          {/* Flecha corto hacia zona de apoyo */}
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
  </svg>

  {/* Popup origen */}
{selectedOrigin && (
  <div className="absolute left-2 right-2 top-2 sm:left-auto sm:right-3 sm:w-80 max-h-[62vw] sm:max-h-[26rem] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 text-white shadow-2xl backdrop-blur-md">
    <div className="mb-3 flex items-start justify-between gap-3">
      {(() => {
        const [popupName, popupPerfil] = selectedOrigin.split("__");
        return (
          <div>
            <h3 className="text-base font-semibold leading-tight">
              {popupName}
            </h3>
            {popupPerfil && (
              <p className="mt-0.5 text-xs capitalize text-slate-400">
                {popupPerfil}
              </p>
            )}
          </div>
        );
      })()}

      <button
        onClick={() => setSelectedOrigin(null)}
        className="rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
      >
        ×
      </button>
    </div>

    <div className="mb-4 rounded-xl border border-[#C8A96B]/20 bg-[#0B1728] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        Acciones registradas
      </p>
      <p className="text-lg font-semibold text-[#E7D2A0]">
        {originCounts[selectedOrigin]}
      </p>
    </div>

    <div className="space-y-2">
      {rows
        .filter((r) => {
          const tipo = normalizeTipoAccion(r.tipoAccion);
          const perfil = (r.perfil || "").toLowerCase();
          return `${tipo}__${perfil}` === selectedOrigin;
        })
        .map((r, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">
                {r.jornada || "Partido"}
                {r.rival && (
                  <span className="text-slate-400"> · {r.rival}</span>
                )}
              </div>

              <div className="text-xs text-slate-400 whitespace-nowrap">
                {r.tiempo || "-"}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <span className="text-slate-400">Perfil</span>
                <div className="text-slate-200">{r.perfil || "-"}</div>
              </div>

              <div>
                <span className="text-slate-400">Envío</span>
                <div className="text-slate-200">{r.tipoEnvio || "-"}</div>
              </div>

              <div className="col-span-2">
                <span className="text-slate-400">Caída</span>
                <div className="text-slate-200">{r.zonaCaida || "-"}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">Resultado</span>
              <span className="font-medium text-[#E7D2A0]">
                {r.resultadoFinal || "-"}
              </span>
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
  {r.tipoRemate || "Sin remate"}
</div>

<div className="text-slate-300">
  Zona: {r.zonaRemate || "-"}
</div>

<div className="text-slate-300">
  xG {Number(r.xG || 0).toFixed(2)}
</div>

<div className="text-slate-300">
  {r.tiempo || "-"}
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