"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ThrowInField } from "@/components/throw-ins/ThrowInField";
import ThrowInZoneMap from "@/components/throw-ins/ThrowInZoneMap";
import ThrowInFlow from "@/components/throw-ins/ThrowInFlow";
import {
  esFavorable,
  esProduccion,
  esProgresion,
  type Mode,
  numero,
  parseDireccion,
  parseResultado,
  read,
  type RecordRow,
  resultColor,
} from "@/components/throw-ins/throwInModel";

type ThrowInsDashboardProps = {
  csvUrl: string;
  title: string;
  mode: Mode;
};

const COLORS = ["#C8A96B", "#3B82F6", "#8B5CF6", "#10B981", "#F97316", "#EC4899"];

/**
 * Filtros por vista. La hoja defensiva no tiene Intencion, Sacador, Rutina ni
 * Velocidad_Saque, y llama Defensa / Debilidad_Defensiva a lo que en la
 * ofensiva son Defensa_Rival / Debilidad_Rival.
 */
function filtersFor(mode: Mode): { key: string; label: string }[] {
  const common = [
    { key: "JORNADA", label: "Jornada" },
    { key: "Rival", label: "Rival" },
    { key: "Tiempo", label: "Tiempo" },
    { key: "Perfil", label: "Banda" },
    { key: "Zona_Saque", label: "Zona de saque" },
    { key: "Tipo_Envio", label: "Tipo de envío" },
    { key: "Calidad_Envio", label: "Calidad de envío" },
    { key: "N_Bloqueadores", label: "Nº bloqueadores" },
  ];

  const propios =
    mode === "offensive"
      ? [
          { key: "Intencion", label: "Intención" },
          { key: "Rutina", label: "Rutina" },
          { key: "Sacador", label: "Sacador" },
        ]
      : [
          { key: "Defensa", label: "Nuestra defensa" },
          { key: "Debilidad_Defensiva", label: "Debilidad defensiva" },
        ];

  return [...common, ...propios, { key: "Resultado_Final", label: "Resultado" }];
}

function chartsFor(mode: Mode): { key: string; title: string }[] {
  const common = [
    { key: "Zona_Saque", title: mode === "offensive" ? "Zona de saque" : "Zona de saque del rival" },
    { key: "Perfil", title: "Banda" },
    { key: "Tipo_Envio", title: "Tipo de envío" },
    { key: "Zona_Caida", title: "Dirección del envío" },
    { key: "Calidad_Envio", title: "Calidad de envío" },
    { key: "Receptor", title: "Receptores" },
  ];

  const propios =
    mode === "offensive"
      ? [
          { key: "Intencion", title: "Intención" },
          { key: "Sacador", title: "Sacadores" },
          { key: "Rutina", title: "Rutina" },
          { key: "Defensa_Rival", title: "Defensa del rival" },
          { key: "Debilidad_Rival", title: "Debilidad del rival" },
        ]
      : [
          { key: "Defensa", title: "Nuestra defensa" },
          { key: "Debilidad_Defensiva", title: "Debilidad defensiva" },
        ];

  return [...common, ...propios];
}

function groupBy(rows: RecordRow[], key: string) {
  return Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = read(row, key) || "Sin dato";
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

/** El resultado se agrupa por su etiqueta canónica, no por el texto crudo. */
function groupResults(rows: RecordRow[]) {
  const acc = new Map<string, number>();

  rows.forEach((row) => {
    const label = parseResultado(read(row, "Resultado_Final")).label;
    acc.set(label, (acc.get(label) ?? 0) + 1);
  });

  return [...acc.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
      >
        <option value="ALL">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? "text-[#E7D2A0]" : "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DistributionChart({
  title,
  data,
  colorFor,
}: {
  title: string;
  data: { name: string; total: number }[];
  colorFor?: (name: string, index: number) => string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      {data.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 48 }}>
              <CartesianGrid stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-28}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#0B1728", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}
              />
              <Bar dataKey="total" radius={[7, 7, 0, 0]}>
                {data.map((item, index) => (
                  <Cell
                    key={item.name}
                    fill={colorFor ? colorFor(item.name, index) : COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-20 text-center text-sm text-slate-500">Aún no hay registros para esta visualización.</p>
      )}
    </section>
  );
}

export function ThrowInsDashboard({ csvUrl, title, mode }: ThrowInsDashboardProps) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const contentRef = useRef<HTMLDivElement | null>(null);

  const isOffensive = mode === "offensive";
  const FILTERS = useMemo(() => filtersFor(mode), [mode]);
  const CHARTS = useMemo(() => chartsFor(mode), [mode]);

  useEffect(() => {
    let active = true;

    fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la hoja de datos.");
        return response.text();
      })
      .then((csv) => {
        const parsed = Papa.parse<RecordRow>(csv, { header: true, skipEmptyLines: true });
        // Las filas de marcador sin saque registrado ensucian todos los conteos.
        if (active) setRows(parsed.data.filter((row) => read(row, "Zona_Saque")));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Error cargando los datos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [csvUrl]);

  const options = useMemo(() => {
    const map: Record<string, string[]> = {};

    FILTERS.forEach(({ key }) => {
      const values = [...new Set(rows.map((row) => read(row, key)).filter(Boolean))];
      map[key] = key === "JORNADA" ? values : values.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    });

    return map;
  }, [rows, FILTERS]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        FILTERS.every(({ key }) => {
          const selected = filters[key] ?? "ALL";
          return selected === "ALL" || read(row, key) === selected;
        })
      ),
    [rows, filters, FILTERS]
  );

  const activeFilters = FILTERS.filter(({ key }) => (filters[key] ?? "ALL") !== "ALL").length;

  const totals = useMemo(() => {
    let favorable = 0;
    let produccion = 0;
    let progresion = 0;
    let calidadSuma = 0;
    let calidadN = 0;

    filtered.forEach((row) => {
      const resultado = parseResultado(read(row, "Resultado_Final"));
      if (esFavorable(resultado)) favorable += 1;
      if (esProduccion(resultado, mode)) produccion += 1;
      if (esProgresion(row)) progresion += 1;

      const calidad = numero(read(row, "Calidad_Envio"));
      if (calidad !== null) {
        calidadSuma += calidad;
        calidadN += 1;
      }
    });

    const pct = (value: number) => (filtered.length ? Math.round((value / filtered.length) * 100) : 0);

    return {
      acciones: filtered.length,
      progresion: pct(progresion),
      favorable: pct(favorable),
      produccion,
      produccionPct: pct(produccion),
      calidad: calidadN ? (calidadSuma / calidadN).toFixed(1) : "–",
    };
  }, [filtered, mode]);

  const exportPng = useCallback(async () => {
    if (!contentRef.current) return;

    setExporting(true);

    try {
      const dataUrl = await htmlToImage.toPng(contentRef.current, {
        backgroundColor: "#0B0F14",
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `saque-banda-${isOffensive ? "ofensivo" : "defensivo"}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("No se pudo generar la imagen del panel.");
    } finally {
      setExporting(false);
    }
  }, [isOffensive]);

  const tableRows = filtered.slice(0, 100);

  const tableColumns = isOffensive
    ? ["Jornada", "Rival", "Tiempo", "Sacador", "Banda", "Zona saque", "Envío", "Dirección", "Intención", "Rutina", "Resultado"]
    : ["Jornada", "Rival", "Tiempo", "Banda", "Zona saque", "Envío", "Dirección", "Receptor", "Defensa", "Debilidad", "Resultado"];

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <Topbar />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">RMCF Castilla · Colectivo</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Análisis de saques de banda {isOffensive ? "a favor" : "en contra"}. Un resultado sin sufijo es del
                  RMCF y uno acabado en &laquo;Rival&raquo; es del rival: sobre esa regla se calculan retención,
                  progresión y peligro.
                </p>
              </div>

              <button
                type="button"
                onClick={exportPng}
                disabled={exporting || loading}
                className="flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm text-[#E7D2A0] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown size={16} />
                {exporting ? "Generando…" : "Descargar PNG"}
              </button>
            </div>

            <div className="mb-7 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {FILTERS.map(({ key, label }) => (
                  <SelectFilter
                    key={key}
                    label={label}
                    value={filters[key] ?? "ALL"}
                    onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                    options={options[key] ?? []}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {filtered.length} de {rows.length} saques registrados
                  {activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? "filtro" : "filtros"} activos` : ""}
                </span>

                {activeFilters ? (
                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="rounded-full border border-white/10 px-3 py-1 text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
            ) : null}

            {loading ? (
              <p className="py-24 text-center text-slate-400">Cargando saques de banda…</p>
            ) : (
              <div ref={contentRef}>
                <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard
                    label={isOffensive ? "Saques registrados" : "Saques del rival"}
                    value={totals.acciones}
                    accent
                  />
                  <MetricCard
                    label={isOffensive ? "% Progresión" : "% Progresión concedida"}
                    value={`${totals.progresion}%`}
                    hint="Envíos hacia delante o al área"
                  />
                  <MetricCard
                    label={isOffensive ? "% Retención" : "% Recuperación"}
                    value={`${totals.favorable}%`}
                    hint="Acaba con el balón para el RMCF"
                  />
                  <MetricCard
                    label={isOffensive ? "Producción" : "Peligro concedido"}
                    value={`${totals.produccion} · ${totals.produccionPct}%`}
                    hint={
                      isOffensive
                        ? "Conquista de último tercio, ocasión o gol nuestro"
                        : "Conquista de último tercio, ocasión o gol del rival"
                    }
                  />
                  <MetricCard
                    label={isOffensive ? "Calidad media de envío" : "Calidad media del envío rival"}
                    value={totals.calidad}
                    hint="Escala 1 a 4"
                  />
                </div>

                <ThrowInField rows={filtered} mode={mode} />

                <ThrowInZoneMap rows={filtered} mode={mode} />

                <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Flujo</p>
                    <h2 className="mt-1 text-xl font-semibold md:text-2xl">
                      Del saque al resultado {isOffensive ? "ofensivo" : "defensivo"}
                    </h2>
                  </div>

                  <ThrowInFlow rows={filtered} mode={mode} />
                </section>

                <div className="grid gap-5 xl:grid-cols-2">
                  {CHARTS.map(({ key, title: chartTitle }) => (
                    <DistributionChart key={key} title={chartTitle} data={groupBy(filtered, key)} />
                  ))}

                  <DistributionChart
                    title="Resultado final"
                    data={groupResults(filtered)}
                    colorFor={(name) => resultColor(name)}
                  />
                </div>

                <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 px-5 py-4 md:px-6">
                    <h2 className="text-lg font-semibold">Registro de acciones</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Mostrando hasta 100 acciones según los filtros aplicados.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left text-sm">
                      <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          {tableColumns.map((label) => (
                            <th key={label} className="px-4 py-3 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tableRows.map((row, index) => {
                          const resultado = parseResultado(read(row, "Resultado_Final"));

                          return (
                            <tr key={`${read(row, "JORNADA")}-${index}`} className="text-slate-200">
                              <td className="px-4 py-3">{read(row, "JORNADA") || "-"}</td>
                              <td className="px-4 py-3">{read(row, "Rival") || "-"}</td>
                              <td className="px-4 py-3">{read(row, "Tiempo") || "-"}</td>
                              {isOffensive ? <td className="px-4 py-3">{read(row, "Sacador") || "-"}</td> : null}
                              <td className="px-4 py-3">{read(row, "Perfil") || "-"}</td>
                              <td className="px-4 py-3">{read(row, "Zona_Saque") || "-"}</td>
                              <td className="px-4 py-3">{read(row, "Tipo_Envio") || "-"}</td>
                              <td className="px-4 py-3">{parseDireccion(read(row, "Zona_Caida")).label}</td>
                              {isOffensive ? (
                                <>
                                  <td className="px-4 py-3">{read(row, "Intencion") || "-"}</td>
                                  <td className="px-4 py-3">{read(row, "Rutina") || "-"}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3">{read(row, "Receptor") || "-"}</td>
                                  <td className="px-4 py-3">{read(row, "Defensa") || "-"}</td>
                                  <td className="px-4 py-3">{read(row, "Debilidad_Defensiva") || "-"}</td>
                                </>
                              )}
                              <td className="px-4 py-3 font-medium" style={{ color: resultColor(resultado.label) }}>
                                {resultado.label}
                              </td>
                            </tr>
                          );
                        })}
                        {!tableRows.length ? (
                          <tr>
                            <td colSpan={tableColumns.length} className="px-4 py-10 text-center text-slate-500">
                              Aún no hay acciones que mostrar.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
