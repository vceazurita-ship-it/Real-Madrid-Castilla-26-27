"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ThrowInField } from "@/components/throw-ins/ThrowInField";

type RecordRow = Record<string, string>;

type ThrowInsDashboardProps = {
  csvUrl: string;
  title: string;
  mode: "offensive" | "defensive";
};

const COLORS = ["#C8A96B", "#3B82F6", "#8B5CF6", "#10B981", "#F97316", "#EC4899"];

function normalizeKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function read(row: RecordRow, key: string) {
  const expected = normalizeKey(key);
  const match = Object.keys(row).find((column) => normalizeKey(column) === expected);
  return match ? row[match]?.trim() ?? "" : "";
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
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? "text-[#E7D2A0]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function DistributionChart({ title, data }: { title: string; data: { name: string; total: number }[] }) {
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
                {data.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
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
  const [jornada, setJornada] = useState("ALL");
  const [rival, setRival] = useState("ALL");
  const [perfil, setPerfil] = useState("ALL");
  const [zonaSaque, setZonaSaque] = useState("ALL");
  const [tipoEnvio, setTipoEnvio] = useState("ALL");
  const [resultado, setResultado] = useState("ALL");

  useEffect(() => {
    let active = true;
    fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la hoja de datos.");
        return response.text();
      })
      .then((csv) => {
        const parsed = Papa.parse<RecordRow>(csv, { header: true, skipEmptyLines: true });
        if (active) setRows(parsed.data.filter((row) => Object.values(row).some(Boolean)));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Error cargando los datos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [csvUrl]);

  const options = useMemo(() => ({
    jornadas: [...new Set(rows.map((row) => read(row, "JORNADA")).filter(Boolean))],
    rivales: [...new Set(rows.map((row) => read(row, "Rival")).filter(Boolean))].sort(),
    perfiles: [...new Set(rows.map((row) => read(row, "Perfil")).filter(Boolean))].sort(),
    zonas: [...new Set(rows.map((row) => read(row, "Zona_Saque")).filter(Boolean))].sort(),
    envios: [...new Set(rows.map((row) => read(row, "Tipo_Envio")).filter(Boolean))].sort(),
    resultados: [...new Set(rows.map((row) => read(row, "Resultado_Final")).filter(Boolean))].sort(),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) =>
    (jornada === "ALL" || read(row, "JORNADA") === jornada) &&
    (rival === "ALL" || read(row, "Rival") === rival) &&
    (perfil === "ALL" || read(row, "Perfil") === perfil) &&
    (zonaSaque === "ALL" || read(row, "Zona_Saque") === zonaSaque) &&
    (tipoEnvio === "ALL" || read(row, "Tipo_Envio") === tipoEnvio) &&
    (resultado === "ALL" || read(row, "Resultado_Final") === resultado)
  ), [rows, jornada, rival, perfil, zonaSaque, tipoEnvio, resultado]);

  const totals = useMemo(() => ({
    actions: filtered.length,
    goals: filtered.filter((row) => read(row, "Resultado_Final").toLowerCase().includes("gol")).length,
    chances: filtered.filter((row) => read(row, "Resultado_Final").toLowerCase().includes("ocasi")).length,
    abp: filtered.filter((row) => read(row, "Resultado_Final").toLowerCase() === "abp").length,
  }), [filtered]);

  const tableRows = filtered.slice(0, 100);
  const isOffensive = mode === "offensive";

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <Topbar />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">RMCF Castilla · Colectivo</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Análisis de saques de banda {isOffensive ? "a favor" : "en contra"}. Los gráficos se actualizarán automáticamente cuando completes la hoja.</p>
            </div>

            <div className="mb-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SelectFilter label="Jornada" value={jornada} onChange={setJornada} options={options.jornadas} />
              <SelectFilter label="Rival" value={rival} onChange={setRival} options={options.rivales} />
              <SelectFilter label="Perfil" value={perfil} onChange={setPerfil} options={options.perfiles} />
              <SelectFilter label="Zona de saque" value={zonaSaque} onChange={setZonaSaque} options={options.zonas} />
              <SelectFilter label="Tipo de envío" value={tipoEnvio} onChange={setTipoEnvio} options={options.envios} />
              <SelectFilter label="Resultado" value={resultado} onChange={setResultado} options={options.resultados} />
            </div>

            {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
            {loading ? <p className="py-24 text-center text-slate-400">Cargando saques de banda…</p> : (
              <>
                <ThrowInField rows={filtered} mode={mode} read={read} />
                <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Saques registrados" value={totals.actions} accent />
                  <MetricCard label="Ocasiones" value={totals.chances} />
                  <MetricCard label="Goles" value={totals.goals} />
                  <MetricCard label="Continuidad ABP" value={totals.abp} />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <DistributionChart title="Zona de saque" data={groupBy(filtered, "Zona_Saque")} />
                  <DistributionChart title="Tipo de envío" data={groupBy(filtered, "Tipo_Envio")} />
                  <DistributionChart title="Zona de caída" data={groupBy(filtered, "Zona_Caida")} />
                  <DistributionChart title="Resultado final" data={groupBy(filtered, "Resultado_Final")} />
                  <DistributionChart title="Perfil" data={groupBy(filtered, "Perfil")} />
                  <DistributionChart title={isOffensive ? "Sacadores" : "Receptores"} data={groupBy(filtered, isOffensive ? "Sacador" : "Receptor")} />
                </div>

                <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 px-5 py-4 md:px-6">
                    <h2 className="text-lg font-semibold">Registro de acciones</h2>
                    <p className="mt-1 text-sm text-slate-400">Mostrando hasta 100 acciones según los filtros aplicados.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-left text-sm">
                      <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
                        <tr>{["Jornada", "Rival", "Minuto", isOffensive ? "Sacador" : "Perfil", "Zona saque", "Envío", "Zona caída", "Intención", "Resultado"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tableRows.map((row, index) => (
                          <tr key={`${read(row, "JORNADA")}-${index}`} className="text-slate-200">
                            <td className="px-4 py-3">{read(row, "JORNADA") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Rival") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Minuto") || "-"}</td>
                            <td className="px-4 py-3">{read(row, isOffensive ? "Sacador" : "Perfil") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Zona_Saque") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Tipo_Envio") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Zona_Caida") || "-"}</td>
                            <td className="px-4 py-3">{read(row, "Intencion") || "-"}</td>
                            <td className="px-4 py-3 font-medium text-[#E7D2A0]">{read(row, "Resultado_Final") || "-"}</td>
                          </tr>
                        ))}
                        {!tableRows.length ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Aún no hay acciones que mostrar.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
