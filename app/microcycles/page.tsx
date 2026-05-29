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
  LineChart,
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
      String(v)
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    ) || 0
  );
}

function avg(arr: number[]) {
  if (!arr.length) return 0;

  return +(
    arr.reduce((a, b) => a + b, 0) /
    arr.length
  ).toFixed(1);
}

function normalizeMD(v?: string) {
  if (!v) return "";

  return String(v)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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
      .then((t) => {
        const parsed = parseCSV(t);
        setRows(parsed);
      })
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
      : rows.filter(
          (r) => String(r.micro) === micro
        );

  const metrics = {
    eval: avg(
      filtered
        .map((r) => r.evaluacion)
        .filter((n) => n > 0)
    ),
    load: filtered.reduce(
      (a, b) => a + b.carga,
      0
    ),
    cog: filtered.reduce(
      (a, b) => a + b.cargaCog,
      0
    ),
    tasks: filtered.length,
  };

  const mdOrder = [
    "MD-4",
    "MD-3",
    "MD-2",
    "MD-1",
    "MD",
  ];

  const mdData = mdOrder.map((md) => {
    const set = filtered.filter(
      (r) => r.md === md
    );

    return {
      md,
      carga: set.reduce(
        (a, b) => a + b.carga,
        0
      ),
      cargaCog: set.reduce(
        (a, b) => a + b.cargaCog,
        0
      ),
      intensidad: avg(
        set.map((r) => r.intensidad)
      ),
    };
  });

  const trendData = micros.map((m) => {
    const set = rows.filter(
      (r) => r.micro === m
    );

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
    const set = rows.filter(
      (r) => r.micro === m
    );

    return {
      micro: `M${m}`,
      eval: avg(
        set
          .map((r) => r.evaluacion)
          .filter((n) => n > 0)
      ),
      load: set.reduce(
        (a, b) => a + b.carga,
        0
      ),
    };
  });

  const taskEvalData = useMemo(() => {
    const grouped: Record<
      string,
      number[]
    > = {};

    filtered.forEach((r) => {
      const key = r.tipo || "Unknown";

      if (!grouped[key]) {
        grouped[key] = [];
      }

      if (r.evaluacion > 0) {
        grouped[key].push(r.evaluacion);
      }
    });

    return Object.entries(
      grouped
    ).map(([tipo, vals]) => ({
      tipo,
      eval: avg(vals),
    }));
  }, [filtered]);

  const phaseData = useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      const key =
        r.fase || "Unknown";

      grouped[key] =
        (grouped[key] || 0) + 1;
    });

    return Object.entries(
      grouped
    ).map(([fase, total]) => ({
      fase,
      total,
    }));
  }, [filtered]);

  const analysisData = useMemo(() => {
    const grouped: Record<
      string,
      number[]
    > = {};

    filtered.forEach((r) => {
      const key =
        r.analisisPost ||
        "No Analysis";

      if (!grouped[key]) {
        grouped[key] = [];
      }

      if (r.evaluacion > 0) {
        grouped[key].push(
          r.evaluacion
        );
      }
    });

    return Object.entries(
      grouped
    ).map(([name, vals]) => ({
      name,
      eval: avg(vals),
    }));
  }, [filtered]);

  const contenidoPrincipalData =
    useMemo(() => {
      const grouped: Record<
        string,
        number[]
      > = {};

      filtered.forEach((r) => {
        const key =
          r.contenidoPrincipal ||
          "No Content";

        if (!grouped[key]) {
          grouped[key] = [];
        }

        if (r.evaluacion > 0) {
          grouped[key].push(
            r.evaluacion
          );
        }
      });

      return Object.entries(
        grouped
      ).map(([name, vals]) => ({
        name,
        eval: avg(vals),
      }));
    }, [filtered]);

  const contenidoSecundarioData =
    useMemo(() => {
      const grouped: Record<
        string,
        number[]
      > = {};

      filtered.forEach((r) => {
        const key =
          r.contenidoSecundario ||
          "No Content";

        if (!grouped[key]) {
          grouped[key] = [];
        }

        if (r.evaluacion > 0) {
          grouped[key].push(
            r.evaluacion
          );
        }
      });

      return Object.entries(
        grouped
      ).map(([name, vals]) => ({
        name,
        eval: avg(vals),
      }));
    }, [filtered]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-10">
            <div className="rounded-[40px] border border-white/10 bg-white/[0.03] p-10">
              <div className="flex items-center justify-between">
                 <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                                RMC Intelligence
              </p>

              <div className="mt-4 flex items-center gap-5">
                <h1 className="text-4xl font-semibold tracking-tight">
                 Análisis de Microciclos
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

                <select
                  value={micro}
                  onChange={(e) =>
                    setMicro(
                      e.target.value
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-5 py-3"
                >
                  <option value="ALL">
                    All Microcycles
                  </option>

                  {micros.map((m) => (
                    <option
                      key={m}
                      value={m}
                    >
                      Micro {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-5 mt-10">
                <Card
                  title="Avg Eval"
                  value={metrics.eval}
                />

                <Card
                  title="Physical Load"
                  value={metrics.load}
                />

                <Card
                  title="Cognitive Load"
                  value={metrics.cog}
                />

                <Card
                  title="Tasks"
                  value={metrics.tasks}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-10">

              <Panel title="Load by MD">
                <Chart>
                  <ComposedChart data={mdData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="md" />
                    <YAxis />
                    <Tooltip />
                    <Legend />

                    <Bar
                      dataKey="carga"
                      fill={COLORS.gold}
                      radius={[8, 8, 0, 0]}
                    />

                    <Bar
                      dataKey="cargaCog"
                      fill={COLORS.blue}
                      radius={[8, 8, 0, 0]}
                    />

                    <Line
                      dataKey="intensidad"
                      stroke={COLORS.purple}
                      strokeWidth={3}
                    />
                  </ComposedChart>
                </Chart>
              </Panel>

              <Panel title="Cognitive Load">
                <Chart>
                  <AreaChart data={mdData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="md" />
                    <YAxis />
                    <Tooltip />

                    <Area
                      dataKey="cargaCog"
                      stroke={COLORS.gray}
                      fill={COLORS.gray}
                      fillOpacity={0.25}
                    />
                  </AreaChart>
                </Chart>
              </Panel>

              <Panel title="Evaluation Trend">
                <Chart>
                  <AreaChart data={trendData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="micro" />
                    <YAxis />
                    <Tooltip />

                    <Area
                      dataKey="value"
                      fill={COLORS.gold}
                      fillOpacity={0.2}
                    />

                    <Line
                      dataKey="value"
                      stroke={COLORS.gold}
                      strokeWidth={3}
                    />
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

                    <Bar
                      dataKey="intensidad"
                      fill={COLORS.purple}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Microcycle Comparison">
                <Chart>
                  <ComposedChart
                    data={compareData}
                  >
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="micro" />
                    <YAxis />
                    <Tooltip />
                    <Legend />

                    <Bar
                      dataKey="load"
                      fill={COLORS.blue}
                      radius={[8, 8, 0, 0]}
                    />

                    <Line
                      dataKey="eval"
                      stroke={COLORS.gold}
                      strokeWidth={3}
                    />
                  </ComposedChart>
                </Chart>
              </Panel>

              <Panel title="Phase Distribution">
                <Chart>
                  <PieChart>
                    <Tooltip />

                    <Pie
                      data={phaseData}
                      dataKey="total"
                      nameKey="fase"
                      innerRadius={55}
                      outerRadius={110}
                    >
                      {phaseData.map(
                        (_, i) => (
                          <Cell
                            key={i}
                            fill={
                              PIE_COLORS[
                                i %
                                  PIE_COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>
                  </PieChart>
                </Chart>
              </Panel>

              <Panel title="Evaluation by Task Type">
                <Chart>
                  <BarChart
                    data={taskEvalData}
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#1E232A" />

                    <XAxis type="number" />

                    <YAxis
                      type="category"
                      dataKey="tipo"
                      width={120}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="eval"
                      fill={COLORS.gold}
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Post Analysis Impact">
                <Chart>
                  <BarChart
                    data={analysisData}
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#1E232A" />

                    <XAxis type="number" />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="eval"
                      fill={COLORS.purple}
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Evaluation by Main Content">
                <Chart>
                  <BarChart
                    data={
                      contenidoPrincipalData
                    }
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#1E232A" />

                    <XAxis type="number" />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="eval"
                      fill={COLORS.gold}
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Evaluation by Secondary Content">
                <Chart>
                  <BarChart
                    data={
                      contenidoSecundarioData
                    }
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#1E232A" />

                    <XAxis type="number" />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="eval"
                      fill={COLORS.blue}
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </Chart>
              </Panel>

            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Chart({
  children,
}: any) {
  return (
    <ResponsiveContainer
      width="100%"
      height={320}
    >
      {children}
    </ResponsiveContainer>
  );
}

function Card({
  title,
  value,
}: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm text-zinc-400">
        {title}
      </p>

      <h3 className="mt-4 text-4xl font-semibold">
        {value}
      </h3>
    </div>
  );
}

function Panel({
  title,
  children,
}: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-xl">
      <h2 className="mb-6 text-2xl font-semibold">
        {title}
      </h2>

      {children}
    </div>
  );
}