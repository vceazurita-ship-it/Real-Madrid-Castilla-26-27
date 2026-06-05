"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import type { LegendProps } from "recharts";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
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
  PieChart,
  Pie,
  Cell,
  LabelList,
  Legend,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=675048698&single=true&output=csv";

const COLORS = {
  gold: "#C8A96B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  green: "#10B981",
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

  return parsed.data
    .slice(1)
    .map((r) => ({
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
    }))
    .filter((r) => r.jornada > 0);
}

function countBy(rows: Row[], key: keyof Row) {
  const grouped: Record<string, number> = {};

  rows.forEach((r) => {
    const k = String(r[key] || "Unknown");

    grouped[k] =
      (grouped[k] || 0) + 1;
  });

  return Object.entries(grouped).map(
    ([name, total]) => ({
      name,
      total,
    })
  );
}

export default function Page() {
  const [isMobile, setIsMobile] =
  useState(false);

const [isNarrow, setIsNarrow] =
  useState(false);

useEffect(() => {
  const check = () => {
    setIsMobile(
      window.innerWidth < 768
    );

    setIsNarrow(
      window.innerWidth < 1200
    );
  };

  check();

  window.addEventListener(
    "resize",
    check
  );

  return () =>
    window.removeEventListener(
      "resize",
      check
    );
}, []);
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
        r.tipoRemate &&
        ![
          "",
          "No Remate",
          "No aplica",
        ].includes(
          r.tipoRemate
        )
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
          { xg: number }
        > = {};

      filtered.forEach((r) => {
        const k =
          r.sacador || "Unknown";

        if (!grouped[k]) {
          grouped[k] = {
            xg: 0,
          };
        }

        grouped[k].xg += r.xg;
      });

      return Object.entries(
        grouped
      ).map(([name, v]) => ({
        name,
        xg: +v.xg.toFixed(2),
      }));
    }, [filtered]);

  const tipoRemateData =
    useMemo(() => {
      const grouped:
        Record<
          string,
          number
        > = {};

      filtered
        .filter(
          (r) =>
            r.tipoRemate &&
            ![
              "",
              "No Remate",
              "No aplica",
            ].includes(
              r.tipoRemate
            )
        )
        .forEach((r) => {
          grouped[
            r.tipoRemate
          ] =
            (grouped[
              r.tipoRemate
            ] || 0) + r.xg;
        });

      return Object.entries(
        grouped
      ).map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      );
    }, [filtered]);
  const xgByTipoAccion =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      const k =
        r.tipoAccion || "Sin dato";

      grouped[k] =
        (grouped[k] || 0) +
        r.xg;
    });

    return Object.entries(
      grouped
    )
      .map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      )
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filtered]);
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered
  .filter(
    (r) =>
      r.rematador &&
      ![
        "Nadie",
        "No aplica",
      ].includes(r.rematador)
  )
      .forEach((r) => {
        grouped[r.rematador] =
          (grouped[r.rematador] || 0) +
          r.xg;
      });

    return Object.entries(grouped)
      .map(([name, xg]) => ({
        name,
        xg: +xg.toFixed(2),
      }))
      .sort(
        (a, b) => b.xg - a.xg
      );
  }, [filtered]);

const zonaRemateData =
  countBy(
    filtered.filter(
      (r) => r.zonaRemate
    ),
    "zonaRemate"
  );

const segundoBalonData =
  countBy(
    filtered.filter(
      (r) => r.segundoBalon
    ),
    "segundoBalon"
  );

const tipoEnvioData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (!r.tipoEnvio) return;

      grouped[r.tipoEnvio] =
        (grouped[r.tipoEnvio] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      )
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filtered]); 
  const rutinaData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (!r.rutina) return;

      grouped[r.rutina] =
        (grouped[r.rutina] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(([name, total]) => ({
        name,
        total:
          +total.toFixed(2),
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filtered]);

const rivalesData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (!r.rival) return;

      grouped[r.rival] =
        (grouped[r.rival] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(([name, total]) => ({
        name,
        total:
          +total.toFixed(2),
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      )
      .slice(0, 8);
  }, [filtered]);

const xgZonaCaida =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (!r.zonaCaida) return;

      grouped[r.zonaCaida] =
        (grouped[r.zonaCaida] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(([name, total]) => ({
        name,
        total:
          +total.toFixed(2),
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filtered]);

const resultadoData = [
  {
    name: "Gol",
    total:
      filtered.filter((r) =>
        r.resultadoFinal
          .toLowerCase()
          .includes("gol")
      ).length,
  },
  {
    name: "No Gol",
    total:
      filtered.filter(
        (r) =>
          !r.resultadoFinal
            .toLowerCase()
            .includes("gol")
      ).length,
  },
];
  const timeline =
    Array.from(
      { length: 6 },
      (_, i) => {
        const start =
          i * 15;

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
   const pieLegendProps: Partial<LegendProps> = {
  layout: isNarrow
    ? "horizontal"
    : "vertical",

  verticalAlign: isNarrow
    ? "bottom"
    : "middle",

  align: isNarrow
    ? "center"
    : "right",

  wrapperStyle: {
    fontSize: 11,
    color: "#CBD5E1",
    paddingTop: isNarrow
      ? 20
      : 0,
  },
};
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <div className="hidden md:block">
  <Sidebar />
</div>

        <div className="flex-1">
          <Topbar />

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">

  {/* Header */}
  <div className="mb-8">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMC COLECTIVO
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        ABP Ofensivo
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div>
  </div>

  {/* Selector + KPIs */}
  <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    <select
      value={jornada}
      onChange={(e) =>
        setJornada(e.target.value)
      }
      className="w-full sm:w-auto rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3 text-sm sm:text-base"
    >
      <option value="ALL">
        Todas
      </option>

      {jornadas.map((m) => (
        <option
          key={m}
          value={m}
        >
          Jornada {m}
        </option>
      ))}
    </select>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-8 sm:mt-10">
      <Card
        title="ABP"
        value={metrics.total}
      />

      <Card
        title="xG"
        value={metrics.xg.toFixed(2)}
      />

      <Card
        title="Remates"
        value={metrics.shots}
      />

      <Card
        title="Goles"
        value={metrics.goals}
      />
    </div>

  </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-8 md:mt-10">

              <Panel title="Tipo de acción">
  <Chart>
    <BarChart
      data={tipoAccion}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.gold}
        radius={[8, 8, 0, 0]}
      >
        <LabelList
          dataKey="total"
          position="top"
          formatter={(v) =>
            typeof v === "number"
              ? v
              : ""
          }
          style={{
            fill: "#F8FAFC",
            fontWeight: 600,
            fontSize: 12,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Zona caída">
  <Chart>
    <PieChart>
      <Pie
        data={zonaCaida}
        dataKey="total"
        nameKey="name"
        innerRadius={65}
        outerRadius={125}
        paddingAngle={3}
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart>
</Panel>
<Panel title="Impacto sacador">
  <Chart>
    <BarChart
      data={sacadorData}
      layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        domain={[0, 1]}
        tick={{
          fill: "#94A3B8",
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
       width={
  isNarrow
    ? 160
    : 220
}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="xg"
        fill={COLORS.blue}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="xg"
          position="right"
          formatter={(v) =>
            typeof v === "number"
              ? v.toFixed(2)
              : ""
          }
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Impacto rematadores">
  <Chart>
    <BarChart
      data={rematadoresData}
      layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="xg"
        fill={COLORS.gold}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="xg"
          position="right"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="xG por tipo envío">
  <Chart>
    <BarChart
      data={tipoEnvioData}
      layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.purple}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="total"
          position="right"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Zona remate">
  <Chart>
    <PieChart>
      <Pie
        data={zonaRemateData}
        dataKey="total"
        nameKey="name"
        innerRadius={60}
        outerRadius={120}
      >
        {zonaRemateData.map(
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart>
</Panel>
<Panel title="Segundo balón">
  <Chart>
    <PieChart>
      <Pie
        data={segundoBalonData}
        dataKey="total"
        nameKey="name"
        innerRadius={60}
        outerRadius={120}
      >
        {segundoBalonData.map(
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart>
</Panel>

<Panel title="Tipo carrera">
  <Chart>
    <PieChart>
      <Pie
        data={tipoCarrera}
        dataKey="total"
        nameKey="name"
        innerRadius={60}
        outerRadius={120}
        paddingAngle={3}
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart>
</Panel>
<Panel title="Defensa rival">
  <Chart>
    <BarChart
      data={defensa}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        tick={{
          fill: "#94A3B8",
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.purple}
        radius={[8, 8, 0, 0]}
      >
        <LabelList
          dataKey="total"
          position="top"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Timeline">
  <Chart>
    <LineChart
      data={timeline}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="tramo"
        tick={{
          fill: "#94A3B8",
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <Tooltip />

      <Line
        dataKey="total"
        stroke={COLORS.green}
        strokeWidth={3}
        dot={{
          r: 5,
          fill: COLORS.green,
        }}
        activeDot={{
          r: 7,
        }}
      >
        <LabelList
          dataKey="total"
          position="top"
          style={{
            fill: "#fff",
            fontSize: 11,
          }}
        />
      </Line>
    </LineChart>
  </Chart>
</Panel>
<Panel title="xG por tipo de acción">
  <Chart>
    <BarChart
      data={xgByTipoAccion}
      layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.green}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="total"
          position="right"
          formatter={(v) =>
            typeof v === "number"
              ? v.toFixed(2)
              : ""
          }
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>

<Panel title="Top rivales por xG concedido">
  <Chart>
    <BarChart
      data={rivalesData}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
  dataKey="name"
  interval={0}
  height={70}
  axisLine={false}
  tickLine={false}
  tick={{
    fill: "#CBD5E1",
    fontSize: 11,
  }}
  angle={-25}
  textAnchor="end"
/>

      <YAxis
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.blue}
        radius={[8, 8, 0, 0]}
      >
        <LabelList
          dataKey="total"
          position="top"
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="xG por zona caida">
  <Chart>
    <BarChart
  data={xgZonaCaida}
  layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
>
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />
      <XAxis
  type="number"
  axisLine={false}
  tickLine={false}
  tick={{
    fill: "#94A3B8",
  }}
/>

      <YAxis
  type="category"
  dataKey="name"
  width={
    isNarrow
      ? 180
      : 260
  }
  interval={0}
  axisLine={false}
  tickLine={false}
  tick={(props) => {
  const {
    x,
    y,
    payload,
  } = props;

  const label =
  String(payload.value);

const words =
  label.length > 18
    ? label.split(" ")
    : [label];

  return (
    <text
      x={x}
      y={y}
      fill="#CBD5E1"
      fontSize="11"
      textAnchor="end"
    >
      {words.map(
        (word, index) => (
          <tspan
            key={index}
            x={x}
            dy={
              index === 0
                ? -(words.length - 1) * 6
                : 12
            }
          >
            {word}
          </tspan>
        )
      )}
    </text>
  );
}}
/>

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.green}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="total"
          position="right"
        />
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Conversión">
  <Chart>
    <PieChart>
      <Pie
        data={resultadoData}
        dataKey="total"
        nameKey="name"
        innerRadius={60}
        outerRadius={120}
      >
        <Cell fill="#10B981" />
        <Cell fill="#475569" />
      </Pie>

      <Tooltip />

      <Legend />
    </PieChart>
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
    <div
      className="
        h-[340px]
        sm:h-[360px]
        md:h-[320px]
        w-full
      "
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Card({
  title,
  value,
}: any) {
  return (
    <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
      <p className="text-sm text-zinc-400">
        {title}
      </p>

      <h3 className="mt-3 md:mt-4 text-2xl md:text-4xl font-semibold">
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
    <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-8 shadow-xl overflow-hidden">
      <h2 className="mb-5 md:mb-6 text-lg md:text-2xl font-semibold">
        {title}
      </h2>

      {children}
    </div>
  );
}