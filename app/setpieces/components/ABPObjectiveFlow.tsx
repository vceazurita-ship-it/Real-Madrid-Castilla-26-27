"use client";

// Reemplaza el componente actual por esta versión.
// El flujo pasa a ser: Intención → Zona de caída → Resultado final.

import { useMemo, useState } from "react";

export type ABPRow = {
jornada?: number | string;
rival?: string;
minuto?: number | string;
tipoAccion: string;
tipoEnvio?: string;
intencion?: string;
zonaCaida?: string;
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

function objetivo(r: ABPRow): string {
return (r.intencion || "Sin definir").trim();
}

function zona(r: ABPRow): string {
return (r.zonaCaida || "Sin zona").trim();
}

function resultado(r: ABPRow): string {
const t = (r.resultadoFinal || "Nada").trim();
if (t.toLowerCase() === "gol") return "Gol";
if (t.toLowerCase().includes("ocas")) return "Ocasión";
if (t.toLowerCase().includes("abp")) return "ABP";
if (t.toLowerCase().includes("transici")) return "Transición rival";
return "Nada";
}

export default function ABPObjectiveFlow({ rows }: { rows: ABPRow[] }) {
const [selected, setSelected] = useState<{
  accion: string;
  objetivo: string;
  zona: string;
  resultado: string;
} | null>(null);

const data = useMemo(() => {
  const acciones = new Map<string, number>();
  const objetivos = new Map<string, number>();
  const zonas = new Map<string, number>();
  const resultados = new Map<string, number>();

  const linksAO = new Map<string, number>();
  const linksOZ = new Map<string, number>();
  const linksZR = new Map<string, number>();

  rows.forEach((r) => {
    const a = (r.tipoAccion || "Sin acción").trim();
    const o = objetivo(r);
    const z = zona(r);
    const res = resultado(r);

    acciones.set(a, (acciones.get(a) || 0) + 1);
    objetivos.set(o, (objetivos.get(o) || 0) + 1);
    zonas.set(z, (zonas.get(z) || 0) + 1);
    resultados.set(res, (resultados.get(res) || 0) + 1);

    linksAO.set(`${a}__${o}`, (linksAO.get(`${a}__${o}`) || 0) + 1);
    linksOZ.set(`${o}__${z}`, (linksOZ.get(`${o}__${z}`) || 0) + 1);
    linksZR.set(`${z}__${res}`, (linksZR.get(`${z}__${res}`) || 0) + 1);
  });

  return {
    acciones,
    objetivos,
    zonas,
    resultados,
    linksAO,
    linksOZ,
    linksZR,
  };
}, [rows]);

const maxLink = Math.max(
  1,
  ...Array.from(data.linksAO.values()),
  ...Array.from(data.linksOZ.values()),
  ...Array.from(data.linksZR.values())
);

const acciones = Array.from(data.acciones.entries());
const objetivos = Array.from(data.objetivos.entries());
const zonas = Array.from(data.zonas.entries());
const resultados = Array.from(data.resultados.entries());

const yFor = (index: number, total: number) =>
  44 + index * (160 / Math.max(1, total - 1));

const totalAcciones = rows.length;
const ocasiones = rows.filter((r) => resultado(r) === "Ocasión").length;
const goles = rows.filter((r) => resultado(r) === "Gol").length;
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
<svg viewBox="0 0 1120 260" className="w-full min-w-[980px]">
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

      <text x="10" y="22" fill="#94A3B8" fontSize="11" fontWeight="600">
  Tipo de acción
</text>
<text x="280" y="22" fill="#94A3B8" fontSize="11" fontWeight="600">
  Intención
</text>
<text x="560" y="22" fill="#94A3B8" fontSize="11" fontWeight="600">
  Zona de caída
</text>
<text x="860" y="22" fill="#94A3B8" fontSize="11" fontWeight="600">
  Resultado final
</text>

{acciones.map(([a], ai) =>
  objetivos.map(([o], oi) => {
    const value = data.linksAO.get(`${a}__${o}`) || 0;
    if (!value) return null;

    const y1 = yFor(ai, acciones.length);
    const y2 = yFor(oi, objetivos.length);
    const w = 2 + (value / maxLink) * 10;

    return (
      <path
        key={`${a}-${o}`}
        d={`M 250 ${y1} C 290 ${y1}, 310 ${y2}, 350 ${y2}`}
        fill="none"
        stroke="url(#goldPath)"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={0.82}
        filter="url(#glow)"
      />
    );
  })
)}

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
        d={`M 520 ${y1} C 560 ${y1}, 580 ${y2}, 620 ${y2}`}
        fill="none"
        stroke="url(#goldPath)"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={0.82}
        filter="url(#glow)"
      />
    );
  })
)}

{zonas.map(([z], zi) =>
  resultados.map(([res], ri) => {
    const value = data.linksZR.get(`${z}__${res}`) || 0;
    if (!value) return null;

    const y1 = yFor(zi, zonas.length);
    const y2 = yFor(ri, resultados.length);
    const w = 2 + (value / maxLink) * 10;

    const color =
      res === "Gol"
        ? COLORS.green
        : res === "Ocasión"
        ? COLORS.green
        : res === "ABP"
        ? COLORS.blue
        : res === "Transición rival"
        ? COLORS.amber
        : COLORS.gray;

    return (
      <path
        key={`${z}-${res}`}
        d={`M 760 ${y1} C 800 ${y1}, 820 ${y2}, 860 ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        opacity={0.84}
        filter="url(#glow)"
      />
    );
  })
)}

{acciones.map(([a, count], i) => {
  const y = yFor(i, acciones.length);

  return (
    <g
      key={a}
      onClick={() =>
        setSelected({
          accion: a,
          objetivo: "",
          zona: "",
          resultado: "",
        })
      }
      style={{ cursor: "pointer" }}
    >
      <rect
        x="10"
        y={y - 14}
        width="240"
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
        fontSize="11"
        fontWeight="600"
      >
        {a}
      </text>

      <text
        x="238"
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

{objetivos.map(([o, count], i) => {
  const y = yFor(i, objetivos.length);

  return (
    <g
      key={o}
      onClick={() =>
        setSelected({
          accion: "",
          objetivo: o,
          zona: "",
          resultado: "",
        })
      }
      style={{ cursor: "pointer" }}
    >
      <rect
        x="280"
        y={y - 14}
        width="240"
        height="28"
        rx="10"
        fill="#0B1320"
        stroke="#334155"
      />

      <circle
        cx="296"
        cy={y}
        r="5"
        fill={COLORS.gold}
        stroke={COLORS.goldLight}
      />

      <text
        x="310"
        y={y + 4}
        fill="white"
        fontSize="11"
        fontWeight="600"
      >
        {o}
      </text>

      <text
        x="518"
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
        setSelected({ accion: "", objetivo: "", zona: z, resultado: "" })
      }
      style={{ cursor: "pointer" }}
    >
      <rect
        x="620"
        y={y - 14}
        width="180"
        height="28"
        rx="10"
        fill="#0B1320"
        stroke="#334155"
      />

      <circle
        cx="636"
        cy={y}
        r="5"
        fill={COLORS.gold}
        stroke={COLORS.goldLight}
      />

      <text
        x="650"
        y={y + 4}
        fill="white"
        fontSize="11"
        fontWeight="600"
      >
        {z}
      </text>

      <text
        x="788"
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

      {resultados.map(([res, count], i) => {
        const y = yFor(i, resultados.length);

        const color =
          res === "Gol"
            ? COLORS.green
            : res === "Ocasión"
            ? COLORS.green
            : res === "ABP"
            ? COLORS.blue
            : res === "Transición rival"
            ? COLORS.amber
            : COLORS.gray;

        return (
          <g
            key={res}
            onClick={() =>
              setSelected({ accion: "", objetivo: "", zona: "", resultado: res })
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
              {res}
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
        Ocasiones
      </div>
      <div className="mt-1 text-2xl font-semibold text-emerald-400">
        {ocasiones}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Goles
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
            {selected.accion || selected.objetivo || selected.zona || selected.resultado}
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
            const o = objetivo(r);
            const z = zona(r);
            const res = resultado(r);

const a = (r.tipoAccion || "Sin acción").trim();

return (
  (!selected.accion || selected.accion === a) &&
  (!selected.objetivo || selected.objetivo === o) &&
  (!selected.zona || selected.zona === z) &&
  (!selected.resultado || selected.resultado === res)
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
  <span className="text-[#E7D2A0]">{r.tipoAccion}</span>
  {" → "}
  {objetivo(r)}
  {" → "}
  {zona(r)}
  {" → "}
  {resultado(r)}
</div>
            </div>
          ))}
      </div>
    </div>
  )}
</div>

);
}