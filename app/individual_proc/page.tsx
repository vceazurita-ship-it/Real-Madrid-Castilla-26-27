"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useEffect, useMemo, useState } from "react";
import { chipInk } from "@/lib/theme";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento } from "@/lib/seguimiento";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  Layers,
  MessageSquareText,
  Minus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LabelList,
  ReferenceLine,
} from "recharts";


type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
  FECHA_CREACION?: string;
  NOMBRE?: string;
};

const MONTHS = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const GOLD = "#C8A96B";

const COLORS = [
  "#C8A96B",
  "#6E7F99",
  "#4C7A67",
  "#8B5E5E",
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F97316",
];

const AXIS = { fill: "#94A3B8", fontSize: 11 };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SEASON_START_MONTH = 6; // julio (0-index)
const SEASON_START_DAY = 8;

function getSeasonWeek(fecha: string) {
  const d = new Date(fecha);

  const seasonStartYear =
    d.getMonth() >= SEASON_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;

  const seasonStart = new Date(
    seasonStartYear,
    SEASON_START_MONTH,
    SEASON_START_DAY
  );

  const diffDays = Math.floor(
    (d.getTime() - seasonStart.getTime()) / 86400000
  );

  return Math.floor(diffDays / 7) + 1;
}

const norm = (v?: string) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function fmtFecha(v: string) {
  const d = new Date(v);

  if (isNaN(d.getTime())) return v;

  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/**
 * La fecha de un registro, sólo si tiene sentido.
 *
 * La hoja trae fechas imposibles —un año mal escrito basta— y con ellas el
 * panel decía «último registro hace -29219184 días»: una fecha del año 82000
 * ordenaba primero y salía como lo más reciente. Se descarta lo que no caiga
 * entre 2000 y mañana; y lo que no es fecha, tampoco.
 */
const HOY_MAS_UNO = () => Date.now() + 86400000;

function fechaValida(v: string): Date | null {
  const d = new Date(v);
  const t = d.getTime();

  if (isNaN(t)) return null;
  if (t < Date.UTC(2000, 0, 1) || t > HOY_MAS_UNO()) return null;

  return d;
}

function daysAgo(v: string) {
  const d = fechaValida(v);

  if (!d) return null;

  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function pct(part: number, total: number) {
  return total ? +((part / total) * 100).toFixed(1) : 0;
}

/** Trims boilerplate text so the feed stays readable */
function clean(text?: string) {
  const t = (text || "").trim();

  return t && t !== "-" ? t : "";
}

type TabKey = "resumen" | "jugadores" | "contenidos" | "registros";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "resumen", label: "Resumen", icon: Sparkles },
  { key: "jugadores", label: "Jugadores", icon: Users },
  { key: "contenidos", label: "Metodología", icon: Layers },
  { key: "registros", label: "Registros", icon: MessageSquareText },
];

const emptyFilters = {
  player: "",
  position: "",
  coach: "",
  strategy: "",
  modality: "",
  moment: "",
  month: "",
  week: "",
};

type Filters = typeof emptyFilters;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardSeguimiento() {
  const { players } = usePlayers();

  const [crudoTracking, setTracking] = useState<TrackingRecord[]>([]);

  /*
  | El nombre manda sobre el ID: la hoja JUGADORES ha renumerado los JUG-XX y
  | un seguimiento viejo apunta hoy a otra persona (ver `lib/seguimiento.ts`).
  |
  | Y **fuera lo que no tiene fecha usable**. Todo este panel se ordena por
  | fecha: la semana de temporada, el mes, la media semanal, el mapa de calor
  | y el «último registro». Un `FECHA` vacío —la hoja tiene dos, los dos con
  | el mismo ID_REGISTRO— sale como semana `NaN`, cuenta como una semana
  | activa más y puede colarse como el registro más reciente. Se dice cuántos
  | son al lado del total, para que no desaparezcan en silencio.
  */
  const conFecha = useMemo(
    () => crudoTracking.filter((s) => fechaValida(s.FECHA)),
    [crudoTracking],
  );

  const sinFecha = crudoTracking.length - conFecha.length;

  const tracking = useMemo(
    () => alineaSeguimiento(conFecha, players),
    [conFecha, players],
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedLimit, setFeedLimit] = useState(20);

  const [filters, setFilters] = useState<Filters>(emptyFilters);

  useEffect(() => {
    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((data) => {
        setTracking(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const nameOf = (r: TrackingRecord) =>
    playerMap[r.ID_JUGADOR]?.nombre ?? r.NOMBRE ?? r.ID_JUGADOR;

  /* ---------------- filtering ---------------- */

  const filteredTracking = useMemo(() => {
    const q = norm(search);

    return tracking.filter((s) => {
      const jugador = playerMap[s.ID_JUGADOR];
      const month = new Date(s.FECHA).getMonth() + 1;
      const week = getSeasonWeek(s.FECHA);

      if (filters.player && s.ID_JUGADOR !== filters.player) return false;
      if (filters.strategy && s.ESTRATEGIA !== filters.strategy) return false;
      if (filters.coach && s.QUIEN !== filters.coach) return false;
      if (filters.modality && s.MODALIDAD !== filters.modality) return false;
      if (filters.moment && s.MOMENTO !== filters.moment) return false;
      if (filters.month && month !== Number(filters.month)) return false;
      if (filters.week && week !== Number(filters.week)) return false;
      if (filters.position && jugador?.posicion !== filters.position)
        return false;

      if (
        q &&
        !norm(
          `${nameOf(s)} ${s.FEEDBACK} ${s.OBJETIVO_OFENSIVO} ${s.OBJETIVO_DEFENSIVO} ${s.OBJETIVO_MENTAL} ${s.ESTRATEGIA} ${s.QUIEN}`
        ).includes(q)
      )
        return false;

      return true;
    });
  }, [tracking, playerMap, filters, search]);

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  /* ---------------- KPIs ---------------- */

  const totalSessions = filteredTracking.length;

  const trackedIds = useMemo(
    () => new Set(filteredTracking.map((s) => s.ID_JUGADOR)),
    [filteredTracking]
  );

  const totalPlayers = trackedIds.size;

  const weeksSet = useMemo(
    () => new Set(filteredTracking.map((s) => getSeasonWeek(s.FECHA))),
    [filteredTracking]
  );

  const totalWeeks = weeksSet.size;

  const averageWeek = totalWeeks
    ? +(totalSessions / totalWeeks).toFixed(1)
    : 0;

  /*
  | La cobertura es **de la plantilla de ahora**, no de todo el que aparezca
  | en la hoja.
  |
  | `totalPlayers` cuenta a cualquiera con registros, y ahí hay gente que se
  | fue: por eso salía «39 de 40 · 97,5%» a la vez que «5 sin registro», que no
  | puede ser. Se cuenta a los de la plantilla que sí tienen seguimiento, y
  | sobre el mismo grupo que la lista de los que no lo tienen —si hay filtro de
  | posición, los de esa posición—.
  */
  const plantillaEnFoco = useMemo(
    () =>
      players.filter(
        (p) => !filters.position || p.posicion === filters.position,
      ),
    [players, filters.position],
  );

  const squadSize = plantillaEnFoco.length;

  const cubiertos = useMemo(
    () => plantillaEnFoco.filter((p) => trackedIds.has(p.id)).length,
    [plantillaEnFoco, trackedIds],
  );

  const coverage = pct(cubiertos, squadSize);

  const lastRecord = useMemo(() => {
    /* Sólo entre los que tienen fecha de verdad: una fecha imposible ordenaba
       primero y se anunciaba como el último seguimiento hecho. */
    const conFecha = filteredTracking.filter((s) => fechaValida(s.FECHA));

    if (!conFecha.length) return null;

    return [...conFecha].sort(
      (a, b) =>
        (fechaValida(b.FECHA)?.getTime() ?? 0) -
        (fechaValida(a.FECHA)?.getTime() ?? 0)
    )[0];
  }, [filteredTracking]);

  const sinceLast = lastRecord ? daysAgo(lastRecord.FECHA) : null;

  const individualShare = pct(
    filteredTracking.filter((s) => norm(s.MODALIDAD) === "individual").length,
    totalSessions
  );

  /* ---------------- per player ---------------- */

  const playerChart = useMemo(() => {
    const map: Record<
      string,
      { id: string; value: number; weeks: Set<number>; last: string }
    > = {};

    filteredTracking.forEach((s) => {
      const nombre = nameOf(s);

      if (!map[nombre]) {
        map[nombre] = {
          id: s.ID_JUGADOR,
          value: 0,
          weeks: new Set(),
          last: s.FECHA,
        };
      }

      map[nombre].value += 1;
      map[nombre].weeks.add(getSeasonWeek(s.FECHA));

      if (new Date(s.FECHA) > new Date(map[nombre].last)) {
        map[nombre].last = s.FECHA;
      }
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        id: v.id,
        value: v.value,
        semanas: v.weeks.size,
        last: v.last,
        dias: daysAgo(v.last),
        percentage: pct(v.value, totalSessions),
        posicion: playerMap[v.id]?.posicion ?? "—",
        foto: playerMap[v.id]?.foto ?? PLAYER_PHOTO_FALLBACK,
        dorsal: playerMap[v.id]?.dorsal,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTracking, playerMap, totalSessions]);

  const mostTrackedPlayer = playerChart[0] ?? { name: "—", value: 0 };

  const leastTrackedPlayer =
    playerChart[playerChart.length - 1] ?? { name: "—", value: 0 };

  const avgPerPlayer = totalPlayers
    ? +(totalSessions / totalPlayers).toFixed(1)
    : 0;

  /** Players in the squad with zero records under the current filters */
  const untrackedPlayers = useMemo(() => {
    return plantillaEnFoco.filter((p) => !trackedIds.has(p.id));
  }, [plantillaEnFoco, trackedIds]);

  /** Players whose last contact is the oldest — actionable list */
  const staleContacts = useMemo(() => {
    return [...playerChart]
      .filter((p) => p.dias !== null)
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
      .slice(0, 6);
  }, [playerChart]);

  /* ---------------- categorical breakdowns ---------------- */

  const countBy = (key: keyof TrackingRecord) => {
    const map: Record<string, number> = {};

    filteredTracking.forEach((s) => {
      const raw = String(s[key] ?? "").trim();

      if (!raw) return;

      map[raw] = (map[raw] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: pct(value, totalSessions),
      }))
      .sort((a, b) => b.value - a.value);
  };

  const strategyData = useMemo(
    () => countBy("ESTRATEGIA"),
    [filteredTracking, totalSessions]
  );

  const modalityData = useMemo(
    () => countBy("MODALIDAD"),
    [filteredTracking, totalSessions]
  );

  const momentData = useMemo(
    () => countBy("MOMENTO"),
    [filteredTracking, totalSessions]
  );

  const coachData = useMemo(
    () => countBy("QUIEN"),
    [filteredTracking, totalSessions]
  );

  const positionData = useMemo(() => {
    const map: Record<string, { value: number; jugadores: Set<string> }> = {};

    filteredTracking.forEach((s) => {
      const pos = playerMap[s.ID_JUGADOR]?.posicion || "Sin posición";

      if (!map[pos]) map[pos] = { value: 0, jugadores: new Set() };

      map[pos].value += 1;
      map[pos].jugadores.add(s.ID_JUGADOR);
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        value: v.value,
        jugadores: v.jugadores.size,
        media: +(v.value / v.jugadores.size).toFixed(1),
        percentage: pct(v.value, totalSessions),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTracking, playerMap, totalSessions]);

  /* ---------------- objectives focus ---------------- */

  const focusData = useMemo(() => {
    let of = 0;
    let def = 0;
    let men = 0;

    filteredTracking.forEach((s) => {
      if (clean(s.OBJETIVO_OFENSIVO)) of += 1;
      if (clean(s.OBJETIVO_DEFENSIVO)) def += 1;
      if (clean(s.OBJETIVO_MENTAL)) men += 1;
    });

    return [
      { name: "Ofensivo", value: of, percentage: pct(of, totalSessions) },
      { name: "Defensivo", value: def, percentage: pct(def, totalSessions) },
      { name: "Mental", value: men, percentage: pct(men, totalSessions) },
    ];
  }, [filteredTracking, totalSessions]);

  const withFeedback = filteredTracking.filter((s) =>
    clean(s.FEEDBACK)
  ).length;

  /* ---------------- weekly evolution ---------------- */

  const weeklyData = useMemo(() => {
    const map: Record<number, { value: number; jugadores: Set<string> }> = {};

    filteredTracking.forEach((s) => {
      const week = getSeasonWeek(s.FECHA);

      if (!map[week]) map[week] = { value: 0, jugadores: new Set() };

      map[week].value += 1;
      map[week].jugadores.add(s.ID_JUGADOR);
    });

    const weeks = Object.keys(map).map(Number).sort((a, b) => a - b);

    if (!weeks.length) return [];

    const out: {
      week: string;
      value: number;
      jugadores: number;
      percentage: number;
    }[] = [];

    for (let w = weeks[0]; w <= weeks[weeks.length - 1]; w++) {
      out.push({
        week: `S${w}`,
        value: map[w]?.value ?? 0,
        jugadores: map[w]?.jugadores.size ?? 0,
        percentage: pct(map[w]?.value ?? 0, totalSessions),
      });
    }

    return out;
  }, [filteredTracking, totalSessions]);

  const weeklyMean = weeklyData.length
    ? +(
        weeklyData.reduce((a, b) => a + b.value, 0) / weeklyData.length
      ).toFixed(1)
    : 0;

  const weeklyDelta = useMemo(() => {
    if (weeklyData.length < 2) return null;

    const last = weeklyData[weeklyData.length - 1].value;
    const prev = weeklyData[weeklyData.length - 2].value;

    return last - prev;
  }, [weeklyData]);

  const monthlyData = useMemo(() => {
    const map: Record<number, number> = {};

    filteredTracking.forEach((s) => {
      const m = new Date(s.FECHA).getMonth() + 1;

      map[m] = (map[m] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([m, value]) => ({
        name: MONTHS[Number(m)],
        month: Number(m),
        value,
        percentage: pct(value, totalSessions),
      }))
      .sort((a, b) => a.month - b.month);
  }, [filteredTracking, totalSessions]);

  /* ---------------- heatmap player x week ---------------- */

  const heatmap = useMemo(() => {
    const weeks = [...weeksSet].sort((a, b) => a - b);

    const rows = playerChart.slice(0, 30).map((p) => ({
      name: p.name,
      id: p.id,
      total: p.value,
      cells: weeks.map((w) => ({
        week: w,
        count: filteredTracking.filter(
          (s) => s.ID_JUGADOR === p.id && getSeasonWeek(s.FECHA) === w
        ).length,
      })),
    }));

    const max = Math.max(
      ...rows.flatMap((r) => r.cells.map((c) => c.count)),
      1
    );

    return { weeks, rows, max };
  }, [playerChart, filteredTracking, weeksSet]);

  /* ---------------- coach x strategy matrix ---------------- */

  const coachStrategyMatrix = useMemo(() => {
    const strategies = strategyData.map((s) => s.name);

    const rows = coachData.map((c) => ({
      coach: c.name,
      total: c.value,
      cells: strategies.map((st) => ({
        strategy: st,
        count: filteredTracking.filter(
          (s) => s.QUIEN === c.name && s.ESTRATEGIA === st
        ).length,
      })),
    }));

    const max = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.count)), 1);

    return { strategies, rows, max };
  }, [coachData, strategyData, filteredTracking]);

  /* ---------------- feed ---------------- */

  const feed = useMemo(
    () =>
      [...filteredTracking].sort(
        (a, b) => new Date(b.FECHA).getTime() - new Date(a.FECHA).getTime()
      ),
    [filteredTracking]
  );

  useEffect(() => {
    setFeedLimit(20);
  }, [filters, search, tab]);

  /* ---------------- insights ---------------- */

  const insights = useMemo(() => {
    const out: { icon: any; tone: string; text: string }[] = [];

    if (!totalSessions) return out;

    out.push({
      icon: UserCheck,
      tone: "text-emerald-400",
      text: `${cubiertos} de ${squadSize} jugadores de la plantilla han recibido seguimiento (${coverage}% de cobertura).`,
    });

    if (untrackedPlayers.length) {
      out.push({
        icon: AlertTriangle,
        tone: "text-amber-400",
        text: `${untrackedPlayers.length} jugador${
          untrackedPlayers.length === 1 ? "" : "es"
        } sin ningún registro con los filtros actuales.`,
      });
    }

    if (strategyData[0]) {
      out.push({
        icon: Layers,
        tone: "text-sky-400",
        text: `"${strategyData[0].name}" es la estrategia dominante (${strategyData[0].percentage}% de los seguimientos).`,
      });
    }

    if (momentData[0]) {
      out.push({
        icon: Clock,
        tone: "text-violet-400",
        text: `El momento preferente de intervención es ${momentData[0].name.toLowerCase()} (${momentData[0].percentage}%).`,
      });
    }

    if (weeklyDelta !== null) {
      const verb =
        weeklyDelta > 0 ? "sube" : weeklyDelta < 0 ? "baja" : "se mantiene";

      out.push({
        icon: TrendingUp,
        tone: weeklyDelta >= 0 ? "text-emerald-400" : "text-rose-400",
        text: `La última semana ${verb} ${Math.abs(
          weeklyDelta
        )} seguimientos respecto a la anterior (media semanal: ${weeklyMean}).`,
      });
    }

    if (sinceLast !== null) {
      out.push({
        icon: CalendarDays,
        tone: "text-white/60",
        text: `Último registro hace ${sinceLast} día${
          sinceLast === 1 ? "" : "s"
        } · ${nameOf(lastRecord!)}.`,
      });
    }

    return out;
  }, [
    totalSessions,
    totalPlayers,
    squadSize,
    coverage,
    untrackedPlayers,
    strategyData,
    momentData,
    weeklyDelta,
    weeklyMean,
    sinceLast,
    lastRecord,
  ]);

  /* ---------------- filter options ---------------- */

  const filterOptions = useMemo(() => {
    const uniq = (fn: (t: TrackingRecord) => string) =>
      [...new Set(tracking.map(fn).filter(Boolean))].sort();

    return {
      positions: [...new Set(players.map((p) => p.posicion).filter(Boolean))].sort(),
      coaches: uniq((t) => t.QUIEN),
      strategies: uniq((t) => t.ESTRATEGIA),
      modalities: uniq((t) => t.MODALIDAD),
      moments: uniq((t) => t.MOMENTO),
      months: [
        ...new Set(tracking.map((t) => new Date(t.FECHA).getMonth() + 1)),
      ].sort((a, b) => a - b),
      weeks: [...new Set(tracking.map((t) => getSeasonWeek(t.FECHA)))].sort(
        (a, b) => a - b
      ),
    };
  }, [players, tracking]);

  const exportCSV = () => {
    const header = [
      "Fecha",
      "Jugador",
      "Posicion",
      "Entrenador",
      "Modalidad",
      "Momento",
      "Estrategia",
      "Objetivo ofensivo",
      "Objetivo defensivo",
      "Objetivo mental",
      "Feedback",
    ];

    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const lines = feed.map((s) =>
      [
        new Date(s.FECHA).toLocaleDateString("es-ES"),
        nameOf(s),
        playerMap[s.ID_JUGADOR]?.posicion ?? "",
        s.QUIEN,
        s.MODALIDAD,
        s.MOMENTO,
        s.ESTRATEGIA,
        s.OBJETIVO_OFENSIVO,
        s.OBJETIVO_DEFENSIVO,
        s.OBJETIVO_MENTAL,
        s.FEEDBACK,
      ]
        .map(escape)
        .join(",")
    );

    const blob = new Blob([`﻿${[header.join(","), ...lines].join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "seguimiento_individual.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const filterLabel = (key: keyof Filters, value: string) => {
    if (key === "player") return playerMap[value]?.nombre ?? value;
    if (key === "month") return MONTHS[Number(value)];
    if (key === "week") return `Semana ${value}`;

    return value;
  };

  /* ------------------------------------------------------------------ */

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 min-w-0">
          <Topbar />

          <div className="px-4 md:px-8 py-6 md:py-8">
            {/* ---------------- Header ---------------- */}

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · INDIVIDUAL
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-5">
              <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
                Seguimiento Individual
              </h1>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                {totalSessions} registros
              </span>

              {sinFecha > 0 && (
                <span
                  title="La hoja los tiene sin fecha, así que no entran en las semanas, los meses ni el último registro."
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300"
                >
                  {sinFecha} sin fecha
                </span>
              )}

              {sinceLast !== null && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                  <Clock className="h-3.5 w-3.5" />
                  último hace {sinceLast}d
                </span>
              )}

              <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
            </div>

            {/* ---------------- Filters ---------------- */}

            <div className="mt-6 rounded-[24px] md:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <Select
                  label="Jugador"
                  value={filters.player}
                  onChange={(v: string) => updateFilter("player", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...players.map((p) => ({ value: p.id, label: p.nombre })),
                  ]}
                />

                <Select
                  label="Posición"
                  value={filters.position}
                  onChange={(v: string) => updateFilter("position", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.positions.map((p) => ({
                      value: p,
                      label: p,
                    })),
                  ]}
                />

                <Select
                  label="Entrenador"
                  value={filters.coach}
                  onChange={(v: string) => updateFilter("coach", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.coaches.map((c) => ({
                      value: c,
                      label: c,
                    })),
                  ]}
                />

                <Select
                  label="Estrategia"
                  value={filters.strategy}
                  onChange={(v: string) => updateFilter("strategy", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.strategies.map((s) => ({
                      value: s,
                      label: s,
                    })),
                  ]}
                />

                <Select
                  label="Modalidad"
                  value={filters.modality}
                  onChange={(v: string) => updateFilter("modality", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.modalities.map((m) => ({
                      value: m,
                      label: m,
                    })),
                  ]}
                />

                <Select
                  label="Momento"
                  value={filters.moment}
                  onChange={(v: string) => updateFilter("moment", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.moments.map((m) => ({
                      value: m,
                      label: m,
                    })),
                  ]}
                />

                <Select
                  label="Mes"
                  value={filters.month}
                  onChange={(v: string) => updateFilter("month", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.months.map((m) => ({
                      value: String(m),
                      label: MONTHS[m],
                    })),
                  ]}
                />

                <Select
                  label="Semana"
                  value={filters.week}
                  onChange={(v: string) => updateFilter("week", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.weeks.map((w) => ({
                      value: String(w),
                      label: `Semana ${w}`,
                    })),
                  ]}
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar en feedback, objetivos o jugadores…"
                    className="w-full rounded-2xl border border-white/10 bg-[#11161C] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
                  />
                </div>

                <button
                  onClick={() => {
                    setFilters(emptyFilters);
                    setSearch("");
                  }}
                  className="rounded-2xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Limpiar
                </button>
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.entries(filters) as [keyof Filters, string][])
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => updateFilter(key, "")}
                        className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                      >
                        {filterLabel(key, value)} ×
                      </button>
                    ))}

                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-300"
                    >
                      &quot;{search}&quot; ×
                    </button>
                  )}
                </div>
              )}

              {/* KPIs */}

              <div className="mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                <StatCard
                  icon={MessageSquareText}
                  title="Seguimientos"
                  value={totalSessions}
                  hint={`${withFeedback} con feedback`}
                />

                <StatCard
                  icon={Users}
                  title="Jugadores"
                  value={totalPlayers}
                  hint={`${avgPerPlayer} por jugador`}
                  accent="#6E7F99"
                />

                <StatCard
                  icon={UserCheck}
                  title="Cobertura"
                  value={`${coverage}%`}
                  hint={`${untrackedPlayers.length} sin registro`}
                  accent={coverage >= 80 ? "#10B981" : coverage >= 50 ? "#C8A96B" : "#EF4444"}
                  progress={coverage}
                />

                <StatCard
                  icon={CalendarDays}
                  title="Media semanal"
                  value={averageWeek}
                  hint={`${totalWeeks} semanas activas`}
                  accent="#4C7A67"
                  delta={weeklyDelta ?? undefined}
                />

                <StatCard
                  icon={Target}
                  title="Individualización"
                  value={`${individualShare}%`}
                  hint="modalidad individual"
                  accent="#8B5CF6"
                  progress={individualShare}
                />

                <StatCard
                  icon={Clock}
                  title="Último registro"
                  value={sinceLast !== null ? `${sinceLast}d` : "—"}
                  hint={lastRecord ? nameOf(lastRecord) : "sin datos"}
                  accent="#F97316"
                />
              </div>
            </div>

            {/* ---------------- Tabs ---------------- */}

            <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;

                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition ${
                      active
                        ? "border-[#C8A96B] bg-[#C8A96B] font-semibold text-black"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {loading && (
              <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[340px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            )}

            {!loading && totalSessions === 0 && (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <p className="text-lg font-semibold">Sin seguimientos</p>

                <p className="mt-2 text-sm text-white/50">
                  Ningún registro coincide con los filtros seleccionados.
                </p>

                <button
                  onClick={() => {
                    setFilters(emptyFilters);
                    setSearch("");
                  }}
                  className="mt-5 rounded-2xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* ================= RESUMEN ================= */}

            {!loading && totalSessions > 0 && tab === "resumen" && (
              <div className="mt-8 space-y-6">
                {insights.length > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#C8A96B]/[0.07] to-white/[0.02] p-6 md:p-7">
                    <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                      <Sparkles className="h-5 w-5 text-[#C8A96B]" />
                      Lecturas del periodo
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                      {insights.map((i, idx) => {
                        const Icon = i.icon;

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <Icon
                              className={`mt-0.5 h-4 w-4 shrink-0 ${i.tone}`}
                            />

                            <p className="text-sm leading-relaxed text-white/75">
                              {i.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Evolución semanal"
                    subtitle={`Media de ${weeklyMean} seguimientos por semana`}
                  >
                    <ChartBox>
                      <AreaChart
                        data={weeklyData}
                        onClick={(state: any) => {
                          if (!state?.activeLabel) return;

                          updateFilter(
                            "week",
                            String(state.activeLabel).replace("S", "")
                          );
                        }}
                      >
                        <defs>
                          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor={GOLD}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="100%"
                              stopColor={GOLD}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="week"
                          tick={AXIS}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis tick={AXIS} axisLine={false} tickLine={false} />

                        <Tooltip
                          content={
                            <DarkTooltip
                              rows={[["Jugadores distintos", "jugadores"]]}
                            />
                          }
                        />

                        <ReferenceLine
                          y={weeklyMean}
                          stroke="rgba(255,255,255,.3)"
                          strokeDasharray="4 4"
                        />

                        <Area
                          dataKey="value"
                          name="Seguimientos"
                          stroke={GOLD}
                          strokeWidth={3}
                          fill="url(#wGrad)"
                          dot={{ r: 4, fill: GOLD }}
                          activeDot={{ r: 7 }}
                        />
                      </AreaChart>
                    </ChartBox>
                  </Panel>

                  <Panel
                    title="Foco de los objetivos"
                    subtitle="Cuántos registros abordan cada dimensión"
                  >
                    <ChartBox>
                      <RadarChart
                        data={focusData}
                        cx="50%"
                        cy="50%"
                        outerRadius="72%"
                      >
                        <PolarGrid stroke="rgba(255,255,255,.12)" />

                        <PolarAngleAxis
                          dataKey="name"
                          tick={{ fill: "#E2E8F0", fontSize: 12 }}
                        />

                        <PolarRadiusAxis tick={false} axisLine={false} />

                        <Tooltip
                          content={
                            <DarkTooltip rows={[["% del total", "percentage"]]} />
                          }
                        />

                        <Radar
                          name="Registros"
                          dataKey="value"
                          stroke={GOLD}
                          strokeWidth={3}
                          fill={GOLD}
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ChartBox>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {focusData.map((f) => (
                        <div
                          key={f.name}
                          className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-center"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-white/40">
                            {f.name}
                          </p>

                          <p className="text-lg font-semibold text-[#C8A96B]">
                            {f.value}
                          </p>

                          <p className="text-[11px] text-white/35">
                            {f.percentage}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel
                    title="Estrategias utilizadas"
                    subtitle="Pulsa un segmento para filtrar"
                  >
                    <DonutWithLegend
                      data={strategyData}
                      active={filters.strategy}
                      onSelect={(name: string) =>
                        updateFilter(
                          "strategy",
                          filters.strategy === name ? "" : name
                        )
                      }
                    />
                  </Panel>

                  <Panel
                    title="Momento de la intervención"
                    subtitle="Cuándo se produce el contacto con el jugador"
                  >
                    <DonutWithLegend
                      data={momentData}
                      active={filters.moment}
                      onSelect={(name: string) =>
                        updateFilter(
                          "moment",
                          filters.moment === name ? "" : name
                        )
                      }
                    />
                  </Panel>
                </div>

                {untrackedPlayers.length > 0 && (
                  <Panel
                    title={`Jugadores sin seguimiento (${untrackedPlayers.length})`}
                    subtitle="Plantilla activa sin ningún registro bajo los filtros actuales"
                  >
                    <div className="flex flex-wrap gap-2.5">
                      {untrackedPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] py-1.5 pl-1.5 pr-3.5"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.nombre}
                            className="h-8 w-8 rounded-xl object-cover"
                          />

                          <div className="leading-tight">
                            <p className="text-sm font-medium">{p.nombre}</p>

                            <p className="text-[11px] text-white/40">
                              {p.posicion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            )}

            {/* ================= JUGADORES ================= */}

            {!loading && totalSessions > 0 && tab === "jugadores" && (
              <div className="mt-8 space-y-6">
                <Panel
                  title="Ranking de seguimiento por jugador"
                  subtitle="Nº de registros, semanas cubiertas y días desde el último contacto"
                >
                  <div className="space-y-2">
                    {playerChart.map((p, i) => {
                      const selected = filters.player === p.id;

                      return (
                        <button
                          key={p.id + p.name}
                          onClick={() =>
                            updateFilter("player", selected ? "" : p.id)
                          }
                          className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                            selected
                              ? "border-[#C8A96B] bg-[#C8A96B]/10"
                              : "border-white/5 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <span className="w-6 shrink-0 text-center text-xs text-white/30">
                            {i + 1}
                          </span>

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.name}
                            className="h-10 w-10 shrink-0 rounded-xl object-cover"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate text-sm font-semibold">
                                {p.name}
                              </p>

                              <span className="shrink-0 text-[11px] text-white/35">
                                {p.posicion}
                              </span>
                            </div>

                            <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-[#C8A96B]"
                                style={{
                                  width: `${
                                    (p.value / (playerChart[0]?.value || 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-[#C8A96B]">
                              {p.value}
                            </p>

                            <p className="text-[10px] text-white/35">
                              {p.percentage.toFixed(1)}%
                            </p>
                          </div>

                          <div className="hidden shrink-0 text-right sm:block">
                            <p className="text-xs text-white/60">
                              {p.semanas} sem.
                            </p>

                            <p
                              className={`text-[10px] ${
                                (p.dias ?? 0) > 14
                                  ? "text-rose-400"
                                  : "text-white/35"
                              }`}
                            >
                              hace {p.dias}d
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="Mapa de contacto · jugador × semana"
                  subtitle="Intensidad de color = nº de seguimientos esa semana"
                >
                  <div className="overflow-x-auto">
                    <div
                      className="grid min-w-[680px] gap-1"
                      style={{
                        gridTemplateColumns: `180px repeat(${heatmap.weeks.length}, minmax(28px,1fr)) 52px`,
                      }}
                    >
                      <div />

                      {heatmap.weeks.map((w) => (
                        <div
                          key={w}
                          className="pb-1 text-center text-[10px] text-white/35"
                        >
                          S{w}
                        </div>
                      ))}

                      <div className="pb-1 text-center text-[10px] text-white/35">
                        Total
                      </div>

                      {heatmap.rows.map((row) => (
                        <HeatRow
                          key={row.id + row.name}
                          row={row}
                          max={heatmap.max}
                          selected={filters.player === row.id}
                          onSelectPlayer={() =>
                            updateFilter(
                              "player",
                              filters.player === row.id ? "" : row.id
                            )
                          }
                          onSelectCell={(w: number) =>
                            updateFilter("week", String(w))
                          }
                        />
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-3 text-[11px] text-white/40">
                      <span>Menos contacto</span>

                      <div className="flex gap-1">
                        {[0.12, 0.32, 0.52, 0.72, 0.92].map((t) => (
                          <span
                            key={t}
                            className="h-3 w-7 rounded"
                            style={{ background: `rgba(200,169,107,${t})` }}
                          />
                        ))}
                      </div>

                      <span>Más contacto</span>
                    </div>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Reparto por posición"
                    subtitle="Volumen total y media por jugador de cada posición"
                  >
                    <ChartBox height={Math.max(320, positionData.length * 42)}>
                      <BarChart
                        data={positionData}
                        layout="vertical"
                        margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#CBD5E1", fontSize: 11 }}
                        />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip
                              rows={[
                                ["Jugadores", "jugadores"],
                                ["Media/jugador", "media"],
                                ["% del total", "percentage"],
                              ]}
                            />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[0, 10, 10, 0]}
                          barSize={16}
                          cursor="pointer"
                          onClick={(d: any) => {
                            const pos = d?.payload?.name;

                            if (pos)
                              updateFilter(
                                "position",
                                filters.position === pos ? "" : pos
                              );
                          }}
                        >
                          {positionData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[i % COLORS.length]}
                              opacity={
                                filters.position &&
                                filters.position !== entry.name
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="right"
                            style={{
                              fill: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>

                  <Panel
                    title="Contactos más antiguos"
                    subtitle="Jugadores con mayor tiempo sin seguimiento registrado"
                  >
                    <div className="space-y-2.5">
                      {staleContacts.map((p) => (
                        <div
                          key={p.id + p.name}
                          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.name}
                            className="h-10 w-10 rounded-xl object-cover"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {p.name}
                            </p>

                            <p className="text-xs text-white/40">
                              {p.posicion} · {p.value} seguimientos
                            </p>
                          </div>

                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${
                                (p.dias ?? 0) > 14
                                  ? "text-rose-400"
                                  : (p.dias ?? 0) > 7
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {p.dias}d
                            </p>

                            <p className="text-[10px] text-white/30">
                              {fmtFecha(p.last)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MiniCard
                    title="Jugador más seguido"
                    name={mostTrackedPlayer.name}
                    value={`${mostTrackedPlayer.value} seguimientos`}
                    tone="emerald"
                  />

                  <MiniCard
                    title="Jugador menos seguido"
                    name={leastTrackedPlayer.name}
                    value={`${leastTrackedPlayer.value} seguimientos`}
                    tone="rose"
                  />
                </div>
              </div>
            )}

            {/* ================= METODOLOGÍA ================= */}

            {!loading && totalSessions > 0 && tab === "contenidos" && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Modalidad de trabajo"
                    subtitle="Individual vs grupal"
                  >
                    <DonutWithLegend
                      data={modalityData}
                      active={filters.modality}
                      onSelect={(name: string) =>
                        updateFilter(
                          "modality",
                          filters.modality === name ? "" : name
                        )
                      }
                    />
                  </Panel>

                  <Panel
                    title="Carga de seguimiento por entrenador"
                    subtitle="Quién sostiene el contacto con los jugadores"
                  >
                    <ChartBox height={Math.max(300, coachData.length * 46)}>
                      <BarChart
                        data={coachData}
                        layout="vertical"
                        margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#CBD5E1", fontSize: 12 }}
                        />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip rows={[["% del total", "percentage"]]} />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[0, 10, 10, 0]}
                          barSize={18}
                          cursor="pointer"
                          onClick={(d: any) => {
                            const c = d?.payload?.name;

                            if (c)
                              updateFilter(
                                "coach",
                                filters.coach === c ? "" : c
                              );
                          }}
                        >
                          {coachData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[i % COLORS.length]}
                              opacity={
                                filters.coach && filters.coach !== entry.name
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="right"
                            style={{
                              fill: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>
                </div>

                <Panel
                  title="Matriz entrenador × estrategia"
                  subtitle="Qué recurso metodológico usa cada miembro del staff"
                >
                  <div className="overflow-x-auto">
                    <div
                      className="grid min-w-[560px] gap-1.5"
                      style={{
                        gridTemplateColumns: `150px repeat(${coachStrategyMatrix.strategies.length}, minmax(0,1fr))`,
                      }}
                    >
                      <div />

                      {coachStrategyMatrix.strategies.map((s) => (
                        <div
                          key={s}
                          className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/40"
                        >
                          {s}
                        </div>
                      ))}

                      {coachStrategyMatrix.rows.map((row) => (
                        <MatrixRow
                          key={row.coach}
                          row={row}
                          max={coachStrategyMatrix.max}
                          selected={filters.coach === row.coach}
                          onSelectCoach={() =>
                            updateFilter(
                              "coach",
                              filters.coach === row.coach ? "" : row.coach
                            )
                          }
                          onSelectCell={(strategy: string) => {
                            updateFilter("coach", row.coach);
                            updateFilter("strategy", strategy);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Distribución mensual"
                    subtitle="Volumen de seguimiento por mes de temporada"
                  >
                    <ChartBox>
                      <BarChart
                        data={monthlyData}
                        onClick={(state: any) => {
                          const m = state?.activePayload?.[0]?.payload?.month;

                          if (m)
                            updateFilter(
                              "month",
                              filters.month === String(m) ? "" : String(m)
                            );
                        }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis tick={AXIS} axisLine={false} tickLine={false} />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip rows={[["% del total", "percentage"]]} />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[10, 10, 0, 0]}
                        >
                          {monthlyData.map((entry) => (
                            <Cell
                              key={entry.month}
                              fill={GOLD}
                              opacity={
                                filters.month &&
                                filters.month !== String(entry.month)
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="top"
                            style={{ fill: "#94A3B8", fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>

                  <Panel
                    title="Jugadores alcanzados por semana"
                    subtitle="Amplitud del seguimiento, no sólo volumen"
                  >
                    <ChartBox>
                      <LineChart data={weeklyData}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="week" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis tick={AXIS} axisLine={false} tickLine={false} />

                        <Tooltip
                          content={
                            <DarkTooltip rows={[["Seguimientos", "value"]]} />
                          }
                        />

                        <Line
                          type="monotone"
                          dataKey="jugadores"
                          name="Jugadores distintos"
                          stroke="#4C7A67"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#4C7A67" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartBox>
                  </Panel>
                </div>
              </div>
            )}

            {/* ================= REGISTROS ================= */}

            {!loading && totalSessions > 0 && tab === "registros" && (
              <div className="mt-8 space-y-6">
                <Panel
                  title={`Registros de seguimiento (${feed.length})`}
                  subtitle="Pulsa una tarjeta para ver los objetivos y el feedback completo"
                  action={
                    <button
                      onClick={exportCSV}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar CSV
                    </button>
                  }
                >
                  <div className="space-y-3">
                    {feed.slice(0, feedLimit).map((s) => {
                      const open = expanded === s.ID_REGISTRO;
                      const jugador = playerMap[s.ID_JUGADOR];

                      return (
                        <div
                          key={s.ID_REGISTRO}
                          className={`rounded-2xl border transition ${
                            open
                              ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.05]"
                              : "border-white/5 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <button
                            onClick={() =>
                              setExpanded(open ? null : s.ID_REGISTRO)
                            }
                            className="flex w-full items-center gap-3 p-3 text-left"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={jugador?.foto ?? PLAYER_PHOTO_FALLBACK}
                              alt={nameOf(s)}
                              className="h-11 w-11 shrink-0 rounded-xl object-cover"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {nameOf(s)}
                                </p>

                                <span className="text-[11px] text-white/35">
                                  {jugador?.posicion}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Tag icon={CalendarDays}>
                                  {fmtFecha(s.FECHA)}
                                </Tag>

                                <Tag icon={Users}>{s.QUIEN}</Tag>

                                <Tag icon={Video}>{s.ESTRATEGIA}</Tag>

                                <Tag icon={Target}>{s.MODALIDAD}</Tag>

                                <Tag icon={Clock}>{s.MOMENTO}</Tag>
                              </div>
                            </div>

                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-white/40 transition ${
                                open ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {open && (
                            <div className="border-t border-white/5 p-4 pt-3.5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Objective
                                  label="Objetivo ofensivo"
                                  color="#C8A96B"
                                  text={s.OBJETIVO_OFENSIVO}
                                />

                                <Objective
                                  label="Objetivo defensivo"
                                  color="#3B82F6"
                                  text={s.OBJETIVO_DEFENSIVO}
                                />

                                <Objective
                                  label="Objetivo mental"
                                  color="#8B5CF6"
                                  text={s.OBJETIVO_MENTAL}
                                />
                              </div>

                              {clean(s.FEEDBACK) && (
                                <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
                                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                                    <MessageSquareText className="h-3 w-3" />
                                    Feedback
                                  </p>

                                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
                                    {s.FEEDBACK}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {feed.length > feedLimit && (
                    <button
                      onClick={() => setFeedLimit((n) => n + 20)}
                      className="mt-5 w-full rounded-2xl border border-white/10 py-3 text-sm text-white/60 transition hover:border-[#C8A96B]/40 hover:text-white"
                    >
                      Ver más ({feed.length - feedLimit} restantes)
                    </button>
                  )}
                </Panel>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

function Panel({ title, subtitle, action, children }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#121922] p-4 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold leading-tight">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-xs md:text-sm text-white/40">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

function ChartBox({ children, height }: any) {
  return (
    <div className="w-full" style={{ height: height ?? 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  accent = GOLD,
  progress,
  delta,
}: any) {
  const showDelta = typeof delta === "number" && delta !== 0;

  const DeltaIcon = !showDelta ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          {title}
        </p>

        <Icon
          className="h-4 w-4 opacity-60"
          style={{ color: chipInk(accent) }}
        />
      </div>

      <p
        className="mt-2.5 text-2xl md:text-[28px] font-semibold leading-none"
        style={{ color: chipInk(accent) }}
      >
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {hint && (
          <span className="truncate text-[11px] text-white/40">{hint}</span>
        )}

        {showDelta && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            <DeltaIcon className="h-2.5 w-2.5" />
            {Math.abs(delta)}
          </span>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: accent,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#11161C] px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DonutWithLegend({ data, active, onSelect }: any) {
  const total = data.reduce((a: number, b: any) => a + b.value, 0);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="relative h-[240px] w-full lg:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
              cursor="pointer"
              onClick={(d: any) => {
                const name = d?.payload?.name ?? d?.name;

                if (name) onSelect(name);
              }}
            >
              {data.map((item: any, i: number) => (
                <Cell
                  key={item.name}
                  fill={COLORS[i % COLORS.length]}
                  opacity={active && active !== item.name ? 0.25 : 1}
                />
              ))}
            </Pie>

            <Tooltip content={<DarkTooltip rows={[["% del total", "percentage"]]} />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-[#C8A96B]">{total}</p>

          <p className="text-[10px] uppercase tracking-wider text-white/35">
            registros
          </p>
        </div>
      </div>

      <div className="w-full space-y-1.5 lg:w-1/2">
        {data.map((item: any, i: number) => (
          <button
            key={item.name}
            onClick={() => onSelect(item.name)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />

            <span className="flex-1 truncate text-sm text-white/80">
              {item.name}
            </span>

            <span className="text-sm font-semibold">{item.value}</span>

            <span className="w-12 text-right text-xs text-white/40">
              {item.percentage}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DarkTooltip({ active, payload, label, rows }: any) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload ?? {};

  return (
    <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-2xl">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      )}

      {payload[0]?.name && label === undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">
          {d.name ?? payload[0].name}
        </p>
      )}

      <div className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <p
            key={i}
            className="text-xs"
            style={{ color: chipInk(p.color ?? "#CBD5E1") }}
          >
            {p.name}: <span className="font-semibold">{p.value}</span>
          </p>
        ))}

        {rows?.map(([rowLabel, key]: [string, string]) =>
          d[key] !== undefined && d[key] !== "" ? (
            <p key={key} className="text-xs text-white/50">
              {rowLabel}: <span className="font-semibold">{d[key]}</span>
            </p>
          ) : null
        )}
      </div>
    </div>
  );
}

function HeatRow({ row, max, selected, onSelectPlayer, onSelectCell }: any) {
  return (
    <>
      <button
        onClick={onSelectPlayer}
        className={`truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
          selected
            ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
            : "border-white/5 bg-white/[0.02] text-white/75 hover:border-white/20"
        }`}
        title={row.name}
      >
        {row.name}
      </button>

      {row.cells.map((c: any) => {
        const t = max ? c.count / max : 0;

        return (
          <button
            key={c.week}
            onClick={() => c.count > 0 && onSelectCell(c.week)}
            disabled={!c.count}
            title={`${row.name} · S${c.week}: ${c.count} seguimiento${
              c.count === 1 ? "" : "s"
            }`}
            className="flex h-7 items-center justify-center rounded-md border border-white/5 text-[10px] font-semibold transition hover:border-white/30 disabled:hover:border-white/5"
            style={{
              background: c.count
                ? `rgba(200,169,107,${0.12 + t * 0.8})`
                : "rgba(255,255,255,0.02)",
              color: t > 0.5 ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb) / .5)",
            }}
          >
            {c.count || ""}
          </button>
        );
      })}

      <div className="flex h-7 items-center justify-center rounded-md bg-white/[0.04] text-xs font-bold text-[#C8A96B]">
        {row.total}
      </div>
    </>
  );
}

function MatrixRow({ row, max, selected, onSelectCoach, onSelectCell }: any) {
  return (
    <>
      <button
        onClick={onSelectCoach}
        className={`flex flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? "border-[#C8A96B] bg-[#C8A96B]/10"
            : "border-white/5 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <span className="truncate text-xs font-semibold">{row.coach}</span>

        <span className="text-[10px] text-white/35">{row.total} registros</span>
      </button>

      {row.cells.map((c: any) => {
        const t = max ? c.count / max : 0;

        return (
          <button
            key={c.strategy}
            onClick={() => c.count > 0 && onSelectCell(c.strategy)}
            disabled={!c.count}
            className="flex h-[52px] items-center justify-center rounded-xl border border-white/5 text-sm font-semibold transition hover:border-white/30 disabled:hover:border-white/5"
            style={{
              background: c.count
                ? `rgba(200,169,107,${0.12 + t * 0.8})`
                : "rgba(255,255,255,0.02)",
              color: t > 0.5 ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb) / .55)",
            }}
          >
            {c.count || "·"}
          </button>
        );
      })}
    </>
  );
}

function Tag({ icon: Icon, children }: any) {
  if (!children) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}

function Objective({ label, color, text }: any) {
  const value = clean(text);

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${color}33`, background: `${color}0D` }}
    >
      <p
        className="mb-1.5 text-[10px] uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </p>

      <p className="text-sm leading-relaxed text-white/75">
        {value || <span className="text-white/25">Sin registrar</span>}
      </p>
    </div>
  );
}

function MiniCard({ title, name, value, tone }: any) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400",
    rose: "border-rose-400/20 bg-rose-400/[0.06] text-rose-400",
  };

  return (
    <div className={`rounded-3xl border p-6 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wider text-white/45">{title}</p>

      <h3 className="mt-3 text-2xl font-bold">{name}</h3>

      <p className="mt-1.5 text-sm text-white/50">{value}</p>
    </div>
  );
}
