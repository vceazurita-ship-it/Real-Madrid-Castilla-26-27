"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=0&single=true&output=csv";

const COLORS = {
  gold: "#C8A96B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  green: "#10B981",
  gray: "#64748B",
};

const PIE_COLORS = [
  "#C8A96B",
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F97316",
  "#EC4899",
];

type Row = {
  contenidoPrincipal: string;
  contenidoSecundario: string;
  temporada: string;
  micro: number;
  rival: string;
  md: string;
  fecha: string;
  tarea: string;
  tipo: string;
  evaluacion: number;
  analisisPost: string;
  fase: string;
  intensidad: number;
  carga: number;
  cargaCog: number;
};

function num(v?: string) {
  if (!v) return 0;
  return (
    Number(
      String(v).replace(",", ".").replace(/[^\d.-]/g, "")
    ) || 0
  );
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function normalizeMD(v?: string) {
  if (!v) return "";
  return String(v).trim().toUpperCase().replace(/\s+/g, "");
}

function parseCSV(text: string): Row[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .slice(1)
    .map((r) => ({
      temporada: r[0] || "",
      micro: num(r[1]),
      rival: r[2] || "",
      md: normalizeMD(r[4]),
      fecha: r[5] || "",
      tarea: r[6] || "",
      tipo: r[7] || "",
      evaluacion: num(r[8]),
      analisisPost: r[9] || "",
      contenidoPrincipal: r[14] || "",
      contenidoSecundario: r[15] || "",
      fase: r[16] || "",
      intensidad: num(r[18]),
      carga: num(r[19]),
      cargaCog: num(r[21]),
    }))
    .filter(
      (r) =>
        r.micro > 0 &&
        r.md &&
        r.tarea.trim() !== ""
    );
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [micro, setMicro] = useState("ALL");

  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((t) => setRows(parseCSV(t)))
      .catch(console.error);
  }, []);

  const micros = useMemo(
    () =>
      [...new Set(rows.map((r) => r.micro))].sort(
        (a, b) => a - b
      ),
    [rows]
  );

  const filtered =
    micro === "ALL"
      ? rows
      : rows.filter((r) => String(r.micro) === micro);

  const metrics = {
    eval: avg(
      filtered
        .map((r) => r.evaluacion)
        .filter((n) => n > 0)
    ),
    load: filtered.reduce((a, b) => a + b.carga, 0),
    cog: filtered.reduce((a, b) => a + b.cargaCog, 0),
    tasks: filtered.length,
  };

  const mdOrder = ["MD-4", "MD-3", "MD-2", "MD-1", "MD"];

  const mdData = mdOrder.map((md) => {
    const set = filtered.filter((r) => r.md === md);

    return {
      md,
      carga: set.reduce((a, b) => a + b.carga, 0),
      cargaCog: set.reduce((a, b) => a + b.cargaCog, 0),
      intensidad: avg(set.map((r) => r.intensidad)),
    };
  });

  const trendData = micros.map((m) => {
    const set = rows.filter((r) => r.micro === m);

    return {
      micro: `M${m}`,
      value: avg(
        set
          .map((r) => r.evaluacion)
          .filter((n) => n > 0)
      ),
    };
  });

  const compareData = micros.map((m) => {
    const set = rows.filter((r) => r.micro === m);

    return {
      micro: `M${m}`,
      eval: avg(
        set
          .map((r) => r.evaluacion)
          .filter((n) => n > 0)
      ),
      load: set.reduce((a, b) => a + b.carga, 0),
    };
  });

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-8 lg:p-10">

            {/* HERO */}
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-transparent p-10">

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,107,0.12),transparent_35%)]" />

              <div className="relative z-10 flex items-start justify-between gap-10">

                <div className="max-w-4xl">
                  <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                    RMC Intelligence
                  </p>

                  <h1 className="mt-5 text-5xl font-semibold tracking-tight leading-[0.95]">
                    Análisis de
                    <br />
                    Microciclos
                  </h1>

                  <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
                    Evaluación integrada de carga física,
                    carga cognitiva e intensidad competitiva
                    a través de cada microciclo.
                  </p>
                </div>

                <select
                  value={micro}
                  onChange={(e) =>
                    setMicro(e.target.value)
                  }
                  className="rounded-2xl border border-white/10 bg-[#11161C] px-5 py-3 text-white"
                >
                  <option value="ALL">
                    All Microcycles
                  </option>

                  {micros.map((m) => (
                    <option key={m} value={m}>
                      Micro {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative z-10 mt-10 grid grid-cols-4 gap-5">
                <Card title="Avg Eval" value={metrics.eval} />
                <Card title="Physical Load" value={metrics.load} />
                <Card title="Cognitive Load" value={metrics.cog} />
                <Card title="Tasks" value={metrics.tasks} />
              </div>
            </div>

            {/* GRID */}
            <div className="mt-8 grid grid-cols-2 gap-6">

              <Panel title="Load by MD">
                <Chart>
                  <ComposedChart data={mdData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="md" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="carga" fill={COLORS.gold} radius={[8,8,0,0]} />
                    <Bar dataKey="cargaCog" fill={COLORS.blue} radius={[8,8,0,0]} />
                    <Line dataKey="intensidad" stroke={COLORS.purple} strokeWidth={3} />
                  </ComposedChart>
                </Chart>
              </Panel>

              <Panel title="Evaluation Trend">
                <Chart>
                  <AreaChart data={trendData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="micro" />
                    <YAxis />
                    <Tooltip />
                    <Area dataKey="value" fill={COLORS.gold} fillOpacity={0.18} />
                    <Line dataKey="value" stroke={COLORS.gold} strokeWidth={3} />
                  </AreaChart>
                </Chart>
              </Panel>

              <Panel title="Intensity by MD">
                <Chart>
                  <BarChart data={mdData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="md" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="intensidad" fill={COLORS.purple} radius={[8,8,0,0]} />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Microcycle Comparison">
                <Chart>
                  <ComposedChart data={compareData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="micro" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="load" fill={COLORS.blue} radius={[8,8,0,0]} />
                    <Line dataKey="eval" stroke={COLORS.gold} strokeWidth={3} />
                  </ComposedChart>
                </Chart>
              </Panel>

            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Chart({ children }: any) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      {children}
    </ResponsiveContainer>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
      <p className="text-sm text-zinc-400">
        {title}
      </p>

      <h3 className="mt-3 text-3xl font-semibold">
        {value}
      </h3>
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm shadow-2xl">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">
        {title}
      </h2>

      {children}
    </div>
  );
}