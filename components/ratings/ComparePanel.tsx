"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GitCompareArrows, Scale, Users } from "lucide-react";

import { formatRating, sortedMatches } from "@/lib/ratings/compute";
import { formatMatchDateShort, matchLabel } from "@/lib/ratings/matches";
import { AREA_KEYS, AREA_LABELS, RatingsSeason } from "@/lib/ratings/types";

import { AXIS, ChartTooltip, GRID_STROKE } from "./charts";
import type { RankedPlayer } from "./TeamPanel";
import { EmptyState, Panel, RatingBadge, TrendPill } from "./ui";

const SERIES_COLORS = ["#C8A96B", "#22D3EE", "#4ADE80", "#F472B6"];

const MAX_PLAYERS = 4;

export function ComparePanel({
  season,
  ranked,
}: {
  season: RatingsSeason;
  ranked: RankedPlayer[];
}) {
  const candidates = useMemo(
    () =>
      [...ranked]
        .filter((entry) => entry.summary.played > 0)
        .sort((a, b) => b.summary.avg - a.summary.avg),
    [ranked]
  );

  /* Hasta que se elige a mano, la comparativa arranca con los dos mejores. */
  const [picked, setPicked] = useState<string[] | null>(null);

  const selected = useMemo(
    () => picked ?? candidates.slice(0, 2).map((entry) => entry.player.id),
    [picked, candidates]
  );

  const chosen = useMemo(
    () =>
      selected
        .map((id) => candidates.find((entry) => entry.player.id === id))
        .filter((entry): entry is RankedPlayer => Boolean(entry)),
    [selected, candidates]
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setPicked(selected.filter((value) => value !== id));
      return;
    }

    if (selected.length >= MAX_PLAYERS) return;

    setPicked([...selected, id]);
  };

  const colorOf = (id: string) =>
    SERIES_COLORS[Math.max(0, selected.indexOf(id)) % SERIES_COLORS.length];

  /* Serie común: todos los partidos del histórico, con hueco donde no jugó. */
  const series = useMemo(() => {
    return sortedMatches(season).map((record) => {
      const point: Record<string, string | number | null> = {
        name: formatMatchDateShort(record.match),
        label: matchLabel(record.match),
      };

      chosen.forEach((entry) => {
        const rating = record.players[entry.player.id]?.rating ?? 0;

        point[entry.player.id] = rating > 0 ? rating : null;
      });

      return point;
    });
  }, [season, chosen]);

  const radar = useMemo(
    () =>
      AREA_KEYS.map((key) => {
        const point: Record<string, string | number> = {
          area: AREA_LABELS[key],
        };

        chosen.forEach((entry) => {
          point[entry.player.id] = entry.summary.areas[key];
        });

        return point;
      }),
    [chosen]
  );

  const hasAreas = radar.some((point) =>
    chosen.some((entry) => Number(point[entry.player.id]) > 0)
  );

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aún no hay jugadores valorados"
        description="Registra las notas de un partido para poder comparar."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* SELECCIÓN */}

      <Panel
        title="Jugadores a comparar"
        subtitle={`Hasta ${MAX_PLAYERS} a la vez · ${chosen.length} seleccionados`}
        icon={GitCompareArrows}
      >
        <div className="flex min-w-0 flex-wrap gap-2">
          {candidates.map((entry) => {
            const active = selected.includes(entry.player.id);
            const color = colorOf(entry.player.id);

            return (
              <button
                key={entry.player.id}
                type="button"
                onClick={() => toggle(entry.player.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                  active
                    ? "text-white"
                    : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"
                }`}
                style={
                  active
                    ? { borderColor: `${color}88`, backgroundColor: `${color}1A` }
                    : undefined
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.player.foto}
                  alt={entry.player.nombre}
                  className="h-6 w-6 rounded-md object-cover object-top"
                />

                <span className="max-w-[120px] truncate font-medium">
                  {entry.player.apodo || entry.player.nombre}
                </span>

                <span className="tabular-nums text-white/40">
                  {formatRating(entry.summary.avg)}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {chosen.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Elige al menos un jugador"
          description="Pulsa sobre las fichas de arriba para añadirlos a la comparativa."
        />
      ) : (
        <>
          {/* EVOLUCIÓN COMPARADA */}

          <Panel
            title="Evolución comparada"
            subtitle="Nota de cada jugador partido a partido"
            bodyClassName="p-3 sm:p-4"
          >
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={series}
                  margin={{ top: 10, right: 10, bottom: 0, left: -18 }}
                >
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

                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;

                      const point = payload[0].payload as Record<string, string>;

                      return (
                        <ChartTooltip
                          title={point.label}
                          rows={chosen
                            .map((entry) => ({
                              label: entry.player.apodo || entry.player.nombre,
                              value: formatRating(
                                Number(point[entry.player.id]) || 0
                              ),
                              color: colorOf(entry.player.id),
                            }))
                            .filter((row) => row.value !== "—")}
                        />
                      );
                    }}
                  />

                  <Legend
                    formatter={(value) => {
                      const entry = chosen.find(
                        (item) => item.player.id === value
                      );

                      return (
                        <span className="text-[11px] text-white/60">
                          {entry
                            ? entry.player.apodo || entry.player.nombre
                            : value}
                        </span>
                      );
                    }}
                  />

                  {chosen.map((entry) => (
                    <Line
                      key={entry.player.id}
                      type="monotone"
                      dataKey={entry.player.id}
                      stroke={colorOf(entry.player.id)}
                      strokeWidth={2.5}
                      connectNulls
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            {/* RADAR */}

            <Panel
              title="Perfil por áreas"
              subtitle="Media de la temporada"
              bodyClassName="p-3 sm:p-4"
            >
              {!hasAreas ? (
                <EmptyState title="Sin notas por área registradas" />
              ) : (
                <div className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radar} outerRadius="70%">
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

                      {chosen.map((entry) => (
                        <Radar
                          key={entry.player.id}
                          dataKey={entry.player.id}
                          stroke={colorOf(entry.player.id)}
                          fill={colorOf(entry.player.id)}
                          fillOpacity={0.18}
                        />
                      ))}

                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;

                          const point = payload[0].payload as Record<
                            string,
                            string
                          >;

                          return (
                            <ChartTooltip
                              title={point.area}
                              rows={chosen.map((entry) => ({
                                label:
                                  entry.player.apodo || entry.player.nombre,
                                value: formatRating(
                                  Number(point[entry.player.id]) || 0
                                ),
                                color: colorOf(entry.player.id),
                              }))}
                            />
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            {/* TABLA */}

            <Panel title="Cara a cara" bodyClassName="p-0">
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] font-medium text-white/35">
                        Métrica
                      </th>

                      {chosen.map((entry) => (
                        <th key={entry.player.id} className="px-2 py-3">
                          <div className="flex flex-col items-center gap-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={entry.player.foto}
                              alt={entry.player.nombre}
                              className="h-9 w-9 rounded-lg border object-cover object-top"
                              style={{
                                borderColor: `${colorOf(entry.player.id)}88`,
                              }}
                            />

                            <span className="max-w-[92px] truncate text-[11px] font-medium text-white">
                              {entry.player.apodo || entry.player.nombre}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <CompareRow
                      label="Media"
                      chosen={chosen}
                      render={(entry) => (
                        <RatingBadge value={entry.summary.avg} size="sm" />
                      )}
                    />

                    <CompareRow
                      label="Ponderada"
                      chosen={chosen}
                      render={(entry) => formatRating(entry.summary.weighted)}
                    />

                    <CompareRow
                      label="Últimos 5"
                      chosen={chosen}
                      render={(entry) => formatRating(entry.summary.form)}
                    />

                    <CompareRow
                      label="Progresión"
                      chosen={chosen}
                      render={(entry) => <TrendPill value={entry.summary.trend} />}
                    />

                    <CompareRow
                      label="Partidos"
                      chosen={chosen}
                      render={(entry) => entry.summary.played}
                    />

                    <CompareRow
                      label="Titularidades"
                      chosen={chosen}
                      render={(entry) => entry.summary.starts}
                    />

                    <CompareRow
                      label="Minutos"
                      chosen={chosen}
                      render={(entry) => entry.summary.minutes}
                    />

                    <CompareRow
                      label="Goles"
                      chosen={chosen}
                      render={(entry) => entry.summary.goals}
                    />

                    <CompareRow
                      label="Asistencias"
                      chosen={chosen}
                      render={(entry) => entry.summary.assists}
                    />

                    <CompareRow
                      label="Mejor nota"
                      chosen={chosen}
                      render={(entry) =>
                        formatRating(entry.summary.best?.entry.rating ?? 0)
                      }
                    />

                    <CompareRow
                      label="Peor nota"
                      chosen={chosen}
                      render={(entry) =>
                        formatRating(entry.summary.worst?.entry.rating ?? 0)
                      }
                    />

                    {AREA_KEYS.map((key) => (
                      <CompareRow
                        key={key}
                        label={AREA_LABELS[key]}
                        chosen={chosen}
                        render={(entry) => formatRating(entry.summary.areas[key])}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function CompareRow({
  label,
  chosen,
  render,
}: {
  label: string;
  chosen: RankedPlayer[];
  render: (entry: RankedPlayer) => React.ReactNode;
}) {
  /* Se resalta el mejor valor numérico de la fila. */
  const values = chosen.map((entry) => {
    const node = render(entry);

    return typeof node === "number" ? node : null;
  });

  const max = Math.max(...values.map((value) => value ?? -Infinity));

  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-white/35">
        {label}
      </td>

      {chosen.map((entry, index) => (
        <td
          key={entry.player.id}
          className={`px-2 py-2.5 text-center tabular-nums ${
            values[index] !== null && values[index] === max && max > 0
              ? "font-semibold text-white"
              : "text-white/60"
          }`}
        >
          {render(entry)}
        </td>
      ))}
    </tr>
  );
}

