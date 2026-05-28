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
  ComposedChart,
  Legend,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=675048698&single=true&output=csv";

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
  jornada: number;
  rival: string;
  tiempo: number;
  minuto: number;
  sacador: string;
  tipoAccion: string;
  perfilGolpeo: string;
  tipoEnvio: string;
  zonaCaida: string;
  tipoCarrera: string;
  defensaRival: string;
  debilidadRival: string;
  rematador: string;
  tipoRemate: string;
  zonaRemate: string;
  xg: number;
  segundoBalon: string;
  resultadoFinal: string;
  rutina: string;
  repetir: string;
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

function parseCSV(text: string): Row[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data.slice(1).map((r) => ({
    jornada: num(r[0]),
    rival: r[1] || "",
    tiempo: num(r[2]),
    minuto: num(r[3]),
    sacador: r[6] || "",
    tipoAccion: r[8] || "",
    perfilGolpeo: r[9] || "",
    tipoEnvio: r[10] || "",
    zonaCaida: r[11] || "",
    tipoCarrera: r[16] || "",
    defensaRival: r[21] || "",
    debilidadRival: r[22] || "",
    rematador: r[24] || "",
    tipoRemate: r[25] || "",
    zonaRemate: r[26] || "",
    xg: num(r[27]),
    segundoBalon: r[28] || "",
    resultadoFinal: r[29] || "",
    rutina: r[30] || "",
    repetir: r[31] || "",
  }));
}

function avg(arr: number[]) {
  if (!arr.length) return 0;

  return +(
    arr.reduce((a, b) => a + b, 0) /
    arr.length
  ).toFixed(2);
}

function countBy(
  rows: Row[],
  key: keyof Row
) {
  const grouped: Record<
    string,
    number
  > = {};

  rows.forEach((r) => {
    const k = String(r[key] || "Unknown");
    grouped[k] =
      (grouped[k] || 0) + 1;
  });

  return Object.entries(
    grouped
  ).map(([name, total]) => ({
    name,
    total,
  }));
}

export default function Page() {
  const [rows, setRows] =
    useState<Row[]>([]);
  const [jornada, setJornada] =
    useState("ALL");

  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((t) =>
        setRows(parseCSV(t))
      );
  }, []);

  const jornadas = useMemo(
    () =>
      [
        ...new Set(
          rows.map((r) => r.jornada)
        ),
      ].sort((a, b) => a - b),
    [rows]
  );

  const filtered =
    jornada === "ALL"
      ? rows
      : rows.filter(
          (r) =>
            String(r.jornada) ===
            jornada
        );

  const metrics = {
    total: filtered.length,
    xg: filtered.reduce(
      (a, b) => a + b.xg,
      0
    ),
    shots: filtered.filter(
      (r) =>
        r.resultadoFinal
          .toLowerCase()
          .includes("remate")
    ).length,
    goals: filtered.filter(
      (r) =>
        r.resultadoFinal
          .toLowerCase()
          .includes("gol")
    ).length,
  };

  const tipoAccion =
    countBy(filtered, "tipoAccion");

  const zonaCaida =
    countBy(filtered, "zonaCaida");

  const tipoCarrera =
    countBy(filtered, "tipoCarrera");

  const defensa =
    countBy(filtered, "defensaRival");

  const sacadorData =
    useMemo(() => {
      const grouped:
        Record<
          string,
          {
            total: number;
            xg: number;
          }
        > = {};

      filtered.forEach((r) => {
        const k =
          r.sacador || "Unknown";

        if (!grouped[k]) {
          grouped[k] = {
            total: 0,
            xg: 0,
          };
        }

        grouped[k].total++;
        grouped[k].xg += r.xg;
      });

      return Object.entries(
        grouped
      ).map(([name, v]) => ({
        name,
        total: v.total,
        xg: +v.xg.toFixed(2),
      }));
    }, [filtered]);

  const scatterData =
    filtered.map((r) => ({
      xg: r.xg,
      tipo: r.tipoRemate,
    }));

  const timeline =
    Array.from(
      { length: 6 },
      (_, i) => {
        const start = i * 15;

        return {
          tramo: `${start}-${start + 15}`,
          total:
            filtered.filter(
              (r) =>
                r.minuto >=
                  start &&
                r.minuto <
                  start + 15
            ).length,
        };
      }
    );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-10">

            <div className="rounded-[40px] border border-white/10 bg-white/[0.03] p-10">

              <div className="flex items-center justify-between">
                <h1 className="text-5xl font-semibold">
                  Set Piece Intelligence
                </h1>

                <select
                  value={jornada}
                  onChange={(e) =>
                    setJornada(
                      e.target.value
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-5 py-3"
                >
                  <option value="ALL">
                    Todas
                  </option>

                  {jornadas.map(
                    (m) => (
                      <option
                        key={m}
                        value={m}
                      >
                        Jornada {m}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-5 mt-10">
                <Card
                  title="ABP"
                  value={
                    metrics.total
                  }
                />

                <Card
                  title="xG"
                  value={
                    metrics.xg.toFixed(
                      2
                    )
                  }
                />

                <Card
                  title="Remates"
                  value={
                    metrics.shots
                  }
                />

                <Card
                  title="Goles"
                  value={
                    metrics.goals
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-10">

              <Panel title="Tipo de acción">
                <Chart>
                  <BarChart
                    data={
                      tipoAccion
                    }
                  >
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="total"
                      fill={COLORS.gold}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Zona caída">
                <Chart>
                  <PieChart>
                    <Pie
                      data={
                        zonaCaida
                      }
                      dataKey="total"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={110}
                    >
                      {zonaCaida.map(
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
                    <Tooltip />
                  </PieChart>
                </Chart>
              </Panel>

              <Panel title="Impacto sacador">
                <Chart>
                  <BarChart
                    data={
                      sacadorData
                    }
                    layout="vertical"
                  >
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="xg"
                      fill={COLORS.blue}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Tipo carrera">
                <Chart>
                  <PieChart>
                    <Pie
                      data={
                        tipoCarrera
                      }
                      dataKey="total"
                      nameKey="name"
                      outerRadius={110}
                    >
                      {tipoCarrera.map(
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
                    <Tooltip />
                  </PieChart>
                </Chart>
              </Panel>

              <Panel title="Defensa rival">
                <Chart>
                  <BarChart
                    data={defensa}
                  >
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="total"
                      fill={COLORS.purple}
                    />
                  </BarChart>
                </Chart>
              </Panel>

              <Panel title="Timeline">
                <Chart>
                  <LineChart
                    data={timeline}
                  >
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis dataKey="tramo" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      dataKey="total"
                      stroke={COLORS.green}
                      strokeWidth={3}
                    />
                  </LineChart>
                </Chart>
              </Panel>

              <Panel title="Finalización xG">
                <Chart>
                  <ScatterChart>
                    <XAxis
                      dataKey="xg"
                    />
                    <YAxis
                      dataKey="tipo"
                    />
                    <Tooltip />
                    <Scatter
                      data={
                        scatterData
                      }
                      fill={
                        COLORS.gold
                      }
                    />
                  </ScatterChart>
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