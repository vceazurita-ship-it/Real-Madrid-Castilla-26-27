"use client";
import { traeCsv } from "@/lib/hojaCsv";

import { useEffect, useMemo, useState } from "react";
import { chipInk } from "@/lib/theme";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { getPlayerImage } from "@/lib/playerImages";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";

import {
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

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

const THEME = {
  gold: "#C8A96B",
  goldSoft: "#B8924F",
  goldDark: "#8E6A37",

  bg: "#0B0F14",
  card: "#11161D",
  border: "#2B3138",

  grid: "#232A33",
  axis: "#8D949C",

  white: "#F8F9FA",
  text: "#C6CBD1",
};

/* Paleta de apoyo para series sin significado semántico (posiciones, licencias). */
const COLORS = [
  "#C8A96B",
  "#B8924F",
  "#8E6A37",
  "#6B532F",
  "#4B4238",
  "#7DA6D9",
];

/* Colores semánticos por estado: se usan en la tarta, el scatter y las leyendas. */
const ESTADO_COLORS: Record<string, string> = {
  "ÓPTIMO": "#52B788",
  "LESIONADO": "#D46A6A",
  "SELECCIÓN": "#7DA6D9",
  "RECUPERACIÓN": "#EAB308",
};

const ESTADO_FALLBACK = "#C8A96B";

function estadoColor(estado: string) {
  return ESTADO_COLORS[estado] ?? ESTADO_FALLBACK;
}

const METRICAS = [
  { key: "mentalidad", label: "Mentalidad" },
  { key: "habitos", label: "Hábitos" },
  { key: "interpretacion", label: "Interpretación" },
  { key: "fisica", label: "Física" },
  { key: "tecnica", label: "Técnica" },
] as const;

type MetricaKey = (typeof METRICAS)[number]["key"];

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

  /* Un jugador sin ficha de scouting tiene todas las métricas a 0: se excluye
     de medias, mejor/peor y ranking para no falsear los agregados. */
  valorado: boolean;

  fortalezas: string;
  aspectosMejora: string;
  hudl: string;
};

/*
|--------------------------------------------------------------------------
| FECHAS
|--------------------------------------------------------------------------
| Las hojas mezclan "YYYY-MM-DD" y "DD/MM/YYYY". `new Date()` interpreta el
| segundo formato como MM/DD, así que lo normalizamos a mano.
*/

function parseFecha(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slash) {
    const [, day, month, year] = slash;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const iso = Date.parse(raw);

  return Number.isNaN(iso) ? 0 : iso;
}

function formatFecha(value: unknown) {
  const timestamp = parseFecha(value);
  if (!timestamp) return String(value || "—");

  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const emptyFilters = {
  jugador: "",
  posicion: "",
  estado: "",
  licencia: "",
  activo: "",
  fecha: "",
};

type Filters = typeof emptyFilters;

const FILTER_LABELS: Record<keyof Filters, string> = {
  jugador: "Jugador",
  posicion: "Posición",
  estado: "Estado",
  licencia: "Licencia",
  activo: "Grupo",
  fecha: "Fecha",
};

export default function DashboardPlantilla() {
  const [estadoRows, setEstadoRows] = useState<EstadoCSV[]>([]);
  const [scoutingRows, setScoutingRows] = useState<ScoutingCSV[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");

  const [filters, setFilters] = useState<Filters>(emptyFilters);

  /*
  |--------------------------------------------------------------------------
  | CARGA DE DATOS
  |--------------------------------------------------------------------------
  */

  /* `loading` arranca en true y sólo se reinicia desde el botón de reintentar,
     para no encadenar renders llamando a setState en el cuerpo del efecto. */
  useEffect(() => {
    let cancelled = false;

    /* Una sola descarga por hoja en toda la pestaña: ver `lib/hojaCsv`. */
    const parseCsv = <T,>(url: string) =>
      traeCsv(url).then(
        (csv) =>
          Papa.parse<T>(csv, { header: true, skipEmptyLines: true })
            .data,
      );

    Promise.all([
      parseCsv<EstadoCSV>(ESTADOS_CSV),
      parseCsv<ScoutingCSV>(SCOUTING_CSV),
    ])
      .then(([estados, scouting]) => {
        if (cancelled) return;

        const visible = <T extends { NOMBRE: string; APODO: string }>(rows: T[]) =>
          rows.filter((row) => !isHiddenPlayer(row.NOMBRE, row.APODO));

        setEstadoRows(visible(estados));
        setScoutingRows(visible(scouting));
      })
      .catch((error) => {
        if (cancelled) return;

        console.error("Error cargando datos de plantilla:", error);
        setLoadError("No se han podido cargar los datos de la plantilla.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /*
  |--------------------------------------------------------------------------
  | JUGADORES
  |--------------------------------------------------------------------------
  */

  const players = useMemo<Player[]>(() => {
    if (!estadoRows.length) return [];

    // Nos quedamos con el registro más reciente de cada jugador
    const latestMap = new Map<string, EstadoCSV>();

    estadoRows.forEach((row) => {
      if (!row.ID_JUGADOR) return;

      const previous = latestMap.get(row.ID_JUGADOR);

      if (!previous) {
        latestMap.set(row.ID_JUGADOR, row);
        return;
      }

      if (parseFecha(row.FECHA) >= parseFecha(previous.FECHA)) {
        latestMap.set(row.ID_JUGADOR, row);
      }
    });

    const scoutingMap = new Map<string, ScoutingCSV>();

    scoutingRows.forEach((row) => {
      if (row.ID_JUGADOR) scoutingMap.set(row.ID_JUGADOR, row);
    });

    return [...latestMap.values()]
      .map((estado) => {
        const scout = scoutingMap.get(estado.ID_JUGADOR);

        const mentalidad = toNumber(scout?.MENTALIDAD);
        const habitos = toNumber(scout?.HABITOS);
        const interpretacion = toNumber(scout?.INTERPRETACION);
        const fisica = toNumber(scout?.CAPACIDAD_FISICA);
        const tecnica = toNumber(scout?.TECNICA);

        const valores = [
          mentalidad,
          habitos,
          interpretacion,
          fisica,
          tecnica,
        ].filter((value) => value > 0);

        const media = valores.length
          ? valores.reduce((acc, value) => acc + value, 0) / valores.length
          : 0;

        return {
          id: estado.ID_JUGADOR,
          fecha: estado.FECHA,

          nombre: scout?.NOMBRE || estado.NOMBRE || "",
          apodo: scout?.APODO || estado.APODO || "",
          posicion: scout?.POSICION || estado.POSICION || "",
          dorsal: scout?.DORSAL || estado.DORSAL || "",
          foto:
            getPlayerImage(
              scout?.NOMBRE || estado.NOMBRE,
              "cerca",
              estado.ID_JUGADOR
            ) ||
            scout?.FOTO_URL ||
            estado.FOTO_URL ||
            "",
          licencia: scout?.LICENCIA || estado.LICENCIA || "",

          estado: estado.ESTADO || "",
          activo: String(estado.ACTIVO).toUpperCase() === "TRUE",

          mentalidad,
          habitos,
          interpretacion,
          fisica,
          tecnica,
          media,
          valorado: valores.length > 0,

          fortalezas: scout?.FORTALEZAS ?? "",
          aspectosMejora: scout?.ASPECTOS_MEJORA ?? "",
          hudl: scout?.HUDL_PERFIL_URL ?? "",
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [estadoRows, scoutingRows]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? "" : value,
    }));
  };

  const filterOptions = useMemo(() => {
    const unique = (values: string[]) =>
      [...new Set(values.filter(Boolean))].sort();

    return {
      posiciones: unique(players.map((p) => p.posicion)),
      estados: unique(players.map((p) => p.estado)),
      licencias: unique(players.map((p) => p.licencia)),
      fechas: [
        ...new Set(estadoRows.map((row) => row.FECHA).filter(Boolean)),
      ].sort((a, b) => parseFecha(b) - parseFecha(a)),
    };
  }, [players, estadoRows]);

  const filteredPlayers = useMemo(() => {
    const search = normalize(playerSearch);

    return players.filter((player) => {
      if (filters.jugador && player.id !== filters.jugador) return false;
      if (filters.posicion && player.posicion !== filters.posicion) return false;
      if (filters.estado && player.estado !== filters.estado) return false;
      if (filters.licencia && player.licencia !== filters.licencia) return false;
      if (filters.activo && String(player.activo) !== filters.activo)
        return false;
      if (filters.fecha && player.fecha !== filters.fecha) return false;

      if (
        search &&
        !normalize(player.nombre).includes(search) &&
        !normalize(player.apodo).includes(search) &&
        !normalize(player.posicion).includes(search) &&
        !String(player.dorsal).includes(search)
      ) {
        return false;
      }

      return true;
    });
  }, [players, filters, playerSearch]);

  /* El jugador seleccionado siempre debe existir dentro del filtro activo. */
  const selectedPlayer = useMemo(() => {
    if (!filteredPlayers.length) return null;

    return (
      filteredPlayers.find((p) => p.id === selectedPlayerId) ??
      filteredPlayers[0]
    );
  }, [filteredPlayers, selectedPlayerId]);

  /*
  |--------------------------------------------------------------------------
  | AGREGADOS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    const total = filteredPlayers.length;
    const valorados = filteredPlayers.filter((p) => p.valorado);

    const countEstado = (estado: string) =>
      filteredPlayers.filter((p) => p.estado === estado).length;

    const optimos = countEstado("ÓPTIMO");

    const media = valorados.length
      ? valorados.reduce((acc, p) => acc + p.media, 0) / valorados.length
      : 0;

    const optimalPercentage = total ? Math.round((optimos / total) * 100) : 0;

    return {
      total,
      activos: filteredPlayers.filter((p) => p.activo).length,
      optimos,
      seleccion: countEstado("SELECCIÓN"),
      lesionados: countEstado("LESIONADO"),
      recuperacion: countEstado("RECUPERACIÓN"),

      valorados: valorados.length,
      sinValorar: total - valorados.length,

      media: valorados.length ? media.toFixed(1) : "—",
      mejor: valorados.length
        ? Math.max(...valorados.map((p) => p.media)).toFixed(1)
        : "—",
      peor: valorados.length
        ? Math.min(...valorados.map((p) => p.media)).toFixed(1)
        : "—",
      elite: valorados.filter((p) => p.media >= 8).length,

      optimalPercentage,
    };
  }, [filteredPlayers]);

  const overallStatus =
    stats.optimalPercentage >= 80
      ? "MUY BUENO"
      : stats.optimalPercentage >= 60
        ? "BUENO"
        : stats.optimalPercentage >= 40
          ? "MEJORABLE"
          : "CRÍTICO";

  const estadoChart = useMemo(() => {
    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {
      const key = player.estado || "SIN ESTADO";
      map[key] = (map[key] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPlayers]);

  const positionChart = useMemo(() => {
    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {
      const key = player.posicion || "SIN POSICIÓN";
      map[key] = (map[key] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPlayers]);

  const licenciaChart = useMemo(() => {
    const map: Record<string, number> = {};

    filteredPlayers.forEach((player) => {
      const key = player.licencia || "SIN LICENCIA";
      map[key] = (map[key] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPlayers]);

  const radarData = useMemo(() => {
    const valorados = filteredPlayers.filter((p) => p.valorado);
    if (!valorados.length) return [];

    const avg = (key: MetricaKey) =>
      Number(
        (
          valorados.reduce((acc, p) => acc + p[key], 0) / valorados.length
        ).toFixed(2),
      );

    return METRICAS.map(({ key, label }) => ({
      subject: label,
      plantilla: avg(key),
      jugador: selectedPlayer?.valorado ? selectedPlayer[key] : avg(key),
    }));
  }, [filteredPlayers, selectedPlayer]);

  const rankingChart = useMemo(() => {
    return filteredPlayers
      .filter((p) => p.valorado)
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
    return filteredPlayers
      .filter((p) => p.valorado)
      .map((player) => ({
        x: player.mentalidad,
        y: player.fisica,
        z: Number(player.media.toFixed(1)),
        id: player.id,
        name: player.apodo || player.nombre,
        estado: player.estado,
        color: estadoColor(player.estado),
      }));
  }, [filteredPlayers]);

  /* Evolución: nº de registros por fecha, ordenado cronológicamente. */
  const evolutionData = useMemo(() => {
    const map: Record<string, number> = {};

    estadoRows.forEach((row) => {
      if (!row.FECHA) return;
      map[row.FECHA] = (map[row.FECHA] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([date, value]) => ({
        date,
        label: formatFecha(date),
        value,
      }))
      .sort((a, b) => parseFecha(a.date) - parseFecha(b.date));
  }, [estadoRows]);

  const handlePlayerSelect = (id: string) => {
    setSelectedPlayerId(id || null);
  };

  const activeFilters = (Object.keys(filters) as (keyof Filters)[])
    .filter((key) => filters[key])
    .map((key) => {
      let value = filters[key];

      if (key === "jugador") {
        value = players.find((p) => p.id === value)?.nombre ?? value;
      }

      if (key === "activo") {
        value = value === "true" ? "RMCF Castilla" : "Promocionados a entrenar";
      }

      if (key === "fecha") {
        value = formatFecha(value);
      }

      return { key, label: FILTER_LABELS[key], value };
    });

  const hasActiveFilters = activeFilters.length > 0 || Boolean(playerSearch);

  const resetFilters = () => {
    setFilters(emptyFilters);
    setPlayerSearch("");
  };

  /*
  |--------------------------------------------------------------------------
  | KPIs
  |--------------------------------------------------------------------------
  */

  const kpis: {
    title: string;
    value: string | number;
    filter?: { key: keyof Filters; value: string };
    tone?: string;
  }[] = [
    { title: "Jugadores", value: stats.total },
    {
      title: "Activos",
      value: stats.activos,
      filter: { key: "activo", value: "true" },
    },
    {
      title: "Óptimos",
      value: stats.optimos,
      filter: { key: "estado", value: "ÓPTIMO" },
      tone: "text-emerald-300",
    },
    {
      title: "Selección",
      value: stats.seleccion,
      filter: { key: "estado", value: "SELECCIÓN" },
      tone: "text-sky-300",
    },
    {
      title: "Lesionados",
      value: stats.lesionados,
      filter: { key: "estado", value: "LESIONADO" },
      tone: "text-red-300",
    },
    { title: "Media", value: stats.media },
    { title: "Mejor", value: stats.mejor },
    { title: "Peor", value: stats.peor },
    { title: "Élite (≥8)", value: stats.elite },
    { title: "% Óptimos", value: `${stats.optimalPercentage}%` },
  ];

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {/* HEADER */}

          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · PLANTILLA
            </p>

            <div className="mt-4 flex min-w-0 items-center gap-4">
              <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">
                Dashboard de plantilla
              </h1>

              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />
            </div>
          </div>

          {/* ERROR */}

          {loadError && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} className="shrink-0" />

              <span className="min-w-0 flex-1">{loadError}</span>

              <button
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setReloadKey((key) => key + 1);
                }}
                className="flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2 transition hover:bg-red-500/20"
              >
                <RotateCcw size={14} />
                Reintentar
              </button>
            </div>
          )}

          {/* FILTROS */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative min-w-0 xl:col-span-2">
                <span className="mb-2 block text-[10px] uppercase tracking-wider text-white/40">
                  Buscar
                </span>

                <Search
                  size={18}
                  className="absolute left-4 top-[2.6rem] text-white/40"
                />

                <input
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Nombre, dorsal o posición..."
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#C8A96B]"
                />
              </div>

              <FilterSelect
                label="Jugador"
                value={filters.jugador}
                onChange={(value) => updateFilter("jugador", value)}
                options={players.map((p) => ({
                  value: p.id,
                  label: p.nombre || p.apodo,
                }))}
              />

              <FilterSelect
                label="Posición"
                value={filters.posicion}
                onChange={(value) => updateFilter("posicion", value)}
                options={filterOptions.posiciones.map((p) => ({
                  value: p,
                  label: p,
                }))}
              />

              <FilterSelect
                label="Estado"
                value={filters.estado}
                onChange={(value) => updateFilter("estado", value)}
                options={filterOptions.estados.map((e) => ({
                  value: e,
                  label: e,
                }))}
              />

              <FilterSelect
                label="Licencia"
                value={filters.licencia}
                onChange={(value) => updateFilter("licencia", value)}
                options={filterOptions.licencias.map((l) => ({
                  value: l,
                  label: l,
                }))}
              />

              <FilterSelect
                label="Fecha de control"
                value={filters.fecha}
                onChange={(value) => updateFilter("fecha", value)}
                options={filterOptions.fechas.map((f) => ({
                  value: f,
                  label: formatFecha(f),
                }))}
              />

              <FilterSelect
                label="Grupo"
                placeholder="Todos los jugadores"
                value={filters.activo}
                onChange={(value) => updateFilter("activo", value)}
                options={[
                  { value: "true", label: "RMCF Castilla" },
                  { value: "false", label: "Promocionados a entrenar" },
                ]}
              />
            </div>

            {/* CHIPS DE FILTROS ACTIVOS */}

            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                {playerSearch && (
                  <Chip
                    label="Búsqueda"
                    value={playerSearch}
                    onClear={() => setPlayerSearch("")}
                  />
                )}

                {activeFilters.map((filter) => (
                  <Chip
                    key={filter.key}
                    label={filter.label}
                    value={filter.value}
                    onClear={() => updateFilter(filter.key, "")}
                  />
                ))}

                <button
                  onClick={resetFilters}
                  className="ml-auto flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2 text-sm text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                >
                  <RotateCcw size={14} />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : players.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
              No hay datos de plantilla disponibles.
            </div>
          ) : (
            <>
              {/* RESUMEN */}

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold">REAL MADRID CASTILLA</h2>

                    <p className="mt-1 text-sm text-white/50">
                      Resumen general de la plantilla
                      {stats.sinValorar > 0 && (
                        <>
                          {" · "}
                          <span className="text-[#C8A96B]">
                            {stats.sinValorar} sin ficha de scouting
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <SummaryStat label="Jugadores" value={stats.total} />
                    <SummaryStat label="Media" value={stats.media} />
                    <SummaryStat
                      label="Disponibles"
                      value={`${stats.optimalPercentage}%`}
                      className="text-emerald-400"
                    />
                    <SummaryStat
                      label="Estado general"
                      value={overallStatus}
                      size="text-xl"
                      className={
                        overallStatus === "MUY BUENO"
                          ? "text-emerald-400"
                          : overallStatus === "BUENO"
                            ? "text-sky-400"
                            : overallStatus === "MEJORABLE"
                              ? "text-yellow-400"
                              : "text-red-400"
                      }
                    />
                  </div>
                </div>
              </div>

              {/* KPIs */}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
                {kpis.map((kpi) => {
                  const clickable = Boolean(kpi.filter);

                  const active = Boolean(
                    kpi.filter && filters[kpi.filter.key] === kpi.filter.value,
                  );

                  const className = `group rounded-xl border p-4 text-left transition-all duration-300 ${
                    clickable
                      ? "cursor-pointer hover:-translate-y-1 hover:border-[#C8A96B] hover:bg-white/[0.06]"
                      : ""
                  } ${
                    active
                      ? "border-[#C8A96B] bg-[#C8A96B]/10 shadow-[0_0_20px_rgba(200,169,107,0.15)]"
                      : "border-white/10 bg-white/[0.025]"
                  }`;

                  const body = (
                    <>
                      <div className="text-sm text-white/50">{kpi.title}</div>

                      <div
                        className={`mt-2 text-3xl font-bold tracking-tight transition-colors duration-300 ${
                          kpi.tone ?? "text-white"
                        } ${clickable ? "group-hover:text-[#C8A96B]" : ""}`}
                      >
                        {kpi.value}
                      </div>

                      <div className="mt-1 text-xs text-white/30">
                        {clickable
                          ? active
                            ? "Filtro activo · click para quitar"
                            : "Click para filtrar"
                          : " "}
                      </div>
                    </>
                  );

                  if (!clickable) {
                    return (
                      <div key={kpi.title} className={className}>
                        {body}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={kpi.title}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        toggleFilter(kpi.filter!.key, kpi.filter!.value)
                      }
                      className={className}
                    >
                      {body}
                    </button>
                  );
                })}
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
                  Ningún jugador coincide con los filtros seleccionados.
                </div>
              ) : (
                <>
                  {/* FICHA + RADAR */}

                  <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                    <PlayerCard
                      player={selectedPlayer}
                      onSelect={handlePlayerSelect}
                      players={filteredPlayers}
                    />

                    <ChartCard
                      title="Perfil comparado"
                      subtitle={
                        selectedPlayer
                          ? `${
                              selectedPlayer.apodo || selectedPlayer.nombre
                            } vs. media de la plantilla filtrada`
                          : undefined
                      }
                    >
                      {radarData.length ? (
                        <ResponsiveContainer width="100%" height={340}>
                          <RadarChart data={radarData} outerRadius="72%">
                            <PolarGrid stroke={THEME.grid} />

                            <PolarAngleAxis
                              dataKey="subject"
                              tick={{ fill: THEME.axis, fontSize: 12 }}
                            />

                            <PolarRadiusAxis
                              domain={[0, 10]}
                              tick={{ fill: THEME.axis, fontSize: 10 }}
                              stroke={THEME.grid}
                            />

                            <Radar
                              name="Plantilla"
                              dataKey="plantilla"
                              stroke="#7DA6D9"
                              fill="#7DA6D9"
                              fillOpacity={0.18}
                            />

                            <Radar
                              name={
                                selectedPlayer?.apodo ||
                                selectedPlayer?.nombre ||
                                "Jugador"
                              }
                              dataKey="jugador"
                              stroke={THEME.gold}
                              fill={THEME.gold}
                              fillOpacity={0.35}
                            />

                            <Legend wrapperStyle={{ color: THEME.text }} />

                            <Tooltip
                              formatter={(value) =>
                                `${Number(value).toFixed(1)}/10`
                              }
                              contentStyle={TOOLTIP_STYLE}
                              labelStyle={TOOLTIP_LABEL_STYLE}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart message="Sin datos de scouting para el filtro actual." />
                      )}
                    </ChartCard>
                  </div>

                  {/* GRÁFICOS */}

                  <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                    <ChartCard
                      title="Estado de la plantilla"
                      subtitle="Click en un sector para filtrar"
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={estadoChart}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={95}
                            label={({ name, value }) => `${name}: ${value}`}
                            cursor="pointer"
                            onClick={(data: { name?: string }) =>
                              data?.name && toggleFilter("estado", data.name)
                            }
                          >
                            {estadoChart.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={estadoColor(entry.name)}
                                stroke={THEME.card}
                              />
                            ))}
                          </Pie>

                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelStyle={TOOLTIP_LABEL_STYLE}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      <ColorLegend
                        items={estadoChart.map((entry) => ({
                          label: entry.name,
                          color: estadoColor(entry.name),
                        }))}
                      />
                    </ChartCard>

                    <ChartCard
                      title="Jugadores por posición"
                      subtitle="Click en una barra para filtrar"
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={positionChart}
                          margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid
                            stroke={THEME.grid}
                            strokeDasharray="2 2"
                          />

                          <XAxis
                            dataKey="name"
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={70}
                            {...AXIS_PROPS}
                          />

                          <YAxis allowDecimals={false} {...AXIS_PROPS} />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            contentStyle={TOOLTIP_STYLE}
                            labelStyle={TOOLTIP_LABEL_STYLE}
                          />

                          <Bar
                            dataKey="value"
                            name="Jugadores"
                            fill={THEME.gold}
                            radius={[5, 5, 0, 0]}
                            cursor="pointer"
                            onClick={(data: { name?: string }) =>
                              data?.name && toggleFilter("posicion", data.name)
                            }
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard
                      title="Top 10 valoración"
                      subtitle="Click en una barra para ver la ficha"
                    >
                      {rankingChart.length ? (
                        <ResponsiveContainer width="100%" height={340}>
                          <BarChart data={rankingChart} layout="vertical">
                            <CartesianGrid
                              stroke={THEME.grid}
                              strokeDasharray="2 2"
                            />

                            <XAxis
                              type="number"
                              domain={[0, 10]}
                              {...AXIS_PROPS}
                            />

                            <YAxis
                              dataKey="name"
                              type="category"
                              width={150}
                              {...AXIS_PROPS}
                              tickFormatter={(value: string, index: number) => {
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
                              cursor={{ fill: "rgba(255,255,255,0.04)" }}
                              formatter={(value) => [
                                `${Number(value).toFixed(1)}/10`,
                                "Valoración",
                              ]}
                              contentStyle={TOOLTIP_STYLE}
                              labelStyle={TOOLTIP_LABEL_STYLE}
                            />

                            <Bar
                              dataKey="value"
                              radius={[0, 6, 6, 0]}
                              cursor="pointer"
                              onClick={(data: { id?: string }) =>
                                data?.id && handlePlayerSelect(data.id)
                              }
                            >
                              {rankingChart.map((entry) => (
                                <Cell
                                  key={entry.id}
                                  fill={
                                    selectedPlayer?.id === entry.id
                                      ? "#F0D8A8"
                                      : THEME.gold
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart message="Sin jugadores valorados en el filtro actual." />
                      )}
                    </ChartCard>

                    <ChartCard
                      title="Mentalidad vs Física"
                      subtitle="El tamaño del punto indica la media global"
                    >
                      {scatterData.length ? (
                        <>
                          <ResponsiveContainer width="100%" height={340}>
                            <ScatterChart
                              margin={{
                                top: 10,
                                right: 20,
                                bottom: 10,
                                left: -10,
                              }}
                            >
                              <CartesianGrid
                                stroke={THEME.grid}
                                strokeDasharray="2 2"
                              />

                              <XAxis
                                type="number"
                                dataKey="x"
                                domain={[0, 10]}
                                name="Mentalidad"
                                {...AXIS_PROPS}
                              />

                              <YAxis
                                type="number"
                                dataKey="y"
                                domain={[0, 10]}
                                name="Física"
                                {...AXIS_PROPS}
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
                                    <div className="rounded-xl border border-white/10 bg-[#11161D] p-3 text-sm shadow-xl">
                                      <div className="font-bold text-white">
                                        {p.name}
                                      </div>

                                      <div className="mt-1 text-white/60">
                                        Mentalidad: {p.x}
                                      </div>
                                      <div className="text-white/60">
                                        Física: {p.y}
                                      </div>
                                      <div className="text-white/60">
                                        Media: {p.z}
                                      </div>

                                      <div
                                        className="mt-1 font-medium"
                                        style={{ color: chipInk(p.color) }}
                                      >
                                        {p.estado}
                                      </div>
                                    </div>
                                  );
                                }}
                              />

                              <Scatter
                                data={scatterData}
                                cursor="pointer"
                                onClick={(data) => {
                                  /* Recharts entrega el punto, no el dato:
                                     el registro original está en `payload`. */
                                  const point = data as unknown as {
                                    id?: string;
                                    payload?: { id?: string };
                                  };

                                  const id = point?.payload?.id ?? point?.id;

                                  if (id) handlePlayerSelect(id);
                                }}
                              >
                                {scatterData.map((entry) => (
                                  <Cell
                                    key={entry.id}
                                    fill={entry.color}
                                    stroke={
                                      selectedPlayer?.id === entry.id
                                        ? "#FFFFFF"
                                        : "transparent"
                                    }
                                    strokeWidth={2}
                                  />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>

                          <ColorLegend
                            items={Object.entries(ESTADO_COLORS).map(
                              ([label, color]) => ({ label, color }),
                            )}
                          />
                        </>
                      ) : (
                        <EmptyChart message="Sin jugadores valorados en el filtro actual." />
                      )}
                    </ChartCard>

                    <ChartCard
                      title="Evolución de registros"
                      subtitle="Controles de estado registrados por fecha"
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={evolutionData}
                          margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid
                            stroke={THEME.grid}
                            strokeDasharray="2 2"
                          />

                          <XAxis dataKey="label" {...AXIS_PROPS} />

                          <YAxis allowDecimals={false} {...AXIS_PROPS} />

                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelStyle={TOOLTIP_LABEL_STYLE}
                          />

                          <Line
                            type="monotone"
                            dataKey="value"
                            name="Registros"
                            stroke={THEME.gold}
                            strokeWidth={3}
                            dot={{ r: 4, fill: THEME.gold }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard
                      title="Distribución por licencias"
                      subtitle="Click en un sector para filtrar"
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={licenciaChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={3}
                            label={({ value }) => value}
                            cursor="pointer"
                            onClick={(data: { name?: string }) =>
                              data?.name && toggleFilter("licencia", data.name)
                            }
                          >
                            {licenciaChart.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={COLORS[index % COLORS.length]}
                                stroke={THEME.card}
                              />
                            ))}
                          </Pie>

                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelStyle={TOOLTIP_LABEL_STYLE}
                          />

                          <Legend wrapperStyle={{ color: THEME.text }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ESTILOS COMPARTIDOS DE RECHARTS
|--------------------------------------------------------------------------
*/

const TOOLTIP_STYLE = {
  background: THEME.card,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#FFF",
} as const;

const TOOLTIP_LABEL_STYLE = {
  color: THEME.gold,
} as const;

const AXIS_PROPS = {
  tick: { fill: THEME.axis, fontSize: 12 },
  axisLine: { stroke: THEME.grid },
  tickLine: { stroke: THEME.grid },
} as const;

/*
|--------------------------------------------------------------------------
| COMPONENTES AUXILIARES
|--------------------------------------------------------------------------
*/

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full min-w-0 rounded-xl border bg-[#11161D] px-3 py-3 text-sm outline-none transition focus:border-[#C8A96B] ${
          value
            ? "border-[#C8A96B]/50 text-[#C8A96B]"
            : "border-white/10 text-white/80"
        }`}
      >
        <option value="">{placeholder ?? `Todas · ${label}`}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 py-1 pl-3 pr-1 text-xs text-[#C8A96B]">
      <span className="text-white/40">{label}:</span>

      <span className="max-w-[160px] truncate font-medium">{value}</span>

      <button
        onClick={onClear}
        aria-label={`Quitar filtro ${label}`}
        className="rounded-full p-1 transition hover:bg-[#C8A96B]/20"
      >
        <X size={12} />
      </button>
    </span>
  );
}

function SummaryStat({
  label,
  value,
  className = "",
  size = "text-3xl",
}: {
  label: string;
  value: string | number;
  className?: string;
  size?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-white/50">{label}</div>

      <div className={`${size} font-bold ${className}`}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
      <div className="mb-5 min-w-0">
        <h3 className="truncate text-lg font-semibold tracking-wide text-neutral-100">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 truncate text-xs text-white/35">{subtitle}</p>
        )}
      </div>

      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center text-sm text-white/30">
      {message}
    </div>
  );
}

function ColorLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}

function MetricBar({
  label,
  value,
  reference,
}: {
  label: string;
  value: number;
  reference?: number;
}) {
  const percentage = Math.max(0, Math.min(100, (value / 10) * 100));

  const diff =
    reference !== undefined ? Number((value - reference).toFixed(1)) : null;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-white/50">{label}</span>

        <span className="shrink-0 font-semibold text-white">
          {value ? value.toFixed(1) : "—"}

          {diff !== null && value > 0 && (
            <span
              className={`ml-2 font-normal ${
                diff > 0
                  ? "text-emerald-400"
                  : diff < 0
                    ? "text-red-400"
                    : "text-white/30"
              }`}
              title="Diferencia respecto a la media de la plantilla filtrada"
            >
              {diff > 0 ? "+" : ""}
              {diff}
            </span>
          )}
        </span>
      </div>

      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8E6A37] to-[#C8A96B] transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  players,
  onSelect,
}: {
  player: Player | null;
  players: Player[];
  onSelect: (id: string) => void;
}) {
  if (!player) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center text-sm text-white/30">
        Selecciona un jugador.
      </div>
    );
  }

  const index = players.findIndex((p) => p.id === player.id);

  const go = (direction: number) => {
    const next = index + direction;
    if (next < 0 || next >= players.length) return;
    onSelect(players[next].id);
  };

  const referencia = players.filter((p) => p.valorado);

  const media = (key: MetricaKey) =>
    referencia.length
      ? referencia.reduce((acc, p) => acc + p[key], 0) / referencia.length
      : 0;

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      {/* CABECERA */}

      <div className="flex min-w-0 items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14]">
          {player.foto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={player.foto}
              alt={player.nombre}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <UserRound size={32} className="text-white/20" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {player.dorsal && (
              <span className="shrink-0 text-sm font-bold text-[#C8A96B]">
                #{player.dorsal}
              </span>
            )}

            <span
              className="min-w-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: `${estadoColor(player.estado)}22`,
                color: chipInk(estadoColor(player.estado)),
              }}
            >
              {player.estado || "SIN ESTADO"}
            </span>
          </div>

          <h3 className="mt-1 truncate text-lg font-semibold">
            {player.apodo || player.nombre}
          </h3>

          <p className="truncate text-xs text-white/40">
            {player.posicion || "—"}
            {player.licencia ? ` · ${player.licencia}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/30">
            Media
          </div>

          <div className="text-3xl font-bold text-[#C8A96B]">
            {player.valorado ? player.media.toFixed(1) : "—"}
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN */}

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/40">
        <button
          onClick={() => go(-1)}
          disabled={index <= 0}
          className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-[#C8A96B] hover:text-white disabled:opacity-20"
        >
          ← Anterior
        </button>

        <span className="shrink-0">
          {index + 1} / {players.length}
        </span>

        <button
          onClick={() => go(1)}
          disabled={index >= players.length - 1}
          className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-[#C8A96B] hover:text-white disabled:opacity-20"
        >
          Siguiente →
        </button>
      </div>

      {/* MÉTRICAS */}

      <div className="mt-5 space-y-3 border-t border-white/5 pt-5">
        {player.valorado ? (
          METRICAS.map(({ key, label }) => (
            <MetricBar
              key={key}
              label={label}
              value={player[key]}
              reference={media(key)}
            />
          ))
        ) : (
          <p className="text-sm text-white/30">
            Este jugador todavía no tiene ficha de scouting.
          </p>
        )}
      </div>

      {/* TEXTOS */}

      {(player.fortalezas || player.aspectosMejora) && (
        <div className="mt-5 space-y-4 border-t border-white/5 pt-5 text-sm">
          {player.fortalezas && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/70">
                Fortalezas
              </p>
              <p className="mt-1 text-white/70">{player.fortalezas}</p>
            </div>
          )}

          {player.aspectosMejora && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#C8A96B]/70">
                Aspectos de mejora
              </p>
              <p className="mt-1 text-white/70">{player.aspectosMejora}</p>
            </div>
          )}
        </div>
      )}

      {/* PIE */}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4 text-xs text-white/30">
        <span className="truncate">
          Último control: {formatFecha(player.fecha)}
        </span>

        {player.hudl && (
          <a
            href={player.hudl}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 text-[#C8A96B] transition hover:text-[#e0c68d]"
          >
            Hudl
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[360px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}
