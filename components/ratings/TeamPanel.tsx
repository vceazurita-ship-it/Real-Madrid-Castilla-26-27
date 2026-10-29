"use client";

import { LecturaGrafico } from "@/components/ui/LecturaGrafico";
import { nombrePuesto } from "@/lib/posiciones";
import { nombreVisible } from "@/lib/nombreJugador";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownWideNarrow,
  Award,
  Crown,
  Flame,
  LineChart as LineChartIcon,
  Medal,
  Trophy,
  Users,
} from "lucide-react";

import {
  MatchSummary,
  PlayerSummary,
  formatRating,
  formatSigned,
  ratingColor,
  ratingColorHex,
  round,
} from "@/lib/ratings/compute";
import { formatMatchDateShort, matchLabel } from "@/lib/ratings/matches";

/** «vs JUVENTUD DE TORREMOLINOS CF»: el rival siempre en mayúsculas. */
function rivalEnMayusculas(match: Parameters<typeof matchLabel>[0]) {
  return `${match.isHome ? "vs" : "@"} ${match.opponent.toUpperCase()}`;
}

/** «1 - 2» y «1-2» salen siempre como «1-2». */
function marcadorUniforme(result: string) {
  return result.replace(/\s*-\s*/, "-");
}
import { lineaDe, type LineaKey } from "@/lib/ratings/pitch";
import { Player } from "@/types/player";

import {
  AXIS,
  CURSOR_BARRA,
  CURSOR_LINEA,
  ChartTooltip,
  GRID_STROKE,
  TickNombre,
} from "./charts";
import {
  EmptyState,
  Panel,
  RatingBadge,
  RatingBar,
  SegmentedControl,
  StatCard,
  TrendPill,
} from "./ui";

export type RankedPlayer = {
  player: Player;
  summary: PlayerSummary;
};

type SortKey = "avg" | "weighted" | "form" | "trend" | "played" | "minutes" | "goals";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "Media" },
  { key: "weighted", label: "Ponderada" },
  { key: "form", label: "Forma" },
  { key: "trend", label: "Progresión" },
  { key: "played", label: "Partidos" },
  { key: "minutes", label: "Minutos" },
  { key: "goals", label: "G+A" },
];

/* La línea sale de `lineaDe`: con una lista cerrada de puestos, el portero
   escrito «1» en la hoja no entraba en ninguna media (19/10/2026). */
const LINE_GROUPS: { key: LineaKey; label: string }[] = [
  { key: "por", label: "Porteros" },
  { key: "def", label: "Defensas" },
  { key: "med", label: "Medios" },
  { key: "del", label: "Ataque" },
];

/** Partidos mínimos para que una media entre en el «mejor» y en el podio. */
const MIN_FIABLE = 4;

/**
 * Qué significa cada color de barra. Los tonos salen de la MISMA función que
 * pinta barras y chips (`ratingColor`, con la variable del tema), no de
 * hexadecimales copiados: así la leyenda no se desvía en modo día.
 */
function LeyendaColorNota() {
  const tramos = [
    { color: ratingColor(4), texto: "menos de 5" },
    { color: ratingColor(6), texto: "5 a 6,4" },
    { color: ratingColor(7), texto: "6,5 a 7,9" },
    { color: ratingColor(9), texto: "8 o más" },
  ];

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
      <span>Color de la nota:</span>

      {tramos.map((tramo) => (
        <span key={tramo.texto} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: tramo.color }}
          />
          {tramo.texto}
        </span>
      ))}
    </p>
  );
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function sortValue(entry: RankedPlayer, key: SortKey) {
  const { summary } = entry;

  if (key === "goals") return summary.goals + summary.assists;

  return summary[key];
}

export function TeamPanel({
  ranked,
  matchSummaries,
  onSelectPlayer,
}: {
  ranked: RankedPlayer[];
  matchSummaries: MatchSummary[];
  onSelectPlayer: (playerId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [minMatches, setMinMatches] = useState(1);

  const eligible = useMemo(
    () => ranked.filter((entry) => entry.summary.played >= minMatches),
    [ranked, minMatches]
  );

  const sorted = useMemo(
    () =>
      [...eligible].sort((a, b) => {
        /* En las clasificaciones por nota, quien tiene 4 o más partidos va
           primero y la tendencia (1-3 PJ) se queda al final del grupo. */
        if (sortKey !== "played" && sortKey !== "minutes" && sortKey !== "goals") {
          const fa = a.summary.played >= MIN_FIABLE ? 1 : 0;
          const fb = b.summary.played >= MIN_FIABLE ? 1 : 0;

          if (fa !== fb) return fb - fa;
        }

        return sortValue(b, sortKey) - sortValue(a, sortKey);
      }),
    [eligible, sortKey]
  );

  /* ---------------- indicadores ---------------- */

  const teamAverage = useMemo(() => {
    const rated = matchSummaries.filter((item) => item.rated > 0);

    if (rated.length === 0) return 0;

    return round(
      rated.reduce((total, item) => total + item.avg, 0) / rated.length
    );
  }, [matchSummaries]);

  /* Con menos de 4 partidos una media no dice nada: el «mejor» y el podio
     cuentan sólo a quien tiene 4 o más. Si nadie
     llega todavía, se usa a todos para no dejar el hueco vacío. */
  const fiables = useMemo(() => {
    const fiablesAhora = ranked.filter((entry) => entry.summary.played >= MIN_FIABLE);

    return fiablesAhora.length > 0 ? fiablesAhora : ranked;
  }, [ranked]);

  const bestSorted = useMemo(
    () => [...fiables].sort((a, b) => b.summary.avg - a.summary.avg),
    [fiables]
  );

  const best = bestSorted[0] ?? null;

  const mostImproved = useMemo(() => {
    const conMuestra = ranked.filter((entry) => entry.summary.played >= MIN_FIABLE);

    return (
      [...(conMuestra.length > 0 ? conMuestra : ranked)].sort(
        (a, b) => b.summary.trend - a.summary.trend
      )[0] ?? null
    );
  }, [ranked]);

  const topScorer = useMemo(
    () =>
      [...ranked].sort(
        (a, b) =>
          b.summary.goals + b.summary.assists -
          (a.summary.goals + a.summary.assists)
      )[0] ?? null,
    [ranked]
  );

  /* «Más decisivo» sólo se nombra con 3 o más acciones (goles + asistencias):
     con una o dos no hay diferencia que merezca un nombre. */
  const decisivoClaro = useMemo(() => {
    if (!topScorer) return false;

    return topScorer.summary.goals + topScorer.summary.assists >= 3;
  }, [topScorer]);

  /* ---------------- series ---------------- */

  const evolution = useMemo(
    () =>
      matchSummaries
        .filter((item) => item.rated > 0)
        .map((item) => ({
          name: formatMatchDateShort(item.match),
          label: matchLabel(item.match),
          result: item.match.result,
          avg: item.avg,
          rated: item.rated,
        })),
    [matchSummaries]
  );

  const topChart = useMemo(
    () =>
      bestSorted.slice(0, 8).map((entry) => ({
        name: entry.player.nombre,
        value: entry.summary.avg,
        played: entry.summary.played,
      })),
    [bestSorted]
  );

  const byLine = useMemo(() => {
    return LINE_GROUPS.map((group) => {
      const members = ranked.filter(
        (entry) =>
          lineaDe(entry.player.posicion) === group.key &&
          entry.summary.played > 0
      );

      const value = members.length
        ? round(
            members.reduce((total, entry) => total + entry.summary.avg, 0) /
              members.length
          )
        : 0;

      return { name: group.label, value, players: members.length };
    }).filter((item) => item.players > 0);
  }, [ranked]);

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Todavía no hay valoraciones"
        description="Registra las notas de un partido y aquí verás el ranking, la evolución y los tops de la plantilla."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* INDICADORES */}

      <div
        className={`grid min-w-0 gap-3 sm:grid-cols-2 ${
          decisivoClaro ? "xl:grid-cols-4" : "xl:grid-cols-3"
        }`}
      >
        <StatCard
          label="Media del equipo"
          value={formatRating(teamAverage)}
          hint={`${evolution.length} partidos valorados`}
          accent={ratingColor(teamAverage)}
        />

        <StatCard
          label="Mejor media"
          value={best ? best.player.nombre : "—"}
          hint={
            best
              ? `${formatRating(best.summary.avg)} en ${plural(best.summary.played, "partido", "partidos")}`
              : undefined
          }
          accent="var(--rmcf-gold-ink)"
        />

        <StatCard
          label="Mayor progresión"
          value={
            mostImproved
              ? mostImproved.player.nombre
              : "—"
          }
          hint={
            mostImproved
              ? `${formatSigned(mostImproved.summary.trend)} en las últimas 3 · ${mostImproved.summary.played} PJ`
              : undefined
          }
          accent="var(--rmcf-rate-good)"
        />

        {decisivoClaro && topScorer && (
          <StatCard
            label="Más decisivo"
            value={topScorer.player.nombre}
            hint={`${plural(topScorer.summary.goals, "gol", "goles")} · ${plural(topScorer.summary.assists, "asistencia", "asistencias")}`}
            accent="var(--rmcf-rate-top)"
          />
        )}
      </div>

      {/* EVOLUCIÓN */}

      <Panel
        title="Evolución del equipo"
        subtitle="Media de las notas de cada partido"
        lectura={
          <LecturaGrafico
            serie={evolution.map((punto) => ({
              etiqueta: punto.name,
              valor: punto.avg,
            }))}
            sentido="mas-es-mejor"
            unidadSerie="de nota"
          />
        }
        icon={LineChartIcon}
        bodyClassName="p-3 sm:p-4"
      >
        {evolution.length === 0 ? (
          <EmptyState title="Sin partidos valorados" />
        ) : (
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={160}
                initialDimension={{ width: 320, height: 190 }}
              >
              <ComposedChart
                data={evolution}
                margin={{ top: 10, right: 10, bottom: 0, left: -18 }}
              >
                <defs>
                  <linearGradient id="teamAvgFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8A96B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#C8A96B" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={GRID_STROKE} vertical={false} />

                <XAxis
                  dataKey="name"
                  stroke={AXIS.stroke}
                  tick={AXIS.tick}
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  domain={[4, 9]}
                  ticks={[4, 5, 6, 7, 8, 9]}
                  allowDataOverflow
                  stroke={AXIS.stroke}
                  tick={AXIS.tick}
                  tickLine={false}
                  axisLine={false}
                />

                <ReferenceLine
                  y={teamAverage}
                  stroke="rgb(var(--rmcf-ink-rgb) / 0.35)"
                  style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.35)" }}
                  strokeDasharray="4 4"
                />

                <Tooltip
                  cursor={CURSOR_LINEA}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const point = payload[0].payload as (typeof evolution)[number];

                    return (
                      <ChartTooltip
                        title={point.label}
                        rows={[
                          {
                            label: "Media",
                            value: formatRating(point.avg),
                            color: ratingColor(point.avg),
                          },
                          { label: "Valorados", value: point.rated },
                          ...(point.result
                            ? [{ label: "Resultado", value: point.result }]
                            : []),
                        ]}
                      />
                    );
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="none"
                  fill="url(#teamAvgFill)"
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#C8A96B"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#C8A96B", strokeWidth: 0 }}
                  activeDot={{ r: 5.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* TOPS */}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Top valoraciones"
          subtitle={`Jugadores con ${MIN_FIABLE}+ partidos`}
          lectura={
            <LecturaGrafico
              ranking={topChart.map((punto) => ({
                nombre: punto.name,
                valor: punto.value,
              }))}
              unidadSerie="de nota"
            />
          }
          icon={Trophy}
          bodyClassName="p-3 sm:p-4"
        >
          {topChart.length === 0 ? (
            <EmptyState title="Sin datos suficientes" />
          ) : (
            <div
              className="w-full min-w-0"
              style={{ height: Math.max(200, topChart.length * 38 + 20) }}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={160}
                initialDimension={{ width: 320, height: 190 }}
              >
                <BarChart
                  data={topChart}
                  layout="vertical"
                  margin={{ top: 0, right: 34, bottom: 0, left: 8 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid stroke={GRID_STROKE} horizontal={false} />

                  <XAxis
                    type="number"
                    domain={[0, 10]}
                    hide
                  />

                  {/* 29/10/2026: la media del equipo como referencia vertical. */}
                  <ReferenceLine
                    x={teamAverage}
                    stroke="rgb(var(--rmcf-ink-rgb) / 0.35)"
                    style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.35)" }}
                    strokeDasharray="4 4"
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={104}
                    stroke={AXIS.stroke}
                    tick={<TickNombre />}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip
                    cursor={CURSOR_BARRA}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;

                      const point = payload[0].payload as (typeof topChart)[number];

                      return (
                        <ChartTooltip
                          title={point.name}
                          rows={[
                            {
                              label: "Media",
                              value: formatRating(point.value),
                              color: ratingColor(point.value),
                            },
                            { label: "Partidos", value: point.played },
                          ]}
                        />
                      );
                    }}
                  />

                  <Bar dataKey="value" isAnimationActive={false} radius={[0, 8, 8, 0]} barSize={18}>
                    {topChart.map((point) => (
                      <Cell key={point.name} fill={ratingColorHex(point.value)} style={{ fill: ratingColor(point.value) }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {topChart.length > 0 && <LeyendaColorNota />}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel
            title="Media por línea"
            lectura={
              <LecturaGrafico
                ranking={byLine.map((punto) => ({
                  nombre: punto.name,
                  valor: punto.value,
                }))}
                unidadSerie="de nota"
              />
            }
            icon={Award}
            bodyClassName="p-3 sm:p-4"
          >
            {byLine.length === 0 ? (
              <EmptyState title="Sin datos" />
            ) : (
              <div className="h-[190px] w-full min-w-0">
                <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={160}
                initialDimension={{ width: 320, height: 190 }}
              >
                  <BarChart
                    data={byLine}
                    margin={{ top: 10, right: 6, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />

                    <XAxis
                      dataKey="name"
                      stroke={AXIS.stroke}
                      tick={AXIS.tick}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(nombre: string) => {
                        const linea = byLine.find((x) => x.name === nombre);

                        return linea ? `${nombre} (${linea.players})` : nombre;
                      }}
                    />

                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 5, 10]}
                      stroke={AXIS.stroke}
                      tick={AXIS.tick}
                      tickLine={false}
                      axisLine={false}
                    />

                    <ReferenceLine
                      y={teamAverage}
                      stroke="rgb(var(--rmcf-ink-rgb) / 0.35)"
                      style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.35)" }}
                      strokeDasharray="4 4"
                    />

                    <Tooltip
                      cursor={CURSOR_BARRA}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;

                        const point = payload[0].payload as (typeof byLine)[number];

                        return (
                          <ChartTooltip
                            title={point.name}
                            rows={[
                              {
                                label: "Media",
                                value: formatRating(point.value),
                                color: ratingColor(point.value),
                              },
                              { label: "Jugadores", value: point.players },
                            ]}
                          />
                        );
                      }}
                    />

                    <Bar dataKey="value" isAnimationActive={false} radius={[8, 8, 0, 0]} barSize={34}>
                      {byLine.map((point) => (
                        /* 29/10/2026: la línea con menos de 3 jugadores con nota (tendencia) va atenuada, como el ranking. */
                        <Cell key={point.name} fill={ratingColorHex(point.value)} fillOpacity={point.players < 3 ? 0.5 : 1} style={{ fill: ratingColor(point.value) }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {byLine.length > 0 && (
              <>
                <LeyendaColorNota />

                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                  La línea de puntos es la media del equipo. Entre paréntesis, los jugadores con nota en cada línea
                  {byLine.some((x) => x.players < 3)
                    ? `: ${byLine
                        .filter((x) => x.players < 3)
                        .map((x) => x.name)
                        .join(" y ")} ${byLine.filter((x) => x.players < 3).length === 1 ? "es" : "son"} tendencia, no una media firme.`
                    : "."}
                </p>
              </>
            )}
          </Panel>

          <Panel title="Podio de la temporada" icon={Crown}>
            <ol className="min-w-0 space-y-2">
              {bestSorted.slice(0, 3).map((entry, index) => (
                <li
                  key={entry.player.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "#C8A96B"
                          : index === 1
                            ? "#CBD5E1"
                            : "#B45309",
                    }}
                  >
                    {index + 1}
                  </span>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.player.foto}
                    alt={entry.player.nombre}
                    className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover object-top"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {entry.player.nombre}
                    </p>

                    <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/30">
                      {nombrePuesto(entry.player.posicion)} · {entry.summary.played} PJ
                    </p>
                  </div>

                  <RatingBadge value={entry.summary.avg} />
                </li>
              ))}

            </ol>
          </Panel>
        </div>
      </div>

      {/* RANKING */}

      <Panel
        title="Ranking de la plantilla"
        subtitle={`Media del equipo ${formatRating(teamAverage)} · con menos de ${MIN_FIABLE} partidos, tendencia · pulsa un jugador para ver su ficha`}
        icon={ArrowDownWideNarrow}
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { key: "1", label: "Todos" },
                { key: "3", label: "3+ PJ" },
                { key: "5", label: "5+ PJ" },
              ]}
              value={String(minMatches)}
              onChange={(key) => setMinMatches(Number(key))}
            />

            <SegmentedControl
              options={SORTS}
              value={sortKey}
              onChange={setSortKey}
            />
          </div>
        }
      >
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-2 py-3 text-left font-medium">Jugador</th>
                <th className="px-2 py-3 text-center font-medium">PJ</th>
                <th className="px-2 py-3 text-center font-medium">Tit.</th>
                <th className="px-2 py-3 text-center font-medium">Min</th>
                <th className="px-2 py-3 text-left font-medium">Media</th>
                <th className="px-2 py-3 text-center font-medium">Pond.</th>
                <th className="px-2 py-3 text-center font-medium">Forma</th>
                <th className="px-2 py-3 text-center font-medium">Tend.</th>
                <th className="px-2 py-3 text-center font-medium">Máx</th>
                <th className="px-2 py-3 text-center font-medium">Mín</th>
                <th className="px-4 py-3 text-center font-medium">G+A</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((entry, index) => (
                <tr
                  key={entry.player.id}
                  onClick={() => onSelectPlayer(entry.player.id)}
                  className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 text-[11px] tabular-nums text-white/30">
                    {index + 1}
                  </td>

                  <td className="px-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.player.foto}
                        alt={entry.player.nombre}
                        className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover object-top"
                      />

                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {nombreVisible(entry.player.nombre)}
                        </p>

                        <p className="truncate text-[10px] uppercase tracking-[0.14em] text-white/30">
                          {nombrePuesto(entry.player.posicion)}
                          {entry.summary.played < MIN_FIABLE
                            ? ` · tendencia (${entry.summary.played} PJ)`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/70">
                    {entry.summary.played}
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/45">
                    {entry.summary.starts}
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/45">
                    {entry.summary.minutes}
                  </td>

                  <td className="px-2 py-2.5">
                    <div className="flex min-w-[132px] items-center gap-2">
                      {/* Con pocos partidos la media es tendencia: se atenúa y lleva sus PJ al lado. */}
                      <div className={`flex min-w-0 flex-1 items-center gap-2 ${entry.summary.played < MIN_FIABLE ? "opacity-50" : ""}`}>
                        <RatingBadge value={entry.summary.avg} size="sm" />
                        <RatingBar value={entry.summary.avg} />
                      </div>
                      {entry.summary.played < MIN_FIABLE ? (
                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/60">{entry.summary.played} PJ</span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/60">
                    {formatRating(entry.summary.weighted)}
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/60">
                    {formatRating(entry.summary.form)}
                  </td>

                  <td className="px-2 py-2.5 text-center">
                    <TrendPill value={entry.summary.trend} />
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-emerald-300/80">
                    {formatRating(entry.summary.best?.entry.rating ?? 0)}
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-rose-300/70">
                    {formatRating(entry.summary.worst?.entry.rating ?? 0)}
                  </td>

                  <td className="px-4 py-2.5 text-center tabular-nums text-white/60">
                    {entry.summary.goals}+{entry.summary.assists}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-white/35">
              Ningún jugador alcanza ese mínimo de partidos
            </div>
          )}
        </div>
      </Panel>

      {/* MEJORES ACTUACIONES */}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <BestPerformances ranked={ranked} onSelectPlayer={onSelectPlayer} />

        <Panel
          title="Partido a partido"
          subtitle="Media del equipo en cada jornada"
          icon={Flame}
          bodyClassName="p-0"
        >
          <ul className="min-w-0 divide-y divide-white/5">
            {[...matchSummaries]
              .reverse()
              .slice(0, 10)
              .map((item) => (
                <li
                  key={item.match.id}
                  className="flex min-w-0 items-center gap-3 px-4 py-2.5"
                >
                  <span className="w-14 shrink-0 text-[10px] tabular-nums text-white/30">
                    {formatMatchDateShort(item.match)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">
                      {rivalEnMayusculas(item.match)}
                    </p>

                    <p className="truncate text-[10px] text-white/30">
                      {item.match.result
                        ? `${marcadorUniforme(item.match.result)} · `
                        : ""}
                      {item.rated} valorados
                    </p>
                  </div>

                  <RatingBadge value={item.avg} size="sm" />
                </li>
              ))}

            {matchSummaries.length === 0 && (
              <li className="px-4 py-10 text-center text-xs text-white/35">
                Sin partidos valorados
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** Las diez mejores notas individuales de la temporada. */
function BestPerformances({
  ranked,
  onSelectPlayer,
}: {
  ranked: RankedPlayer[];
  onSelectPlayer: (playerId: string) => void;
}) {
  const best = useMemo(() => {
    return ranked
      .flatMap((entry) =>
        entry.summary.entries
          .filter((item) => item.entry.rating > 0)
          .map((item) => ({ player: entry.player, ...item }))
      )
      .sort((a, b) => b.entry.rating - a.entry.rating)
      .slice(0, 10);
  }, [ranked]);

  return (
    <Panel
      title="Mejores actuaciones"
      subtitle="Notas más altas de la temporada"
      icon={Medal}
      bodyClassName="p-0"
    >
      <ul className="min-w-0 divide-y divide-white/5">
        {best.map((item) => (
          <li key={`${item.player.id}-${item.match.id}`}>
            <button
              type="button"
              onClick={() => onSelectPlayer(item.player.id)}
              className="flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.player.foto}
                alt={nombreVisible(item.player.nombre)}
                className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover object-top"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {nombreVisible(item.player.nombre)}
                </p>

                <p className="truncate text-[10px] text-white/30">
                  {rivalEnMayusculas(item.match)} ·{" "}
                  {formatMatchDateShort(item.match)}
                </p>
              </div>

              <RatingBadge value={item.entry.rating} size="sm" />
            </button>
          </li>
        ))}

        {best.length === 0 && (
          <li className="px-4 py-10 text-center text-xs text-white/35">
            Sin valoraciones registradas
          </li>
        )}
      </ul>
    </Panel>
  );
}

