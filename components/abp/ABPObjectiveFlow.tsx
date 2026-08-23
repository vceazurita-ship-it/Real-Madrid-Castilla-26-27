"use client";

// Flujo del balón parado en cuatro etapas:
//   Tipo de acción → (Intención | Tipo de envío) → Zona de caída → Resultado.
//
// La segunda etapa cambia con el lado. Atacando se registra la Intención,
// que es nuestra; defendiendo esa columna no existe —es del ataque rival—,
// así que se lee su Tipo de envío, que es lo que mejor describe su intención
// con los datos disponibles.
//
// El alto del lienzo se calcula a partir de la columna más larga: con un alto
// fijo los nodos se solapaban.

import { useMemo, useState } from "react";

export type ABPRow = {
jornada?: number | string;
rival?: string;
minuto?: number | string;
tiempo?: number | string;
tipoAccion: string;
tipoEnvio?: string;
intencion?: string;
calidadEnvio?: string;
zonaCaida?: string;
zonaRemate?: string;
xG?: number | string;
rematador?: string;
tipoRemate?: string;
resultadoFinal?: string;
};

const COLORS = {
gold: "#C8A96B",
goldLight: "#E7D2A0",
green: "#10B981",
blue: "#5E7FB8",
amber: "#8A6262",
red: "#B45454",
gray: "#64748B",
steel: "#3A4658",
};

/**
 * Vocabulario cromático de cada lado. Atacando, el verde es nuestro gol;
 * defendiendo, el gol que importa es el del rival y va en rojo, mientras que
 * el verde queda para el que marcamos nosotros tras robar.
 */
function resultColorsFor(def: boolean): Record<string, string> {
  return def
    ? {
        "Gol Rival": "#B45454",
        "Ocasión": "#D08A7E",
        "ABP": "#5E7FB8",
        "Transición Ofensiva": "#567A68",
        "Gol RMCF": "#10B981",
        "Nada": "#475569",
      }
    : {
        "Gol": COLORS.green,
        "Ocasión": COLORS.gold,
        "ABP": COLORS.blue,
        "Transición Rival": COLORS.amber,
        "Nada": COLORS.gray,
      };
}

/** `medio` es la segunda etapa; qué representa lo decide el modo. */
type ColKey = "accion" | "medio" | "zona" | "resultado";

function colsFor(def: boolean): Record<
  ColKey,
  { x: number; w: number; title: string }
> {
  return {
    accion: { x: 12, w: 250, title: "Tipo de acción" },
    medio: { x: 312, w: 230, title: def ? "Tipo de envío" : "Intención" },
    zona: { x: 592, w: 230, title: "Zona de caída" },
    resultado: { x: 872, w: 210, title: "Resultado final" },
  };
}

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

/** "Penati" es un error de tecleo recurrente en la hoja: lo unificamos al leer. */
function intencion(r: ABPRow): string {
  const raw = (r.intencion || "").trim();
  if (!raw) return "Sin definir";

  return raw.replace(/penati/gi, "Penalti");
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

/** Mismo vocabulario cerrado que el resto del panel ofensivo. */
/**
 * Normaliza el resultado al vocabulario de cada lado.
 *
 * Atacando, un gol sin más es nuestro y la transición es del rival. Defendiendo
 * se invierte: la hoja marca "Gol RMCF" cuando lo metemos nosotros al robar, y
 * cualquier otro gol es del rival.
 */
function resultadoDe(r: ABPRow, def: boolean): string {
  const t = norm(r.resultadoFinal);

  if (!t) return "Nada";

  if (def) {
    if (t.includes("gol") && t.includes("rmcf")) return "Gol RMCF";
    if (t.includes("gol")) return "Gol Rival";
    if (t.includes("ocas")) return "Ocasión";
    if (t.includes("transici")) return "Transición Ofensiva";
    if (t.includes("abp")) return "ABP";

    return "Nada";
  }

  if (t === "gol") return "Gol";
  if (t.includes("ocas")) return "Ocasión";
  if (t.includes("transici")) return "Transición Rival";
  if (t.includes("abp")) return "ABP";

  return "Nada";
}

/** Tipo de envío del rival: es la columna que hace de "intención" en defensa. */
function envio(r: ABPRow): string {
  const raw = (r.tipoEnvio || "").trim();
  return raw || "Sin definir";
}

function accessorsFor(def: boolean): Record<ColKey, (r: ABPRow) => string> {
  return {
    accion,
    medio: def ? envio : intencion,
    zona,
    resultado: (r: ABPRow) => resultadoDe(r, def),
  };
}

/**
 * Rampa del flujo. El extremo caliente significa lo contrario en cada lado:
 * atacando es peligro generado (verde) y defendiendo peligro concedido (rojo).
 */
function peligroColor(t: number, def: boolean) {
  const stops: { p: number; c: [number, number, number] }[] = def
    ? [
        { p: 0, c: [58, 70, 88] },
        { p: 0.5, c: [200, 169, 107] },
        { p: 1, c: [180, 84, 84] },
      ]
    : [
    { p: 0, c: [58, 70, 88] },
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

export type ABPFlowMode = "offensive" | "defensive";

/**
 * Diagrama de flujo del balón parado en cuatro etapas.
 *
 * Un solo componente para ataque y defensa: la maquinaria de nodos y enlaces
 * es idéntica y el modo decide qué se lee en la segunda etapa, con qué
 * vocabulario se clasifica el resultado y hacia qué color calienta la rampa.
 */
export default function ABPObjectiveFlow({
  rows,
  mode = "offensive",
}: {
  rows: ABPRow[];
  mode?: ABPFlowMode;
}) {
  const def = mode === "defensive";

  /* Configuración derivada del modo. Memoizada porque alimenta las
     dependencias de los useMemo del cálculo. */
  const COLS = useMemo(() => colsFor(def), [def]);
  const ACCESSORS = useMemo(() => accessorsFor(def), [def]);
  const RESULT_COLORS = useMemo(() => resultColorsFor(def), [def]);

  /** Etiqueta del resultado que cuenta como gol propio del lado analizado. */
  const GOL = def ? "Gol Rival" : "Gol";
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
  [rows, focus, ACCESSORS]
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

      const res = resultadoDe(r, def);

      grouped.set(k, {
        total: prev.total + 1,
        xg: prev.xg + numero(r.xG),
        peligro:
          prev.peligro +
          (res === GOL || res === "Ocasión" ? 1 : 0),
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
    accion: build(ACCESSORS.accion),
    medio: build(ACCESSORS.medio),
    zona: build(ACCESSORS.zona),
    resultado: build(ACCESSORS.resultado),
  } as Record<ColKey, NodeStat[]>;
}, [rows, ACCESSORS, GOL, def]);

/** Enlaces de un tramo, con la proporción de gol u ocasión de cada uno. */
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

        const res = resultadoDe(r, def);

        grouped.set(key, {
          from,
          to,
          total: prev.total + 1,
          peligro:
            prev.peligro +
            (res === GOL || res === "Ocasión" ? 1 : 0),
        });
      });

      return Array.from(grouped.values());
    },
  [ACCESSORS, GOL, def]
);

const STAGES: { source: ColKey; target: ColKey }[] = [
  { source: "accion", target: "medio" },
  { source: "medio", target: "zona" },
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
}, [columns, COLS]);

/** Nodos que siguen participando con la selección activa. */
const activeNodes = useMemo(() => {
  const map = {} as Record<ColKey, Set<string>>;

  (Object.keys(COLS) as ColKey[]).forEach((k) => {
    map[k] = new Set(activeRows.map((r) => ACCESSORS[k](r)));
  });

  return map;
}, [activeRows, ACCESSORS, COLS]);

const totalAcciones = activeRows.length;
const ocasiones = activeRows.filter(
  (r) => resultadoDe(r, def) === "Ocasión"
).length;
const goles = activeRows.filter(
  (r) => resultadoDe(r, def) === GOL
).length;
const xgTotal = activeRows.reduce(
  (acc, r) => acc + numero(r.xG),
  0
);
const tasaPeligro = totalAcciones
  ? ((ocasiones + goles) / totalAcciones) * 100
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
    // los anteriores se colorean por el peligro que acaban generando.
    const color =
      target === "resultado"
        ? RESULT_COLORS[l.to] || COLORS.gray
        : peligroColor(l.peligro / Math.max(1, l.total), def);

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
        : peligroColor(n.peligro, def);

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
          )} xG${def ? " concedido" : ""} · ${(n.peligro * 100).toFixed(
            0
          )}% ${def ? "acaba en gol u ocasión rival" : "gol u ocasión"}`}
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
          background: `linear-gradient(90deg, ${peligroColor(0, def)}, ${peligroColor(0.5, def)}, ${peligroColor(1, def)})`,
        }}
      />
      Grosor = acciones · color = % que acaba en gol u ocasión
      {def ? " rival" : ""}
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
        {def ? "Ocasiones concedidas" : "Ocasiones"}
      </div>
      <div className="mt-1 text-2xl font-semibold text-[#E7D2A0]">
        {ocasiones}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {def ? "Goles rival" : "Goles"}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold ${
          def ? "text-[#F08A96]" : "text-emerald-400"
        }`}
      >
        {goles}
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {def ? "xG concedido" : "xG total"}
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
                {def
                  ? `${r.tiempo ? `${r.tiempo}` : "Tiempo -"}${
                      r.tipoRemate ? ` · ${r.tipoRemate}` : ""
                    }`
                  : `Min ${r.minuto ?? "-"}${
                      r.rematador ? ` · ${r.rematador}` : ""
                    }`}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                <span className="text-[#E7D2A0]">{accion(r)}</span>
                {" → "}
                {ACCESSORS.medio(r)}
                {" → "}
                {zona(r)}
                {" → "}
                <span
                  style={{
                    color:
                      RESULT_COLORS[resultadoDe(r, def)] || COLORS.gray,
                  }}
                >
                  {resultadoDe(r, def)}
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
