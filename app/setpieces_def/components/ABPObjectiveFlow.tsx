"use client";

// Flujo defensivo: Tipo de acción → Tipo de envío → Zona de caída → Resultado final.
//
// La hoja defensiva no registra "Intención" (es una columna de nuestro ataque),
// así que el segundo tramo lee el tipo de envío del rival, que es lo que mejor
// describe su intención con los datos disponibles.
//
// El alto del lienzo se calcula a partir de la columna más larga: con un alto
// fijo los nodos se solapaban.

import { useMemo, useState } from "react";

export type ABPRow = {
jornada?: number | string;
rival?: string;
tiempo?: number | string;
tipoAccion: string;
tipoEnvio?: string;
calidadEnvio?: string;
zonaCaida?: string;
zonaRemate?: string;
xG?: number | string;
tipoRemate?: string;
resultadoFinal?: string;
};

const COLORS = {
gold: "#C8A96B",
goldLight: "#E7D2A0",
green: "#10B981",
blue: "#5E7FB8",
red: "#B45454",
gray: "#64748B",
steel: "#3A4658",
};

// Mismo vocabulario cromático que el resto del panel defensivo.
const RESULT_COLORS: Record<string, string> = {
  "Gol Rival": "#B45454",
  "Ocasión": "#D08A7E",
  "ABP": "#5E7FB8",
  "Transición Ofensiva": "#567A68",
  "Gol RMCF": "#10B981",
  "Nada": "#475569",
};

type ColKey = "accion" | "envio" | "zona" | "resultado";

const COLS: Record<
  ColKey,
  { x: number; w: number; title: string }
> = {
  accion: { x: 12, w: 250, title: "Tipo de acción" },
  envio: { x: 312, w: 230, title: "Tipo de envío" },
  zona: { x: 592, w: 230, title: "Zona de caída" },
  resultado: { x: 872, w: 210, title: "Resultado final" },
};

const TOP = 46;
const NODE_H = 26;
const STEP = 35;

function norm(v?: string) {
  return (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function numero(v?: number | string) {
  const x =
    typeof v === "number"
      ? v
      : parseFloat(String(v || 0).replace(",", "."));

  return Number.isFinite(x) ? x : 0;
}

function accion(r: ABPRow): string {
  return (r.tipoAccion || "Sin acción").trim();
}

/** Tipo de envío del rival: es la columna que hace de "intención" en defensa. */
function envio(r: ABPRow): string {
  const raw = (r.tipoEnvio || "").trim();
  return raw || "Sin definir";
}

/**
 * Zona donde cae el envío. Las superioridades (2v1, 3v2, 3v3) no son zonas del
 * área: se agrupan en un único nodo para no romper la columna en variantes.
 */
function zona(r: ABPRow): string {
  const raw = (r.zonaCaida || "").trim();
  if (!raw) return "Sin zona";

  if (/^\d+\s*v\s*\d+$/i.test(raw)) return "Superioridad en corto";

  return raw;
}

/**
 * Mismo vocabulario cerrado que el resto del panel defensivo.
 * Ojo al orden: "Gol RMCF" es gol nuestro tras transición, no gol encajado.
 */
function resultado(r: ABPRow): string {
  const t = norm(r.resultadoFinal);

  if (!t) return "Nada";
  if (t.includes("gol") && t.includes("rmcf")) return "Gol RMCF";
  if (t.includes("gol")) return "Gol Rival";
  if (t.includes("ocas")) return "Ocasión";
  if (t.includes("transici")) return "Transición Ofensiva";
  if (t.includes("abp")) return "ABP";

  return "Nada";
}

/** En defensa el peligro es lo que concedemos: gol rival u ocasión rival. */
function esPeligro(res: string) {
  return res === "Gol Rival" || res === "Ocasión";
}

const ACCESSORS: Record<ColKey, (r: ABPRow) => string> = {
  accion,
  envio,
  zona,
  resultado,
};

/**
 * Mezcla acero → oro → rojo según la proporción de peligro concedido.
 * Invertida respecto al panel ofensivo: aquí el extremo caliente es malo.
 */
function peligroColor(t: number) {
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: 0, c: [58, 70, 88] },
    { p: 0.5, c: [200, 169, 107] },
    { p: 1, c: [180, 84, 84] },
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

/** Recorta la etiqueta al ancho disponible del nodo. */
function truncate(label: string, width: number) {
  const max = Math.floor((width - 96) / 5.6);
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

type NodeStat = {
  name: string;
  total: number;
  xg: number;
  peligro: number;
};

export default function ABPObjectiveFlow({ rows }: { rows: ABPRow[] }) {
const [focus, setFocus] = useState<{
  col: ColKey;
  value: string;
} | null>(null);

// Filas que atraviesan el nodo seleccionado (todas si no hay selección).
const activeRows = useMemo(
  () =>
    focus
      ? rows.filter((r) => ACCESSORS[focus.col](r) === focus.value)
      : rows,
  [rows, focus]
);

const columns = useMemo(() => {
  const build = (get: (r: ABPRow) => string): NodeStat[] => {
    const grouped = new Map<
      string,
      { total: number; xg: number; peligro: number }
    >();

    rows.forEach((r) => {
      const k = get(r);
      const prev =
        grouped.get(k) || { total: 0, xg: 0, peligro: 0 };

      const res = resultado(r);

      grouped.set(k, {
        total: prev.total + 1,
        xg: prev.xg + numero(r.xG),
        peligro: prev.peligro + (esPeligro(res) ? 1 : 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        xg: v.xg,
        peligro: v.total ? v.peligro / v.total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  };

  return {
    accion: build(accion),
    envio: build(envio),
    zona: build(zona),
    resultado: build(resultado),
  } as Record<ColKey, NodeStat[]>;
}, [rows]);

/** Enlaces de un tramo, con la proporción de peligro concedido de cada uno. */
const buildLinks = useMemo(
  () =>
    (
      source: ColKey,
      target: ColKey,
      subset: ABPRow[]
    ) => {
      const grouped = new Map<
        string,
        { from: string; to: string; total: number; peligro: number }
      >();

      subset.forEach((r) => {
        const from = ACCESSORS[source](r);
        const to = ACCESSORS[target](r);
        const key = `${from}__${to}`;

        const prev =
          grouped.get(key) ||
          { from, to, total: 0, peligro: 0 };

        const res = resultado(r);

        grouped.set(key, {
          from,
          to,
          total: prev.total + 1,
          peligro: prev.peligro + (esPeligro(res) ? 1 : 0),
        });
      });

      return Array.from(grouped.values());
    },
  []
);

const STAGES: { source: ColKey; target: ColKey }[] = [
  { source: "accion", target: "envio" },
  { source: "envio", target: "zona" },
  { source: "zona", target: "resultado" },
];

const allLinks = useMemo(
  () =>
    STAGES.map((s) => buildLinks(s.source, s.target, rows)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, buildLinks]
);

const activeLinks = useMemo(
  () =>
    STAGES.map((s) => buildLinks(s.source, s.target, activeRows)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeRows, buildLinks]
);

const maxLink = Math.max(
  1,
  ...allLinks.flat().map((l) => l.total)
);

const maxRows = Math.max(
  1,
  ...(Object.keys(COLS) as ColKey[]).map(
    (k) => columns[k].length
  )
);

const svgHeight = TOP + maxRows * STEP + 18;

// Índice de posición vertical por nodo, para trazar los enlaces.
const yIndex = useMemo(() => {
  const map = {} as Record<ColKey, Record<string, number>>;

  (Object.keys(COLS) as ColKey[]).forEach((k) => {
    map[k] = {};
    columns[k].forEach((n, i) => {
      map[k][n.name] = TOP + i * STEP + NODE_H / 2;
    });
  });

  return map;
}, [columns]);

/** Nodos que siguen participando con la selección activa. */
const activeNodes = useMemo(() => {
  const map = {} as Record<ColKey, Set<string>>;

  (Object.keys(COLS) as ColKey[]).forEach((k) => {
    map[k] = new Set(activeRows.map((r) => ACCESSORS[k](r)));
  });

  return map;
}, [activeRows]);

const totalAcciones = activeRows.length;
const ocasiones = activeRows.filter(
  (r) => resultado(r) === "Ocasión"
).length;
const golesRival = activeRows.filter(
  (r) => resultado(r) === "Gol Rival"
).length;
const xgTotal = activeRows.reduce(
  (acc, r) => acc + numero(r.xG),
  0
);
const tasaPeligro = totalAcciones
  ? ((ocasiones + golesRival) / totalAcciones) * 100
  : 0;

const linkPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const dx = (x2 - x1) * 0.45;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
};

const renderStage = (
  stageIndex: number,
  links: ReturnType<typeof buildLinks>,
  dimmed: boolean
) => {
  const { source, target } = STAGES[stageIndex];

  const x1 = COLS[source].x + COLS[source].w;
  const x2 = COLS[target].x;

  return links.map((l) => {
    const y1 = yIndex[source][l.from];
    const y2 = yIndex[target][l.to];

    if (y1 == null || y2 == null) return null;

    // El último tramo hereda el color del resultado al que llega;
    // los anteriores se colorean por el peligro que acaban concediendo.
    const color =
      target === "resultado"
        ? RESULT_COLORS[l.to] || COLORS.gray
        : peligroColor(l.peligro / Math.max(1, l.total));

    return (
      <path
        key={`${stageIndex}-${l.from}-${l.to}-${dimmed ? "d" : "a"}`}
        d={linkPath(x1, y1, x2, y2)}
        fill="none"
        stroke={color}
        strokeWidth={1.5 + (l.total / maxLink) * 9}
        strokeLinecap="round"
        opacity={dimmed ? 0.12 : 0.85}
      />
    );
  });
};

const renderColumn = (col: ColKey) => {
  const { x, w } = COLS[col];

  return columns[col].map((n, i) => {
    const y = TOP + i * STEP;
    const isFocused =
      focus?.col === col && focus.value === n.name;

    const participa = activeNodes[col].has(n.name);
    const atenuado = !!focus && !participa;

    const dot =
      col === "resultado"
        ? RESULT_COLORS[n.name] || COLORS.gray
        : peligroColor(n.peligro);

    return (
      <g
        key={`${col}-${n.name}`}
        onClick={() =>
          setFocus(
            isFocused ? null : { col, value: n.name }
          )
        }
        style={{ cursor: "pointer" }}
        opacity={atenuado ? 0.28 : 1}
      >
        <title>
          {`${n.name} · ${n.total} acciones · ${n.xg.toFixed(
            2
          )} xG concedido · ${(n.peligro * 100).toFixed(
            0
          )}% acaba en gol u ocasión rival`}
        </title>

        <rect
          x={x}
          y={y}
          width={w}
          height={NODE_H}
          rx="9"
          fill={isFocused ? "#16233A" : "#0B1320"}
          stroke={isFocused ? COLORS.goldLight : "#334155"}
          strokeWidth={isFocused ? 1.4 : 1}
        />

        <circle cx={x + 15} cy={y + NODE_H / 2} r="4.5" fill={dot} />

        <text
          x={x + 27}
          y={y + NODE_H / 2 + 4}
          fill="white"
          fontSize="11"
          fontWeight="600"
        >
          {truncate(n.name, w)}
        </text>

        <text
          x={x + w - 40}
          y={y + NODE_H / 2 + 3.5}
          textAnchor="end"
          fill="#94A3B8"
          fontSize="9"
        >
          {n.xg.toFixed(2)} xG
        </text>

        <text
          x={x + w - 10}
          y={y + NODE_H / 2 + 4}
          textAnchor="end"
          fill={COLORS.goldLight}
          fontSize="12"
          fontWeight="700"
        >
          {n.total}
        </text>
      </g>
    );
  });
};

return (
<div className="w-full">
  {/* Leyenda */}
  <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-zinc-400">
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-6 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${peligroColor(
            0
          )}, ${peligroColor(0.5)}, ${peligroColor(1)})`,
        }}
      />
      Grosor = acciones · color = % que acaba en gol u ocasión rival
    </span>

    <span>Pulsa un nodo para aislar su recorrido completo</span>

    {focus && (
      <button
        type="button"
        onClick={() => setFocus(null)}
        className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-[#E7D2A0] transition hover:bg-[#C8A96B]/20"
      >
        {focus.value} ×
      </button>
    )}
  </div>

<div className="relative w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#05101D] p-4">
<svg
  viewBox={`0 0 1094 ${svgHeight}`}
  className="w-full min-w-[980px]"
  onClick={(e) => {
    if (e.target === e.currentTarget) setFocus(null);
  }}
>
      {(Object.keys(COLS) as ColKey[]).map((k) => (
        <text
          key={k}
          x={COLS[k].x}
          y="24"
          fill="#94A3B8"
          fontSize="11"
          fontWeight="600"
        >
          {COLS[k].title}
        </text>
      ))}

      {/* Capa base: todo el flujo, atenuado cuando hay selección */}
      {allLinks.map((links, i) =>
        renderStage(i, links, !!focus)
      )}

      {/* Capa activa: sólo el recorrido seleccionado */}
      {focus &&
        activeLinks.map((links, i) =>
          renderStage(i, links, false)
        )}

      {(Object.keys(COLS) as ColKey[]).map((k) => (
        <g key={`col-${k}`}>{renderColumn(k)}</g>
      ))}
    </svg>
  </div>

  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
        Ocasiones concedidas
      </div>
      <div className="mt-1 text-2xl font-semibold text-[#E7D2A0]">
        {ocasiones}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Goles rival
      </div>
      <div className="mt-1 text-2xl font-semibold text-[#F08A96]">
        {golesRival}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        xG concedido
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {xgTotal.toFixed(2)}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        Gol u ocasión
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {tasaPeligro.toFixed(1)}%
      </div>
    </div>
  </div>

  {focus && (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-white">
            {focus.value}
          </h3>
          <p className="text-sm text-slate-400">
            {activeRows.length}{" "}
            {activeRows.length === 1
              ? "acción registrada"
              : "acciones registradas"}
            {activeRows.length > 12 &&
              " · se listan las 12 primeras"}
          </p>
        </div>

        <button
          onClick={() => setFocus(null)}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1 text-slate-400 transition hover:border-white/20 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {activeRows.slice(0, 12).map((r, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-[#07111F] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 break-words font-medium text-white">
                  {r.jornada || "Partido"}
                  {r.rival ? ` · ${r.rival}` : ""}
                </div>

                <div className="shrink-0 text-xs text-slate-400">
                  {numero(r.xG).toFixed(2)} xG
                </div>
              </div>

              <div className="mt-1 text-sm text-slate-300">
                {r.tiempo ? `${r.tiempo}` : "Tiempo -"}
                {r.tipoRemate ? ` · ${r.tipoRemate}` : ""}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                <span className="text-[#E7D2A0]">{accion(r)}</span>
                {" → "}
                {envio(r)}
                {" → "}
                {zona(r)}
                {" → "}
                <span
                  style={{
                    color:
                      RESULT_COLORS[resultado(r)] || COLORS.gray,
                  }}
                >
                  {resultado(r)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )}
</div>

);
}
