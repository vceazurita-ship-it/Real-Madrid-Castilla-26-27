"use client";

import { useMemo, useState } from "react";

type RecordRow = Record<string, string>;

type ThrowInFieldProps = {
  rows: RecordRow[];
  mode: "offensive" | "defensive";
  read: (row: RecordRow, key: string) => string;
};

type FieldNode = {
  key: string;
  side: "left" | "right";
  zone: number;
  label: string;
  count: number;
  rows: RecordRow[];
};

// Z1 = Nuestra portería (arriba), Z2 = Intermedia, Z3 = Portería rival (abajo)
const ZONE_Y = [15, 50, 85, 15, 50, 85];

function getSide(value: string): "left" | "right" {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized.includes("izq") || normalized.includes("left") ? "left" : "right";
}

function getZone(value: string) {
  const match = value.match(/(?:zona|z)?\s*([1-6])/i) ?? value.match(/([1-6])/);
  return match ? Number(match[1]) : 3;
}

function targetFor(node: FieldNode, mode: "offensive" | "defensive", read: ThrowInFieldProps["read"]) {
  const falls = node.rows.map((row) => read(row, "Zona_Caida").toLowerCase());
  const combined = falls.join(" ");
  const direction = mode === "offensive" ? -1 : 1;
  const x = combined.includes("izq") ? 32 : combined.includes("der") ? 68 : 50;
  const y = Math.max(12, Math.min(88, ZONE_Y[node.zone - 1] + direction * 24));
  return { x, y };
}

export function ThrowInField({ rows, mode, read }: ThrowInFieldProps) {
  const [selected, setSelected] = useState<FieldNode | null>(null);
  const isOffensive = mode === "offensive";

  const nodes = useMemo(() => {
    const grouped = new Map<string, FieldNode>();

    rows.forEach((row) => {
      const zoneLabel = read(row, "Zona_Saque");
      if (!zoneLabel) return;

      const side = getSide(`${zoneLabel} ${read(row, "Perfil")}`);
      const zone = getZone(zoneLabel);
      const key = `${side}-${zone}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
        existing.rows.push(row);
      } else {
        grouped.set(key, { key, side, zone, label: zoneLabel, count: 1, rows: [row] });
      }
    });

    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [rows, read]);

  const maxCount = Math.max(...nodes.map((node) => node.count), 1);

  return (
    <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Situación global</p>
          <h2 className="mt-1 text-xl font-semibold md:text-2xl">Mapa de saques de banda {isOffensive ? "ofensivos" : "defensivos"}</h2>
        </div>
        <p className="text-sm text-slate-400">Pulsa una zona para ver las acciones registradas.</p>
      </div>

      <div 
        className="relative mx-auto aspect-[16/10] w-full max-w-[1200px] overflow-hidden rounded-2xl border border-emerald-200/20 shadow-inner"
        style={{ backgroundImage: "url(/emotional-field-bg.png)", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label="Campo de fútbol completo con distribución de saques de banda">
          <defs>
            <filter id="field-glow"><feGaussianBlur stdDeviation="0.7" /></filter>
          </defs>

          {nodes.map((node) => {
            const x = node.side === "left" ? 5 : 95;
            const y = ZONE_Y[node.zone - 1];
            const target = targetFor(node, mode, read);
            const radius = 2.5 + Math.sqrt(node.count / maxCount) * 3.6;
            const color = isOffensive ? "#C8A96B" : "#F08A96";

            return (
              <g key={node.key} className="cursor-pointer" onClick={() => setSelected(node)}>
                <path
                  d={`M ${x} ${y} Q ${(x + target.x) / 2} ${(y + target.y) / 2 - 4} ${target.x} ${target.y}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.7"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                />
                <circle cx={target.x} cy={target.y} r="1.25" fill={color} fillOpacity="0.75" filter="url(#field-glow)" />
                <circle cx={x} cy={y} r={radius + 0.9} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="0.55" />
                <circle cx={x} cy={y} r={radius} fill={color} fillOpacity="0.96" stroke="#FFF7E5" strokeWidth="0.35" />
                <text x={x} y={y + 0.7} textAnchor="middle" fill="#0B1728" fontSize="2.2" fontWeight="700">{node.count}</text>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {isOffensive ? "Ataque hacia la portería rival (abajo)" : "Amenaza rival hacia nuestra portería (arriba)"}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {nodes.length ? `${nodes.length} zonas activas · tamaño = volumen de acciones` : "Sin zonas activas todavía"}
        </div>

        {!nodes.length ? (
          <div className="absolute inset-0 grid place-items-center bg-[#07111F]/45 p-6 text-center">
            <div>
              <p className="text-lg font-medium">El mapa aparecerá al registrar los saques.</p>
              <p className="mt-1 text-sm text-slate-300">Completa el campo <strong>Zona_Saque</strong> en la hoja para situar cada acción en el campo.</p>
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="absolute inset-x-3 bottom-3 max-h-[64%] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-[360px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#C8A96B]">Zona de saque</p>
                <h3 className="mt-1 text-lg font-semibold">{selected.label}</h3>
                <p className="mt-1 text-sm text-slate-400">{selected.count} {selected.count === 1 ? "acción" : "acciones"} registradas</p>
              </div>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(null)} className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="mt-4 space-y-2">
              {selected.rows.map((row, index) => (
                <div key={`${read(row, "JORNADA")}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{read(row, "JORNADA") || "Partido"} <span className="font-normal text-slate-400">· {read(row, "Rival") || "Sin rival"}</span></p>
                    <p className="shrink-0 text-slate-400">Min {read(row, "Minuto") || "-"}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <p className="rounded-lg bg-white/5 px-2 py-1.5"><span className="block text-slate-400">Envío</span>{read(row, "Tipo_Envio") || "-"}</p>
                    <p className="rounded-lg bg-white/5 px-2 py-1.5"><span className="block text-slate-400">Caída</span>{read(row, "Zona_Caida") || "-"}</p>
                    <p className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5"><span className="block text-slate-400">Resultado</span>{read(row, "Resultado_Final") || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
