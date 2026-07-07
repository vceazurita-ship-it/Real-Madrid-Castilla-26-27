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
  "#C8A96B",
  "#D6B67A",
  "#A58A54",
  "#8E7546",
  "#6B5734",
  "#4D4D4D",
];

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

  const estadoChart = useMemo(() => {

    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {

      map[player.estado] =
        (map[player.estado] ?? 0) + 1;

    });

    return Object.entries(map)

  .sort(
    ([a], [b]) =>
      new Date(a).getTime() -
      new Date(b).getTime()
  )

  .map(([date, value]) => ({
    date,
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

    if (!filteredPlayers.length)
      return [];

    const avg = (
      key:
        | "mentalidad"
        | "habitos"
        | "interpretacion"
        | "fisica"
        | "tecnica"
    ) =>

      filteredPlayers.reduce(
        (acc, p) => acc + p[key],
        0
      ) / filteredPlayers.length;

    return [

      {
        subject: "Mentalidad",
        value: avg("mentalidad"),
      },

      {
        subject: "Hábitos",
        value: avg("habitos"),
      },

      {
        subject: "Interpretación",
        value: avg("interpretacion"),
      },

      {
        subject: "Física",
        value: avg("fisica"),
      },

      {
        subject: "Técnica",
        value: avg("tecnica"),
      },

    ];

  }, [filteredPlayers]);

  const rankingChart = useMemo(() => {

    return [...filteredPlayers]

      .sort(
        (a, b) => b.media - a.media
      )

      .slice(0, 10)

      .map((player) => ({

        id: player.id,

        name:
          player.apodo ||
          player.nombre,

        value: Number(
          player.media.toFixed(1)
        ),

      }));

  }, [filteredPlayers]);

  const scatterData = useMemo(() => {

    return filteredPlayers.map(
      (player) => ({

        x: player.mentalidad,

        y: player.fisica,

        z: player.media,

        id: player.id,

        name:
          player.apodo ||
          player.nombre,

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
              <option value="">Activo</option>

              <option value="true">Sí</option>

              <option value="false">No</option>
            </select>

            <button
              onClick={() => setFilters(emptyFilters)}
              className="rounded-lg bg-amber-600 px-4 py-2"
            >
              Limpiar filtros
            </button>

          </div>

        </div>

        {/* KPIs */}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">

          {[
            ["Jugadores", totalPlayers],
            ["Activos", activePlayers],
            ["Óptimos", optimalPlayers],
            ["Selección", selectedPlayers],
            ["Lesionados", injuredPlayers],
            ["Media", averageScore],
          ].map(([title, value]) => (

            <div
              key={String(title)}
              className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 hover:border-amber-500 transition"
            >

              <div className="text-sm text-neutral-400">
                {title}
              </div>

              <div className="text-3xl font-bold mt-2">
                {value}
              </div>

            </div>

          ))}

        </div>

        {/* GRÁFICOS */}

        <div className="grid lg:grid-cols-2 gap-6">

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
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
                >

                  {estadoChart.map((_, i) => (

                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />

                  ))}

                </Pie>

                <Tooltip />

              </PieChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
              Jugadores por posición
            </h3>

            <ResponsiveContainer width="100%" height={280}>

              <BarChart data={positionChart}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="name" />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill="#C8A96B"
                  radius={[5, 5, 0, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>
                    <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
              Perfil medio de la plantilla
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <RadarChart data={radarData}>

                <PolarGrid />

                <PolarAngleAxis dataKey="subject" />

                <PolarRadiusAxis domain={[0, 10]} />

                <Radar
                  dataKey="value"
                  stroke="#C8A96B"
                  fill="#C8A96B"
                  fillOpacity={0.5}
                />

                <Tooltip />

              </RadarChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
              Top 10 valoración
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <BarChart
                data={rankingChart}
                layout="vertical"
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis type="number" domain={[0, 10]} />

                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill="#C8A96B"
                  radius={[0, 6, 6, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
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
                />

                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 10]}
                  name="Física"
                />

                <ZAxis
                  type="number"
                  dataKey="z"
                  range={[80, 320]}
                />

                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value) => value}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.name ?? ""
                  }
                />

                <Scatter
                  data={scatterData}
                  fill="#C8A96B"
                />

              </ScatterChart>

            </ResponsiveContainer>

          </div>

          <div className="rounded-xl bg-neutral-900 p-4">

            <h3 className="mb-4 font-semibold">
              Evolución registros
            </h3>

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={evolutionData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="date" />

                <YAxis />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#C8A96B"
                  strokeWidth={3}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* FICHA DEL JUGADOR */}

        {selectedPlayer && (

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

            <div className="flex flex-col lg:flex-row gap-6">

              <img
                src={selectedPlayer.foto}
                alt={selectedPlayer.nombre}
                className="w-40 h-40 rounded-xl object-cover border border-neutral-700"
              />

              <div className="flex-1">

                <h2 className="text-3xl font-bold">
  {selectedPlayer.nombre}
</h2>

<p className="text-neutral-400 mt-1">
  {selectedPlayer.posicion} · #{selectedPlayer.dorsal}
</p>

<div className="mt-3">

  <span
    className={`px-3 py-1 rounded-full text-sm font-semibold ${
      selectedPlayer.estado === "ÓPTIMO"
        ? "bg-green-500/20 text-green-300"
        : selectedPlayer.estado === "LESIONADO"
        ? "bg-red-500/20 text-red-300"
        : selectedPlayer.estado === "SELECCIÓN"
        ? "bg-blue-500/20 text-blue-300"
        : "bg-yellow-500/20 text-yellow-300"
    }`}
  >
    {selectedPlayer.estado}
  </span>

</div>
<p className="text-neutral-400 mt-3">
  Licencia: <span className="text-white">{selectedPlayer.licencia}</span>
</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                                  {[
                    ["Mentalidad", selectedPlayer.mentalidad],
                    ["Hábitos", selectedPlayer.habitos],
                    ["Interpretación", selectedPlayer.interpretacion],
                    ["Capacidad Física", selectedPlayer.fisica],
                    ["Técnica", selectedPlayer.tecnica],
                    ["Media", selectedPlayer.media.toFixed(1)],
                  ].map(([label, value]) => (

                    <div
                      key={String(label)}
                      className="rounded-xl bg-neutral-800 border border-neutral-700 p-4 hover:border-amber-500 transition"
                    >

                      <div className="text-xs uppercase tracking-wide text-neutral-400">
                        {label}
                      </div>

                      <div className="mt-2 text-2xl font-bold text-amber-300">
                        {value}
                      </div>

                    </div>

                  ))}

                </div>

<div className="mt-6">

  <div className="flex justify-between text-sm text-neutral-400 mb-2">

    <span>Valoración global</span>

    <span>{selectedPlayer.media.toFixed(1)} / 10</span>

  </div>

  <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">

    <div
      className="h-full bg-amber-500 rounded-full transition-all duration-500"
      style={{
        width: `${selectedPlayer.media * 10}%`,
      }}
    />

  </div>

</div>

<div className="grid lg:grid-cols-2 gap-6 mt-8">

                  <div>

                    <h3 className="font-semibold text-amber-300 mb-2">
                      Fortalezas
                    </h3>

                    <div className="rounded-lg bg-neutral-800 p-4 whitespace-pre-wrap leading-relaxed">
                      {selectedPlayer.fortalezas || "Sin información"}
                    </div>

                  </div>

                  <div>

                    <h3 className="font-semibold text-amber-300 mb-2">
                      Aspectos de mejora
                    </h3>

                    <div className="rounded-lg bg-neutral-800 p-4 whitespace-pre-wrap leading-relaxed">
                      {selectedPlayer.aspectosMejora || "Sin información"}
                    </div>

                  </div>

                </div>

                {selectedPlayer.hudl && (

                  <div className="mt-8">

                    <a
                      href={selectedPlayer.hudl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-amber-600 hover:bg-amber-500 px-5 py-3 font-semibold shadow-lg transition-all duration-300 hover:scale-105"
                    >
                      Ver perfil HUDL
                    </a>

                  </div>

                )}

              </div>

            </div>

          </div>

        )}

      </div>

    </main>

  </div>

);
}