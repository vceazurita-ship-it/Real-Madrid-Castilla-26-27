"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { cn } from "@/lib/utils";

import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Goal,
  House,
  LoaderCircle,
  Minus,
  Plane,
  Play,
  RotateCcw,
  Search,
  Target,
  Trophy,
  Video,
  VideoOff,
  X,
  XCircle,
} from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=953333469&single=true&output=csv";

type MatchRow = {
  microciclo: string;
  fecha: string;
  resultado: string;
  partido: string;
  enlace: string;
};

type Outcome = "W" | "D" | "L";

type Match = {
  id: string;
  microciclo: string;
  fecha: string;
  partido: string;
  resultado: string;
  home: string;
  away: string;
  /** true cuando el Castilla juega en casa */
  isHome: boolean;
  opponent: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** goles a favor / en contra del Castilla */
  gf: number | null;
  ga: number | null;
  outcome: Outcome | null;
  date: Date | null;
  link: string;
  embed: string;
};

type Metrics = {
  total: number;
  played: number;
  withVideo: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  winPct: number;
  drawPct: number;
  lossPct: number;
  avgFor: string;
  avgAgainst: string;
  lastFive: Match[];
};

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Separa "Local - Visitante" y detecta de qué lado juega el Castilla.
 * Los nombres pueden contener guiones, así que sólo partimos por " - ".
 */
function splitSides(partido: string) {
  const raw = (partido ?? "").trim();
  const parts = raw.split(/\s+-\s+/);

  if (parts.length < 2) {
    return { home: raw, away: "", isHome: true, opponent: raw };
  }

  const home = parts[0].trim();
  const away = parts.slice(1).join(" - ").trim();

  const homeIsRM = /castilla/i.test(home);
  const awayIsRM = /castilla/i.test(away);

  // Si ningún lado dice "Castilla", asumimos local (formato habitual del CSV).
  const isHome = homeIsRM || !awayIsRM;

  return { home, away, isHome, opponent: isHome ? away : home };
}

function parseScore(resultado: string) {
  const m = (resultado ?? "").match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;

  return { home: Number(m[1]), away: Number(m[2]) };
}

/** dd/mm/yyyy (admite también - o . como separador y años de 2 dígitos) */
function parseDate(fecha: string) {
  const m = (fecha ?? "")
    .trim()
    .match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);

  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);

  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(match: Match) {
  return match.date
    ? dateFormatter.format(match.date)
    : match.fecha || "Fecha por confirmar";
}

/** Convierte enlaces de Drive / YouTube / Docs en URLs incrustables. */
function toEmbedUrl(url: string) {
  if (!url) return "";

  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`;

  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
  if (driveOpen) return `https://drive.google.com/file/d/${driveOpen[1]}/preview`;

  const youtube = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const gdoc = url.match(
    /docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([^/?#]+)/
  );
  if (gdoc) return `https://docs.google.com/${gdoc[1]}/d/${gdoc[2]}/preview`;

  return url;
}

function toMatch(row: MatchRow, index: number): Match {
  const sides = splitSides(row.partido);
  const score = parseScore(row.resultado);

  const gf = score ? (sides.isHome ? score.home : score.away) : null;
  const ga = score ? (sides.isHome ? score.away : score.home) : null;

  const outcome: Outcome | null =
    gf === null || ga === null ? null : gf > ga ? "W" : gf < ga ? "L" : "D";

  const link = (row.enlace ?? "").trim();

  return {
    id: `${index}-${row.partido}-${row.fecha}`,
    microciclo: (row.microciclo ?? "").trim() || "Sin microciclo",
    fecha: (row.fecha ?? "").trim(),
    partido: (row.partido ?? "").trim(),
    resultado: (row.resultado ?? "").trim(),
    ...sides,
    homeGoals: score?.home ?? null,
    awayGoals: score?.away ?? null,
    gf,
    ga,
    outcome,
    date: parseDate(row.fecha),
    link,
    embed: toEmbedUrl(link),
  };
}

/* ------------------------------------------------------------------ */
/* Tokens de resultado                                                 */
/* ------------------------------------------------------------------ */

const OUTCOME = {
  W: {
    short: "V",
    label: "Victoria",
    chip: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    stripe: "bg-emerald-400/70",
  },
  D: {
    short: "E",
    label: "Empate",
    chip: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    stripe: "bg-amber-400/70",
  },
  L: {
    short: "D",
    label: "Derrota",
    chip: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    stripe: "bg-rose-400/70",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [search, setSearch] = useState("");
  const [selectedMicro, setSelectedMicro] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | Outcome>("ALL");
  const [onlyWithVideo, setOnlyWithVideo] = useState(false);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* Los escudos de los rivales, para el marcador de cada tarjeta. */
  const escudoDe = useEscudos();

  useEffect(() => {
    const controller = new AbortController();

    fetch(CSV_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((csv) => {
        const parsed = Papa.parse<MatchRow>(csv, {
          header: true,
          skipEmptyLines: true,
        });

        setMatches(
          parsed.data
            .filter((row) => (row?.partido ?? "").trim().length > 0)
            .map(toMatch)
        );

        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        console.error(error);
        setStatus("error");
      });

    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const micros = useMemo(() => {
    const byMicro = new Map<string, Match[]>();

    matches.forEach((m) => {
      byMicro.set(m.microciclo, [...(byMicro.get(m.microciclo) ?? []), m]);
    });

    const list = Array.from(byMicro.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }))
      .map(([value, items]) => ({
        value,
        label:
          items.length === 1
            ? `${value} · ${items[0].opponent}`
            : `${value} · ${items.length} partidos`,
      }));

    return [
      { value: "ALL", label: `Todos los microciclos (${matches.length})` },
      ...list,
    ];
  }, [matches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = matches.filter((m) => {
      if (selectedMicro !== "ALL" && m.microciclo !== selectedMicro) return false;
      if (outcomeFilter !== "ALL" && m.outcome !== outcomeFilter) return false;
      if (onlyWithVideo && !m.link) return false;

      if (!q) return true;

      return (
        m.partido.toLowerCase().includes(q) ||
        m.opponent.toLowerCase().includes(q) ||
        m.microciclo.toLowerCase().includes(q) ||
        m.fecha.toLowerCase().includes(q)
      );
    });

    // Los partidos sin fecha válida van al final.
    return list.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;

      const diff = a.date.getTime() - b.date.getTime();
      return sortDir === "desc" ? -diff : diff;
    });
  }, [matches, search, selectedMicro, outcomeFilter, onlyWithVideo, sortDir]);

  const metrics = useMemo<Metrics>(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let played = 0;
    let withVideo = 0;

    filtered.forEach((m) => {
      if (m.link) withVideo++;
      if (m.outcome === null || m.gf === null || m.ga === null) return;

      played++;
      goalsFor += m.gf;
      goalsAgainst += m.ga;

      if (m.outcome === "W") wins++;
      else if (m.outcome === "L") losses++;
      else draws++;
    });

    // La racha siempre se lee del más reciente al más antiguo.
    const lastFive = [...filtered]
      .filter((m) => m.outcome !== null)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .slice(0, 5);

    const pct = (n: number) => (played > 0 ? Math.round((n / played) * 100) : 0);

    return {
      total: filtered.length,
      played,
      withVideo,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      diff: goalsFor - goalsAgainst,
      winPct: pct(wins),
      drawPct: pct(draws),
      lossPct: pct(losses),
      avgFor: played > 0 ? (goalsFor / played).toFixed(1) : "0.0",
      avgAgainst: played > 0 ? (goalsAgainst / played).toFixed(1) : "0.0",
      lastFive,
    };
  }, [filtered]);

  const hasFilters =
    search.trim().length > 0 ||
    selectedMicro !== "ALL" ||
    outcomeFilter !== "ALL" ||
    onlyWithVideo;

  const resetFilters = () => {
    setSearch("");
    setSelectedMicro("ALL");
    setOutcomeFilter("ALL");
    setOnlyWithVideo(false);
  };

  const selected = openIndex !== null ? filtered[openIndex] ?? null : null;

  const goTo = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;

        const next = current + delta;
        return next < 0 || next > filtered.length - 1 ? current : next;
      });
    },
    [filtered.length]
  );

  // Esc para cerrar, flechas para navegar y bloqueo del scroll de fondo.
  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      else if (e.key === "ArrowRight") goTo(1);
      else if (e.key === "ArrowLeft") goTo(-1);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, goTo]);

  return (
    <>
      <div className="flex min-h-screen bg-[#0B0F14] text-white">
        <Sidebar />

        <main className="min-w-0 flex-1">
          <Topbar />

          <div className="px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
            {/* HEADER */}
            <header className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Metodología
              </p>

              <div className="mt-4 flex items-center gap-5">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Vídeo Análisis de Partidos
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>

              <p className="mt-3 max-w-2xl text-sm text-white/55">
                Los vídeos de análisis de cada partido ya jugado, microciclo a
                microciclo. No es la previa del próximo rival —eso es
                «Preparación de Partido»—: aquí está el material de vídeo de la
                temporada.
              </p>
            </header>

            {/* MÉTRICAS */}
            <MetricsPanel metrics={metrics} />

            {/* FILTROS */}
            <div className="sticky top-20 z-20 -mx-4 mt-8 border-y border-white/[0.08] bg-[#0B0F14]/90 px-4 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8 md:top-24">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar rival, partido, microciclo o fecha…"
                    aria-label="Buscar partido"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#C8A96B]/50 focus:bg-white/[0.05]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={selectedMicro}
                    onChange={(e) => setSelectedMicro(e.target.value)}
                    aria-label="Filtrar por microciclo"
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-4 pr-10 text-sm text-white outline-none transition focus:border-[#C8A96B]/50 lg:w-[300px] [&>option]:bg-[#11161C]"
                  >
                    {micros.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <ChevronRight
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-white/35"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title="Cambiar el orden por fecha"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:border-white/25 hover:text-white"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortDir === "desc" ? "Más recientes" : "Más antiguos"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ["ALL", "Todos"],
                    ["W", "Victorias"],
                    ["D", "Empates"],
                    ["L", "Derrotas"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOutcomeFilter(value)}
                    aria-pressed={outcomeFilter === value}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                      outcomeFilter === value
                        ? value === "ALL"
                          ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]"
                          : OUTCOME[value].chip
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setOnlyWithVideo((v) => !v)}
                  aria-pressed={onlyWithVideo}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    onlyWithVideo
                      ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
                  )}
                >
                  <Video className="h-3.5 w-3.5" />
                  Solo con vídeo
                </button>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                )}

                <span className="ml-auto text-xs text-white/45">
                  <span className="font-semibold text-white">
                    {filtered.length}
                  </span>{" "}
                  {filtered.length === 1 ? "partido" : "partidos"} ·{" "}
                  {metrics.withVideo} con vídeo
                </span>
              </div>
            </div>

            {/* LISTADO */}
            <div className="mt-8">
              {status === "loading" && <SkeletonGrid />}

              {status === "error" && (
                <EmptyState
                  icon={<XCircle className="h-6 w-6" />}
                  title="No se han podido cargar los partidos"
                  description="Revisa la conexión o el acceso a la hoja de cálculo e inténtalo de nuevo."
                  action={
                    <button
                      type="button"
                      onClick={retry}
                      className="rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Reintentar
                    </button>
                  }
                />
              )}

              {status === "ready" && filtered.length === 0 && (
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title={
                    matches.length === 0
                      ? "Todavía no hay partidos publicados"
                      : "Ningún partido coincide con los filtros"
                  }
                  description={
                    matches.length === 0
                      ? "Los vídeos de análisis aparecerán aquí en cuanto se añadan a la hoja de la temporada."
                      : "Prueba a ampliar la búsqueda o restablece los filtros activos."
                  }
                  action={
                    hasFilters ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition hover:border-[#C8A96B]/50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Limpiar filtros
                      </button>
                    ) : null
                  }
                />
              )}

              {status === "ready" && filtered.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((match, index) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      escudoDe={escudoDe}
                      onOpen={() => setOpenIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {selected && (
        <MatchModal
          match={selected}
          position={{ index: openIndex ?? 0, total: filtered.length }}
          onClose={() => setOpenIndex(null)}
          onPrev={() => goTo(-1)}
          onNext={() => goTo(1)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Métricas                                                            */
/* ------------------------------------------------------------------ */

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          title="Partidos"
          value={metrics.total}
          hint={`${metrics.played} disputados`}
          icon={<Video className="h-4 w-4" />}
        />

        <Stat
          title="Victorias"
          value={metrics.wins}
          hint={`${metrics.winPct}% de los disputados`}
          icon={<Trophy className="h-4 w-4" />}
          accent="text-emerald-400"
        />

        <Stat
          title="Empates"
          value={metrics.draws}
          hint={`${metrics.drawPct}% de los disputados`}
          icon={<Minus className="h-4 w-4" />}
          accent="text-amber-400"
        />

        <Stat
          title="Derrotas"
          value={metrics.losses}
          hint={`${metrics.lossPct}% de los disputados`}
          icon={<XCircle className="h-4 w-4" />}
          accent="text-rose-400"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          title="Goles a favor"
          value={metrics.goalsFor}
          hint={`${metrics.avgFor} por partido`}
          icon={<Goal className="h-4 w-4" />}
        />

        <Stat
          title="Goles en contra"
          value={metrics.goalsAgainst}
          hint={`${metrics.avgAgainst} por partido`}
          icon={<Target className="h-4 w-4" />}
        />

        <Stat
          title="Diferencia"
          value={`${metrics.diff > 0 ? "+" : ""}${metrics.diff}`}
          hint="Saldo goleador"
          accent={
            metrics.diff > 0
              ? "text-emerald-400"
              : metrics.diff < 0
              ? "text-rose-400"
              : undefined
          }
        />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Últimos 5
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {metrics.lastFive.length === 0 && (
              <span className="text-sm text-white/35">Sin datos</span>
            )}

            {metrics.lastFive.map((m) => {
              const token = OUTCOME[m.outcome as Outcome];

              return (
                <span
                  key={m.id}
                  title={`${m.partido} · ${m.resultado} · ${formatDate(m)}`}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold",
                    token.chip
                  )}
                >
                  {token.short}
                </span>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-white/35">
            Del más reciente al más antiguo
          </p>
        </div>
      </div>

      {metrics.played > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/45">
            <span>Rendimiento</span>

            <span className="text-white/70">
              <span className="font-semibold text-[#C8A96B]">
                {metrics.winPct}%
              </span>{" "}
              de victorias
            </span>
          </div>

          <div
            className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
            role="img"
            aria-label={`${metrics.wins} victorias, ${metrics.draws} empates, ${metrics.losses} derrotas`}
          >
            <div
              className="bg-emerald-400 transition-all"
              style={{ width: `${metrics.winPct}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${metrics.drawPct}%` }}
            />
            <div
              className="bg-rose-400 transition-all"
              style={{ width: `${metrics.lossPct}%` }}
            />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-white/50">
            <Legend color="bg-emerald-400" label={`${metrics.wins} V`} />
            <Legend color="bg-amber-400" label={`${metrics.draws} E`} />
            <Legend color="bg-rose-400" label={`${metrics.losses} D`} />
          </div>
        </div>
      )}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function Stat({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
          {title}
        </p>

        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C8A96B]/10 text-[#C8A96B]">
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-3 text-3xl font-semibold tabular-nums sm:text-4xl",
          accent
        )}
      >
        {value}
      </p>

      {hint && <p className="mt-1 text-[11px] text-white/35">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta de partido                                                  */
/* ------------------------------------------------------------------ */

function MatchCard({
  match,
  escudoDe,
  onOpen,
}: {
  match: Match;
  escudoDe: (team: string) => string | undefined;
  onOpen: () => void;
}) {
  const token = match.outcome ? OUTCOME[match.outcome] : null;
  const hasVideo = Boolean(match.link);

  const homeWins =
    match.homeGoals !== null &&
    match.awayGoals !== null &&
    match.homeGoals > match.awayGoals;

  const awayWins =
    match.homeGoals !== null &&
    match.awayGoals !== null &&
    match.awayGoals > match.homeGoals;

  // Toda la tarjeta es clicable cuando hay vídeo; si no, es informativa.
  const Wrapper = hasVideo ? "button" : "div";

  return (
    <Wrapper
      {...(hasVideo ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left transition",
        hasVideo &&
          "hover:border-[#C8A96B]/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F14]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          token ? token.stripe : "bg-white/15"
        )}
      />

      <span className="block p-5 pl-6">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-[#C8A96B]/12 px-3 py-1 text-[11px] font-medium text-[#C8A96B]">
            {match.microciclo}
          </span>

          <span
            className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/45"
            title={match.isHome ? "Partido en casa" : "Partido fuera"}
          >
            {match.isHome ? (
              <House className="h-3.5 w-3.5" />
            ) : (
              <Plane className="h-3.5 w-3.5" />
            )}
            {match.isHome ? "Casa" : "Fuera"}
          </span>
        </span>

        {/* Marcador */}
        <span className="mt-4 block space-y-1.5">
          <TeamRow
            name={match.home}
            goals={match.homeGoals}
            isRM={match.isHome}
            isWinner={homeWins}
            escudo={escudoDe(match.home)}
          />

          <TeamRow
            name={match.away}
            goals={match.awayGoals}
            isRM={!match.isHome}
            isWinner={awayWins}
            escudo={escudoDe(match.away)}
          />
        </span>

        <span className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-white/45">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatDate(match)}</span>
          </span>

          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              token
                ? token.chip
                : "border-white/10 bg-white/[0.03] text-white/45"
            )}
          >
            {token ? token.label : "Sin resultado"}
          </span>
        </span>

        {hasVideo ? (
          <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-black transition group-hover:opacity-90">
            <Play className="h-4 w-4" />
            Ver vídeo análisis
          </span>
        ) : (
          <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white/35">
            <VideoOff className="h-4 w-4" />
            Vídeo no disponible
          </span>
        )}
      </span>
    </Wrapper>
  );
}

function TeamRow({
  name,
  goals,
  isRM,
  isWinner,
  escudo,
}: {
  name: string;
  goals: number | null;
  isRM: boolean;
  isWinner: boolean;
  /** El del rival, cuando se conoce; el nuestro es el del propio menú. */
  escudo?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      {/* El escudo hace de marca de quién es quién: antes era un punto dorado
          en nuestra línea, y con dos nombres largos costaba leer el marcador. */}
      <EscudoEquipo
        nombre={name}
        escudo={isRM ? "/logo.png" : escudo}
        lado={22}
        className={isRM ? "border-[#C8A96B]/35" : ""}
      />

      <span
        title={name}
        className={cn(
          "min-w-0 flex-1 truncate text-[15px]",
          isWinner
            ? "font-semibold text-white"
            : isRM
            ? "text-white/80"
            : "text-white/60"
        )}
      >
        {name || "—"}
      </span>

      <span
        className={cn(
          "shrink-0 text-lg font-bold tabular-nums",
          isWinner ? "text-[#C8A96B]" : "text-white/50"
        )}
      >
        {goals ?? "–"}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function MatchModal({
  match,
  position,
  onClose,
  onPrev,
  onNext,
}: {
  match: Match;
  position: { index: number; total: number };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const token = match.outcome ? OUTCOME[match.outcome] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vídeo análisis: ${match.partido}`}
      className="modal-veil fixed inset-0 z-[99999] flex flex-col p-3 backdrop-blur-sm sm:p-6 lg:p-10"
    >
      {/* Clic fuera para cerrar */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161C] shadow-2xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#C8A96B]/12 px-3 py-1 text-[11px] font-medium text-[#C8A96B]">
                {match.microciclo}
              </span>

              <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                {match.isHome ? (
                  <House className="h-3.5 w-3.5" />
                ) : (
                  <Plane className="h-3.5 w-3.5" />
                )}
                {match.isHome ? "Casa" : "Fuera"}
              </span>

              {token && (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    token.chip
                  )}
                >
                  {token.label}
                </span>
              )}
            </div>

            <h2 className="mt-2.5 truncate text-xl font-semibold sm:text-2xl">
              {match.partido}
            </h2>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-white/50">
              <span className="font-semibold text-[#C8A96B]">
                {match.resultado || "Sin resultado"}
              </span>
              <span aria-hidden>·</span>
              <span>{formatDate(match)}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs tabular-nums text-white/40 sm:block">
              {position.index + 1} / {position.total}
            </span>

            <IconButton
              label="Partido anterior"
              onClick={onPrev}
              disabled={position.index === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>

            <IconButton
              label="Partido siguiente"
              onClick={onNext}
              disabled={position.index >= position.total - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>

            {match.link && (
              <a
                href={match.link}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en una pestaña nueva"
                className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Abrir</span>
              </a>
            )}

            <IconButton label="Cerrar" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-black/30">
          {match.embed ? (
            <iframe
              key={match.embed}
              src={match.embed}
              title={`Vídeo análisis: ${match.partido}`}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <VideoOff className="mx-auto h-8 w-8 text-white/25" />

                <p className="mt-3 font-medium text-white/70">
                  Sin vídeo asociado
                </p>

                <p className="mt-1 text-sm text-white/40">
                  Este partido aún no tiene un plan enlazado en la hoja de la
                  temporada.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="shrink-0 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/30 sm:px-6">
          Usa ← → para cambiar de partido · Esc para cerrar
        </p>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-white/70"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Estados                                                             */
/* ------------------------------------------------------------------ */

function SkeletonGrid() {
  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-sm text-white/40">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Cargando partidos…
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[248px] animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.03]"
          />
        ))}
      </div>
    </>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-white/40">
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-semibold">{title}</h3>

      <p className="mt-2 max-w-sm text-sm text-white/45">{description}</p>

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
