"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Gauge, MessageSquareText, Star, Timer } from "lucide-react";

import {
  PlayerSummary,
  playerEntries,
  formatRating,
  ratingColor,
  summarize,
} from "@/lib/ratings/compute";
import {
  formatMatchDate,
  formatMatchDateShort,
  matchLabel,
  matchOutcome,
} from "@/lib/ratings/matches";
import { AREA_KEYS, AREA_LABELS, RatingsSeason } from "@/lib/ratings/types";

import { AXIS, ChartTooltip, GRID_STROKE } from "./charts";
import { EmptyState, Panel, RatingBadge, StatCard, TrendPill } from "./ui";

const OUTCOME_TONE = {
  W: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  D: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  L: "border-rose-400/25 bg-rose-400/10 text-rose-300",
} as const;

const OUTCOME_SHORT = { W: "V", D: "E", L: "D" } as const;

/**
 * Valoraciones de partido de un jugador.
 *
 * Se usa tal cual dentro de la ficha individual y como panel de detalle en la
 * página de equipo, así que no depende de nada más que del histórico y del id.
 */
export function PlayerRatingsTab({
  season,
  playerId,
  compact = false,
}: {
  season: RatingsSeason;
  playerId: string;
  compact?: boolean;
}) {
  const entries = useMemo(
    () => playerEntries(season, playerId),
    [season, playerId]
  );

  const summary: PlayerSummary = useMemo(
    () => summarize(playerId, entries),
    [playerId, entries]
  );

  const series = useMemo(
    () =>
      entries
        .filter((item) => item.entry.rating > 0)
        .map((item) => ({
          name: formatMatchDateShort(item.match),
          label: matchLabel(item.match),
          result: item.match.result,
          rating: item.entry.rating,
          minutes: item.entry.minutes,
        })),
    [entries]
  );

  const radar = useMemo(
    () =>
      AREA_KEYS.map((key) => ({
        area: AREA_LABELS[key],
        value: summary.areas[key],
      })),
    [summary]
  );

  const hasAreas = radar.some((item) => item.value > 0);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="Sin valoraciones todavía"
        description="Cuando se registren las notas de un partido aparecerán aquí su evolución, sus mejores actuaciones y los comentarios del cuerpo técnico."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* INDICADORES */}

      <div className="grid min-w-0 gap-3 grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Media"
          value={formatRating(summary.avg)}
          hint={`${summary.played} partidos valorados`}
          accent={ratingColor(summary.avg)}
        />

        <StatCard
          label="Últimos 5"
          value={formatRating(summary.form)}
          hint="Estado de forma"
          accent={ratingColor(summary.form)}
        />

        <StatCard
          label="Mejor partido"
          value={formatRating(summary.best?.entry.rating ?? 0)}
          hint={summary.best ? matchLabel(summary.best.match) : undefined}
          accent="var(--rmcf-rate-top)"
        />

        <StatCard
          label="Minutos"
          value={summary.minutes}
          hint={`${summary.starts} como titular`}
        />
      </div>

      {/* EVOLUCIÓN + RADAR */}

      <div
        className={`grid min-w-0 gap-4 ${
          compact ? "" : "xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
        }`}
      >
        <Panel
          title="Evolución"
          subtitle="Nota partido a partido"
          icon={Gauge}
          bodyClassName="p-3 sm:p-4"
        >
          {series.length === 0 ? (
            <EmptyState title="Sin notas registradas" />
          ) : (
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={series}
                  margin={{ top: 10, right: 10, bottom: 0, left: -18 }}
                >
                  <defs>
                    <linearGradient
                      id={`playerFill-${playerId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#C8A96B" stopOpacity={0.32} />
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
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    stroke={AXIS.stroke}
                    tick={AXIS.tick}
                    tickLine={false}
                    axisLine={false}
                  />

                  <ReferenceLine
                    y={summary.avg}
                    stroke="rgba(255,255,255,0.25)"
                    strokeDasharray="4 4"
                  />

                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;

                      const point = payload[0].payload as (typeof series)[number];

                      return (
                        <ChartTooltip
                          title={point.label}
                          rows={[
                            {
                              label: "Nota",
                              value: formatRating(point.rating),
                              color: ratingColor(point.rating),
                            },
                            { label: "Minutos", value: point.minutes },
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
                    dataKey="rating"
                    stroke="none"
                    fill={`url(#playerFill-${playerId})`}
                  />

                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#C8A96B"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#C8A96B", strokeWidth: 0 }}
                    activeDot={{ r: 5.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel
            title="Perfil por áreas"
            subtitle="Media de la temporada"
            icon={Star}
            bodyClassName="p-3 sm:p-4"
          >
            {!hasAreas ? (
              <EmptyState
                title="Sin notas por área"
                description="Despliega el detalle del jugador al valorar un partido para puntuar técnica, táctica, física y mental."
              />
            ) : (
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />

                    <PolarAngleAxis
                      dataKey="area"
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    />

                    <PolarRadiusAxis
                      domain={[0, 10]}
                      tick={false}
                      axisLine={false}
                    />

                    <Radar
                      dataKey="value"
                      stroke="#C8A96B"
                      fill="#C8A96B"
                      fillOpacity={0.28}
                    />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;

                        const point = payload[0].payload as (typeof radar)[number];

                        return (
                          <ChartTooltip
                            title={point.area}
                            rows={[
                              {
                                label: "Media",
                                value: formatRating(point.value),
                                color: ratingColor(point.value),
                              },
                            ]}
                          />
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Aportación" icon={Timer}>
            <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
              <Metric label="Goles" value={summary.goals} />
              <Metric label="Asistencias" value={summary.assists} />
              <Metric label="Titularidades" value={summary.starts} />
              <Metric
                label="Progresión"
                value={<TrendPill value={summary.trend} />}
              />
              <Metric label="Amarillas" value={summary.yellow} />
              <Metric label="Rojas" value={summary.red} />
            </dl>
          </Panel>
        </div>
      </div>

      {/* PARTIDOS */}

      <Panel
        title="Partido a partido"
        subtitle={`${entries.length} registros`}
        icon={Clock}
        bodyClassName="p-0"
      >
        <ul className="min-w-0 divide-y divide-white/5">
          {[...entries].reverse().map((item) => {
            const outcome = matchOutcome(item.match);

            return (
              <li key={item.match.id} className="min-w-0 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <RatingBadge value={item.entry.rating} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {matchLabel(item.match)}
                    </p>

                    <p className="truncate text-[11px] text-white/30">
                      {formatMatchDate(item.match)} · {item.match.competition}
                    </p>
                  </div>

                  {outcome && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${OUTCOME_TONE[outcome]}`}
                    >
                      {OUTCOME_SHORT[outcome]} {item.match.result}
                    </span>
                  )}

                  <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                    {item.entry.minutes}′
                  </span>

                  {item.entry.starter && (
                    <span className="shrink-0 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                      Titular
                    </span>
                  )}

                  {(item.entry.goals > 0 || item.entry.assists > 0) && (
                    <span className="shrink-0 text-[11px] tabular-nums text-white/45">
                      {item.entry.goals}G · {item.entry.assists}A
                    </span>
                  )}
                </div>

                {/* ÁREAS DEL PARTIDO */}

                {AREA_KEYS.some((key) => (item.entry.areas?.[key] ?? 0) > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {AREA_KEYS.map((key) => {
                      const value = item.entry.areas?.[key] ?? 0;

                      if (!value) return null;

                      return (
                        <span
                          key={key}
                          className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-white/50"
                        >
                          {AREA_LABELS[key]} {formatRating(value)}
                        </span>
                      );
                    })}
                  </div>
                )}

                {item.entry.note.trim() && (
                  <p className="mt-2 flex min-w-0 gap-2 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 text-xs leading-relaxed text-white/60">
                    <MessageSquareText
                      size={13}
                      className="mt-0.5 shrink-0 text-[#C8A96B]"
                    />

                    <span className="min-w-0 whitespace-pre-line">
                      {item.entry.note}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2">
      <dt className="truncate text-[10px] uppercase tracking-[0.16em] text-white/30">
        {label}
      </dt>

      <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-white">
        {value}
      </dd>
    </div>
  );
}
