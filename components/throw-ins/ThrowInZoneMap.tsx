"use client";

// Mapa de calor de saques de banda por banda x zona (6 celdas).
//
// El campo se dibuja siempre con NUESTRA porteria a la izquierda. En la vista
// defensiva el sacador es el rival, asi que su Zona 3 cae junto a nuestra area
// y su banda izquierda queda abajo: gira el mapa 180 grados, no las etiquetas.

import { useMemo, useState } from "react";
import {
  ACCENT_INK,
  BANDA_LABEL,
  type Banda,
  esFavorable,
  esProduccion,
  esProgresion,
  esTransicion,
  heatColor,
  type Mode,
  norm,
  numero,
  parseBanda,
  parseDireccion,
  parseResultado,
  parseZona,
  read,
  type RecordRow,
  resultColor,
  textoSobre,
  type Tono,
  type Zona,
  zonaLabel,
} from "./throwInModel";

type MetricKey =
  | "saques"
  | "progresion"
  | "favorable"
  | "produccion"
  | "transicion"
  | "calidad"
  | "largo"
  | "bloqueadores";

type Metric = {
  key: MetricKey;
  label: string;
  hint: string;
  decimals: number;
  suffix: string;
  tono: Tono;
  /** Cómo se normaliza el valor para el color. */
  scale: "max" | "porcentaje" | "calidad";
};

function metricsFor(mode: Mode): Metric[] {
  const of = mode === "offensive";

  const metrics: Metric[] = [
    {
      key: "saques",
      label: of ? "Saques" : "Saques rival",
      hint: of
        ? "Volumen de saques de banda ejecutados desde la zona"
        : "Volumen de saques de banda que el rival ejecuta desde la zona",
      decimals: 0,
      suffix: "",
      tono: "neutro",
      scale: "max",
    },
    {
      key: "progresion",
      label: of ? "% Progresión" : "% Progresión concedida",
      hint: of
        ? "Envíos dirigidos hacia delante o al área sobre el total de la zona"
        : "Envíos del rival hacia delante o al área sobre el total de la zona",
      decimals: 0,
      suffix: "%",
      tono: of ? "positivo" : "negativo",
      scale: "porcentaje",
    },
    {
      key: "favorable",
      label: of ? "% Retención" : "% Recuperación",
      hint: of
        ? "Acciones que terminan con el balón en poder del RMCF"
        : "Saques del rival que terminan con el balón en poder del RMCF",
      decimals: 0,
      suffix: "%",
      tono: "positivo",
      scale: "porcentaje",
    },
    {
      key: "produccion",
      label: of ? "% Producción" : "% Peligro concedido",
      hint: of
        ? "Termina en conquista de último tercio, ocasión o gol del RMCF"
        : "Termina en conquista de último tercio, ocasión o gol del rival",
      decimals: 0,
      suffix: "%",
      tono: of ? "positivo" : "negativo",
      scale: "porcentaje",
    },
    {
      key: "calidad",
      label: of ? "Calidad de envío" : "Calidad del envío rival",
      hint: "Media de Calidad_Envio en la zona (escala 1 a 4)",
      decimals: 1,
      suffix: "",
      tono: of ? "positivo" : "negativo",
      scale: "calidad",
    },
    {
      key: "largo",
      label: "% Envío largo",
      hint: "Saques en largo sobre el total de la zona",
      decimals: 0,
      suffix: "%",
      tono: "neutro",
      scale: "porcentaje",
    },
    {
      key: "bloqueadores",
      label: "Bloqueadores",
      hint: "Media de bloqueadores participando en la acción",
      decimals: 1,
      suffix: "",
      tono: "neutro",
      scale: "max",
    },
  ];

  // En ataque la transición coincide con la producción, así que sólo aporta
  // información en defensa: mide el contragolpe tras robar el saque rival.
  if (!of) {
    metrics.splice(4, 0, {
      key: "transicion",
      label: "% Transición",
      hint: "Saques del rival que acabamos convirtiendo en último tercio, ocasión o gol nuestro",
      decimals: 0,
      suffix: "%",
      tono: "positivo",
      scale: "porcentaje",
    });
  }

  return metrics;
}

type CellStats = Record<MetricKey, number> & {
  total: number;
  direcciones: [string, number][];
  resultados: [string, number][];
};

const BANDAS: Banda[] = ["izq", "der"];
const ZONAS: Zona[] = [1, 2, 3];

/**
 * Etiqueta corta para pintar DENTRO de la celda. La larga
 * ("BANDA IZQUIERDA · ZONA 3 · JUNTO A NUESTRA ÁREA") medía casi el doble que
 * la celda y se desbordaba sobre las vecinas y fuera del campo. El nombre
 * completo sigue en el tooltip y en el panel de detalle.
 */
const BANDA_CORTA: Record<Banda, string> = {
  izq: "IZQUIERDA",
  der: "DERECHA",
};

const CELL_W = 32;
const CELL_H = 15;
const TOP_Y = 3;
const BOTTOM_Y = 46;

/** Geometría de la celda: la vista defensiva gira el campo 180 grados. */
function cellBox(banda: Banda, zona: Zona, mode: Mode) {
  const flip = mode === "defensive";
  const index = flip ? 3 - zona : zona - 1;
  const arriba = flip ? banda === "der" : banda === "izq";

  return {
    x: 2 + index * CELL_W,
    y: arriba ? TOP_Y : BOTTOM_Y,
    w: CELL_W,
    h: CELL_H,
  };
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export default function ThrowInZoneMap({ rows, mode }: { rows: RecordRow[]; mode: Mode }) {
  const METRICS = useMemo(() => metricsFor(mode), [mode]);
  const [metric, setMetric] = useState<MetricKey>("saques");
  const [selected, setSelected] = useState<string | null>(null);

  const { cells, sinUbicar } = useMemo(() => {
    const acc = new Map<
      string,
      {
        total: number;
        progresion: number;
        favorable: number;
        produccion: number;
        transicion: number;
        largo: number;
        calidadSuma: number;
        calidadN: number;
        bloqSuma: number;
        bloqN: number;
        direcciones: Map<string, number>;
        resultados: Map<string, number>;
      }
    >();

    let sinUbicar = 0;

    rows.forEach((row) => {
      const banda = parseBanda(row);
      const zona = parseZona(row);

      if (!banda || !zona) {
        sinUbicar += 1;
        return;
      }

      const key = `${banda}-${zona}`;
      const cell =
        acc.get(key) ?? {
          total: 0,
          progresion: 0,
          favorable: 0,
          produccion: 0,
          transicion: 0,
          largo: 0,
          calidadSuma: 0,
          calidadN: 0,
          bloqSuma: 0,
          bloqN: 0,
          direcciones: new Map<string, number>(),
          resultados: new Map<string, number>(),
        };

      const resultado = parseResultado(read(row, "Resultado_Final"));
      const direccion = parseDireccion(read(row, "Zona_Caida"));
      const calidad = numero(read(row, "Calidad_Envio"));
      const bloqueadores = numero(read(row, "N_Bloqueadores"));

      cell.total += 1;
      if (esProgresion(row)) cell.progresion += 1;
      if (esFavorable(resultado)) cell.favorable += 1;
      if (esProduccion(resultado, mode)) cell.produccion += 1;
      if (esTransicion(resultado)) cell.transicion += 1;
      if (norm(read(row, "Tipo_Envio")).includes("largo")) cell.largo += 1;

      if (calidad !== null) {
        cell.calidadSuma += calidad;
        cell.calidadN += 1;
      }

      if (bloqueadores !== null) {
        cell.bloqSuma += bloqueadores;
        cell.bloqN += 1;
      }

      cell.direcciones.set(direccion.label, (cell.direcciones.get(direccion.label) ?? 0) + 1);
      cell.resultados.set(resultado.label, (cell.resultados.get(resultado.label) ?? 0) + 1);

      acc.set(key, cell);
    });

    const cells = new Map<string, CellStats>();

    acc.forEach((cell, key) => {
      const pct = (value: number) => (cell.total ? (value / cell.total) * 100 : 0);

      cells.set(key, {
        total: cell.total,
        saques: cell.total,
        progresion: pct(cell.progresion),
        favorable: pct(cell.favorable),
        produccion: pct(cell.produccion),
        transicion: pct(cell.transicion),
        largo: pct(cell.largo),
        calidad: cell.calidadN ? cell.calidadSuma / cell.calidadN : 0,
        bloqueadores: cell.bloqN ? cell.bloqSuma / cell.bloqN : 0,
        direcciones: topEntries(cell.direcciones, 4),
        resultados: topEntries(cell.resultados, 4),
      });
    });

    return { cells, sinUbicar };
  }, [rows, mode]);

  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  const maxValue = Math.max(0, ...[...cells.values()].map((cell) => cell[metric]));

  const format = (value: number) =>
    `${active.decimals === 0 ? Math.round(value) : value.toFixed(active.decimals)}${active.suffix}`;

  const ratioFor = (value: number) => {
    if (active.scale === "porcentaje") return value / 100;
    if (active.scale === "calidad") return value > 0 ? (value - 1) / 3 : 0;
    return maxValue > 0 ? value / maxValue : 0;
  };

  const ranking = useMemo(() => {
    const list: { key: string; banda: Banda; zona: Zona; value: number }[] = [];

    BANDAS.forEach((banda) =>
      ZONAS.forEach((zona) => {
        const cell = cells.get(`${banda}-${zona}`);
        if (!cell) return;
        list.push({ key: `${banda}-${zona}`, banda, zona, value: cell[metric] });
      })
    );

    return list.sort((a, b) => b.value - a.value);
  }, [cells, metric]);

  // Al cambiar los filtros la celda elegida puede desaparecer: derivamos la
  // selección de los datos vivos en vez de dejar un detalle huérfano.
  const selectedKey = selected && cells.has(selected) ? selected : null;
  const selectedCell = selectedKey ? cells.get(selectedKey) ?? null : null;
  const [selBanda, selZona] = (selectedKey ?? "").split("-") as [Banda, string];

  return (
    <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Mapa de zonas</p>
          <h2 className="mt-1 text-xl font-semibold md:text-2xl">Rendimiento por banda y zona de saque</h2>
        </div>
        <p className="max-w-md text-sm text-slate-400">
          Elige una métrica y pulsa una celda para ver su detalle. El color mide la métrica activa: la
          escala cambia de signo cuando lo que crece nos perjudica.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            title={m.hint}
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

      <p className="mb-4 text-xs text-zinc-500">{active.hint}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="w-full">
          <svg viewBox="0 0 100 64" className="h-full w-full">
            <rect
              x="2"
              y="2"
              width="96"
              height="60"
              rx="1.5"
              fill="#07111F"
              stroke="#E5E7EB"
              strokeWidth="0.35"
            />

            {BANDAS.map((banda) =>
              ZONAS.map((zona) => {
                const key = `${banda}-${zona}`;
                const box = cellBox(banda, zona, mode);
                const cell = cells.get(key);
                const value = cell ? cell[metric] : 0;
                const ratio = ratioFor(value);
                const isSelected = selectedKey === key;
                const fondo = cell ? heatColor(ratio, active.tono) : "#0B1320";
                // El umbral fijo pintaba texto claro sobre el oro de media rampa.
                const textoFuerte = textoSobre(fondo);
                const textoSuave = textoSobre(fondo, "#1F2937", "#94A3B8");

                return (
                  <g key={key} onClick={() => setSelected(isSelected ? null : key)} style={{ cursor: "pointer" }}>
                    <title>{`${BANDA_LABEL[banda]} · ${zonaLabel(zona, mode)} · ${cell?.total ?? 0} saques`}</title>

                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.w}
                      height={box.h}
                      fill={fondo}
                      fillOpacity={cell ? 0.92 : 0.5}
                      stroke={isSelected ? "#FFFFFF" : "#0B1728"}
                      strokeWidth={isSelected ? 0.6 : 0.25}
                    />

                    <text
                      x={box.x + box.w / 2}
                      y={box.y + 8.6}
                      textAnchor="middle"
                      fontSize="4.4"
                      fontWeight="700"
                      fill={cell ? textoFuerte : "#F8FAFC"}
                      pointerEvents="none"
                    >
                      {cell ? format(value) : "–"}
                    </text>

                    <text
                      x={box.x + box.w / 2}
                      y={box.y + 12.2}
                      textAnchor="middle"
                      fontSize="1.9"
                      fontWeight="600"
                      letterSpacing="0.1"
                      fill={cell ? textoSuave : "#94A3B8"}
                      pointerEvents="none"
                    >
                      {`${BANDA_CORTA[banda]} · Z${zona}`}
                    </text>

                    {cell ? (
                      <text
                        x={box.x + box.w - 1.4}
                        y={box.y + 3.2}
                        textAnchor="end"
                        fontSize="1.9"
                        fill={textoSuave}
                        pointerEvents="none"
                      >
                        {cell.total} saques
                      </text>
                    ) : null}
                  </g>
                );
              })
            )}

            {/* Líneas de campo por encima del mapa de calor */}
            <line x1="50" y1="2" x2="50" y2="62" stroke="#F4F4F5" strokeWidth="0.3" strokeOpacity="0.7" />
            <circle cx="50" cy="32" r="7" fill="none" stroke="#F4F4F5" strokeWidth="0.3" strokeOpacity="0.7" />
            <rect x="2" y="19" width="12" height="26" fill="none" stroke="#F4F4F5" strokeWidth="0.3" strokeOpacity="0.7" />
            <rect x="86" y="19" width="12" height="26" fill="none" stroke="#F4F4F5" strokeWidth="0.3" strokeOpacity="0.7" />
            <line x1="2" y1="27" x2="2" y2="37" stroke="#F4F4F5" strokeWidth="1" />
            <line x1="98" y1="27" x2="98" y2="37" stroke="#F4F4F5" strokeWidth="1" />

            <text x="4" y="32.8" fontSize="2" fill="#94A3B8">
              Nuestra portería
            </text>
            <text x="96" y="32.8" fontSize="2" textAnchor="end" fill="#94A3B8">
              Portería rival
            </text>
          </svg>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] text-zinc-500">0</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${heatColor(0, active.tono)}, ${heatColor(
                  0.5,
                  active.tono
                )}, ${heatColor(1, active.tono)})`,
              }}
            />
            <span className="text-[11px] text-zinc-500">
              {active.scale === "porcentaje" ? "100%" : active.scale === "calidad" ? "4.0" : format(maxValue)}
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-zinc-500">
            {mode === "offensive"
              ? "Atacamos hacia la derecha: la Zona 3 es nuestro último tercio y la banda izquierda va arriba."
              : "El rival ataca hacia la izquierda: su Zona 3 cae junto a nuestra área y su banda izquierda va abajo."}
            {sinUbicar ? ` · ${sinUbicar} acciones sin banda o zona registrada.` : ""}
          </p>
        </div>

        {selectedCell ? (
          <div className="rounded-2xl border border-[#C8A96B]/30 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Celda</p>
                <p className="mt-1 text-base font-semibold text-[#E7D2A0]">{BANDA_LABEL[selBanda]}</p>
                <p className="text-sm text-slate-400">{zonaLabel(Number(selZona) as Zona, mode)}</p>
              </div>

              <button
                type="button"
                aria-label="Cerrar detalle de celda"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>

            <dl className="mt-4 space-y-2">
              {METRICS.map((m) => (
                <div key={m.key} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <dt className="text-[11px] text-zinc-400">{m.label}</dt>
                  <dd className="text-sm font-semibold text-white">
                    {m.decimals === 0 ? Math.round(selectedCell[m.key]) : selectedCell[m.key].toFixed(m.decimals)}
                    {m.suffix}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-[11px] uppercase tracking-wide text-zinc-500">Dirección del envío</p>
            <div className="mt-2 space-y-1.5">
              {selectedCell.direcciones.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-zinc-300">{label}</span>
                  <span className="shrink-0 text-zinc-500">
                    {count} · {Math.round((count / selectedCell.total) * 100)}%
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] uppercase tracking-wide text-zinc-500">Resultado final</p>
            <div className="mt-2 space-y-1.5">
              {selectedCell.resultados.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: resultColor(label) }} />
                    <span className="truncate text-zinc-300">{label}</span>
                  </span>
                  <span className="shrink-0 text-zinc-500">{count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Ranking · {active.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              Orden de las seis celdas según la métrica activa.
            </p>

            <div className="mt-4 space-y-3">
              {ranking.length ? (
                ranking.map((item) => {
                  const ratio = ratioFor(item.value);

                  return (
                    <button key={item.key} type="button" onClick={() => setSelected(item.key)} className="block w-full text-left">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate text-zinc-300">
                          {BANDA_LABEL[item.banda]} · Z{item.zona}
                        </span>
                        <span className="shrink-0 font-semibold" style={{ color: ACCENT_INK }}>
                          {format(item.value)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(3, ratio * 100)}%`, background: heatColor(ratio, active.tono) }}
                        />
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Sin datos suficientes: completa Perfil y Zona_Saque en la hoja.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
