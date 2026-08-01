"use client";

import { useMemo, useState } from "react";

export type ABPRow = {
jornada?: number | string;
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

const COLORS = {
bg: "#07111F",
card: "#0B1320",
border: "#233248",
gold: "#C8A96B",
goldLight: "#E7D2A0",
green: "#10B981",
blue: "#3B82F6",
amber: "#F59E0B",
gray: "#64748B",
};

function objetivoDesdeAccion(tipo: string): string {
const t = (tipo || "").toLowerCase();
if (t.includes("penalti") || t.includes("directa")) return "Finalizar";
if (t.includes("córner") || t.includes("corner")) return "Finalizar";
if (t.includes("diagonal")) return "Progresar";
if (t.includes("indirecta")) return "Fijar";
if (t.includes("lateral")) return "Progresar";
return "Progresar";
}

function zonaDestino(zona?: string): string {
const z = (zona || "").toLowerCase();
if (z.includes("1p") || z.includes("primer")) return "Primer palo";
if (z.includes("2p") || z.includes("segundo")) return "Segundo palo";
if (z.includes("6m")) return "6 m";
if (z.includes("penal")) return "Punto de penalti";
if (z.includes("fuera")) return "Fuera de área";
return "Borde del área";
}

function consecuencia(r: ABPRow): string {
const xg =
typeof r.xG === "number"
? r.xG
: parseFloat(String(r.xG || 0).replace(",", "."));

if (Number.isFinite(xg) && xg >= 0.3) return "Gol / Gran ocasión";
if (Number.isFinite(xg) && xg > 0) return "Remate";

const t = (r.tipoRemate || "").toLowerCase();
if (t.includes("despeje")) return "Despeje";
if (t.includes("rechace")) return "Rechace";
return "Pérdida";
}

export default function ABPObjectiveFlow({ rows }: { rows: ABPRow[] }) {
const [selected, setSelected] = useState<{
objetivo: string;
zona: string;
consecuencia: string;
} | null>(null);

const data = useMemo(() => {
const objetivos = new Map<string, number>();
const zonas = new Map<string, number>();
const consecuencias = new Map<string, number>();
const linksOZ = new Map<string, number>();
const linksZC = new Map<string, number>();

rows.forEach((r) => {
  const o = objetivoDesdeAccion(r.tipoAccion);
  const z = zonaDestino(r.zonaRemate);
  const c = consecuencia(r);

  objetivos.set(o, (objetivos.get(o) || 0) + 1);
  zonas.set(z, (zonas.get(z) || 0) + 1);
  consecuencias.set(c, (consecuencias.get(c) || 0) + 1);

  linksOZ.set(`${o}__${z}`, (linksOZ.get(`${o}__${z}`) || 0) + 1);
  linksZC.set(`${z}__${c}`, (linksZC.get(`${z}__${c}`) || 0) + 1);
});

return { objetivos, zonas, consecuencias, linksOZ, linksZC };

}, [rows]);

const maxLink = Math.max(
1,
...Array.from(data.linksOZ.values()),
...Array.from(data.linksZC.values())
);

const objetivos = Array.from(data.objetivos.entries());
const zonas = Array.from(data.zonas.entries());
const consecuencias = Array.from(data.consecuencias.entries());

const yFor = (index: number, total: number) =>
26 + index * (178 / Math.max(1, total - 1));

const totalAcciones = rows.length;
const remates = rows.filter((r) => consecuencia(r) === "Remate").length;
const goles = rows.filter((r) => consecuencia(r) === "Gol / Gran ocasión").length;
const xgTotal = rows.reduce((acc, r) => {
const x =
typeof r.xG === "number"
? r.xG
: parseFloat(String(r.xG || 0).replace(",", "."));
return acc + (Number.isFinite(x) ? x : 0);
}, 0);

return (
<div className="w-full">
  <div className="relative w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#05101D] p-4">
    <svg viewBox="0 0 820 230" className="w-full min-w-[760px]">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="goldPath" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8A6A35" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#C8A96B" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#E7D2A0" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <text x="10" y="14" fill="#94A3B8" fontSize="11" fontWeight="600">
        Objetivo
      </text>
      <text x="340" y="14" fill="#94A3B8" fontSize="11" fontWeight="600">
        Zona de destino
      </text>
      <text x="640" y="14" fill="#94A3B8" fontSize="11" fontWeight="600">
        Consecuencia
      </text>

      {objetivos.map(([o], oi) =>
        zonas.map(([z], zi) => {
          const value = data.linksOZ.get(`${o}__${z}`) || 0;
          if (!value) return null;

          const y1 = yFor(oi, objetivos.length);
          const y2 = yFor(zi, zonas.length);
          const w = 2 + (value / maxLink) * 10;

          return (
            <path
              key={`${o}-${z}`}
              d={`M 170 ${y1} C 250 ${y1}, 285 ${y2}, 360 ${y2}`}
              fill="none"
              stroke="url(#goldPath)"
              strokeWidth={w}
              strokeLinecap="round"
              opacity={0.8}
              filter="url(#glow)"
            />
          );
        })
      )}

      {zonas.map(([z], zi) =>
        consecuencias.map(([c], ci) => {
          const value = data.linksZC.get(`${z}__${c}`) || 0;
          if (!value) return null;

          const y1 = yFor(zi, zonas.length);
          const y2 = yFor(ci, consecuencias.length);
          const w = 2 + (value / maxLink) * 10;

          const color =
            c === "Gol / Gran ocasión"
              ? COLORS.green
              : c === "Remate"
              ? COLORS.green
              : c === "Rechace"
              ? COLORS.blue
              : c === "Despeje"
              ? COLORS.amber
              : COLORS.gray;

          return (
            <path
              key={`${z}-${c}`}
              d={`M 470 ${y1} C 550 ${y1}, 585 ${y2}, 660 ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={w}
              strokeLinecap="round"
              opacity={0.82}
              filter="url(#glow)"
            />
          );
        })
      )}

      {objetivos.map(([o, count], i) => {
        const y = yFor(i, objetivos.length);
        return (
          <g
            key={o}
            onClick={() =>
              setSelected({ objetivo: o, zona: "", consecuencia: "" })
            }
            style={{ cursor: "pointer" }}
          >
            <rect
              x="10"
              y={y - 14}
              width="150"
              height="28"
              rx="10"
              fill="#0B1320"
              stroke="#334155"
            />
            <circle
              cx="26"
              cy={y}
              r="5"
              fill={COLORS.gold}
              stroke={COLORS.goldLight}
            />
            <text
              x="40"
              y={y + 4}
              fill="white"
              fontSize="12"
              fontWeight="600"
            >
              {o}
            </text>
            <text
              x="148"
              y={y + 4}
              textAnchor="end"
              fill={COLORS.goldLight}
              fontSize="12"
              fontWeight="700"
            >
              {count}
            </text>
          </g>
        );
      })}

      {zonas.map(([z, count], i) => {
        const y = yFor(i, zonas.length);
        return (
          <g
            key={z}
            onClick={() =>
              setSelected({ objetivo: "", zona: z, consecuencia: "" })
            }
            style={{ cursor: "pointer" }}
          >
            <rect
              x="360"
              y={y - 14}
              width="150"
              height="28"
              rx="10"
              fill="#0B1320"
              stroke="#334155"
            />
            <circle
              cx="376"
              cy={y}
              r="5"
              fill={COLORS.gold}
              stroke={COLORS.goldLight}
            />
            <text
              x="390"
              y={y + 4}
              fill="white"
              fontSize="12"
              fontWeight="600"
            >
              {z}
            </text>
            <text
              x="498"
              y={y + 4}
              textAnchor="end"
              fill={COLORS.goldLight}
              fontSize="12"
              fontWeight="700"
            >
              {count}
            </text>
          </g>
        );
      })}

      {consecuencias.map(([c, count], i) => {
        const y = yFor(i, consecuencias.length);

        const color =
          c === "Gol / Gran ocasión"
            ? COLORS.green
            : c === "Remate"
            ? COLORS.green
            : c === "Rechace"
            ? COLORS.blue
            : c === "Despeje"
            ? COLORS.amber
            : COLORS.gray;

        return (
          <g
            key={c}
            onClick={() =>
              setSelected({ objetivo: "", zona: "", consecuencia: c })
            }
            style={{ cursor: "pointer" }}
          >
            <rect
              x="660"
              y={y - 14}
              width="150"
              height="28"
              rx="10"
              fill="#0B1320"
              stroke={color}
            />
            <circle cx="676" cy={y} r="5" fill={color} />
            <text
              x="690"
              y={y + 4}
              fill="white"
              fontSize="12"
              fontWeight="600"
            >
              {c}
            </text>
            <text
              x="798"
              y={y + 4}
              textAnchor="end"
              fill={color}
              fontSize="12"
              fontWeight="700"
            >
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  </div>

  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Acciones
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {totalAcciones}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Remates
      </div>
      <div className="mt-1 text-2xl font-semibold text-emerald-400">
        {remates}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Grandes ocasiones
      </div>
      <div className="mt-1 text-2xl font-semibold text-emerald-400">
        {goles}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        xG total
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {xgTotal.toFixed(2)}
      </div>
    </div>
  </div>

  {selected && (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {selected.objetivo || selected.zona || selected.consecuencia}
          </h3>
          <p className="text-sm text-slate-400">
            Acciones relacionadas
          </p>
        </div>

        <button
          onClick={() => setSelected(null)}
          className="rounded-lg border border-white/10 px-3 py-1 text-slate-400 hover:text-white hover:border-white/20"
        >
          ×
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows
          .filter((r) => {
            const o = objetivoDesdeAccion(r.tipoAccion);
            const z = zonaDestino(r.zonaRemate);
            const c = consecuencia(r);

            return (
              (!selected.objetivo || selected.objetivo === o) &&
              (!selected.zona || selected.zona === z) &&
              (!selected.consecuencia || selected.consecuencia === c)
            );
          })
          .slice(0, 12)
          .map((r, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-[#07111F] p-3"
            >
              <div className="font-medium text-white">
                {r.jornada || "Partido"}
                {r.rival ? ` · ${r.rival}` : ""}
              </div>

              <div className="mt-1 text-sm text-slate-300">
                Min {r.minuto ?? "-"}
                {r.rematador ? ` · ${r.rematador}` : ""}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                {r.tipoAccion} → {zonaDestino(r.zonaRemate)} → {consecuencia(r)}
              </div>
            </div>
          ))}
      </div>
    </div>
  )}
</div>

);
}