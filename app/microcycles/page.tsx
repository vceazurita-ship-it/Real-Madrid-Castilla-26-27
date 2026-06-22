"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import type { LegendProps } from "recharts";
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
  LabelList,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=0&single=true&output=csv";

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
const getEvalColor = (value: number) => {
  if (value >= 7.5) return "#10B981";
  if (value >= 6.5) return "#C8A96B";
  if (value >= 5.5) return "#F59E0B";
  return "#EF4444";
};

const renderMultilineTick = (
  props: any
) => {
  const {
    x,
    y,
    payload,
  } = props;

  const label = String(
    payload.value
  );

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
        (
          word: string,
          index: number
        ) => (
          <tspan
            key={index}
            x={x}
            dy={
              index === 0
                ? -(words.length - 1) *
                  6
                : 12
            }
          >
            {word}
          </tspan>
        )
      )}
    </text>
  );
};

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
  const [isMobile, setIsMobile] =
    useState(false);

  const [isNarrow, setIsNarrow] =
    useState(false);

  const [rows, setRows] =
    useState<Row[]>([]);

  const [micro, setMicro] =
    useState("ALL");
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
const avgLoadPerTask =
  metrics.tasks > 0
    ? metrics.load / metrics.tasks
    : 0;

const avgCogPerTask =
  metrics.tasks > 0
    ? metrics.cog / metrics.tasks
    : 0;
    const taskDiversity =
  new Set(
    filtered.map((r) => r.tipo)
  ).size;
  const competitionTasks =
  filtered.filter(
    (r) =>
      r.fase
        .toLowerCase()
        .includes("compet")
  ).length;

const competitionRatio =
  metrics.tasks > 0
    ? competitionTasks /
      metrics.tasks
    : 0;
    const maxAvgLoadPerTask =
  Math.max(
    ...micros.map((m) => {
      const set = rows.filter(
        (r) => r.micro === m
      );

      const load =
        set.reduce(
          (a, b) => a + b.carga,
          0
        ) / set.length;

      return load;
    }),
    1
  );

const maxAvgCogPerTask =
  Math.max(
    ...micros.map((m) => {
      const set = rows.filter(
        (r) => r.micro === m
      );

      const cog =
        set.reduce(
          (a, b) => a + b.cargaCog,
          0
        ) / set.length;

      return cog;
    }),
    1
  );

const maxTaskDiversity =
  Math.max(
    ...micros.map((m) => {
      const set = rows.filter(
        (r) => r.micro === m
      );

      return new Set(
        set.map((r) => r.tipo)
      ).size;
    }),
    1
  );
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

const loadCorrelationData = filtered
  .filter((r) => {
    const fase = (r.fase || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return (
      r.carga > 0 &&
      r.cargaCog > 0 &&
      r.evaluacion > 0 &&
      !fase.includes("competicion")
    );
  })
  .map((r) => ({
    carga: r.carga,
    cargaCog: r.cargaCog,
    eval: r.evaluacion,
    tipo: r.tipo,
  }));  
const scatterColoredData =
  loadCorrelationData.map((d) => ({
    ...d,
    fill: getEvalColor(d.eval),
  }));
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
    cog: set.reduce(
      (a, b) => a + b.cargaCog,
      0
    ),
  };
});

const maxTasks = Math.max(
  ...micros.map(
    (m) =>
      rows.filter(
        (r) => r.micro === m
      ).length
  )
);
const maxLoad = Math.max(
  ...micros.map((m) =>
    rows
      .filter((r) => r.micro === m)
      .reduce((a, b) => a + b.carga, 0)
  ),
  1
);

const maxCog = Math.max(
  ...micros.map((m) =>
    rows
      .filter((r) => r.micro === m)
      .reduce((a, b) => a + b.cargaCog, 0)
  ),
  1
);

const maxIntensity = Math.max(
  ...rows.map((r) => r.intensidad),
  1
);
const radarData = [
  {
    metric: "Evaluación",
    value: metrics.eval,
  },
  {
    metric: "Intensidad",
    value: avg(
      filtered.map(r => r.intensidad)
    ) * 2.5,
  },
  {
    metric: "Carga/Tarea",
    value: Math.min(
      avgLoadPerTask / 8,
      10
    ),
  },
  {
    metric: "Cog/Tarea",
    value: Math.min(
      avgCogPerTask / 8,
      10
    ),
  },
  {
    metric: "Diversidad",
    value: Math.min(
      (taskDiversity / 12) * 10,
      10
    ),
  },
];
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

    return Object.entries(grouped)
  .map(([tipo, vals]) => ({
    tipo,
    eval: avg(vals),
  }))
  .sort((a, b) => b.eval - a.eval);
  }, [filtered]);
const microOptions = useMemo(() => {
  return micros.map((m) => {
    const firstRow = rows.find(
      (r) => r.micro === m
    );

    return {
      micro: m,
      rival: firstRow?.rival || "",
    };
  });
}, [micros, rows]);
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

    return Object.entries(grouped)
  .map(([name, vals]) => ({
    name,
    eval: avg(vals),
  }))
  .sort((a, b) => b.eval - a.eval);
  }, [filtered]);
  const faseEvalData = useMemo(() => {
  const grouped: Record<
    string,
    number[]
  > = {};

  filtered.forEach((r) => {
 const key = r.fase || "No Phase";

const normalizedKey = key
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

if (
  normalizedKey.includes("competicion") ||
  normalizedKey === "competicion"
) {
  return;
}

  if (!grouped[key]) {
    grouped[key] = [];
  }

  if (r.evaluacion > 0) {
    grouped[key].push(r.evaluacion);
  }
});

  return Object.entries(grouped)
    .map(([name, vals]) => ({
      name,
      eval: avg(vals),
    }))
    .sort((a, b) => b.eval - a.eval);
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

  if (
    key.toLowerCase().includes(
      "competición"
    )
  ) {
    return;
  }

  if (!grouped[key]) {
    grouped[key] = [];
  }

  if (r.evaluacion > 0) {
    grouped[key].push(r.evaluacion);
  }
});

return Object.entries(grouped)
  .map(([name, vals]) => ({
    name,
    eval: avg(vals),
  }))
  .sort((a, b) => b.eval - a.eval);
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

return Object.entries(grouped)
  .map(([name, vals]) => ({
    name,
    eval: avg(vals),
  }))
  .sort((a, b) => b.eval - a.eval);
    }, [filtered]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar /> 

        <div className="flex-1">
          <Topbar />

<section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">

  {/* Header */}
  <div className="mb-8">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMCF CASTILLA METODOLOGÍA
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        Microciclos
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div></div>

  {/* Selector + KPIs */}
<div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

  <select
  value={micro}
  onChange={(e) => setMicro(e.target.value)}
  className="w-full sm:w-auto rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3 text-sm sm:text-base"
>
  <option value="ALL">
    Todos los microciclos
  </option>

  {microOptions.map((item) => (
    <option
      key={item.micro}
      value={item.micro}
    >
      Micro {item.micro}
      {item.rival
        ? ` · ${item.rival}`
        : ""}
    </option>
  ))}
</select>

  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-8 sm:mt-10">
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6 mt-8 sm:mt-10">
<Panel title="Perfil del Microciclo">
  <Chart>
<RadarChart
  cx="50%"
  cy="45%"
  outerRadius={isMobile ? "58%" : "80%"}
  data={radarData}
>
  <PolarGrid stroke="rgba(255,255,255,.12)" />

  <PolarAngleAxis
    dataKey="metric"
    tick={{
      fill: "#E2E8F0",
      fontSize: isMobile ? 10 : 13,
      fontWeight: 500,
    }}
  />

  <PolarRadiusAxis
    domain={[0, 10]}
    tick={false}
    axisLine={false}
  />

  <Radar
    dataKey="value"
    stroke={COLORS.gold}
    strokeWidth={3}
    fill={COLORS.gold}
    fillOpacity={0.35}
  />
</RadarChart>
  </Chart>
</Panel>
<Panel title="Carga Física vs Carga Cognitiva">
  <Chart>
    <ScatterChart
      margin={{
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      }}
    >
      <CartesianGrid stroke="#1E232A" />

      <XAxis
        type="number"
        dataKey="carga"
        name="Carga Física"
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
      />

      <YAxis
        type="number"
        dataKey="cargaCog"
        name="Carga Cognitiva"
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
      />
      <ZAxis
  dataKey="eval"
  range={[80, 400]}
/>

      <Tooltip
  content={({ active, payload }) => {
    if (!active || !payload?.length)
      return null;

    const d = payload[0].payload;

    return (
      <div className="rounded-xl border border-white/10 bg-[#1A212B] p-3 shadow-xl">
        <p className="font-semibold text-white">
          Evaluación: {d.eval}
        </p>

        <p className="text-slate-300">
          Carga Física: {d.carga}
        </p>

        <p className="text-slate-300">
          Carga Cognitiva: {d.cargaCog}
        </p>

        <p className="text-slate-300">
          Tipo: {d.tipo}
        </p>
      </div>
    );
  }}
/>

      <Scatter data={scatterColoredData}>
        {scatterColoredData.map(
          (entry, index) => (
            <Cell
              key={index}
              fill={entry.fill}
            />
          )
        )}
      </Scatter>
    </ScatterChart>
  </Chart>
</Panel>


              <Panel title="Carga e Intensidad en Microciclo">
  <Chart>
    <ComposedChart
  data={mdData}
  margin={{
    top: 10,
    right: 10,
    left: 10,
    bottom: 40,
  }}
>
      <CartesianGrid stroke="#1E232A" />

      <XAxis dataKey="md" />

      {/* eje cargas */}
      <YAxis yAxisId="left" />

      {/* eje intensidad */}
      <YAxis
        yAxisId="right"
        orientation="right"
        domain={[0, 10]}
      />

      <Tooltip />
      <Legend
  layout="horizontal"
  verticalAlign="bottom"
  align="center"
  wrapperStyle={{
    fontSize: 11,
    color: "#CBD5E1",
    paddingTop: 20,
  }}
/>
      <Bar
        yAxisId="left"
        dataKey="carga"
        fill={COLORS.gold}
        radius={[8, 8, 0, 0]}
      />

      <Bar
        yAxisId="left"
        dataKey="cargaCog"
        fill={COLORS.blue}
        radius={[8, 8, 0, 0]}
      />

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="intensidad"
        stroke={COLORS.purple}
        strokeWidth={3}
        dot={{
          r: 4,
          fill: COLORS.purple,
        }}
        activeDot={{ r: 6 }}
      />
    </ComposedChart>
  </Chart>
</Panel>

              <Panel title="Carga Cognitiva en Microciclo">
                <Chart>
                  <AreaChart
  data={mdData}
  margin={{
    top: 10,
    right: 10,
    left: 10,
    bottom: 40,
  }}
>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis
  dataKey="md"
  height={70}
  tick={{
    fill: "#94A3B8",
    fontSize: 11,
  }}
  axisLine={false}
  tickLine={false}
/>
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
              <Panel title="Intensidad en Microciclo">
                <Chart>
                  <BarChart data={mdData}>
                    <CartesianGrid stroke="#1E232A" />
                    <XAxis
  dataKey="md"
  height={70}
  tick={{
    fill: "#94A3B8",
    fontSize: 11,
  }}
  axisLine={false}
  tickLine={false}
/>
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

              <Panel title="Tendencia de Evaluación por Microciclo">
  <Chart>
    <AreaChart data={trendData}>
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
  dataKey="micro"
  interval={0}
  minTickGap={0}
  angle={-45}
  textAnchor="end"
  height={70}
/>

<YAxis
  domain={[0, 10]}
/>

      <Tooltip
  contentStyle={{
    background: "#11161C",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius: "16px",
    color: "#fff",
  }}
/>

      <Area
        dataKey="value"
        fill={COLORS.gold}
        fillOpacity={0.2}
      />

      <Line
        dataKey="value"
        stroke={COLORS.gold}
        strokeWidth={3}
        dot={{
          r: 4,
          fill: COLORS.gold,
        }}
      />
    </AreaChart>
  </Chart>
</Panel>

              

              <Panel title="Comparativa de Evaluación y Carga Cognitiva">
  <Chart>
    <ComposedChart data={compareData}>
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="micro"
        tick={{
          fill: "#94A3B8",
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        yAxisId="left"
        tick={{
          fill: "#94A3B8",
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        yAxisId="right"
        orientation="right"
        domain={[0, 10]}
        tick={{
          fill: COLORS.gold,
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip
        contentStyle={{
          background: "#11161C",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "16px",
          color: "#fff",
        }}
      />

      <Legend
        verticalAlign="top"
        align="right"
        iconType="circle"
        wrapperStyle={{
          paddingBottom: 20,
          fontSize: 13,
        }}
      />

      <Bar
        yAxisId="left"
        dataKey="cog"
        name="Carga Cognitiva"
        fill={COLORS.purple}
        radius={[10, 10, 0, 0]}
        barSize={34}
      />

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="eval"
        name="Evaluación"
        stroke={COLORS.gold}
        strokeWidth={3}
        dot={{
          r: 4,
          strokeWidth: 2,
          stroke: COLORS.gold,
          fill: "#0B0F14",
        }}
        activeDot={{
          r: 6,
          fill: COLORS.gold,
        }}
      />
    </ComposedChart>
  </Chart>
</Panel>

             <Panel title="Comparativa de Evaluación y Carga Física">
  <Chart>
    <ComposedChart data={compareData}>
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="micro"
        tick={{
          fill: "#94A3B8",
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      {/* carga */}
      <YAxis
        yAxisId="left"
        tick={{
          fill: "#94A3B8",
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      {/* evaluación */}
      <YAxis
        yAxisId="right"
        orientation="right"
        domain={[0, 10]}
        tick={{
          fill: COLORS.gold,
          fontSize: 12,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip
        contentStyle={{
          background: "#11161C",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "16px",
          color: "#fff",
        }}
      />

      <Legend
        verticalAlign="top"
        align="right"
        iconType="circle"
        wrapperStyle={{
          paddingBottom: 20,
          fontSize: 13,
        }}
      />

      <Bar
        yAxisId="left"
        dataKey="load"
        name="Carga Física"
        fill={COLORS.blue}
        radius={[10, 10, 0, 0]}
        barSize={34}
      />

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="eval"
        name="Evaluación"
        stroke={COLORS.gold}
        strokeWidth={3}
        dot={{
          r: 4,
          strokeWidth: 2,
          stroke: COLORS.gold,
          fill: "#0B0F14",
        }}
        activeDot={{
          r: 6,
          fill: COLORS.gold,
        }}
      />
    </ComposedChart>
  </Chart>
</Panel>

              <Panel title="Evaluación por Tipo de Tarea">
  <Chart>
    <BarChart
      data={taskEvalData}
      layout="vertical"
margin={{
  top: 10,
  right: 24,
  left: 20,
  bottom: 10,
}}
      barCategoryGap={24}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
  type="number"
  domain={[0, 10]}
  tick={{
    fill: "#94A3B8",
    fontSize: 11,
  }}
  axisLine={false}
  tickLine={false}
/>
    <YAxis
  type="category"
  dataKey="tipo"
  width={
  isMobile
    ? 120
    : isNarrow
    ? 160
    : 220
}
  interval={0}
  axisLine={false}
  tickLine={false}
  tick={renderMultilineTick}
/>

      <Tooltip
        cursor={{
          fill:
            "rgba(255,255,255,0.03)",
        }}
        contentStyle={{
          background: "#11161C",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "16px",
          color: "#fff",
        }}
      />

      <Bar
  dataKey="eval"
  name="Evaluación"
  fill={COLORS.gold}
  radius={[0, 12, 12, 0]}
  barSize={
    isMobile
      ? 16
      : 20
  }
>
{taskEvalData.map(
  (entry, index) => (
    <Cell
      key={index}
      fill={getEvalColor(entry.eval)}
    />
  )
)}


  <LabelList
    dataKey="eval"
    position="right"
    formatter={(value) =>
      typeof value === "number"
        ? value.toFixed(1)
        : value ?? ""
    }
    style={{
      fill: "#fff",
      fontSize: 12,
      fontWeight: 600,
    }}
  />
</Bar>
    </BarChart>
  </Chart>
</Panel>


              <Panel title="Evaluación por Contenido Principal">
  <Chart>
    <BarChart
      data={contenidoPrincipalData}
      layout="vertical"
     margin={{
  top: 10,
  right: 24,
  left: 20,
  bottom: 10,
}}
      barCategoryGap={24}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

   <XAxis
  type="number"
  domain={[0, 10]}
  tick={{
    fill: "#94A3B8",
    fontSize: 11,
  }}
  axisLine={false}
  tickLine={false}
/>

<YAxis
  type="category"
  dataKey="name"
 width={
  isMobile
    ? 120
    : isNarrow
    ? 160
    : 220
}
  interval={0}
  axisLine={false}
  tickLine={false}
  tick={renderMultilineTick}
/>

      <Tooltip
        cursor={{
          fill:
            "rgba(255,255,255,0.03)",
        }}
        contentStyle={{
          background: "#11161C",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "16px",
          color: "#fff",
        }}
      />

      <Bar
  dataKey="eval"
  name="Evaluación"
  radius={[0, 12, 12, 0]}
  barSize={
    isMobile
      ? 16
      : 20
  }
>
  {contenidoPrincipalData.map(
    (entry, index) => (
      <Cell
        key={index}
        fill={getEvalColor(entry.eval)}
      />
    )
  )}
        <LabelList
  dataKey="eval"
  position="right"
  formatter={(value) =>
    typeof value === "number"
      ? value.toFixed(1)
      : value ?? ""
  }
  style={{
    fill: "#fff",
    fontSize: 12,
    fontWeight: 600,
  }}
/>
      </Bar>
    </BarChart>
  </Chart>
</Panel>
<Panel title="Evaluación por Fase">
  <Chart>
    <BarChart
      data={faseEvalData}
      layout="vertical"
      margin={{
        top: 10,
        right: 24,
        left: 20,
        bottom: 10,
      }}
      barCategoryGap={24}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        type="number"
        domain={[0, 10]}
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
  type="category"
  dataKey="name"
  width={
    isMobile
      ? 120
      : isNarrow
      ? 160 
      : 220
  }
  interval={0}
  axisLine={false}
  tickLine={false}
  tick={{
    fill: "#CBD5E1",
    fontSize: 11,
  }}
/>

      <Tooltip
        cursor={{
          fill:
            "rgba(255,255,255,0.03)",
        }}
        contentStyle={{
          background: "#11161C",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "16px",
          color: "#fff",
        }}
      />

      <Bar
  dataKey="eval"
  name="Evaluación"
  radius={[0, 8, 8, 0]}
  barSize={
    isMobile
      ? 16
      : 20
  }
>
  {faseEvalData.map(
    (entry, index) => (
      <Cell
        key={index}
        fill={getEvalColor(entry.eval)}
      />
    )
  )}
        <LabelList
          dataKey="eval"
          position="right"
          formatter={(value) =>
            typeof value === "number"
              ? value.toFixed(1)
              : value ?? ""
          }
          style={{
            fill: "#fff",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
      </Bar>
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
    <div
     className="
        h-[420px]
        sm:h-[420px]
        md:h-[360px]
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <p className="text-xs sm:text-sm text-zinc-400">
        {title}
      </p>

      <h3 className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-semibold">
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-8 shadow-xl overflow-hidden">
      <h2 className="mb-4 sm:mb-6 text-lg sm:text-2xl font-semibold leading-tight">
        {title}
      </h2>

      {children}
    </div>
  );
}