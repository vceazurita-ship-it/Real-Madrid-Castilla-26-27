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
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=1071911136&single=true&output=csv";

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
  tiempo: string;
  perfil: string;

  tipoAccion: string;
  perfilGolpeo: string;
  tipoEnvio: string;
  zonaCaida: string;
  calidadEnvio: string;

  nAtacantes: number;
  tipoCarrera: string;

  oc1P: string;
  ocCentral: string;
  oc2P: string;
  ocFrontal: string;

  remate: string;
  tipoRemate: string;
  zonaRemate: string;

  xg: number;

  segundoBalon: string;
  resultadoFinal: string;
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
      tiempo: (r[2] || "").trim(),
      perfil: r[3] || "",

      tipoAccion: r[4] || "",
      perfilGolpeo: r[5] || "",
      tipoEnvio: r[6] || "",
      zonaCaida: r[7] || "",
      calidadEnvio: r[8] || "",

      nAtacantes: num(r[9]),

      tipoCarrera: r[10] || "",

      oc1P: r[11] || "",
      ocCentral: r[12] || "",
      oc2P: r[13] || "",
      ocFrontal: r[14] || "",

      remate: r[15] || "",
      tipoRemate: r[16] || "",
      zonaRemate: r[17] || "",

      xg: num(r[18]),

      segundoBalon: r[19] || "",
      resultadoFinal: r[20] || "",
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
  const [rival, setRival] =
  useState("ALL");

const [perfil, setPerfil] =
  useState("ALL");

const [tiempo, setTiempo] =
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
  const rivales = useMemo(
  () =>
    [...new Set(rows.map(r => r.rival))]
      .filter(Boolean)
      .sort(),
  [rows]
);

const perfiles = useMemo(
  () =>
    [...new Set(rows.map(r => r.perfil))]
      .filter(Boolean)
      .sort(),
  [rows]
);
const filtered = rows.filter(
  (r) => {
    const matchJornada =
      jornada === "ALL" ||
      String(r.jornada) === jornada;

    const matchRival =
      rival === "ALL" ||
      r.rival === rival;

    const matchPerfil =
      perfil === "ALL" ||
      r.perfil === perfil;

const matchTiempo =
  tiempo === "ALL" ||
  r.tiempo === tiempo;

    return (
      matchJornada &&
      matchRival &&
      matchPerfil &&
      matchTiempo
    );
  }
);

  const metrics = {
    total: filtered.length,

    xg: filtered.reduce(
      (a, b) => a + b.xg,
      0
    ),

    shots: filtered.filter((r) => {
  const remate =
    r.remate
      ?.trim()
      .toLowerCase();

  return (
    remate === "sí" ||
    remate === "si"
  );
}).length,


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
const sacadorData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (!r.perfilGolpeo) return;

      grouped[r.perfilGolpeo] =
        (grouped[r.perfilGolpeo] || 0) +
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
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (
        !r.tipoRemate ||
        r.tipoRemate === "No Remate"
      )
        return;

      grouped[r.tipoRemate] =
        (grouped[r.tipoRemate] || 0) +
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
  const timeline = [
  {
    tramo: "1T",
    total: filtered.filter(
      (r) => r.tiempo === "1T"
    ).length,
  },
  {
    tramo: "2T",
    total: filtered.filter(
      (r) => r.tiempo === "2T"
    ).length,
  },
];
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

  <Sidebar />


        <div className="flex-1">
          <Topbar />

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-3 sm:pt-5">

  {/* Header */}
  <div className="mb-8">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMC COLECTIVO
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        ABP Defensivo
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div>
  </div>

  {/* Selector + KPIs */}
  <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">

  <select
    value={jornada}
    onChange={(e) =>
      setJornada(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todas las jornadas
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

  <select
    value={rival}
    onChange={(e) =>
      setRival(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todos los rivales
    </option>

    {rivales.map((r) => (
      <option
        key={r}
        value={r}
      >
        {r}
      </option>
    ))}
  </select>

  <select
    value={perfil}
    onChange={(e) =>
      setPerfil(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todos los perfiles
    </option>

    {perfiles.map((p) => (
      <option
        key={p}
        value={p}
      >
        {p}
      </option>
    ))}
  </select>

  <select
    value={tiempo}
    onChange={(e) =>
      setTiempo(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
  Todo el partido
</option>

<option value="1T">
  Primer tiempo
</option>

<option value="2T">
  Segundo tiempo
</option>
  </select>

</div>
<div className="mt-5">
  <p className="text-sm text-zinc-400 mb-3">
    Equipos visualizados (
    {[...new Set(filtered.map((r) => r.rival))]
      .length}
    )
  </p>

  <div className="flex flex-wrap gap-2">
    {[...new Set(filtered.map((r) => r.rival))]
      .sort()
      .map((equipo) => (
        <span
          key={equipo}
          className="
            px-3
            py-1.5
            rounded-full
            border
            border-white/10
            bg-[#C8A96B]/10
            text-[#C8A96B]
            text-xs
          "
        >
          {equipo}
        </span>
      ))}
  </div>
</div>
    <div
  className="
    mt-5 sm:mt-6
    grid
    gap-3
    grid-cols-2
    sm:grid-cols-3
    lg:grid-cols-4
    xl:grid-cols-7
  "
>
  <Card
    title="ABP"
    value={metrics.total.toLocaleString()}
  />
  <Card
  title="% Remate"
  value={
    metrics.total
      ? `${(
          (metrics.shots /
            metrics.total) *
          100
        ).toFixed(1)}%`
      : "0%"
  }
/>

<Card
  title="xG / Remate"
  value={
    metrics.shots
      ? (
          metrics.xg /
          metrics.shots
        ).toFixed(2)
      : "0"
  }
/>

  <Card
    title="xG"
    value={metrics.xg.toFixed(2)}
  />

  <Card
    title="Remates"
    value={metrics.shots.toLocaleString()}
  />

  <Card
    title="Goles"
    value={metrics.goals.toLocaleString()}
  />
  <div
className="
  h-[96px]
  sm:h-[112px]
  rounded-[20px]
  sm:rounded-[24px]
  border
  border-white/10
  bg-white/[0.03]
  p-3
  sm:p-5
  flex
  flex-col
  justify-between
"
>
  <p className="text-sm text-zinc-400">
Mayor xG concedido  </p>

  <h3 className="mt-4 text-lg md:text-xl font-semibold text-[#C8A96B]">
    {sacadorData[0]?.name || "-"}
  </h3>
</div>
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
        domain={[0, (dataMax: number) => dataMax * 1.1]}
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
        
                domain={[0, (dataMax: number) => dataMax * 1.1]}

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
    ? 180
    : 240
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
        domain={[0, (dataMax: number) => dataMax * 1.1]}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 180
    : 240
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
        domain={[0, (dataMax: number) => dataMax * 1.1]}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 180
    : 240
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
<Panel title="Distribución por periodo">
  <Chart>
    <BarChart data={timeline}>
  <CartesianGrid
    stroke="#1E232A"
    vertical={false}
  />

  <XAxis
    dataKey="tramo"
    domain={[0, (dataMax: number) => dataMax * 1.1]}
    axisLine={false}
    tickLine={false}
  />

  <YAxis
    axisLine={false}
    tickLine={false}
  />

  <Tooltip />

  <Bar
    dataKey="total"
    fill={COLORS.green}
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
        domain={[0, (dataMax: number) => dataMax * 1.1]}
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
    : 240
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
  domain={[0, (dataMax: number) => dataMax * 1.1]}
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
  domain={[0, (dataMax: number) => dataMax * 1.1]}
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
      : 240
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
    <div
      className="
        h-[96px]
        sm:h-[112px]
        rounded-[20px]
        sm:rounded-[24px]
        border
        border-white/10
        bg-white/[0.03]
        p-3
        sm:p-5
        flex
        flex-col
        justify-between
      "
    >
      <p className="text-xs sm:text-sm text-zinc-400">
  {title}
</p>

<h3
  className="
    mt-2
    text-lg
    sm:text-2xl
    lg:text-[34px]
    font-semibold
    leading-none
    truncate
  "
>
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