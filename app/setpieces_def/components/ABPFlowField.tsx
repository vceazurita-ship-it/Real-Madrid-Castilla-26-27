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

    zonaCaida?: string;
    Zona_Caida?: string;

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
  "Central": { x: 70, y: 13 },
  "Segundo Palo": { x: 88, y: 8 },
  "2P": { x: 88, y: 8 },
  "Penalti": { x: 70, y: 16 },
  "Fuera de área": { x: 70, y: 24 },
  };


  function normalizeZonaRemate(v?: string): string | null {
  if (!v) return null;
  if (remateCoords[v]) return v;

  const t = v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // "No aplica" y "No remate" no son zonas: no deben pintarse sobre el campo.
  if (t.includes("no aplica") || t.includes("no remate")) return null;

  if (t === "1p" || t.includes("primer")) return "1P";
  if (t === "2p" || t.includes("segundo")) return "2P";
  if (t.includes("6m")) return "6m";
  if (t.includes("central")) return "Central";
  if (t.includes("penal")) return "Penalti";
  if (t.includes("fuera")) return "Fuera de área";

  return null;
  }

  /** Zona del área donde cae el envío, normalizada al vocabulario del campo. */
  function normalizeZonaCaida(v?: string): string | null {
  const t = (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  if (!t) return null;

  // Las superioridades (2v1, 3v2...) las representa la flecha de juego en corto.
  if (/^\d+\s*v\s*\d+$/.test(t)) return null;

  if (t.includes("arriba")) return "Portería arriba";
  if (t.includes("abajo")) return "Portería abajo";
  if (t.includes("primer")) return "Primer palo";
  if (t.includes("segundo")) return "Segundo palo";
  if (t.includes("6m")) return "6m";
  if (t.includes("penalti")) return "Penalti";
  if (t.includes("barrera")) return "Directa a barrera";
  if (t.includes("fuera") || t.includes("frontal")) return "Frontal";

  return null;
  }

  /**
   * Coordenadas reales de la zona de caída sobre el campo.
   * Primer y segundo palo dependen del lado desde el que se golpea.
   */
  function caidaCoords(
  zona: string,
  esIzq: boolean,
  esDer: boolean
  ): { x: number; y: number } | null {
  const palo = esIzq
    ? { primero: 58, segundo: 82 }
    : esDer
    ? { primero: 82, segundo: 58 }
    : { primero: 60, segundo: 80 };

  switch (zona) {
    case "Primer palo":
      return { x: palo.primero, y: 7 };
    case "Segundo palo":
      return { x: palo.segundo, y: 7 };
    case "6m":
      return { x: 70, y: 6.5 };
    case "Penalti":
      return { x: 70, y: 12 };
    case "Frontal":
      return { x: 70, y: 24 };
    case "Directa a barrera":
      return { x: 70, y: 18 };
    case "Portería arriba":
      return { x: 66, y: 2.6 };
    case "Portería abajo":
      return { x: 74, y: 3.6 };
    default:
      return null;
  }
  }

  /** Mezcla acero → oro → verde según el % de acciones que acaban en gol u ocasión. */
  function peligroColor(t: number) {
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: 0, c: [90, 103, 122] },
    { p: 0.5, c: [200, 169, 107] },
    { p: 1, c: [16, 185, 129] },
  ];

  const ratio = Math.max(0, Math.min(1, t));

  let a = stops[0];
  let b = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].p && ratio <= stops[i + 1].p) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }

  const span = b.p - a.p || 1;
  const local = (ratio - a.p) / span;

  const rgb = a.c.map((channel, i) =>
    Math.round(channel + (b.c[i] - channel) * local)
  );

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  export default function ABPFlowField({ rows }: { rows: ABPRow[] }) {
  const [selectedOrigin, setSelectedOrigin] = useState<{
  key: string;
  tipo: "corto" | "directo" | "origen";
} | null>(null);
  const [selectedRemate, setSelectedRemate] = useState<string | null>(null);
  const [metric, setMetric] = useState<"acciones" | "xg">("acciones");

  const { originCounts, originEnvios, remateStats } = useMemo(() => {
    const originCounts: Record<string, number> = {};
    const originEnvios: Record<
    string,
    {
      envios: Record<string, number>;
      perfil: string;
      // Reparto real de zonas de caída: es lo que marca hacia dónde apunta la flecha.
      caidas: Record<string, number>;
      xg: number;
      peligro: number;
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
      caidas: {},
      xg: 0,
      peligro: 0,
    };
  }

  originEnvios[origen].envios[envio] =
    (originEnvios[origen].envios[envio] || 0) + 1;

  const caida = normalizeZonaCaida(r.zonaCaida ?? r.Zona_Caida);

  if (caida) {
    originEnvios[origen].caidas[caida] =
      (originEnvios[origen].caidas[caida] || 0) + 1;
  }

  const xgFila =
    typeof r.xG === "number"
      ? r.xG
      : parseFloat(String(r.xG || 0).replace(",", "."));

  originEnvios[origen].xg += Number.isFinite(xgFila) ? xgFila : 0;

  const res = (r.resultadoFinal ?? r.Resultado_Final ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (res === "gol" || res.includes("ocas")) {
    originEnvios[origen].peligro += 1;
  }

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

  const maxOriginXg = Math.max(
    ...Object.values(originEnvios).map((v) => v.xg),
    0.01
  );
  const maxXG = Math.max(
  ...Object.values(remateStats).map((v) => v.xg),
  0.01
  );
  return (
  <div className="w-full">
  {/* Selector de métrica y leyenda */}
  <div className="mx-auto mb-4 flex max-w-[980px] flex-wrap items-center gap-x-5 gap-y-2">
    <div className="flex gap-2">
      {(
        [
          { key: "acciones", label: "Acciones" },
          { key: "xg", label: "xG" },
        ] as const
      ).map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMetric(m.key)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
            metric === m.key
              ? "border-[#C8A96B] bg-[#C8A96B] text-black"
              : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>

    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded-full bg-[#E7D2A0]" />
        Envío al área
      </span>

      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded-full border-t border-dashed border-blue-300 bg-transparent" />
        Juego en corto
      </span>

      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        xG por zona de remate
      </span>

      <span className="flex items-center gap-1.5">
        <span
          className="h-2 w-6 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${peligroColor(
              0
            )}, ${peligroColor(0.5)}, ${peligroColor(1)})`,
          }}
        />
        Anillo = % gol u ocasión
      </span>
    </div>
  </div>

  <div className="relative w-full max-w-[980px] mx-auto aspect-[8/5]">
  <svg
    viewBox="0 0 140 70"
    className="w-full h-full"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedOrigin(null);
        setSelectedRemate(null);
      }
    }}
  >
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

  // El tamaño responde a la métrica elegida: volumen de acciones o xG generado.
  const magnitud =
    metric === "xg" ? data?.xg || 0 : value;

  const escala =
    metric === "xg" ? Math.max(maxOriginXg, 0.01) : maxOrigin;

  const r = 3 + Math.sqrt(magnitud / escala) * 6.2;

  const ratioPeligro = value ? (data?.peligro || 0) / value : 0;

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

// Destino para juego en corto (azul)
let cortoX = p.x;
let cortoY = p.y + 8;

// Destinos posibles al área (dorado)
let destinosArea: { x: number; y: number }[] = [];

const esIzq = perfil.includes("izquier");
const esDer = perfil.includes("derech");

// ---------- CÓRNER ----------
if (tipo.startsWith("corner")) {
  cortoX = esIzq ? 22 : esDer ? 118 : 70;
  cortoY = 16;

  destinosArea = esIzq
    ? [
        { x: 56, y: 8 },   // Primer palo
        { x: 70, y: 10 },  // Penalti
        { x: 84, y: 8 },   // Segundo palo
        { x: 70, y: 18 },  // Frontal
      ]
    : [
        { x: 84, y: 8 },
        { x: 70, y: 10 },
        { x: 56, y: 8 },
        { x: 70, y: 18 },
      ];
}

// ---------- FALTA LATERAL EXTERIOR ----------
else if (tipo.startsWith("falta lateral exterior")) {
  cortoX = esIzq ? 18 : 122;
  cortoY = p.y + 5;

  destinosArea = esIzq
    ? [
        { x: 54, y: 8 },
        { x: 70, y: 10 },
        { x: 86, y: 8 },
      ]
    : [
        { x: 86, y: 8 },
        { x: 70, y: 10 },
        { x: 54, y: 8 },
      ];
}

// ---------- FALTA LATERAL INTERIOR ----------
else if (tipo.startsWith("falta lateral interior")) {
  cortoX = esIzq ? 38 : 102;
  cortoY = p.y + 4;

  destinosArea = esIzq
    ? [
        { x: 60, y: 10 },
        { x: 72, y: 12 },
        { x: 84, y: 10 },
      ]
    : [
        { x: 80, y: 10 },
        { x: 68, y: 12 },
        { x: 56, y: 10 },
      ];
}

// ---------- FALTA LATERAL CENTRADA ----------
else if (tipo.startsWith("falta lateral centrada")) {
  cortoX = 70;
  cortoY = p.y + 4;

  destinosArea = [
    { x: 58, y: 10 },
    { x: 70, y: 9 },
    { x: 82, y: 10 },
  ];
}

// ---------- FALTA DIAGONAL ----------
else if (tipo.startsWith("falta diagonal")) {
  cortoX = esIzq ? p.x + 10 : p.x - 10;
  cortoY = p.y + 4;

  destinosArea = esIzq
    ? [
        { x: 58, y: 9 },
        { x: 70, y: 10 },
        { x: 84, y: 8 },
      ]
    : [
        { x: 82, y: 8 },
        { x: 70, y: 10 },
        { x: 56, y: 9 },
      ];
}

// ---------- FALTA DIRECTA CENTRADA ----------
else if (tipo.startsWith("falta directa centrada")) {
  cortoX = 70;
  cortoY = p.y + 3;

  destinosArea = [
    { x: 70, y: 4 },
    { x: 66, y: 6 },
    { x: 74, y: 6 },
  ];
}

// ---------- FALTA DIRECTA PERFILADA ----------
else if (tipo.startsWith("falta directa perfilada")) {
  cortoX = esIzq ? p.x + 8 : p.x - 8;
  cortoY = p.y + 3;

  destinosArea = esIzq
    ? [
        { x: 64, y: 5 },
        { x: 70, y: 4 },
        { x: 76, y: 6 },
      ]
    : [
        { x: 76, y: 5 },
        { x: 70, y: 4 },
        { x: 64, y: 6 },
      ];
}

// ---------- FALTA INDIRECTA ----------
else if (tipo.startsWith("falta indirecta")) {
  cortoX = 70;
  cortoY = p.y + 4;

  destinosArea = [
    { x: 60, y: 8 },
    { x: 70, y: 9 },
    { x: 80, y: 8 },
  ];
}

// ---------- PENALTI ----------
else if (tipo.startsWith("penalti")) {
  cortoX = 70;
  cortoY = 18;

  destinosArea = [
    { x: 66, y: 3 },
    { x: 70, y: 2.5 },
    { x: 74, y: 3 },
  ];
}

// Destino real del envío: las zonas de caída registradas para este origen.
// Antes se elegía con `value % destinosArea.length`, así que la flecha
// apuntaba a un sitio arbitrario que no describía nada.
const caidasOrigen = data?.caidas || {};

const enviosAlArea = Object.values(caidasOrigen).reduce(
  (acc, n) => acc + n,
  0
);

const destinosReales = Object.entries(caidasOrigen)
  .map(([zonaNombre, n]) => {
    const c = caidaCoords(zonaNombre, esIzq, esDer);
    if (!c) return null;

    return {
      zona: zonaNombre,
      n,
      share: enviosAlArea ? n / enviosAlArea : 0,
      ...c,
    };
  })
  .filter(
    (d): d is NonNullable<typeof d> => d !== null
  )
  .sort((a, b) => b.n - a.n)
  // Sólo los destinos con peso real: por debajo del 25% ensucian el campo.
  .filter((d, i) => i === 0 || d.share >= 0.25)
  .slice(0, 3);

// Sin zona de caída registrada usamos el destino de referencia del tipo de acción.
if (destinosReales.length === 0 && destinosArea.length > 0) {
  targetX = destinosArea[0].x;
  targetY = destinosArea[0].y;
}

const atenuado =
  !!selectedOrigin && selectedOrigin.key !== key;

    return (
      <g
  key={key}
  filter="url(#shadow)"
  opacity={atenuado ? 0.22 : 1}
  onClick={() =>
    setSelectedOrigin({
      key,
      tipo: "origen",
    })
  }
  style={{ cursor: "pointer" }}
>
  <title>
    {`${name} · ${value} acciones · ${(data?.xg || 0).toFixed(2)} xG`}
  </title>

  {/* Envíos al área (DORADO): una flecha por zona de caída real */}
 {ratioDirecto > 0 &&
  (destinosReales.length > 0
    ? destinosReales
    : [
        {
          zona: "Sin zona registrada",
          n: 0,
          share: 1,
          x: targetX,
          y: targetY,
        },
      ]
  ).map((d) => {
    const curva = `M ${p.x} ${p.y} Q ${(p.x + d.x) / 2} ${Math.max(
      6,
      p.y - 10
    )} ${d.x} ${d.y}`;

    // El grosor sigue el peso de esa zona dentro del origen.
    const peso = ratioDirecto * (0.45 + d.share * 0.55);

    return (
      <g key={`${key}-${d.zona}`}>
        <path
          d={curva}
          fill="none"
          stroke="#F5E7C8"
          strokeWidth={2.8 + peso * 1.2}
          strokeLinecap="round"
          opacity="0.12"
          filter="url(#pathGlow)"
        />
        <path
          d={curva}
          fill="none"
          stroke="url(#goldPath)"
          strokeWidth={1.4 + peso * 1.1}
          strokeLinecap="round"
          opacity={0.7 + d.share * 0.25}
          markerEnd="url(#arrowGold)"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrigin({
              key,
              tipo: "directo",
            });
          }}
          style={{ cursor: "pointer" }}
        >
          <title>
            {d.n > 0
              ? `${d.zona}: ${d.n} envíos (${(d.share * 100).toFixed(
                  0
                )}%)`
              : "Envío al área sin zona de caída registrada"}
          </title>
        </path>
      </g>
    );
  })}

{/* Juego en corto (AZUL) */}
{ratioCorto > 0 && (
  <>
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + cortoX) / 2} ${p.y - 3} ${cortoX} ${cortoY}`}
      fill="none"
      stroke="#DBEAFE"
      strokeWidth={2.4 + ratioCorto * 1.0}
      strokeLinecap="round"
      opacity="0.10"
      filter="url(#pathGlow)"
    />
    <path
      d={`M ${p.x} ${p.y} Q ${(p.x + cortoX) / 2} ${p.y - 3} ${cortoX} ${cortoY}`}
      fill="none"
      stroke="url(#bluePath)"
      strokeWidth={1.2 + ratioCorto * 0.9}
      strokeLinecap="round"
      strokeDasharray="3 2.5"
      opacity={0.75 + ratioCorto * 0.2}
      markerEnd="url(#arrowBlue)"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedOrigin({
          key,
          tipo: "corto",
        });
      }}
      style={{ cursor: "pointer" }}
    />
  </>
)}

  {/* Anillo exterior: verde cuanto más gol u ocasión produce este origen */}
  <circle
    cx={p.x}
    cy={p.y}
    r={r + 0.9}
    fill="none"
    stroke={peligroColor(ratioPeligro)}
    strokeWidth="0.9"
    opacity="0.95"
  />

  {/* Nodo principal */}
  <circle
    cx={p.x}
    cy={p.y}
    r={r}
    fill="url(#goldNode)"
    stroke="#F5E7C8"
    strokeWidth="0.35"
  />

  {/* Valor de la métrica activa */}
  <text
    x={p.x}
    y={p.y + 0.8}
    textAnchor="middle"
    fill="#FFFFFF"
    fontSize="2.2"
    fontWeight="700"
  >
    {metric === "xg" ? (data?.xg || 0).toFixed(2) : value}
  </text>
</g>
    );
  })}

      {/* Zonas de remate */}
      {Object.entries(remateStats).map(([name, stat]) => {
        const p = remateCoords[name];
        if (!p || stat.xg <= 0) return null;

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
{/* Popup origen */}
{selectedOrigin && (() => {
  const envioStats = originEnvios[selectedOrigin.key]?.envios || {};

  const cortoCount = envioStats["Corto"] || 0;

  const directoCount =
    (envioStats["Directo"] || 0) +
    (envioStats["Tenso"] || 0) +
    (envioStats["Bombeado"] || 0);

  const [popupName, popupPerfil] = selectedOrigin.key.split("__");

  const subtitle =
    selectedOrigin.tipo === "corto"
      ? "Juego en corto"
      : selectedOrigin.tipo === "directo"
      ? "Envíos al área"
      : "Todas las variantes";

  return (
    <div className="absolute left-2 right-2 top-2 max-h-[calc(100%-1rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-80 sm:max-h-[26rem]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-tight">
            {popupName}
          </h3>

          <p className="mt-0.5 break-words text-xs text-slate-400">
            {popupPerfil ? `${popupPerfil} · ` : ""}
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          aria-label="Cerrar detalle"
          onClick={() => setSelectedOrigin(null)}
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Resumen */}
      <div className="mb-4 rounded-xl border border-[#C8A96B]/20 bg-[#0B1728] p-3">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Acciones registradas
          </p>
          <p className="text-xl font-semibold text-[#E7D2A0]">
            {originCounts[selectedOrigin.key]}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-300" />
              <p className="text-[11px] uppercase tracking-wide text-blue-200">
                Juego en corto
              </p>
            </div>
            <p className="mt-1 text-lg font-semibold text-blue-100">
              {cortoCount}
            </p>
          </div>

          <div className="rounded-lg border border-[#C8A96B]/20 bg-[#C8A96B]/10 p-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#E7D2A0]" />
              <p className="text-[11px] uppercase tracking-wide text-[#E7D2A0]">
                Envíos al área
              </p>
            </div>
            <p className="mt-1 text-lg font-semibold text-[#F5E7C8]">
              {directoCount}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <p className="text-[11px] text-slate-400">xG generado</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {(originEnvios[selectedOrigin.key]?.xg || 0).toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <p className="text-[11px] text-slate-400">Gol u ocasión</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {originCounts[selectedOrigin.key]
                ? (
                    ((originEnvios[selectedOrigin.key]?.peligro || 0) /
                      originCounts[selectedOrigin.key]) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Reparto real de zonas de caída: es lo que dibujan las flechas doradas */}
      {(() => {
        const caidas = Object.entries(
          originEnvios[selectedOrigin.key]?.caidas || {}
        ).sort((a, b) => b[1] - a[1]);

        const totalCaidas = caidas.reduce(
          (acc, [, n]) => acc + n,
          0
        );

        if (!totalCaidas) return null;

        return (
          <div className="mb-4 rounded-xl border border-white/10 bg-[#0B1728] p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
              Dónde cae el envío
            </p>

            <div className="space-y-2">
              {caidas.map(([zonaNombre, n]) => (
                <div key={zonaNombre}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">{zonaNombre}</span>
                    <span className="text-slate-500">
                      {n} · {((n / totalCaidas) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className="h-1.5 rounded-full bg-[#C8A96B]"
                      style={{
                        width: `${(n / totalCaidas) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Lista de acciones */}
      <div className="space-y-2">
        {rows
          .filter((r) => {
            const tipo = normalizeTipoAccion(
              r.tipoAccion ?? r.Tipo_Accion ?? ""
            );

            const perfil = (r.perfil ?? r.Perfil ?? "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            if (`${tipo}__${perfil}` !== selectedOrigin.key) return false;

            const envio = (r.tipoEnvio ?? r.Tipo_Envio ?? "Directo").trim();

            if (selectedOrigin.tipo === "corto") {
              return envio === "Corto";
            }

            if (selectedOrigin.tipo === "directo") {
              return (
                envio === "Directo" ||
                envio === "Tenso" ||
                envio === "Bombeado"
              );
            }

            return true;
          })
          .map((r, idx) => {
            const envio = (r.tipoEnvio ?? r.Tipo_Envio ?? "Directo").trim();
            const esCorto = envio === "Corto";

            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 break-words text-sm font-medium leading-snug">
                    {r.jornada ?? r.JORNADA ?? "Partido"}
                    {(r.rival ?? r.Rival) && (
                      <span className="text-slate-400">
                        {" "}· {r.rival ?? r.Rival}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                    Min {r.minuto ?? r.Minuto ?? "-"}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                    <p className="text-slate-400">Tipo de acción</p>
                    <p className="mt-0.5 font-medium text-white">{r.tipoAccion ?? r.Tipo_Accion ?? "-"}</p>
                  </div>
                  <span
                    className={
                      esCorto
                        ? "rounded-lg border border-blue-400/30 bg-blue-400/10 px-2 py-1.5 text-center leading-snug text-blue-200"
                        : "rounded-lg border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-1.5 text-center leading-snug text-[#E7D2A0]"
                    }
                  >
                    {esCorto ? "Juego en corto" : envio}
                  </span>

                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center font-medium leading-snug text-[#E7D2A0]">
                    {r.resultadoFinal ?? r.Resultado_Final ?? "-"}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
})()}

    {/* Popup remate */}
    {selectedRemate && remateStats[selectedRemate]?.xg > 0 && (
      <div className="absolute bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-80 sm:max-h-80">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold leading-tight">{selectedRemate}</h3>
            <p className="mt-0.5 text-xs text-slate-400">Detalle de los remates</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar detalle de remates"
            onClick={() => setSelectedRemate(null)}
            className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-emerald-200">xG acumulado</p>
          <p className="text-xl font-semibold text-emerald-100">{remateStats[selectedRemate].xg.toFixed(2)}</p>
        </div>

        <div className="space-y-2">
          {remateStats[selectedRemate].actions.map((r, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              <p className="break-words text-sm font-medium">
                {r.rematador ?? r.Rematador ?? "Sin rematador"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                  <dt className="text-slate-400">Tipo de remate</dt>
                  <dd className="mt-0.5 font-medium">{r.tipoRemate ?? r.Tipo_Remate ?? "-"}</dd>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                  <dt className="text-slate-400">Minuto</dt>
                  <dd className="mt-0.5 font-medium">{r.minuto ?? r.Minuto ?? "-"}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <dt className="text-slate-400">xG</dt>
                  <dd className="mt-0.5 font-medium">{Number(r.xG ?? 0).toFixed(2)}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <dt className="text-slate-400">Tipo de acción</dt>
                  <dd className="mt-0.5 font-medium">{r.tipoAccion ?? r.Tipo_Accion ?? "-"}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <dt className="text-slate-400">Resultado</dt>
                  <dd className="mt-0.5 font-medium text-[#E7D2A0]">{r.resultadoFinal ?? r.Resultado_Final ?? "-"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  </div>

  );
  }
