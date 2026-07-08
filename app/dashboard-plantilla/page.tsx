"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const ESTADOS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1978494160&single=true&output=csv";

const SCOUTING_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

const COLORS = [
  "#D4B06A",
  "#B8924F",
  "#8E6A37",
  "#6B532F",
  "#4B4238",
  "#2E2E2E",
];
const THEME = {
  gold: "#D4B06A",
  goldSoft: "#B8924F",
  goldDark: "#8E6A37",

  bg: "#171A1F",
  card: "#1D2127",
  border: "#2B3138",

  grid: "#2F343C",
  axis: "#8D949C",

  white: "#F8F9FA",
  text: "#C6CBD1",
};

type EstadoCSV = {
  ID_JUGADOR: string;
  FECHA: string;
  NOMBRE: string;
  APODO: string;
  POSICION: string;
  DORSAL: string;
  FOTO_URL: string;
  ACTIVO: string;
  LICENCIA: string;
  ESTADO: string;
};

type ScoutingCSV = {
  ID_JUGADOR: string;
  NOMBRE: string;
  APODO: string;
  POSICION: string;
  DORSAL: string;
  FECHA_NACIMIENTO: string;
  FOTO_URL: string;
  MENTALIDAD: string;
  HABITOS: string;
  INTERPRETACION: string;
  CAPACIDAD_FISICA: string;
  TECNICA: string;
  FORTALEZAS: string;
  ASPECTOS_MEJORA: string;
  HUDL_PERFIL_URL: string;
  ACTIVO: string;
  LICENCIA: string;
  ESTADO: string;
};

type Player = {
  id: string;

  fecha: string;

  nombre: string;

  apodo: string;

  posicion: string;

  dorsal: string;

  foto: string;

  licencia: string;

  estado: string;

  activo: boolean;

  mentalidad: number;

  habitos: number;

  interpretacion: number;

  fisica: number;

  tecnica: number;

  media: number;

  fortalezas: string;

  aspectosMejora: string;

  hudl: string;
};

export default function DashboardPlantilla() {

  const [estadoRows, setEstadoRows] =
    useState<EstadoCSV[]>([]);

  const [scoutingRows, setScoutingRows] =
    useState<ScoutingCSV[]>([]);

  const [selectedPlayer, setSelectedPlayer] =
    useState<Player | null>(null);

  const [filters, setFilters] = useState({

    jugador: "",

    posicion: "",

    estado: "",

    licencia: "",

    activo: "",

    fecha: "",

  });

  const emptyFilters = {

    jugador: "",

    posicion: "",

    estado: "",

    licencia: "",

    activo: "",

    fecha: "",

  };

  useEffect(() => {

    Papa.parse(ESTADOS_CSV, {

      download: true,

      header: true,

      skipEmptyLines: true,

      complete: (results) => {

        setEstadoRows(results.data as EstadoCSV[]);

      },

    });

    Papa.parse(SCOUTING_CSV, {

      download: true,

      header: true,

      skipEmptyLines: true,

      complete: (results) => {

        setScoutingRows(results.data as ScoutingCSV[]);

      },

    });

  }, []);
    const players = useMemo<Player[]>(() => {

    if (!estadoRows.length) return [];

    // Nos quedamos con el registro más reciente de cada jugador
    const latestMap = new Map<string, EstadoCSV>();

    estadoRows.forEach((row) => {

      const previous = latestMap.get(row.ID_JUGADOR);

      if (!previous) {

        latestMap.set(row.ID_JUGADOR, row);
        return;

      }

      const currentDate = new Date(row.FECHA).getTime();
      const previousDate = new Date(previous.FECHA).getTime();

      if (currentDate >= previousDate) {

        latestMap.set(row.ID_JUGADOR, row);

      }

    });

    const scoutingMap = new Map<string, ScoutingCSV>();

    scoutingRows.forEach((row) => {

      scoutingMap.set(row.ID_JUGADOR, row);

    });

    return [...latestMap.values()]

      .map((estado) => {

        const scout = scoutingMap.get(
          estado.ID_JUGADOR
        );

        const mentalidad = Number(
          scout?.MENTALIDAD ?? 0
        );

        const habitos = Number(
          scout?.HABITOS ?? 0
        );

        const interpretacion = Number(
          scout?.INTERPRETACION ?? 0
        );

        const fisica = Number(
          scout?.CAPACIDAD_FISICA ?? 0
        );

        const tecnica = Number(
          scout?.TECNICA ?? 0
        );

        const media =
          (
            mentalidad +
            habitos +
            interpretacion +
            fisica +
            tecnica
          ) / 5;

        return {

          id: estado.ID_JUGADOR,

          fecha: estado.FECHA,

          nombre:
            scout?.NOMBRE ??
            estado.NOMBRE,

          apodo:
            scout?.APODO ??
            estado.APODO,

          posicion:
            scout?.POSICION ??
            estado.POSICION,

          dorsal:
            scout?.DORSAL ??
            estado.DORSAL,

          foto:
            scout?.FOTO_URL ??
            estado.FOTO_URL,

          licencia:
            scout?.LICENCIA ??
            estado.LICENCIA,

          estado:
            estado.ESTADO,

          activo:
            String(
              estado.ACTIVO
            ).toUpperCase() === "TRUE",

          mentalidad,

          habitos,

          interpretacion,

          fisica,

          tecnica,

          media,

          fortalezas:
            scout?.FORTALEZAS ?? "",

          aspectosMejora:
            scout?.ASPECTOS_MEJORA ?? "",

          hudl:
            scout?.HUDL_PERFIL_URL ?? "",

        };

      })

      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      );

  }, [estadoRows, scoutingRows]);

 useEffect(() => {

  if (
    players.length &&
    !selectedPlayer &&
    !filters.jugador
  ) {
    setSelectedPlayer(players[0]);
  }

}, [players, selectedPlayer, filters.jugador]);

  const updateFilter = (
    key: keyof typeof filters,
    value: string
  ) => {

    setFilters((prev) => ({

      ...prev,

      [key]: value,

    }));

  };

  const filterOptions = useMemo(() => {

    return {

      posiciones: [

        ...new Set(

          players
            .map((p) => p.posicion)
            .filter(Boolean)

        ),

      ].sort(),

      estados: [

        ...new Set(

          players
            .map((p) => p.estado)
            .filter(Boolean)

        ),

      ].sort(),

      licencias: [

        ...new Set(

          players
            .map((p) => p.licencia)
            .filter(Boolean)

        ),

      ].sort(),

      fechas: [

        ...new Set(

          players
            .map((p) => p.fecha)
            .filter(Boolean)

        ),

      ].sort(),

    };

  }, [players]);
    const filteredPlayers = useMemo(() => {

    return players.filter((player) => {

      if (
        filters.jugador &&
        player.id !== filters.jugador
      )
        return false;

      if (
        filters.posicion &&
        player.posicion !== filters.posicion
      )
        return false;

      if (
        filters.estado &&
        player.estado !== filters.estado
      )
        return false;

      if (
        filters.licencia &&
        player.licencia !== filters.licencia
      )
        return false;

      if (
        filters.activo &&
        String(player.activo) !== filters.activo
      )
        return false;

      if (
        filters.fecha &&
        player.fecha !== filters.fecha
      )
        return false;

      return true;

    });

  }, [players, filters]);

  const totalPlayers = filteredPlayers.length;

  const activePlayers =
    filteredPlayers.filter(
      (p) => p.activo
    ).length;

  const optimalPlayers =
    filteredPlayers.filter(
      (p) => p.estado === "ÓPTIMO"
    ).length;

  const selectedPlayers =
    filteredPlayers.filter(
      (p) => p.estado === "SELECCIÓN"
    ).length;

  const injuredPlayers =
    filteredPlayers.filter(
      (p) => p.estado === "LESIONADO"
    ).length;

  const averageScore =
    totalPlayers
      ? (
          filteredPlayers.reduce(
            (acc, p) => acc + p.media,
            0
          ) / totalPlayers
        ).toFixed(1)
      : "0";
  
  const bestScore =
  filteredPlayers.length > 0
    ? Math.max(...filteredPlayers.map((p) => p.media)).toFixed(1)
    : "0";

const worstScore =
  filteredPlayers.length > 0
    ? Math.min(...filteredPlayers.map((p) => p.media)).toFixed(1)
    : "0";

const elitePlayers =
  filteredPlayers.filter((p) => p.media >= 8).length;

const optimalPercentage =
  totalPlayers > 0
    ? ((optimalPlayers / totalPlayers) * 100).toFixed(0)
    : "0";      
const overallStatus =
  Number(optimalPercentage) >= 80
    ? "MUY BUENO"
    : Number(optimalPercentage) >= 60
    ? "BUENO"
    : Number(optimalPercentage) >= 40
    ? "MEJORABLE"
    : "CRÍTICO";
  const estadoChart = useMemo(() => {

    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {

      map[player.estado] =
        (map[player.estado] ?? 0) + 1;

    });

    return Object.entries(map).map(([name, value]) => ({
  name,
  value,
}));

  }, [filteredPlayers]);

  const positionChart = useMemo(() => {

    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {

      map[player.posicion] =
        (map[player.posicion] ?? 0) + 1;

    });

    return Object.entries(map).map(
      ([name, value]) => ({
        name,
        value,
      })
    );

  }, [filteredPlayers]);

const radarData = useMemo(() => {

  if (!filteredPlayers.length) return [];

  const avg = (
    key:
      | "mentalidad"
      | "habitos"
      | "interpretacion"
      | "fisica"
      | "tecnica"
  ) =>
    filteredPlayers.reduce((acc, p) => acc + p[key], 0) /
    filteredPlayers.length;

  return [
    {
      subject: "Mentalidad",
      plantilla: avg("mentalidad"),
      jugador: selectedPlayer?.mentalidad ?? avg("mentalidad"),
    },
    {
      subject: "Hábitos",
      plantilla: avg("habitos"),
      jugador: selectedPlayer?.habitos ?? avg("habitos"),
    },
    {
      subject: "Interpretación",
      plantilla: avg("interpretacion"),
      jugador: selectedPlayer?.interpretacion ?? avg("interpretacion"),
    },
    {
      subject: "Física",
      plantilla: avg("fisica"),
      jugador: selectedPlayer?.fisica ?? avg("fisica"),
    },
    {
      subject: "Técnica",
      plantilla: avg("tecnica"),
      jugador: selectedPlayer?.tecnica ?? avg("tecnica"),
    },
  ];

}, [filteredPlayers, selectedPlayer]);

  const rankingChart = useMemo(() => {

  return [...filteredPlayers]

    .sort((a, b) => b.media - a.media)

    .slice(0, 10)

    .map((player, index) => ({

      puesto: index + 1,

      id: player.id,

      name: player.apodo || player.nombre,

      value: Number(player.media.toFixed(1)),

    }));

}, [filteredPlayers]);

  const scatterData = useMemo(() => {

    return filteredPlayers.map((player) => ({

  x: player.mentalidad,

  y: player.fisica,

  z: player.media,

  id: player.id,

  name: player.apodo || player.nombre,

  estado: player.estado,

  color:
    player.estado === "ÓPTIMO"
      ? "#52B788"
      : player.estado === "LESIONADO"
      ? "#D46A6A"
      : player.estado === "SELECCIÓN"
      ? "#7DA6D9º"
      : player.estado === "RECUPERACIÓN"
      ? "#facc15"
      : "#C8A96B",

}));

  }, [filteredPlayers]);
const licenciaChart = useMemo(() => {

  const map: Record<string, number> = {};

  filteredPlayers.forEach((player) => {

    map[player.licencia] =
      (map[player.licencia] ?? 0) + 1;

  });

  return Object.entries(map).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

}, [filteredPlayers]);
  const evolutionData = useMemo(() => {

    const map: Record<string, number> = {};

    estadoRows.forEach((row) => {

      if (
        filters.fecha &&
        row.FECHA !== filters.fecha
      )
        return;

      map[row.FECHA] =
        (map[row.FECHA] ?? 0) + 1;

    });

    return Object.entries(map).map(
      ([date, value]) => ({

        date,

        value,

      })
    );

  }, [estadoRows, filters.fecha]);

const handlePlayerSelect = (id: string) => {

  updateFilter("jugador", id);

  if (!id) {
    setSelectedPlayer(null);
    return;
  }

  const player =
    players.find((p) => p.id === id) ?? null;

  setSelectedPlayer(player);

};

const handleKpiClick = (title: string) => {

  switch (title) {

    case "Activos":
      updateFilter(
        "activo",
        filters.activo === "true" ? "" : "true"
      );
      break;

    case "Óptimos":
      updateFilter(
        "estado",
        filters.estado === "ÓPTIMO"
          ? ""
          : "ÓPTIMO"
      );
      break;

    case "Lesionados":
      updateFilter(
        "estado",
        filters.estado === "LESIONADO"
          ? ""
          : "LESIONADO"
      );
      break;

    case "Selección":
      updateFilter(
        "estado",
        filters.estado === "SELECCIÓN"
          ? ""
          : "SELECCIÓN"
      );
      break;

    default:
      break;

  }

};
  return (
  <div className="flex min-h-screen bg-neutral-950 text-white">
    <Sidebar />

    <main className="flex-1">
      <Topbar />

      <div className="p-6 space-y-6">

        {/* FILTROS */}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">

          <div className="flex flex-wrap gap-3">

            <select
              className="rounded-lg bg-neutral-800 px-3 py-2"
              value={filters.jugador}
              onChange={(e) => handlePlayerSelect(e.target.value)}
            >
              <option value="">Jugador</option>

              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg bg-neutral-800 px-3 py-2"
              value={filters.posicion}
              onChange={(e) =>
                updateFilter("posicion", e.target.value)
              }
            >
              <option value="">Posición</option>

              {filterOptions.posiciones.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <select
              className="rounded-lg bg-neutral-800 px-3 py-2"
              value={filters.estado}
              onChange={(e) =>
                updateFilter("estado", e.target.value)
              }
            >
              <option value="">Estado</option>

              {filterOptions.estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>

            <select
              className="rounded-lg bg-neutral-800 px-3 py-2"
              value={filters.licencia}
              onChange={(e) =>
                updateFilter("licencia", e.target.value)
              }
            >
              <option value="">Licencia</option>

              {filterOptions.licencias.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>

            <select
              className="rounded-lg bg-neutral-800 px-3 py-2"
              value={filters.activo}
              onChange={(e) =>
                updateFilter("activo", e.target.value)
              }
            >
              <option value="">Todos los jugadores</option>

              <option value="true">RMCF Castilla</option>

              <option value="false">Promocionados a entrenar</option>
            </select>

            <button
              onClick={() => setFilters(emptyFilters)}
              className="inline-flex
        items-center
        gap-3
        rounded-2xl
        border
        border-[#C8A96B]/20
        bg-[#C8A96B]
        px-6
        py-3
        text-base
        font-medium
        text-black
        shadow-[0_8px_25px_rgba(200,169,107,0.25)]
        transition-all
        hover:-translate-y-0.5
        hover:shadow-[0_12px_30px_rgba(200,169,107,0.35)]" 
            >
              Limpiar filtros
            </button>

          </div>

        </div>
<div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

    <div>
      <h2 className="text-2xl font-bold">
        REAL MADRID CASTILLA
      </h2>

      <p className="text-neutral-400 mt-1">
        Resumen general de la plantilla
      </p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

      <div>
        <div className="text-sm text-neutral-400">
          Jugadores
        </div>

        <div className="text-3xl font-bold">
          {totalPlayers}
        </div>
      </div>

      <div>
        <div className="text-sm text-neutral-400">
          Media
        </div>

        <div className="text-3xl font-bold">
          {averageScore}
        </div>
      </div>

      <div>
        <div className="text-sm text-neutral-400">
          Disponibles
        </div>

        <div className="text-3xl font-bold text-green-400">
          {optimalPercentage}%
        </div>
      </div>

      <div>
        <div className="text-sm text-neutral-400">
          Estado general
        </div>

        <div
          className={`text-xl font-bold ${
            overallStatus === "MUY BUENO"
              ? "text-green-400"
              : overallStatus === "BUENO"
              ? "text-blue-400"
              : overallStatus === "MEJORABLE"
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {overallStatus}
        </div>
      </div>

    </div>

  </div>

</div>
        {/* KPIs */}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">

          {[
  ["Jugadores", totalPlayers],
  ["Activos", activePlayers],
  ["Óptimos", optimalPlayers],
  ["Selección", selectedPlayers],
  ["Lesionados", injuredPlayers],
  ["Media", averageScore],
  ["Mejor", bestScore],
  ["Peor", worstScore],
  ["Élite", elitePlayers],
  ["% Óptimos", `${optimalPercentage}%`],
].map(([title, value]) => (

            <div
  key={String(title)}
  onClick={() => handleKpiClick(String(title))}
  className={`
    group
  rounded-xl
  border
  p-4
  cursor-pointer
  transition-all
  duration-300
  hover:-translate-y-1
  hover:bg-neutral-800/70
  hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]
  ${
    (title === "Óptimos" &&
      filters.estado === "ÓPTIMO") ||

    (title === "Lesionados" &&
      filters.estado === "LESIONADO") ||

    (title === "Selección" &&
      filters.estado === "SELECCIÓN") ||

    (title === "Activos" &&
      filters.activo === "true")

      ? "bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(212,176,106,0.10)]"

      : "bg-neutral-900 border-neutral-800 hover:border-amber-500"
  }
`}
>
              <div className="text-sm text-neutral-400">
                {title}
              </div>

              <div className="mt-2 text-3xl font-bold tracking-tight text-white transition-colors duration-300 group-hover:text-amber-300">

                {value}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
  Click para filtrar
</div>

            </div>

          ))}

        </div>

        {/* GRÁFICOS */}

        <div className="grid lg:grid-cols-2 gap-6">

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
              Estado plantilla
            </h3>

            <ResponsiveContainer width="100%" height={280}>

              <PieChart>

                <Pie
  data={estadoChart}
  dataKey="value"
  nameKey="name"
  outerRadius={90}
  label
  cursor="pointer"
  onClick={(data: any) => {
    updateFilter(
  "estado",
  filters.estado === data.name ? "" : data.name
);
  }}
>

                  {estadoChart.map((_, i) => (

                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />

                  ))}

                </Pie>

                <Tooltip contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}}/>

              </PieChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
              Jugadores por posición
            </h3>

            <ResponsiveContainer width="100%" height={280}>

              <BarChart data={positionChart}>

                <CartesianGrid
stroke={THEME.grid}
strokeDasharray="2 2"
/>

                <XAxis dataKey="name" tick={{ fill: THEME.axis }}

axisLine={{
stroke: THEME.grid
}}

tickLine={{
stroke: THEME.grid
}}/>

                <YAxis />

                <Tooltip contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}}/>

                <Bar
  dataKey="value"
  fill={THEME.gold}
  radius={[5, 5, 0, 0]}
  cursor="pointer"
  onClick={(data: any) => {
    updateFilter(
  "posicion",
  filters.posicion === data.name ? "" : data.name
);
  }}
/>

              </BarChart>

            </ResponsiveContainer>

          </div>


          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
              Top 10 valoración
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <BarChart
                data={rankingChart}
                layout="vertical"
              >

                <CartesianGrid
stroke={THEME.grid}
strokeDasharray="2 2"
/>

                <XAxis type="number" domain={[0, 10]} tick={{ fill: THEME.axis }}

axisLine={{
stroke: THEME.grid
}}

tickLine={{
stroke: THEME.grid
}} />

                <YAxis
  dataKey="name"
  type="category"
  width={130}
  tickFormatter={(value, index) => {

    const medal =
      index === 0
        ? "🥇 "
        : index === 1
        ? "🥈 "
        : index === 2
        ? "🥉 "
        : `${index + 1}. `;

    return medal + value;

  }}
/>

                <Tooltip
  formatter={(value) => [
    `${Number(value).toFixed(1)}/10`,
    "Valoración",
  ]}
contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}}/>

                <Bar
  dataKey="value"
  fill={THEME.gold}
  radius={[0, 6, 6, 0]}
  cursor="pointer"
  onClick={(data: any) => handlePlayerSelect(data.id)}
/>

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
              Mentalidad vs Física
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <ScatterChart>

                <CartesianGrid />

                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 10]}
                  name="Mentalidad"
                  tick={{ fill: THEME.axis }}

axisLine={{
stroke: THEME.grid
}}

tickLine={{
stroke: THEME.grid
}}
                />

                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 10]}
                  name="Física"
                  tick={{ fill: THEME.axis }}

axisLine={{
stroke: THEME.grid
}}

tickLine={{
stroke: THEME.grid
}}
                />

                <ZAxis
                  type="number"
                  dataKey="z"
                  range={[80, 320]}
                />

                <Tooltip
  cursor={{ strokeDasharray: "3 3" }}
  content={({ active, payload }) => {

    if (!active || !payload?.length) return null;

    const p = payload[0].payload;

    return (

      <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm">

        <div className="font-bold text-white">
          {p.name}
        </div>

        <div>Mentalidad: {p.x}</div>

        <div>Física: {p.y}</div>

        <div>Media: {p.z.toFixed(1)}</div>

        <div>Estado: {p.estado}</div>

      </div>

    );

  }}
contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}}/>

                <Scatter
  data={scatterData}
  cursor="pointer"
  onClick={(data: any) => handlePlayerSelect(data.id)}
>
  {scatterData.map((entry, index) => (
    <Cell
      key={index}
      fill={entry.color}
    />
  ))}
</Scatter>

              </ScatterChart>

            </ResponsiveContainer>
<div className="mt-4 flex flex-wrap gap-4 text-sm">

  <div className="flex items-center gap-2">
    <span className="h-3 w-3 rounded-full bg-green-500" />
    ÓPTIMO
  </div>

  <div className="flex items-center gap-2">
    <span className="h-3 w-3 rounded-full bg-red-500" />
    LESIONADO
  </div>

  <div className="flex items-center gap-2">
    <span className="h-3 w-3 rounded-full bg-blue-500" />
    SELECCIÓN
  </div>

  <div className="flex items-center gap-2">
    <span className="h-3 w-3 rounded-full bg-yellow-400" />
    RECUPERACIÓN
  </div>

</div>
          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
              Evolución registros
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={evolutionData}>

                <CartesianGrid
stroke={THEME.grid}
strokeDasharray="2 2"
/>

                <XAxis dataKey="date" tick={{ fill: THEME.axis }}

axisLine={{
stroke: THEME.grid
}}

tickLine={{
stroke: THEME.grid
}}/>

                <YAxis />

                <Tooltip contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}}/>

                <Legend wrapperStyle={{
color:"#C6CBD1"
}}/>

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={THEME.gold}
                  strokeWidth={3}
                  dot={{
  r:4,
  fill:THEME.gold
}}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>
          <div className="rounded-xl bg-neutral-900 p-4">

  <h3 className="mb-5 text-lg font-semibold tracking-wide text-neutral-100">
    Distribución por licencias
  </h3>

  <ResponsiveContainer width="100%" height={300}>

    <PieChart>

      <Pie
        data={licenciaChart}
        dataKey="value"
        nameKey="name"
        innerRadius={65}
        outerRadius={95}
        paddingAngle={3}
        label
        cursor="pointer"
        onClick={(data: any) =>
          updateFilter(
            "licencia",
            filters.licencia === data.name
              ? ""
              : data.name
          )
        }
      >

        {licenciaChart.map((_, index) => (

          <Cell
            key={index}
            fill={COLORS[index % COLORS.length]}
          />

        ))}

      </Pie>

      <Tooltip contentStyle={{
background:"#1D2127",
border:"1px solid #2B3138",
borderRadius:12,
color:"#FFF"
}}
labelStyle={{
color:"#D4B06A"
}} />

      <Legend wrapperStyle={{
color:"#C6CBD1"
}} />

    </PieChart>

  </ResponsiveContainer>

</div>

        </div>

      </div>

    </main>

  </div>

);
}