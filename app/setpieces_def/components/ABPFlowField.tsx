  "use client";

  import { useMemo, useState } from "react";

  export type ABPRow = {
    jornada?: string;
    JORNADA?: string;

    rival?: string;
    Rival?: string;

    minuto?: number | string;
    Minuto?: number | string;

    tipoAccion?: string;
    Tipo_Accion?: string;

    perfil?: string;
    Perfil?: string;

    tipoEnvio?: string;
    Tipo_Envio?: string;

    zonaRemate?: string;
    Zona_Remate?: string;

    xG?: number | string;

    rematador?: string;
    Rematador?: string;

    tipoRemate?: string;
    Tipo_Remate?: string;

    resultadoFinal?: string;
    Resultado_Final?: string;
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

  // -------------------------
  // CÓRNER (PRUEBA EXAGERADA)
  // -------------------------
  if (t.includes("corner")) {
    if (lado === "I") return { x: 2, y: 6, lane: "Exterior" as const };
    if (lado === "D") return { x: 138, y: 6, lane: "Exterior" as const };
    return { x: 70, y: 8, lane: "Centrado" as const };
  }

  // -------------------------
  // PENALTI
  // -------------------------
  if (t.includes("penalti")) {
    return { x: 70, y: 16, lane: "Centrado" as const };
  }

// -------------------------
// FALTA DIAGONAL
// -------------------------
if (t.includes("diagonal")) {
  const z = (tipoAccion.match(/Z([3-6])/i)?.[1] || "6") as keyof typeof Z_Y;
  const y = Math.min(Z_Y[z] + 9, 65); // un escalón más lejos que Z6

  if (lado === "I") return { x: 22, y, lane: "Interior" as const };
  if (lado === "D") return { x: 118, y, lane: "Interior" as const };
  return { x: 70, y, lane: "Centrado" as const };
}

// -------------------------
// FALTAS LATERALES
// -------------------------
if (t.includes("falta lateral")) {
  // OJO: usamos el texto normalizado "t", no tipoAccion
  const match = t.match(/z([1-6])/);
  const z = (match ? (`Z${match[1]}` as keyof typeof Z_Y) : "Z6");
  const y = Z_Y[z];

  const esExterior = t.includes("exterior");
  const esInterior = t.includes("interior");
  const esCentrada = t.includes("centrada");

  // Centradas
  if (esCentrada || lado === "C") {
    return { x: 70, y, lane: "Centrado" as const };
  }

  // Interiores
  if (esInterior) {
    if (lado === "I") return { x: 30, y, lane: "Interior" as const };
    if (lado === "D") return { x: 110, y, lane: "Interior" as const };
  }

  // Exteriores
  if (esExterior) {
    if (lado === "I") return { x: 8, y, lane: "Exterior" as const };
    if (lado === "D") return { x: 132, y, lane: "Exterior" as const };
  }

  // Fallback
  if (lado === "I") return { x: 8, y, lane: "Exterior" as const };
  if (lado === "D") return { x: 132, y, lane: "Exterior" as const };
  return { x: 70, y, lane: "Centrado" as const };
}

// -------------------------
// FALTA DIRECTA PERFILADA
// -------------------------
if (t.includes("falta directa perfilada")) {
  const match = t.match(/z([3-6])/);
  const z = (match ? (`Z${match[1]}` as keyof typeof Z_Y) : "Z3");

  // Escala propia de directas: desde la frontal hacia atrás
  const yMap: Record<keyof typeof Z_Y, number> = {
    Z1: 11,
    Z2: 20,
    Z3: 26,
    Z4: 34,
    Z5: 42,
    Z6: 50,
  };

  const y = yMap[z];

  // Perfilada: ligeramente escorada respecto al eje central
  if (lado === "I") return { x: 60, y, lane: "Interior" as const };
  if (lado === "D") return { x: 80, y, lane: "Interior" as const };

  return { x: 70, y, lane: "Centrado" as const };
}

// -------------------------
// FALTA DIRECTA CENTRADA
// -------------------------
if (t.includes("falta directa centrada")) {
  const match = t.match(/z([3-6])/);
  const z = (match ? (`Z${match[1]}` as keyof typeof Z_Y) : "Z3");

  const yMap: Record<keyof typeof Z_Y, number> = {
    Z1: 11,
    Z2: 20,
    Z3: 26,
    Z4: 34,
    Z5: 42,
    Z6: 50,
  };

  return { x: 70, y: yMap[z], lane: "Centrado" as const };
}

// -------------------------
// FALTA INDIRECTA
// -------------------------
if (t.includes("falta indirecta")) {
  // Indirecta en área
  if (t.includes("area")) {
    return { x: 70, y: 16, lane: "Centrado" as const };
  }

  const match = t.match(/z([3-6])/);
  const z = (match ? (`Z${match[1]}` as keyof typeof Z_Y) : "Z3");

  const yMap: Record<keyof typeof Z_Y, number> = {
    Z1: 11,
    Z2: 20,
    Z3: 26,
    Z4: 34,
    Z5: 42,
    Z6: 50,
  };

  return { x: 70, y: yMap[z], lane: "Centrado" as const };
}

  return null;
}

  function normalizeTipoAccion(tipo: string): string {
    return (tipo || "").trim();
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


  function normalizeZonaRemate(v?: string): string | null {
  if (!v) return null;
  if (remateCoords[v]) return v;

  const t = v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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
    const originEnvios: Record<
    string,
    {
      envios: Record<string, number>;
      perfil: string;
    }
  > = {};
    const remateStats: Record<string, { xg: number; actions: ABPRow[] }> = {};

    rows.forEach((r) => {
    const tipo = normalizeTipoAccion(
    r.tipoAccion ?? r.Tipo_Accion ?? ""
  );

  const perfil = (r.perfil ?? r.Perfil ?? "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

// La clave incluye el perfil para separar izquierda/derecha/centro
const origen = `${tipo}__${perfil}`;

  originCounts[origen] = (originCounts[origen] || 0) + 1;

  const envio = (r.tipoEnvio ?? r.Tipo_Envio ?? "Directo").trim();

  if (!originEnvios[origen]) {
    originEnvios[origen] = {
      envios: {},
      perfil,
    };
  }

  originEnvios[origen].envios[envio] =
    (originEnvios[origen].envios[envio] || 0) + 1;

    const remate = normalizeZonaRemate(r.zonaRemate ?? r.Zona_Remate);
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
  {Object.entries(originCounts).map(([key, value]) => {
  const data = originEnvios[key];

  // La clave es: "TipoAccion__perfil"
  const [name] = key.split("__");

  const p = getOriginCoords(name, data?.perfil);
  if (!p) return null;

  const r = 3 + Math.sqrt(value) * 2.2;

  const envios = data?.envios || {};

  // Normalizamos para comparar siempre igual
  const perfil = (data?.perfil || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

  const tipo = name
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

  const corto = envios["Corto"] || 0;
  const directo =
    (envios["Tenso"] || 0) +
    (envios["Bombeado"] || 0) +
    (envios["Directo"] || 0);

  const total = corto + directo;
  const ratioCorto = total ? corto / total : 0;
  const ratioDirecto = total ? directo / total : 0;

  // Destino según el lado
  let targetX = 70;
  let targetY = 14;

  const esIzq = perfil.includes("izquier");
  const esDer = perfil.includes("derech");

   // CÓRNER
if (tipo.startsWith("corner")) {
  if (esIzq) {
    targetX = corto > directo ? 58 : 54;
    targetY = corto > directo ? 13 : 8;
  } else if (esDer) {
    targetX = corto > directo ? 82 : 86;
    targetY = corto > directo ? 13 : 8;
  } else {
    targetX = 70;
    targetY = corto > directo ? 12 : 8;
  }
}

// FALTA LATERAL EXTERIOR
else if (tipo.startsWith("falta lateral exterior")) {
  targetX = esDer ? 84 : 56;
  targetY = 10;
}
else if (tipo.startsWith("falta lateral interior")) {
  targetX = esDer ? 76 : 64;
  targetY = 12;
}
else if (tipo.startsWith("falta lateral centrada")) {
  targetX = 70;
  targetY = 10;
}
// FALTA DIAGONAL
else if (tipo.startsWith("falta diagonal")) {
  targetX = esDer ? 80 : 60;
  targetY = 10;
}

// DIRECTAS
else if (tipo.startsWith("falta directa centrada")) {
  targetX = 70;
  targetY = 6;
}
else if (tipo.startsWith("falta directa perfilada")) {
  targetX = esDer ? 76 : 64;
  targetY = 7;
}
else if (tipo.startsWith("falta indirecta")) {
  targetX = 70;
  targetY = 8;
}
else if (tipo.startsWith("penalti")) {
  targetX = 70;
  targetY = 4;
}

    return (
      <g
        key={key}
        filter="url(#shadow)"
        onClick={() => setSelectedOrigin(key)}
        style={{ cursor: "pointer" }}
      >
        {ratioDirecto > 0 && (
          <>
            <path
              d={`M ${p.x} ${p.y} Q ${(p.x + targetX) / 2} ${Math.max(
                6,
                p.y - 10
              )} ${targetX} ${targetY}`}
              fill="none"
              stroke="#F5E7C8"
              strokeWidth={2.8 + ratioDirecto * 1.2}
              strokeLinecap="round"
              opacity="0.12"
              filter="url(#pathGlow)"
            />
            <path
              d={`M ${p.x} ${p.y} Q ${(p.x + targetX) / 2} ${Math.max(
                6,
                p.y - 10
              )} ${targetX} ${targetY}`}
              fill="none"
              stroke="url(#goldPath)"
              strokeWidth={1.4 + ratioDirecto * 1.1}
              strokeLinecap="round"
              opacity={0.7 + ratioDirecto * 0.2}
              markerEnd="url(#arrowGold)"
            />
          </>
        )}

        {ratioCorto > 0 && (
          <>
            <path
              d={`M ${p.x} ${p.y} Q ${(p.x + targetX) / 2} ${
                p.y - 4
              } ${(p.x + targetX) / 2} ${p.y + 8}`}
              fill="none"
              stroke="#DBEAFE"
              strokeWidth={2.4 + ratioCorto * 1.0}
              strokeLinecap="round"
              opacity="0.10"
              filter="url(#pathGlow)"
            />
            <path
              d={`M ${p.x} ${p.y} Q ${(p.x + targetX) / 2} ${
                p.y - 4
              } ${(p.x + targetX) / 2} ${p.y + 8}`}
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
        stroke="#F5C2C7"
        strokeWidth="0.5"
      />

      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill="#7A1F2B"
        fillOpacity="0.92"
        stroke="#F8D7DA"
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
              <p className="text-xs text-slate-400 mt-0.5 capitalize">
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
          const tipo = normalizeTipoAccion(
            r.tipoAccion ?? r.Tipo_Accion ?? ""
          );
          const perfil = (r.perfil ?? r.Perfil ?? "").toLowerCase();
          return `${tipo}__${perfil}` === selectedOrigin;
        })
        .map((r, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">
                {r.jornada ?? r.JORNADA ?? "Partido"}
                {(r.rival ?? r.Rival) && (
                  <span className="text-slate-400">
                    {" "}· {r.rival ?? r.Rival}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 whitespace-nowrap">
                Min {r.minuto ?? r.Minuto ?? "-"}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Resultado</span>
              <span className="font-medium text-[#E7D2A0]">
                {r.resultadoFinal ?? r.Resultado_Final ?? "-"}
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
                {r.rematador ?? r.Rematador ?? "Sin rematador"}
  {r.tipoRemate ?? r.Tipo_Remate ?? "Remate"}
  Min {r.minuto ?? r.Minuto ?? "-"}
  {(r.resultadoFinal ?? r.Resultado_Final)
    ? ` · ${r.resultadoFinal ?? r.Resultado_Final}`
    : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>

  );
  }