"use client";
import { traeCsv } from "@/lib/hojaCsv";
import { EstadoError, Hueso } from "@/components/ui/estados";

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
import { coma } from "@/lib/formatoNumero";
import { posicionDe } from "@/lib/posiciones";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { AXES, SCALE, SERIES_COLORS, average, labelFor, nombreLargo, toneFor, type GroupKey, type MetricKey, type Player } from "./modelo";
import { CampoEmocional } from "./CampoEmocional";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=970113485&single=true&output=csv";

const VIDEO_ID = "1pKrNKJwbiXjsKP4cJ8ROE-2E8-PlLyi8";
const VIDEO_URL = `https://drive.google.com/file/d/${VIDEO_ID}/view`;
const VIDEO_EMBED = `https://drive.google.com/file/d/${VIDEO_ID}/preview`;


/* Por debajo de esto la media es una tendencia, no un diagnóstico. */
const MUESTRA_MINIMA = 12;


const EMPTY_GROUPS: Record<GroupKey, string[]> = {
  leftSide: [],
  defense: [],
  rightSide: [],
  midfield: [],
  strikers: [],
};

/* Composición por defecto: sale de los jugadores que hay en la base emocional,
   repartidos por su demarcación en la hoja (con las correcciones de
   lib/posiciones.ts) y sin repetir a nadie. Perfil izquierdo = lateral
   izquierdo y extremo izquierdo (11); perfil derecho = lateral derecho y
   extremo derecho (7); defensa = centrales; mediocampo = 6, 8 y 10; puntas = 9. */
function grupoDe(posicion: string): GroupKey | null {
  const p = posicion.trim().toUpperCase();
  if (p === "LATERAL I." || p === "11") return "leftSide";
  if (p === "LATERAL D." || p === "7") return "rightSide";
  if (p === "CENTRAL") return "defense";
  if (p === "6" || p === "8" || p === "10") return "midfield";
  if (p === "9") return "strikers";
  return null;
}

function gruposPorDefecto(rows: Player[]): Record<GroupKey, string[]> {
  const grupos: Record<GroupKey, string[]> = {
    leftSide: [],
    defense: [],
    rightSide: [],
    midfield: [],
    strikers: [],
  };
  const vistos = new Set<string>();

  for (const r of rows) {
    const clave = grupoDe(posicionDe(r.jugador, r.posicion));
    if (!clave || vistos.has(r.jugador)) continue;
    vistos.add(r.jugador);
    grupos[clave].push(r.jugador);
  }

  return grupos;
}

function num(v?: string) {
  return Number(String(v || "").replace(",", ".")) || 0;
}

/* Una nota de verdad: número, con coma o punto. */
const ES_NOTA = /^\s*\d+(?:[.,]\d+)?\s*$/;

function parseCSV(text: string): Player[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  /*
  | Sólo filas con las cuatro notas (19/10/2026). La hoja lleva encima un
  | título, los rótulos de los cuadrantes y la cabecera «POSICION, JUGADOR,
  | E.A.…»; ésta tenía nombre en la segunda columna y entraba como un jugador
  | llamado «JUGADOR» con todo a cero: salía en los selectores y hundía la
  | media de la plantilla y de cada eje. Un jugador sin evaluar tampoco es un
  | cero.
  */
  return parsed.data
    .filter((r) => [r[2], r[3], r[4], r[5]].every((v) => ES_NOTA.test(v ?? "")))
    /* Las cuatro notas exactamente en 5 son el relleno de la hoja, no una
       evaluación: no entran en radares ni en medias. */
    .filter((r) => ![r[2], r[3], r[4], r[5]].every((v) => num(v) === 5))
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
  const [verVideo, setVerVideo] = useState(false);
  const [showTeamAverage, setShowTeamAverage] = useState(true);

  const [groups, setGroups] = useState<Record<GroupKey, string[]>>(EMPTY_GROUPS);

  /* Las líneas del once de la pizarra (30/10/2026): mandan sobre las de la
     demarcación, y «Restablecer líneas» vuelve a ellas. */
  const [gruposOnce, setGruposOnce] = useState<Record<GroupKey, string[]> | null>(null);

  const recibeOnce = useCallback((g: Record<GroupKey, string[]>) => {
    setGruposOnce(g);
    setGroups(g);
  }, []);

  /* Cambiar la clave relanza la descarga: así el botón de reintento
     no necesita duplicar la lógica de carga. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    traeCsv(CSV_URL, { forzar: reloadKey > 0 })
      .then((t) => {
        if (cancelled) return;

        const parsed = parseCSV(t);
        setRows(parsed);
        setGroups((prev) => (Object.values(prev).some((v) => v.length > 0) ? prev : gruposPorDefecto(parsed)));

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
    setGroups(gruposOnce ?? gruposPorDefecto(rows));
  }, [rows, gruposOnce]);

  /* Las líneas sin ningún jugador evaluado no se dibujan. Se decide con la
     composición por defecto, no con lo que el usuario vaya quitando: una
     línea vaciada a mano sigue ahí para volver a rellenarla. */
  const lineasConJugadores = useMemo(() => {
    const por = gruposPorDefecto(rows);
    return new Set(
      (Object.keys(por) as GroupKey[]).filter((k) => por[k].length > 0 || (gruposOnce?.[k].length ?? 0) > 0)
    );
  }, [rows, gruposOnce]);

  const openVideo = () => {
    if (window.innerWidth < 1024) {
      window.open(VIDEO_URL, "_blank");
      return;
    }

    setVerVideo(true);
    videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const centrales = (
    [
      { clave: "defense", titulo: "Defensa" },
      { clave: "midfield", titulo: "Mediocampo" },
      { clave: "strikers", titulo: "Puntas / Delanteros" },
    ] as { clave: GroupKey; titulo: string }[]
  ).filter((c) => lineasConJugadores.has(c.clave));

  const panelProps = (key: GroupKey) => ({
    players: names,
    selected: groups[key],
    onChange: (value: string[]) => setGroup(key, value),
    getPlayer,
    teamAverage: showTeamAverage ? teamAverage : null,
    loading,
  });

  return (
    <main className="min-h-screen bg-[#030811] text-white max-sm:pb-20">
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
                    El once de la pizarra táctica con su estado emocional:
                    cada línea tiene su radar en su zona del campo, con los
                    jugadores que hay en la pizarra. En «Fichas del once», el
                    aro es la media de las cuatro dimensiones (0 a 10) y la
                    flecha, cómo ha cambiado. Pulsa un jugador para ver su
                    perfil; más abajo se cambia quién entra en cada radar.
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

            {/* ------------------------------- El once de la pizarra (29/10/2026) */}
            {!error && (
              <CampoEmocional
                rows={rows}
                loading={loading}
                teamAverage={teamAverage}
                grupos={groups}
                onGruposDelOnce={recibeOnce}
              />
            )}

            {/* ---------------------------------------------- Resumen */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Jugadores analizados"
                value={loading ? "—" : String(rows.length)}
                caption={
                  rows.length > 0 && rows.length < MUESTRA_MINIMA
                    ? `Sólo ${rows.length} jugadores medidos: es una tendencia, no un diagnóstico`
                    : "Registros en la base emocional"
                }
                icon={Users}
              />

              <SummaryTile
                label="Media de plantilla"
                value={loading ? "—" : coma(teamScore)}
                caption={
                  loading
                    ? "Cargando datos"
                    : `${labelFor(teamScore)} · sobre ${rows.length} jugadores`
                }
                tone={loading ? undefined : toneFor(teamScore)}
              />

              <SummaryTile
                label="Dimensión más fuerte"
                value={axisRanking ? nombreLargo(axisRanking.top) : "—"}
                caption={
                  axisRanking
                    ? `${axisRanking.top.corto} · ${axisRanking.top.label}`
                    : "Cargando datos"
                }
                tone="#3BEA9A"
              />

              <SummaryTile
                label="Dimensión a desarrollar"
                value={axisRanking ? nombreLargo(axisRanking.bottom) : "—"}
                caption={
                  axisRanking
                    ? `${axisRanking.bottom.corto} · ${axisRanking.bottom.label}`
                    : "Cargando datos"
                }
                tone="#FFB84D"
              />
            </div>

            {error && (
              <EstadoError
                className="mb-5"
                titulo="No se han podido cargar los datos emocionales"
                onReintentar={retry}
                reintentando={loading}
              />
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
              className="rounded-[34px] border border-white/10 bg-[#08131F]/60 p-4 sm:p-5 lg:p-6 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white/80"
            >
              {/* Sin imagen de campo detrás (26/10/2026): ensuciaba los radares y los chips. */}
              <div className="space-y-4">
                {lineasConJugadores.has("leftSide") && (
                  <RadarPanel
                    horizontal
                    title="Perfil izquierdo"
                    {...panelProps("leftSide")}
                  />
                )}

                {centrales.length > 0 && (
                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      centrales.length === 1
                        ? ""
                        : centrales.length === 2
                          ? "lg:grid-cols-2"
                          : "lg:grid-cols-3"
                    }`}
                  >
                    {centrales.map((c) => (
                      <RadarPanel
                        key={c.clave}
                        title={c.titulo}
                        {...panelProps(c.clave)}
                      />
                    ))}
                  </div>
                )}

                {lineasConJugadores.has("rightSide") && (
                  <RadarPanel
                    horizontal
                    title="Perfil derecho"
                    {...panelProps("rightSide")}
                  />
                )}
              </div>
            </div>

            {/* ------------------------------------- Leyenda de los ejes */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AXES.map((axis) => {
                const value = teamAverage ? teamAverage[axis.key] : null;

                return (
                  <div
                    key={axis.code}
                    className="rounded-2xl border border-white/10 bg-[#08131F]/85 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white px-4 py-4 transition hover:border-[#E1C77B]/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[.15em] text-[#E1C77B]">
                        {axis.label}
                      </div>

                      <span className="rounded-md border border-[#E1C77B]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#E1C77B]">
                        {axis.corto}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-medium leading-snug text-white">
                      {axis.detail}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                      <span>{axis.moment}</span>

                      {value !== null && (
                        <span className="tabular-nums text-white/70">
                          {coma(value)}
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

            {/* Lectura: sale de las mismas medias que se muestran arriba. */}
            {axisRanking && teamAverage && (
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                <span className="font-semibold text-white">
                  Dimensión a trabajar: {nombreLargo(axisRanking.bottom).toLowerCase()}
                </span>
                , {coma(teamAverage[axisRanking.bottom.key])} de media frente a{" "}
                {coma(teamAverage[axisRanking.top.key])} en{" "}
                {nombreLargo(axisRanking.top).toLowerCase()}. Media sobre {rows.length} jugadores
                {rows.length < MUESTRA_MINIMA
                  ? ": con tan pocos registros es una tendencia"
                  : ""}
                .
              </p>
            )}

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
                {verVideo ? (
                  <iframe
                    title="Vídeo explicativo del análisis emocional"
                    src={VIDEO_EMBED}
                    className="h-[640px] w-full rounded-[18px] border-0 bg-black sm:rounded-[24px]"
                    allow="autoplay"
                    allowFullScreen
                  />
                ) : (
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    {AXES.map((axis) => (
                      <div
                        key={axis.code}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-lg font-bold text-[#E4C977]">
                          {axis.corto}
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {axis.label}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-white/60">
                          {axis.detail}. Se entrena en: {axis.moment.toLowerCase()}.
                        </p>
                      </div>
                    ))}

                    <div className="flex items-center justify-center sm:col-span-2 xl:col-span-4">
                      <button
                        onClick={() => setVerVideo(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black shadow-xl"
                      >
                        <Play size={15} />
                        Ver el vídeo explicativo
                      </button>
                    </div>
                  </div>
                )}
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

  const axis = AXES.find((a) => a.corto === label);

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
              {coma(Number(entry.value ?? 0))}
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
  const [abierto, setAbierto] = useState(false);

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
        const row: Record<string, string | number> = { key: axis.corto };

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
      /* 29/10/2026: con jugadores, el fondo base va por tema (en modo día el
         panel se leía como un bloque gris oscuro); el degradado del nivel sólo
         tiñe por encima. */
      className={`rounded-[24px] border p-3 sm:p-4 ${series.length ? "bg-[#08131F]/40 [:root[data-theme=light]_&]:bg-white" : "emo-panel-vacio"}`}
      style={
        series.length
          ? {
              borderColor: `${radarTone}55`,
              backgroundImage: `radial-gradient(circle at center, ${radarTone}15 0%, transparent 75%)`,
              boxShadow: `0 0 30px ${radarTone}20`,
            }
          : undefined
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="min-w-0 text-[12px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
          {title}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Es la media de los elegidos, no una medida de cómo encajan:
              «Sinergia» prometía algo que no se calcula (19/10/2026). Sin
              jugadores no se enseña un 0,0 que parece una nota. */}
          {series.length > 0 && (
            <span
              className="text-[11px] text-white/60"
              title="Media de las cuatro dimensiones de los jugadores elegidos, de 0 a 10"
            >
              Media{" "}
              <span className="tabular-nums font-semibold text-white">
                {coma(synergyScore)}
              </span>
              <span className="text-white/35"> / 10</span>
            </span>
          )}

          {series.length >= 3 && (
            <span className="text-[11px] tabular-nums text-white/60">
              {series.length} jugadores
            </span>
          )}

          {/* Con menos de tres jugadores el nivel es una tendencia, no un perfil de línea.
              29/10/2026: el chip gris llevaba tinta clara fija y en modo día salía
              como una píldora vacía; ahora la tinta va por tema y el número de
              jugadores va dentro del propio chip. */}
          {series.length > 0 &&
            (series.length < 3 ? (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "rgba(148,163,184,.22)", border: "1px solid rgba(148,163,184,.55)", color: "var(--rmcf-ink)" }}
              >
                {series.length} {series.length === 1 ? "jugador" : "jugadores"} · tendencia
              </span>
            ) : (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: radarTone, color: "#031018" }}
              >
                {synergyLabel} · {series.length} jugadores
              </span>
            ))}
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
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-125"
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
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="inline-flex items-center justify-between gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
          >
            {abierto ? "Cerrar lista" : "Elegir jugadores"}
            <span className="tabular-nums text-white/45">
              {selected.length}/{players.length}
            </span>
          </button>

          {abierto && (
          <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[.18em] text-white/35">
              Jugadores
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
          </>
          )}
        </div>

        <div className="w-full min-w-0 flex-1">
          {/* 29/10/2026: lienzo más bajo y radio mayor; antes el radar era un
              rombo pequeño en mucho vacío. */}
          <div className="h-[270px] w-full min-w-[240px] sm:h-[320px]">
            {series.length === 0 && loading ? (
              <Hueso className="h-full w-full rounded-2xl" />
            ) : series.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-[11px] text-white/40">
                Selecciona jugadores para dibujar el perfil
              </div>
            ) : (
              <ResponsiveContainer
                width="100%" minWidth={200}
                height="100%"
                initialDimension={{ width: horizontal ? 520 : 300, height: 320 }}
              >
                <RadarChart
                  data={chartData}
                  outerRadius="86%"
                  /* 29/10/2026: las etiquetas de los lados se escriben hacia dentro
                     (encima del vértice), así que no necesitan margen lateral y
                     «Controlar» ya no se corta en las columnas estrechas. */
                  margin={{ top: 22, right: 10, bottom: 22, left: 10 }}
                >
                  <PolarGrid stroke={`${radarTone}40`} />

                  <PolarAngleAxis
                    dataKey="key"
                    tick={(props: {
                      x?: number | string;
                      y?: number | string;
                      textAnchor?: "start" | "middle" | "end" | "inherit";
                      payload?: { value?: string };
                    }) => {
                      const code = String(props.payload?.value ?? "");
                      /* Los ejes laterales se anclan hacia dentro y suben
                         sobre la línea: nunca salen del lienzo. */
                      const lado =
                        props.textAnchor === "start"
                          ? "end"
                          : props.textAnchor === "end"
                            ? "start"
                            : null;
                      return (
                        <text
                          x={props.x}
                          y={lado ? Number(props.y) - 8 : props.y}
                          textAnchor={lado ?? props.textAnchor}
                          fontSize={13}
                          paintOrder="stroke"
                          stroke="var(--rmcf-surface, transparent)"
                          strokeWidth={3}
                          fontWeight={700}
                          style={{ fill: "var(--rmcf-ink)" }}
                        >
                          {code}
                        </text>
                      );
                    }}
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

          {teamAverage && series.length > 0 && (
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-white/50">
              <svg width="18" height="4" aria-hidden>
                <line x1="0" y1="2" x2="18" y2="2" stroke="#8FA3B8" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              Media de la plantilla
            </div>
          )}

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
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5"
                  title={`${axis.label} · ${axis.detail}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-bold text-white/85">
                      {axis.corto}
                    </span>

                    <span
                      className="text-[15px] font-bold tabular-nums"
                      style={{ color: chipInk(toneFor(value)) }}
                    >
                      {coma(value)}
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-[10px] leading-tight text-white/55">
                    {axis.label}
                  </p>

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
