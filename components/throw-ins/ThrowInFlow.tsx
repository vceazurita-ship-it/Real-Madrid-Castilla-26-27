"use client";

// Flujo del saque de banda: Zona de saque -> Tipo de envío -> Dirección -> Resultado.
//
// El tercer tramo lee Zona_Caida, que en estas hojas guarda la DIRECCIÓN del
// envío ("Progresión Carril Exterior", "Area"...), no una zona del terreno.
// La hoja ofensiva añade Intencion, así que ahí se puede alternar la columna;
// la defensiva no tiene esa columna y se queda siempre en dirección.
//
// El alto del lienzo se calcula con la columna más larga: con alto fijo los
// nodos se solapaban al crecer el vocabulario.

import { useMemo, useState } from "react";
import {
  ACCENT_LIGHT,
  esFavorable,
  esProduccion,
  esProgresion,
  heatColor,
  type Mode,
  parseBanda,
  parseDireccion,
  parseResultado,
  parseZona,
  read,
  type RecordRow,
  resultColor,
  tonoDeModo,
} from "./throwInModel";

type ColKey = "saque" | "envio" | "medio" | "resultado";
type MedioKey = "direccion" | "intencion";

const COLS: Record<ColKey, { x: number; w: number }> = {
  saque: { x: 12, w: 240 },
  envio: { x: 302, w: 190 },
  medio: { x: 542, w: 280 },
  resultado: { x: 872, w: 210 },
};

const TOP = 46;
const NODE_H = 26;
const STEP = 35;

/** Recorta la etiqueta al ancho disponible del nodo. */
function truncate(label: string, width: number) {
  const max = Math.floor((width - 70) / 5.6);
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function saqueLabel(row: RecordRow) {
  const banda = parseBanda(row);
  const zona = parseZona(row);
  if (!banda || !zona) return "Sin zona";
  return `${banda === "izq" ? "Izquierda" : "Derecha"} · Zona ${zona}`;
}

type NodeStat = {
  name: string;
  total: number;
  produccion: number;
  favorable: number;
};

export default function ThrowInFlow({ rows, mode }: { rows: RecordRow[]; mode: Mode }) {
  const isOffensive = mode === "offensive";
  const tono = tonoDeModo(mode);

  const [medioKey, setMedioKey] = useState<MedioKey>("direccion");
  const [focus, setFocus] = useState<{ col: ColKey; value: string } | null>(null);

  const medio = medioKey === "intencion" && isOffensive ? "intencion" : "direccion";

  const accessors = useMemo<Record<ColKey, (row: RecordRow) => string>>(
    () => ({
      saque: saqueLabel,
      envio: (row) => read(row, "Tipo_Envio") || "Sin definir",
      medio:
        medio === "intencion"
          ? (row) => read(row, "Intencion") || "Sin definir"
          : (row) => parseDireccion(read(row, "Zona_Caida")).label,
      resultado: (row) => parseResultado(read(row, "Resultado_Final")).label,
    }),
    [medio]
  );

  const titles: Record<ColKey, string> = {
    saque: "Zona de saque",
    envio: "Tipo de envío",
    medio: medio === "intencion" ? "Intención" : "Dirección del envío",
    resultado: "Resultado final",
  };

  const columns = useMemo(() => {
    const build = (get: (row: RecordRow) => string): NodeStat[] => {
      const grouped = new Map<string, { total: number; produccion: number; favorable: number }>();

      rows.forEach((row) => {
        const key = get(row);
        const prev = grouped.get(key) ?? { total: 0, produccion: 0, favorable: 0 };
        const resultado = parseResultado(read(row, "Resultado_Final"));

        grouped.set(key, {
          total: prev.total + 1,
          produccion: prev.produccion + (esProduccion(resultado, mode) ? 1 : 0),
          favorable: prev.favorable + (esFavorable(resultado) ? 1 : 0),
        });
      });

      return [...grouped.entries()]
        .map(([name, value]) => ({
          name,
          total: value.total,
          produccion: value.total ? value.produccion / value.total : 0,
          favorable: value.total ? value.favorable / value.total : 0,
        }))
        .sort((a, b) => b.total - a.total);
    };

    return {
      saque: build(accessors.saque),
      envio: build(accessors.envio),
      medio: build(accessors.medio),
      resultado: build(accessors.resultado),
    } as Record<ColKey, NodeStat[]>;
  }, [rows, accessors, mode]);

  const activeRows = useMemo(
    () => (focus ? rows.filter((row) => accessors[focus.col](row) === focus.value) : rows),
    [rows, focus, accessors]
  );

  const buildLinks = useMemo(
    () => (source: ColKey, target: ColKey, subset: RecordRow[]) => {
      const grouped = new Map<string, { from: string; to: string; total: number; produccion: number }>();

      subset.forEach((row) => {
        const from = accessors[source](row);
        const to = accessors[target](row);
        const key = `${from}__${to}`;
        const prev = grouped.get(key) ?? { from, to, total: 0, produccion: 0 };
        const resultado = parseResultado(read(row, "Resultado_Final"));

        grouped.set(key, {
          from,
          to,
          total: prev.total + 1,
          produccion: prev.produccion + (esProduccion(resultado, mode) ? 1 : 0),
        });
      });

      return [...grouped.values()];
    },
    [accessors, mode]
  );

  const STAGES: { source: ColKey; target: ColKey }[] = [
    { source: "saque", target: "envio" },
    { source: "envio", target: "medio" },
    { source: "medio", target: "resultado" },
  ];

  const allLinks = useMemo(
    () => STAGES.map((stage) => buildLinks(stage.source, stage.target, rows)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, buildLinks]
  );

  const activeLinks = useMemo(
    () => STAGES.map((stage) => buildLinks(stage.source, stage.target, activeRows)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRows, buildLinks]
  );

  const maxLink = Math.max(1, ...allLinks.flat().map((link) => link.total));

  const maxRows = Math.max(
    1,
    ...(Object.keys(COLS) as ColKey[]).map((key) => columns[key].length)
  );

  const svgHeight = TOP + maxRows * STEP + 18;

  const yIndex = useMemo(() => {
    const map = {} as Record<ColKey, Record<string, number>>;

    (Object.keys(COLS) as ColKey[]).forEach((key) => {
      map[key] = {};
      columns[key].forEach((node, index) => {
        map[key][node.name] = TOP + index * STEP + NODE_H / 2;
      });
    });

    return map;
  }, [columns]);

  const activeNodes = useMemo(() => {
    const map = {} as Record<ColKey, Set<string>>;

    (Object.keys(COLS) as ColKey[]).forEach((key) => {
      map[key] = new Set(activeRows.map((row) => accessors[key](row)));
    });

    return map;
  }, [activeRows, accessors]);

  const total = activeRows.length;

  const resumen = useMemo(() => {
    let favorable = 0;
    let produccion = 0;
    let progresion = 0;
    let rival = 0;

    activeRows.forEach((row) => {
      const resultado = parseResultado(read(row, "Resultado_Final"));
      if (esFavorable(resultado)) favorable += 1;
      if (esProduccion(resultado, mode)) produccion += 1;
      if (esProgresion(row)) progresion += 1;
      if (resultado.owner === "rival") rival += 1;
    });

    const pct = (value: number) => (total ? (value / total) * 100 : 0);

    return {
      favorable: pct(favorable),
      produccion,
      produccionPct: pct(produccion),
      progresion: pct(progresion),
      rival,
    };
  }, [activeRows, total, mode]);

  const linkPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = (x2 - x1) * 0.45;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  const renderStage = (stageIndex: number, links: ReturnType<typeof buildLinks>, dimmed: boolean) => {
    const { source, target } = STAGES[stageIndex];
    const x1 = COLS[source].x + COLS[source].w;
    const x2 = COLS[target].x;

    return links.map((link) => {
      const y1 = yIndex[source][link.from];
      const y2 = yIndex[target][link.to];

      if (y1 == null || y2 == null) return null;

      // El último tramo hereda el color del resultado; los anteriores se
      // colorean por la producción a la que acaban llevando.
      const color =
        target === "resultado"
          ? resultColor(link.to)
          : heatColor(link.produccion / Math.max(1, link.total), tono);

      return (
        <path
          key={`${stageIndex}-${link.from}-${link.to}-${dimmed ? "d" : "a"}`}
          d={linkPath(x1, y1, x2, y2)}
          fill="none"
          stroke={color}
          strokeWidth={1.5 + (link.total / maxLink) * 9}
          strokeLinecap="round"
          opacity={dimmed ? 0.12 : 0.85}
        />
      );
    });
  };

  const renderColumn = (col: ColKey) => {
    const { x, w } = COLS[col];

    return columns[col].map((node, index) => {
      const y = TOP + index * STEP;
      const isFocused = focus?.col === col && focus.value === node.name;
      const atenuado = !!focus && !activeNodes[col].has(node.name);

      const dot = col === "resultado" ? resultColor(node.name) : heatColor(node.produccion, tono);

      return (
        <g
          key={`${col}-${node.name}`}
          onClick={() => setFocus(isFocused ? null : { col, value: node.name })}
          style={{ cursor: "pointer" }}
          opacity={atenuado ? 0.28 : 1}
        >
          <title>
            {`${node.name} · ${node.total} saques · ${(node.favorable * 100).toFixed(0)}% acaba en balón para el RMCF · ${(
              node.produccion * 100
            ).toFixed(0)}% ${isOffensive ? "produce último tercio, ocasión o gol" : "concede último tercio, ocasión o gol"}`}
          </title>

          <rect
            x={x}
            y={y}
            width={w}
            height={NODE_H}
            rx="9"
            fill={isFocused ? "#16233A" : "#0B1320"}
            stroke={isFocused ? ACCENT_LIGHT : "#334155"}
            strokeWidth={isFocused ? 1.4 : 1}
          />

          <circle cx={x + 15} cy={y + NODE_H / 2} r="4.5" fill={dot} />

          <text x={x + 27} y={y + NODE_H / 2 + 4} fill="white" fontSize="11" fontWeight="600">
            {truncate(node.name, w)}
          </text>

          <text
            x={x + w - 10}
            y={y + NODE_H / 2 + 4}
            textAnchor="end"
            fill={ACCENT_LIGHT}
            fontSize="12"
            fontWeight="700"
          >
            {node.total}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-6 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${heatColor(0, tono)}, ${heatColor(0.5, tono)}, ${heatColor(
                1,
                tono
              )})`,
            }}
          />
          Grosor = saques · color = {isOffensive ? "% que acaba en último tercio, ocasión o gol nuestro" : "% que acaba en último tercio, ocasión o gol del rival"}
        </span>

        <span>Pulsa un nodo para aislar su recorrido completo</span>

        {isOffensive ? (
          <span className="flex items-center gap-1">
            {(["direccion", "intencion"] as MedioKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMedioKey(key);
                  setFocus(null);
                }}
                className={`rounded-full border px-2.5 py-1 transition ${
                  medio === key
                    ? "border-[#C8A96B] bg-[#C8A96B] text-black"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                }`}
              >
                {key === "direccion" ? "Dirección" : "Intención"}
              </button>
            ))}
          </span>
        ) : null}

        {focus ? (
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-[#E7D2A0] transition hover:bg-[#C8A96B]/20"
          >
            {focus.value} ×
          </button>
        ) : null}
      </div>

      <div className="relative w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#05101D] p-4">
        <svg
          viewBox={`0 0 1094 ${svgHeight}`}
          className="w-full min-w-[980px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFocus(null);
          }}
        >
          {(Object.keys(COLS) as ColKey[]).map((key) => (
            <text key={key} x={COLS[key].x} y="24" fill="#94A3B8" fontSize="11" fontWeight="600">
              {titles[key]}
            </text>
          ))}

          {/* Capa base: todo el flujo, atenuado cuando hay selección */}
          {allLinks.map((links, index) => renderStage(index, links, !!focus))}

          {/* Capa activa: sólo el recorrido seleccionado */}
          {focus ? activeLinks.map((links, index) => renderStage(index, links, false)) : null}

          {(Object.keys(COLS) as ColKey[]).map((key) => (
            <g key={`col-${key}`}>{renderColumn(key)}</g>
          ))}
        </svg>

        {!rows.length ? (
          <div className="absolute inset-0 grid place-items-center bg-[#05101D]/85 p-6 text-center">
            <p className="text-sm text-slate-300">
              El flujo aparecerá cuando la hoja tenga saques registrados con los filtros activos.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Saques</div>
          <div className="mt-1 text-2xl font-semibold text-white">{total}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {isOffensive ? "Retención" : "Recuperación"}
          </div>
          <div className="mt-1 text-2xl font-semibold text-[#E7D2A0]">{resumen.favorable.toFixed(1)}%</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {isOffensive ? "Progresión" : "Progresión concedida"}
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">{resumen.progresion.toFixed(1)}%</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {isOffensive ? "Producción" : "Peligro concedido"}
          </div>
          <div
            className="mt-1 text-2xl font-semibold"
            style={{ color: isOffensive ? "#10B981" : "#F08A96" }}
          >
            {resumen.produccion}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {isOffensive ? "Balón para el rival" : "Balón que sigue siendo del rival"}
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">{resumen.rival}</div>
        </div>
      </div>

      {focus ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B1320] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold text-white">{focus.value}</h3>
              <p className="text-sm text-slate-400">
                {activeRows.length} {activeRows.length === 1 ? "saque registrado" : "saques registrados"}
                {activeRows.length > 12 ? " · se listan los 12 primeros" : ""}
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
            {activeRows.slice(0, 12).map((row, index) => {
              const resultado = parseResultado(read(row, "Resultado_Final"));

              return (
                <div key={index} className="rounded-xl border border-white/10 bg-[#07111F] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 break-words font-medium text-white">
                      {read(row, "JORNADA") || "Partido"}
                      {read(row, "Rival") ? ` · ${read(row, "Rival")}` : ""}
                    </div>
                    <div className="shrink-0 text-xs text-slate-400">
                      {read(row, "Tiempo") || "-"} {read(row, "Minuto") ? `· min ${read(row, "Minuto")}` : ""}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    <span className="text-[#E7D2A0]">{accessors.saque(row)}</span>
                    {" → "}
                    {accessors.envio(row)}
                    {" → "}
                    {accessors.medio(row)}
                    {" → "}
                    <span style={{ color: resultColor(resultado.label) }}>{resultado.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
