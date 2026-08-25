"use client";

import { chipInk } from "@/lib/theme";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Play,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import Papa from "papaparse";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=970113485&single=true&output=csv";

const VIDEO_ID = "1pKrNKJwbiXjsKP4cJ8ROE-2E8-PlLyi8";
const VIDEO_URL = `https://drive.google.com/file/d/${VIDEO_ID}/view`;
const VIDEO_EMBED = `https://drive.google.com/file/d/${VIDEO_ID}/preview`;

type MetricKey = "ea" | "ie" | "ia" | "ee";

type Player = {
  posicion: string;
  jugador: string;
} & Record<MetricKey, number>;

/* Las cuatro dimensiones atencionales del modelo emocional.
   El orden define el recorrido del radar y se reutiliza en la leyenda. */
const AXES: {
  key: MetricKey;
  code: string;
  label: string;
  detail: string;
  moment: string;
}[] = [
  {
    key: "ea",
    code: "EA",
    label: "Externo · Amplio",
    detail: "Observación / lectura (qué ocurre)",
    moment: "Antes de intervenir",
  },
  {
    key: "ie",
    code: "IE",
    label: "Interno · Estrecho",
    detail: "Control emocional (qué siento)",
    moment: "Adversidad",
  },
  {
    key: "ia",
    code: "IA",
    label: "Interno · Amplio",
    detail: "Análisis / reflexión (qué hacer)",
    moment: "Juego parado",
  },
  {
    key: "ee",
    code: "EE",
    label: "Externo · Estrecho",
    detail: "Ejecución de acción (1v1)",
    moment: "Participación",
  },
];

const SERIES_COLORS = ["#36DAFF", "#B66BFF", "#62E8FF", "#D17DFF"];

/* Escala cromática compartida: el mismo valor se lee siempre con el mismo
   color, tanto en los paneles como en la cabecera. */
const SCALE = [
  { min: 8.5, tone: "#3BEA9A", label: "ÉLITE" },
  { min: 7.5, tone: "#36DAFF", label: "ALTA" },
  { min: 6.5, tone: "#8D7CFF", label: "MEDIA" },
  { min: 0, tone: "#FFB84D", label: "MEJORABLE" },
];

/* Composición por defecto de cada panel. Si un jugador no está en el CSV
   simplemente se ignora, así la página nunca queda vacía. */
const DEFAULT_GROUPS = {
  leftSide: ["Diego Aguado", "Alexis Ciria"],
  defense: ["Diego Aguado", "Mario Rivas", "Joan Martínez", "Fortea"],
  rightSide: ["Fortea", "Yáñez"],
  midfield: ["Cestero", "Pol Fortuny"],
  strikers: ["Rachad", "Pol Fortuny"],
} as const;

type GroupKey = keyof typeof DEFAULT_GROUPS;

const EMPTY_GROUPS: Record<GroupKey, string[]> = {
  leftSide: [],
  defense: [],
  rightSide: [],
  midfield: [],
  strikers: [],
};

function num(v?: string) {
  return Number(String(v || "").replace(",", ".")) || 0;
}

function parseCSV(text: string): Player[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .map((r) => ({
      posicion: r[0]?.trim() || "",
      jugador: r[1]?.trim() || "",
      ea: num(r[2]),
      ie: num(r[3]),
      ia: num(r[4]),
      ee: num(r[5]),
    }))
    .filter((r) => r.jugador && !isHiddenPlayer(r.jugador));
}

function average(player: Player) {
  return AXES.reduce((acc, axis) => acc + player[axis.key], 0) / AXES.length;
}

function bandFor(score: number) {
  return SCALE.find((band) => score >= band.min) ?? SCALE[SCALE.length - 1];
}

function toneFor(score: number) {
  return bandFor(score).tone;
}

function labelFor(score: number) {
  return bandFor(score).label;
}

/* Comparación tolerante a acentos para el buscador de jugadores. */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function EmotionPage() {
  const videoRef = useRef<HTMLDivElement | null>(null);

  const [rows, setRows] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showTeamAverage, setShowTeamAverage] = useState(true);

  const [groups, setGroups] = useState<Record<GroupKey, string[]>>(EMPTY_GROUPS);

  /* Cambiar la clave relanza la descarga: así el botón de reintento
     no necesita duplicar la lógica de carga. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch(CSV_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((t) => {
        if (cancelled) return;

        const parsed = parseCSV(t);
        const known = new Set(parsed.map((p) => p.jugador));

        setRows(parsed);

        setGroups({
          leftSide: DEFAULT_GROUPS.leftSide.filter((n) => known.has(n)),
          defense: DEFAULT_GROUPS.defense.filter((n) => known.has(n)),
          rightSide: DEFAULT_GROUPS.rightSide.filter((n) => known.has(n)),
          midfield: DEFAULT_GROUPS.midfield.filter((n) => known.has(n)),
          strikers: DEFAULT_GROUPS.strikers.filter((n) => known.has(n)),
        });

        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(false);
    setReloadKey((k) => k + 1);
  };

  const names = useMemo(() => rows.map((r) => r.jugador), [rows]);

  const playersByName = useMemo(() => {
    const map = new Map<string, Player>();
    rows.forEach((r) => map.set(r.jugador, r));
    return map;
  }, [rows]);

  const getPlayer = useCallback(
    (name: string) => playersByName.get(name),
    [playersByName]
  );

  /* Media de la plantilla por eje: línea de referencia en cada radar. */
  const teamAverage = useMemo(() => {
    if (rows.length === 0) return null;

    return AXES.reduce(
      (acc, axis) => {
        acc[axis.key] =
          rows.reduce((sum, r) => sum + r[axis.key], 0) / rows.length;
        return acc;
      },
      {} as Record<MetricKey, number>
    );
  }, [rows]);

  const teamScore = useMemo(
    () =>
      rows.length === 0
        ? 0
        : rows.reduce((acc, r) => acc + average(r), 0) / rows.length,
    [rows]
  );

  /* Ejes más fuerte y más débil del grupo: lectura rápida para el cuerpo técnico. */
  const axisRanking = useMemo(() => {
    if (!teamAverage) return null;

    const sorted = [...AXES].sort(
      (a, b) => teamAverage[b.key] - teamAverage[a.key]
    );

    return { top: sorted[0], bottom: sorted[sorted.length - 1] };
  }, [teamAverage]);

  const setGroup = useCallback((key: GroupKey, value: string[]) => {
    setGroups((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetGroups = useCallback(() => {
    const known = new Set(names);

    setGroups({
      leftSide: DEFAULT_GROUPS.leftSide.filter((n) => known.has(n)),
      defense: DEFAULT_GROUPS.defense.filter((n) => known.has(n)),
      rightSide: DEFAULT_GROUPS.rightSide.filter((n) => known.has(n)),
      midfield: DEFAULT_GROUPS.midfield.filter((n) => known.has(n)),
      strikers: DEFAULT_GROUPS.strikers.filter((n) => known.has(n)),
    });
  }, [names]);

  const openVideo = () => {
    if (window.innerWidth < 1024) {
      window.open(VIDEO_URL, "_blank");
      return;
    }

    videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const panelProps = (key: GroupKey) => ({
    players: names,
    selected: groups[key],
    onChange: (value: string[]) => setGroup(key, value),
    getPlayer,
    teamAverage: showTeamAverage ? teamAverage : null,
    loading,
  });

  return (
    <main className="min-h-screen bg-[#030811] text-white">
      <div className="flex flex-col md:flex-row">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-10 pt-6 sm:px-8 sm:pb-14 sm:pt-10">
            {/* ---------------------------------------------- Cabecera */}
            <header className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Individual
              </p>

              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Rendimiento emocional
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
                    Perfil atencional de cada jugador en las cuatro dimensiones
                    del modelo. Selecciona jugadores en cada línea para comparar
                    perfiles y detectar sinergias.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2" data-export-hide>
                  <button
                    onClick={() => setShowTeamAverage((v) => !v)}
                    aria-pressed={showTeamAverage}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                      showTeamAverage
                        ? "border-white/25 bg-white/[0.08] text-white"
                        : "border-white/10 bg-transparent text-white/50 hover:text-white/80"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-px w-5 border-t border-dashed border-current"
                    />
                    Media del equipo
                  </button>

                  <button
                    onClick={resetGroups}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    <RefreshCw size={13} />
                    Restablecer líneas
                  </button>

                  <button
                    onClick={openVideo}
                    className="inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2 text-xs font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/20"
                  >
                    <Play size={13} />
                    Ver explicación
                  </button>
                </div>
              </div>
            </header>

            {/* ---------------------------------------------- Resumen */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Jugadores analizados"
                value={loading ? "—" : String(rows.length)}
                caption="Registros en la base emocional"
                icon={Users}
              />

              <SummaryTile
                label="Media de plantilla"
                value={loading ? "—" : teamScore.toFixed(1)}
                caption={loading ? "Cargando datos" : labelFor(teamScore)}
                tone={loading ? undefined : toneFor(teamScore)}
              />

              <SummaryTile
                label="Dimensión más fuerte"
                value={axisRanking ? axisRanking.top.code : "—"}
                caption={axisRanking ? axisRanking.top.label : "Cargando datos"}
                tone="#3BEA9A"
              />

              <SummaryTile
                label="Dimensión a desarrollar"
                value={axisRanking ? axisRanking.bottom.code : "—"}
                caption={
                  axisRanking ? axisRanking.bottom.label : "Cargando datos"
                }
                tone="#FFB84D"
              />
            </div>

            {error && (
              <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-[#FFB84D]/30 bg-[#FFB84D]/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/80">
                  No se han podido cargar los datos emocionales.
                </p>

                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 rounded-full border border-[#FFB84D]/40 px-4 py-2 text-xs font-semibold uppercase tracking-[.15em] text-[#FFB84D] transition hover:bg-[#FFB84D]/10"
                >
                  <RefreshCw size={14} />
                  Reintentar
                </button>
              </div>
            )}

            {/* ---------------------------------------------- Escala */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[.25em] text-white/40">
                Perfiles por línea
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {SCALE.map((band) => (
                  <span
                    key={band.label}
                    className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[.12em] text-white/45"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ background: band.tone }}
                    />
                    {band.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ---------------------------------------------- Radares */}
            <div
              className="rounded-[34px] p-4 sm:p-5 lg:p-6"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(5,14,24,.68), rgba(5,14,24,.68)), url('/emotional-field-bg.png')",
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <div className="space-y-4">
                <RadarPanel
                  horizontal
                  title="Perfil izquierdo"
                  {...panelProps("leftSide")}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <RadarPanel title="Defensa" {...panelProps("defense")} />

                  <RadarPanel title="Mediocampo" {...panelProps("midfield")} />

                  <RadarPanel
                    title="Puntas / Delanteros"
                    {...panelProps("strikers")}
                  />
                </div>

                <RadarPanel
                  horizontal
                  title="Perfil derecho"
                  {...panelProps("rightSide")}
                />
              </div>
            </div>

            {/* ------------------------------------- Leyenda de los ejes */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AXES.map((axis) => {
                const value = teamAverage ? teamAverage[axis.key] : null;

                return (
                  <div
                    key={axis.code}
                    className="rounded-2xl border border-white/10 bg-[#08131F]/85 px-4 py-4 transition hover:border-[#E1C77B]/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[.15em] text-[#E1C77B]">
                        {axis.label}
                      </div>

                      <span className="rounded-md border border-[#E1C77B]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#E1C77B]">
                        {axis.code}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-medium leading-snug text-white">
                      {axis.detail}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                      <span>{axis.moment}</span>

                      {value !== null && (
                        <span className="tabular-nums text-white/70">
                          {value.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {value !== null && (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, value * 10)}%`,
                            background: toneFor(value),
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ------------------------------------- Vídeo explicativo */}
            <div ref={videoRef} className="mt-14 sm:mt-20" data-export-hide>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Explicación visual
                </p>

                <p className="mt-2 text-sm text-white/45">
                  Cómo se leen las cuatro dimensiones y qué se entrena en cada
                  una.
                </p>
              </div>

              <div className="hidden overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:rounded-[32px] sm:p-4 lg:block">
                <iframe
                  title="Vídeo explicativo del análisis emocional"
                  src={VIDEO_EMBED}
                  className="h-[640px] w-full rounded-[18px] border-0 bg-black sm:rounded-[24px]"
                  allow="autoplay"
                  allowFullScreen
                />
              </div>

              <div className="rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 text-center lg:hidden">
                <p className="mb-4 text-sm text-white/80">
                  Ver explicación completa del análisis emocional
                </p>

                <button
                  onClick={() => window.open(VIDEO_URL, "_blank")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black shadow-xl"
                >
                  <Play size={15} />
                  Abrir vídeo
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryTile({
  label,
  value,
  caption,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: string;
  icon?: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#08131F]/70 px-4 py-4"
      style={tone ? { borderColor: `${tone}45` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[.22em] text-white/45">
          {label}
        </p>

        {Icon && <Icon size={15} className="text-white/30" />}
      </div>

      <p
        className="mt-2 text-2xl font-semibold tabular-nums"
        style={tone ? { color: chipInk(tone) } : undefined}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-white/55">{caption}</p>
    </div>
  );
}

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
};

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const axis = AXES.find((a) => a.code === label);

  return (
    <div className="rounded-xl border border-white/15 bg-[#050E18]/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.45)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#E4C977]">
        {axis ? axis.label : label}
      </p>

      {axis && <p className="mt-0.5 text-[10px] text-white/45">{axis.detail}</p>}

      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span className="flex items-center gap-1.5 text-white/75">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>

            <span className="tabular-nums text-white">
              {Number(entry.value ?? 0).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TEAM_SERIES = "Media equipo";

/* A partir de esta cantidad de jugadores el buscador ahorra scroll. */
const SEARCH_THRESHOLD = 10;

function RadarPanel({
  title,
  players,
  selected,
  onChange,
  getPlayer,
  teamAverage,
  loading,
  horizontal = false,
}: {
  title: string;
  players: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  getPlayer: (name: string) => Player | undefined;
  teamAverage: Record<MetricKey, number> | null;
  loading: boolean;
  horizontal?: boolean;
}) {
  const [query, setQuery] = useState("");

  const series = useMemo(
    () =>
      selected
        .map((name, index) => ({
          name,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
          values: getPlayer(name),
        }))
        .filter(
          (s): s is { name: string; color: string; values: Player } =>
            Boolean(s.values)
        ),
    [selected, getPlayer]
  );

  const chartData = useMemo(
    () =>
      AXES.map((axis) => {
        const row: Record<string, string | number> = { key: axis.code };

        series.forEach((s) => {
          row[s.name] = s.values[axis.key];
        });

        if (teamAverage) {
          row[TEAM_SERIES] = Number(teamAverage[axis.key].toFixed(2));
        }

        return row;
      }),
    [series, teamAverage]
  );

  /* Media del grupo por eje: alimenta las barras bajo el radar. */
  const groupAverages = useMemo(() => {
    if (series.length === 0) return null;

    return AXES.map((axis) => ({
      axis,
      value:
        series.reduce((acc, s) => acc + s.values[axis.key], 0) / series.length,
    }));
  }, [series]);

  const synergyScore =
    series.length === 0
      ? 0
      : series.reduce((acc, s) => acc + average(s.values), 0) / series.length;

  const radarTone = toneFor(synergyScore);
  const synergyLabel = labelFor(synergyScore);

  /* Seleccionados primero: evita perderlos de vista en listas largas. */
  const visiblePlayers = useMemo(() => {
    const q = normalize(query.trim());

    const filtered = q
      ? players.filter((name) => normalize(name).includes(q))
      : players;

    return [...filtered].sort((a, b) => {
      const diff = Number(selected.includes(b)) - Number(selected.includes(a));
      return diff !== 0 ? diff : a.localeCompare(b, "es");
    });
  }, [players, query, selected]);

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    );
  };

  return (
    <div
      className="rounded-[24px] border p-3 sm:p-4"
      style={{
        borderColor: series.length ? `${radarTone}55` : "rgba(255,255,255,.08)",
        background: series.length
          ? `radial-gradient(circle at center, ${radarTone}15 0%, transparent 75%)`
          : "rgba(8,19,31,.5)",
        boxShadow: series.length ? `0 0 30px ${radarTone}20` : undefined,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[12px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
          {title}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-white/60">
            Sinergia{" "}
            <span className="tabular-nums font-semibold text-white">
              {synergyScore.toFixed(1)}
            </span>
            <span className="text-white/35"> / 10</span>
          </span>

          {series.length > 0 && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: radarTone, color: "#031018" }}
            >
              {synergyLabel}
            </span>
          )}
        </div>
      </div>

      {/* Jugadores activos del panel */}
      <div className="mb-3 flex min-h-[24px] flex-wrap items-center gap-1.5">
        {series.length === 0 ? (
          <span className="text-[11px] text-white/35">
            Sin jugadores seleccionados
          </span>
        ) : (
          series.map((s) => (
            <button
              key={s.name}
              onClick={() => toggle(s.name)}
              title={`Quitar ${s.name}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition hover:brightness-125"
              style={{
                background: `${s.color}25`,
                color: chipInk(s.color),
                border: `1px solid ${s.color}40`,
              }}
            >
              {s.name}
              <X size={9} aria-hidden />
            </button>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Selector: chips accesibles, mejor en táctil que un multi-select */}
        <div
          className={`flex shrink-0 flex-col gap-2 ${
            horizontal ? "lg:w-[230px]" : "lg:w-[160px]"
          }`}
          data-export-hide
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[.18em] text-white/35">
              {selected.length}/{players.length}
            </span>

            <button
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="inline-flex items-center gap-1 text-[10px] text-white/40 transition hover:text-white disabled:opacity-30 disabled:hover:text-white/40"
            >
              <Eraser size={10} />
              Limpiar
            </button>
          </div>

          {players.length > SEARCH_THRESHOLD && (
            <div className="relative">
              <Search
                size={11}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label={`Buscar jugador en ${title}`}
                className="w-full rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-7 pr-2 text-[11px] text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
            </div>
          )}

          <div
            role="group"
            aria-label={`Jugadores en ${title}`}
            className="flex max-h-[150px] flex-wrap content-start gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_0_14px_rgba(255,255,255,.03)] backdrop-blur-xl lg:max-h-[210px]"
          >
            {loading && players.length === 0 && (
              <div className="w-full space-y-1.5 p-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-5 w-full animate-pulse rounded-full bg-white/10"
                  />
                ))}
              </div>
            )}

            {!loading && visiblePlayers.length === 0 && (
              <span className="p-1 text-[10px] text-white/30">
                Sin resultados
              </span>
            )}

            {visiblePlayers.map((name) => {
              const active = selected.includes(name);

              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] leading-none transition ${
                    active
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 bg-transparent text-white/55 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {active && <Check size={9} aria-hidden />}
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="h-[240px] w-full">
            {series.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-[11px] text-white/40">
                {loading
                  ? "Cargando perfiles…"
                  : "Selecciona jugadores para dibujar el perfil"}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: horizontal ? 520 : 300, height: 240 }}
              >
                <RadarChart
                  data={chartData}
                  outerRadius="78%"
                  margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
                >
                  <PolarGrid stroke={`${radarTone}40`} />

                  <PolarAngleAxis
                    dataKey="key"
                    tick={{ fill: "#ffffff", fontSize: 11 }}
                  />

                  <PolarRadiusAxis
                    domain={[0, 10]}
                    tick={false}
                    axisLine={false}
                  />

                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => (
                      <RadarTooltip
                        active={active}
                        payload={payload as unknown as TooltipEntry[]}
                        label={String(label ?? "")}
                      />
                    )}
                  />

                  {teamAverage && (
                    <Radar
                      name={TEAM_SERIES}
                      dataKey={TEAM_SERIES}
                      stroke="#8FA3B8"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      fill="#8FA3B8"
                      fillOpacity={0.05}
                      isAnimationActive={false}
                    />
                  )}

                  {series.map((s) => (
                    <Radar
                      key={s.name}
                      name={s.name}
                      dataKey={s.name}
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.12}
                      strokeWidth={2.6}
                      isAnimationActive={false}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lectura numérica: el radar da la forma, esto da el dato */}
          {groupAverages && (
            <div
              className={`mt-2 grid gap-2 ${
                horizontal ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
              }`}
            >
              {groupAverages.map(({ axis, value }) => (
                <div
                  key={axis.code}
                  className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5"
                  title={`${axis.label} · ${axis.detail}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold tracking-wider text-white/45">
                      {axis.code}
                    </span>

                    <span
                      className="text-[12px] font-semibold tabular-nums"
                      style={{ color: chipInk(toneFor(value)) }}
                    >
                      {value.toFixed(1)}
                    </span>
                  </div>

                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, value * 10)}%`,
                        background: toneFor(value),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
