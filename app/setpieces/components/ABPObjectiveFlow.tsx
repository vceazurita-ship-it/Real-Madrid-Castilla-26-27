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

const gold = "#C8A96B";
const green = "#10B981";
const blue = "#3B82F6";
const amber = "#F59E0B";
const gray = "#64748B";

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
  const [selected, setSelected] = useState<{ objetivo: string; zona: string; consecuencia: string } | null>(null);

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
    20 + (index * (150 / Math.max(1, total - 1)));

  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111F] p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-white">
          Flujo ofensivo
        </h2>
        <p className="text-sm text-slate-400">
          Objetivo → Zona de destino → Consecuencia
        </p>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox="0 0 760 190" className="w-full min-w-[700px]">
          {objetivos.map(([o], oi) =>
            zonas.map(([z], zi) => {
              const value = data.linksOZ.get(`${o}__${z}`) || 0;
              if (!value) return null;

              const y1 = yFor(oi, objetivos.length);
              const y2 = yFor(zi, zonas.length);
              const w = 1 + (value / maxLink) * 8;

              return (
                <path
                  key={`${o}-${z}`}
                  d={`M 170 ${y1} C 250 ${y1}, 290 ${y2}, 360 ${y2}`}
                  fill="none"
                  stroke={gold}
                  strokeWidth={w}
                  strokeLinecap="round"
                  opacity={0.75}
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
              const w = 1 + (value / maxLink) * 8;

              const color =
                c === "Gol / Gran ocasión"
                  ? green
                  : c === "Remate"
                  ? green
                  : c === "Rechace"
                  ? blue
                  : c === "Despeje"
                  ? amber
                  : gray;

              return (
                <path
                  key={`${z}-${c}`}
                  d={`M 430 ${y1} C 510 ${y1}, 550 ${y2}, 620 ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={w}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              );
            })
          )}

          {objetivos.map(([o, count], i) => {
            const y = yFor(i, objetivos.length);
            return (
              <g
                key={o}
                onClick={() => setSelected({ objetivo: o, zona: "", consecuencia: "" })}
                style={{ cursor: "pointer" }}
              >
                <rect x="10" y={y - 10} width="150" height="22" rx="8" fill="#0F172A" stroke="#334155" />
                <text x="20" y={y + 4} fill="white" fontSize="12" fontWeight="600">
                  {o}
                </text>
                <text x="145" y={y + 4} textAnchor="end" fill="#E7D2A0" fontSize="12" fontWeight="700">
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
                onClick={() => setSelected({ objetivo: "", zona: z, consecuencia: "" })}
                style={{ cursor: "pointer" }}
              >
                <rect x="360" y={y - 10} width="150" height="22" rx="8" fill="#0F172A" stroke="#334155" />
                <text x="370" y={y + 4} fill="white" fontSize="12" fontWeight="600">
                  {z}
                </text>
                <text x="495" y={y + 4} textAnchor="end" fill="#E7D2A0" fontSize="12" fontWeight="700">
                  {count}
                </text>
              </g>
            );
          })}

          {consecuencias.map(([c, count], i) => {
            const y = yFor(i, consecuencias.length);
            const color =
              c === "Gol / Gran ocasión"
                ? green
                : c === "Remate"
                ? green
                : c === "Rechace"
                ? blue
                : c === "Despeje"
                ? amber
                : gray;

            return (
              <g
                key={c}
                onClick={() => setSelected({ objetivo: "", zona: "", consecuencia: c })}
                style={{ cursor: "pointer" }}
              >
                <rect x="620" y={y - 10} width="130" height="22" rx="8" fill="#0F172A" stroke={color} />
                <text x="630" y={y + 4} fill="white" fontSize="12" fontWeight="600">
                  {c}
                </text>
                <text x="740" y={y + 4} textAnchor="end" fill={color} fontSize="12" fontWeight="700">
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {selected.objetivo || selected.zona || selected.consecuencia}
              </div>
              <div className="text-slate-400">
                Acciones relacionadas
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
              ×
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
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
              .slice(0, 20)
              .map((r, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 bg-[#0B1320] p-3">
                  <div className="font-medium">
                    {r.jornada || "Partido"}
                    {r.rival ? ` · ${r.rival}` : ""}
                  </div>
                  <div className="text-slate-300">
                    Min {r.minuto ?? "-"}
                    {r.rematador ? ` · ${r.rematador}` : ""}
                  </div>
                  <div className="text-slate-400">
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