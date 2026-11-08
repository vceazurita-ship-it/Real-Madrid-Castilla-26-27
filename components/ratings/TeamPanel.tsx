"use client";

import { LecturaGrafico } from "@/components/ui/LecturaGrafico";
import { ResponsiveConVistas } from "@/components/data/visual/ResponsiveConVistas";
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
  LabelList,
  Line,
  ReferenceLine,
  Scatter,
  ScatterChart,
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
  const [todasCols, setTodasCols] = useState(false);
  const colSec = todasCols ? "" : "max-sm:hidden";

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

  /* 30/10/2026: la lectura del top se hace sobre TODOS los que tienen 4+
     partidos, no sólo sobre los diez del gráfico: si no, «abajo» era el
     décimo y parecía que nadie iba peor. */
  const elegiblesTop = useMemo(
    () => bestSorted.filter((entry) => entry.summary.played >= MIN_FIABLE),
    [bestSorted]
  );

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

  /* 07/11/2026: nota frente a minutos de todos los que tienen 4+ partidos.
     Se rotulan sólo los tres primeros, el último y el de más minutos, para
     que los nombres no se pisen. */
  const topChart = useMemo(() => {
    const masMinutos = [...elegiblesTop].sort(
      (a, b) => b.summary.minutes - a.summary.minutes
    )[0];

    const maxMin = Math.max(1, ...elegiblesTop.map((e) => e.summary.minutes));
    const puntos = elegiblesTop.map((entry, index) => {
      const nombre = nombreVisible(entry.player.nombre);
      const rotular =
        index < 3 ||
        index === elegiblesTop.length - 1 ||
        entry === masMinutos;

      return {
        name: nombre,
        rotulo: rotular ? nombre.split(" ").slice(-1)[0] : "",
        value: entry.summary.avg,
        minutes: entry.summary.minutes,
        played: entry.summary.played,
        /* 08/11/2026: si dos rótulos chocan (Cestero sobre Aguado), el
           segundo va debajo del punto. */
        abajo: false,
      };
    });

    const rotulados = puntos.filter((p) => p.rotulo);
    rotulados.forEach((p, i) => {
      const choca = rotulados
        .slice(0, i)
        .some((q) => !q.abajo && Math.abs(q.minutes - p.minutes) / maxMin < 0.14 && Math.abs(q.value - p.value) < 0.45);
      if (choca) p.abajo = true;
    });

    return puntos;
  }, [elegiblesTop]);

  const dominioNota = useMemo((): [number, number] => {
    const valores = topChart.map((p) => p.value);
    const lo = Math.min(4, ...valores.map((v) => Math.floor(v)));
    const hi = Math.max(9, ...valores.map((v) => Math.ceil(v)));

    return [lo, hi];
  }, [topChart]);

  const ticksNota = useMemo(() => {
    const out: number[] = [];

    for (let v = dominioNota[0]; v <= dominioNota[1]; v += 1) out.push(v);

    return out;
  }, [dominioNota]);

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

      const notas = members.reduce((total, entry) => total + entry.summary.played, 0);

      return { name: group.label, value, players: members.length, notas };
    }).filter((item) => item.players > 0);
  }, [ranked]);

  const dominioLineas = useMemo((): [number, number] => {
    const valores = byLine.map((l) => l.value);
    const lo = Math.min(4, ...valores.map((v) => Math.floor(v)));
    const hi = Math.max(9, ...valores.map((v) => Math.ceil(v)));

    return [lo, hi];
  }, [byLine]);

  const ticksLineas = useMemo(() => {
    const out: number[] = [];

    for (let v = dominioLineas[0]; v <= dominioLineas[1]; v += 1) out.push(v);

    return out;
  }, [dominioLineas]);

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
          value={best ? nombreVisible(best.player.nombre) : ""}
          hint={
            best
              ? `${formatRating(best.summary.avg)} en ${plural(best.summary.played, "partido", "partidos")} · nota del cuerpo técnico, no el índice Wyscout (está en Comparativa categoría)`
              : undefined
          }
          accent="var(--rmcf-gold-ink)"
        />

        <StatCard
          label="Mayor progresión"
          value={
            mostImproved
              ? nombreVisible(mostImproved.player.nombre)
              : ""
          }
          hint={
            mostImproved
              ? `${formatSigned(mostImproved.summary.trend)}: ${desdeHasta(mostImproved)}sus 3 últimas notas frente a las 3 anteriores · ${mostImproved.summary.played} PJ · media de la temporada ${formatRating(mostImproved.summary.avg)} · entre quienes tienen ${MIN_FIABLE}+ PJ`
              : undefined
          }
          accent="var(--rmcf-rate-good)"
        />

        {decisivoClaro && topScorer && (
          <StatCard
            label="Más decisivo"
            value={nombreVisible(topScorer.player.nombre)}
            hint={`${plural(topScorer.summary.goals, "gol", "goles")} · ${plural(topScorer.summary.assists, "asistencia", "asistencias")}`}
            accent="var(--rmcf-rate-top)"
          />
        )}
      </div>

      {/* EVOLUCIÓN */}

      <Panel
        title="Evolución del equipo"
        subtitle="Media de las notas de cada partido · un punto por partido"
        lectura={
          <LecturaGrafico
            serie={evolution.map((punto) => ({
              etiqueta: punto.name,
              valor: punto.avg,
            }))}
            sentido="mas-es-mejor"
            unidadSerie="de nota"
            nota={ultimoPartido(evolution, teamAverage)}
          />
        }
        icon={LineChartIcon}
        bodyClassName="p-3 sm:p-4"
      >
        {evolution.length === 0 ? (
          <EmptyState title="Sin partidos valorados" />
        ) : (
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveConVistas
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

                {/* 30/10/2026: «linear», no «monotone»: la curva se inventaba
                    notas entre un partido y el siguiente. */}
                <Area
                  type="linear"
                  dataKey="avg"
                  stroke="none"
                  fill="url(#teamAvgFill)"
                  isAnimationActive={false}
                />

                <Line
                  type="linear"
                  dataKey="avg"
                  stroke="#C8A96B"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#C8A96B", strokeWidth: 0 }}
                  activeDot={{ r: 5.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveConVistas>
          </div>
        )}
      </Panel>

      {/* TOPS */}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Nota y minutos"
          subtitle={`Los ${topChart.length} jugadores con ${MIN_FIABLE}+ partidos · cada punto, un jugador · arriba, mejor nota; a la derecha, más minutos`}
          lectura={<LecturaGrafico nota={lecturaTop(elegiblesTop)} />}
          icon={Trophy}
          bodyClassName="p-3 sm:p-4"
        >
          {topChart.length === 0 ? (
            <EmptyState title="Sin datos suficientes" />
          ) : (
            <div className="h-[300px] w-full min-w-0 sm:h-[340px]">
              <ResponsiveConVistas
                width="100%"
                height="100%"
                minHeight={160}
                initialDimension={{ width: 320, height: 190 }}
              >
                {/* 07/11/2026: antes era un ranking en barras que repetía
                    la tabla de abajo; ahora cruza la nota con los minutos,
                    que la tabla no deja ver de un vistazo. */}
                <ScatterChart margin={{ top: 18, right: 18, bottom: 4, left: -14 }}>
                  <CartesianGrid stroke={GRID_STROKE} />

                  <XAxis
                    type="number"
                    dataKey="minutes"
                    name="Minutos"
                    domain={[0, "dataMax"]}
                    stroke={AXIS.stroke}
                    tick={AXIS.tick}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}′`}
                  />

                  <YAxis
                    type="number"
                    dataKey="value"
                    name="Media"
                    domain={dominioNota}
                    ticks={ticksNota}
                    stroke={AXIS.stroke}
                    tick={AXIS.tick}
                    tickLine={false}
                    axisLine={false}
                  />

                  {teamAverage > 0 && (
                    <ReferenceLine
                      y={teamAverage}
                      stroke="rgb(var(--rmcf-ink-rgb) / 0.45)"
                      style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.45)" }}
                      strokeDasharray="4 4"
                      /* 08/11/2026: sin rótulo dentro: caía sobre los puntos
                         (Fortea). La media se dice bajo el gráfico. */
                    />
                  )}

                  <Tooltip
                    cursor={CURSOR_LINEA}
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
                            { label: "Minutos", value: `${point.minutes}′` },
                          ]}
                        />
                      );
                    }}
                  />

                  <Scatter
                    data={topChart}
                    isAnimationActive={false}
                    shape={(props: unknown) => {
                      const { cx, cy, payload } = props as {
                        cx?: number;
                        cy?: number;
                        payload?: (typeof topChart)[number];
                      };

                      if (cx == null || cy == null || !payload) return <g />;

                      return (
                        <g>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill={ratingColorHex(payload.value)}
                            style={{ fill: ratingColor(payload.value) }}
                            stroke="rgb(var(--rmcf-ink-rgb) / 0.35)"
                          />
                          {payload.rotulo && (
                            <text
                              x={cx}
                              y={payload.abajo ? cy + 19 : cy - 10}
                              textAnchor="middle"
                              fontSize={11}
                              style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.8)" }}
                            >
                              {payload.rotulo}
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveConVistas>
            </div>
          )}

          {topChart.length > 0 && (
            <>
              <LeyendaColorNota />
              {teamAverage > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/55">
                  <span
                    aria-hidden
                    className="inline-block w-5 border-t-2 border-dashed"
                    style={{ borderColor: "rgb(var(--rmcf-ink-rgb) / 0.45)" }}
                  />
                  media del equipo {formatRating(teamAverage)} · arriba a la derecha, más nota y más minutos: los referentes; abajo a la derecha, mucho minuto con nota baja: a revisar
                </p>
              )}
            </>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel
            title="Media por línea"
            lectura={
              <LecturaGrafico nota={lecturaLineas(byLine)} />
            }
            icon={Award}
            bodyClassName="p-3 sm:p-4"
          >
            {byLine.length === 0 ? (
              <EmptyState title="Sin datos" />
            ) : (
              <div className="h-[250px] w-full min-w-0">
                <ResponsiveConVistas
                width="100%"
                height="100%"
                minHeight={160}
                initialDimension={{ width: 320, height: 220 }}
              >
                  <BarChart
                    data={byLine}
                    margin={{ top: 30, right: 6, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />

                    {/* 29/10/2026: «n jugadores» en una segunda línea bajo
                        cada barra, igual en todas. */}
                    <XAxis
                      dataKey="name"
                      stroke={AXIS.stroke}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      height={52}
                      tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string } }) => {
                        const nombre = String(props.payload?.value ?? "");
                        const linea = byLine.find((x) => x.name === nombre);

                        /* 07/11/2026: la base en dos renglones; en una sola
                           línea se pisaba con la de al lado en el móvil. */
                        return (
                          <text x={props.x} y={props.y} textAnchor="middle" style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.7)" }}>
                            <tspan x={props.x} dy={12} fontSize={11}>{nombre}</tspan>
                            {linea && (
                              <>
                                <tspan x={props.x} dy={13} fontSize={10} style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.55)" }}>
                                  {linea.players} jug.
                                </tspan>
                                <tspan x={props.x} dy={12} fontSize={10} style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.55)" }}>
                                  {linea.notas} notas
                                </tspan>
                              </>
                            )}
                          </text>
                        );
                      }}
                    />

                    {/* 07/11/2026: de 4 a 9, como la evolución del equipo:
                        desde 0 las diferencias de casi un punto no se veían. */}
                    <YAxis
                      domain={dominioLineas}
                      ticks={ticksLineas}
                      allowDataOverflow
                      stroke={AXIS.stroke}
                      tick={AXIS.tick}
                      tickLine={false}
                      axisLine={false}
                    />

                    {teamAverage > 0 && (
                      <ReferenceLine
                        y={teamAverage}
                        stroke="rgb(var(--rmcf-ink-rgb) / 0.45)"
                        style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.45)" }}
                        strokeDasharray="4 4"
                      />
                    )}

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

                      {/* La cifra encima de cada barra y, si es muestra
                          corta, «tendencia» sobre ella. */}
                      <LabelList
                        dataKey="value"
                        content={(props: unknown) => {
                          const { x, y, width, index } = props as {
                            x?: number | string;
                            y?: number | string;
                            width?: number | string;
                            index?: number;
                          };
                          const punto = index != null ? byLine[index] : undefined;

                          if (!punto || x == null || y == null) return null;

                          const cx = Number(x) + Number(width ?? 0) / 2;
                          const cy = Number(y);

                          return (
                            <g>
                              <text x={cx} y={cy - 5} textAnchor="middle" fontSize={12} fontWeight={700} style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.9)" }}>
                                {formatRating(punto.value)}
                              </text>
                              {punto.players < 3 && (
                                <text x={cx} y={cy - 19} textAnchor="middle" fontSize={10} style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.55)" }}>
                                  tendencia
                                </text>
                              )}
                            </g>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveConVistas>
              </div>
            )}

            {byLine.length > 0 && (
              <>
                <LeyendaColorNota />

                {/* 30/10/2026: la media del equipo va aquí y no dentro del
                    gráfico, donde se montaba sobre la barra de Ataque. */}
                {teamAverage > 0 && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/55">
                    <span
                      aria-hidden
                      className="inline-block w-5 border-t-2 border-dashed"
                      style={{ borderColor: "rgb(var(--rmcf-ink-rgb) / 0.45)" }}
                    />
                    media del equipo {formatRating(teamAverage)}
                  </p>
                )}

                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                  Bajo cada barra, los jugadores con nota en esa línea y cuántas notas suman
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
                      {nombreVisible(entry.player.nombre)}
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
        subtitle={`Media del equipo ${formatRating(teamAverage)} · con menos de ${MIN_FIABLE} partidos, tendencia (fila atenuada) · Pond. = media por minutos · Forma = últimos 5 · Tend. = 3 últimas frente a las 3 anteriores · pulsa un jugador para ver su ficha`}
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

            {/* 07/11/2026: en el móvil, sólo lo esencial (PJ, Min, Media,
                Tend., G+A); el resto, a un toque. */}
            <button
              type="button"
              onClick={() => setTodasCols((v) => !v)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/65 transition hover:bg-white/[0.05] sm:hidden"
            >
              {todasCols ? "Menos columnas" : "Ver más columnas"}
            </button>
          </div>
        }
      >
        <div className="min-w-0 overflow-x-auto">
          <table className={`w-full border-collapse text-sm ${todasCols ? "min-w-[840px]" : "sm:min-w-[840px]"}`}>
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">#</th>
                <th className="sticky left-0 z-[1] bg-[#11161D] px-2 py-3 text-left font-medium max-sm:pl-4">Jugador</th>
                <th className="px-2 py-3 text-center font-medium" title="Partidos con nota">PJ</th>
                <th className={`px-2 py-3 text-center font-medium ${colSec}`} title="Titularidades en esos partidos con nota">Tit.</th>
                <th className="px-2 py-3 text-center font-medium">Min</th>
                <th className="px-2 py-3 text-left font-medium">Media</th>
                <th className={`px-2 py-3 text-center font-medium ${colSec}`} title="Media ponderada por minutos">Pond.</th>
                <th className={`px-2 py-3 text-center font-medium ${colSec}`} title="Media de los últimos 5 partidos">Forma</th>
                <th className="px-2 py-3 text-center font-medium" title="Sus 3 últimas notas frente a las 3 anteriores">Tend.</th>
                <th className={`px-2 py-3 text-center font-medium ${colSec}`} title="Su mejor nota en sus PJ">Máx</th>
                <th className={`px-2 py-3 text-center font-medium ${colSec}`} title="Su peor nota en sus PJ">Mín</th>
                <th className="px-4 py-3 text-center font-medium" title="Goles + asistencias">G+A</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((entry, index) => (
                <tr
                  key={entry.player.id}
                  onClick={() => onSelectPlayer(entry.player.id)}
                  title={
                    entry.summary.played < MIN_FIABLE
                      ? `Tendencia: ${entry.summary.played} PJ con nota`
                      : undefined
                  }
                  className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03] ${
                    /* 07/11/2026: la tendencia atenúa TODAS sus cifras, no sólo la barra. */
                    entry.summary.played < MIN_FIABLE ? "[&>td:nth-child(n+4)]:opacity-55" : ""
                  }`}
                >
                  <td className="hidden px-4 py-2.5 text-[11px] tabular-nums text-white/30 sm:table-cell">
                    {index + 1}
                  </td>

                  {/* 30/10/2026: fija a la izquierda, para no perder de quién es la fila al desplazar. */}
                  <td className="sticky left-0 z-[1] max-w-[180px] bg-[#11161D] px-2 py-2.5 max-sm:pl-4">
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

                  <td className={`${colSec} px-2 py-2.5 text-center tabular-nums text-white/45`}>
                    {entry.summary.starts}
                  </td>

                  <td className="px-2 py-2.5 text-center tabular-nums text-white/45">
                    {entry.summary.minutes}
                  </td>

                  <td className="px-2 py-2.5">
                    <div className="flex min-w-[132px] items-center gap-2">
                      {/* Con pocos partidos la media es tendencia: se atenúa y lleva sus PJ al lado. */}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <RatingBadge value={entry.summary.avg} size="sm" />
                        <RatingBar value={entry.summary.avg} />
                      </div>
                      {entry.summary.played < MIN_FIABLE ? (
                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/60">{entry.summary.played} PJ</span>
                      ) : null}
                    </div>
                  </td>

                  <td className={`${colSec} px-2 py-2.5 text-center tabular-nums text-white/60`}>
                    {formatRating(entry.summary.weighted)}
                  </td>

                  <td className={`${colSec} px-2 py-2.5 text-center tabular-nums text-white/60`}>
                    {formatRating(entry.summary.form)}
                  </td>

                  <td className="px-2 py-2.5 text-center">
                    <TrendPill value={entry.summary.trend} />
                  </td>

                  <td className={`${colSec} px-2 py-2.5 text-center tabular-nums text-emerald-300/80`}>
                    {formatRating(entry.summary.best?.entry.rating ?? 0)}
                  </td>

                  <td className={`${colSec} px-2 py-2.5 text-center tabular-nums text-rose-300/70`}>
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

/** «Arriba «Mestre» con 7,4; el último de los 17 con 4+ partidos, «Rachad», con 4,6 (2,8 menos).» */
/** «de 4,7 a 6,5 · »: la media de las 3 anteriores y la de las 3 últimas. */
function desdeHasta(jugador: RankedPlayer): string {
  const notas = jugador.summary.entries
    .map((item) => item.entry.rating)
    .filter((nota) => nota > 0);
  const ultimas = notas.slice(-3);
  const anteriores = notas.slice(-6, -3);
  if (!ultimas.length || !anteriores.length) return "";
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return `de ${formatRating(media(anteriores))} a ${formatRating(media(ultimas))}, `;
}

function lecturaTop(elegibles: RankedPlayer[]): string | null {
  if (elegibles.length < 2) return null;

  const arriba = elegibles[0];
  const abajo = elegibles[elegibles.length - 1];

  return (
    `Arriba «${nombreVisible(arriba.player.nombre)}» con ${formatRating(arriba.summary.avg)} de nota en ${arriba.summary.minutes}′; ` +
    `el último de los ${elegibles.length} con ${MIN_FIABLE}+ partidos, «${nombreVisible(abajo.player.nombre)}», ` +
    `con ${formatRating(abajo.summary.avg)} en ${abajo.summary.minutes}′ (${formatRating(arriba.summary.avg - abajo.summary.avg)} menos). ` +
    /* 08/11/2026 (jueces): que la lectura acabe en una acción. */
    `Qué hacemos: ver en vídeo sus 3 últimos partidos y fijar con él una acción para la semana.`
  );
}

/** La línea más baja y qué mirar en ella; si van a la par, se dice. */
function lecturaLineas(
  lineas: { name: string; value: number; players: number; notas: number }[]
): string | null {
  /* Una línea con menos de 3 jugadores con nota es tendencia: no se señala. */
  const firmes = lineas.filter((linea) => linea.players >= 3);

  if (firmes.length < 2) return null;

  const orden = [...firmes].sort((a, b) => b.value - a.value);
  const arriba = orden[0];
  const abajo = orden[orden.length - 1];
  const salto = arriba.value - abajo.value;

  if (salto < 0.3) {
    return `Las líneas van a la par (de ${formatRating(abajo.value)} a ${formatRating(arriba.value)}): ninguna tira del equipo hacia abajo.`;
  }

  /* 07/11/2026: fuera el «revisar ocasiones y último pase»: no salía de
     ningún dato. La lectura dice sólo lo que mide la nota. */
  return (
    `«${abajo.name}», ${formatRating(abajo.value)} de nota: la línea más baja, ` +
    `${formatRating(salto)} por debajo de «${arriba.name}» ` +
    `(media de sus ${abajo.players} jugadores, ${abajo.notas} notas).`
  );
}

/** El último partido frente a la media: un partido suelto es tendencia, no un cambio de nivel. */
function ultimoPartido(
  serie: { label: string; avg: number; rated: number }[],
  media: number
): string | null {
  const ultimo = serie[serie.length - 1];

  if (!ultimo || serie.length < 2 || media <= 0) return null;

  const delta = ultimo.avg - media;

  if (Math.abs(delta) < 0.3) {
    return `Último partido (${ultimo.label}): ${formatRating(ultimo.avg)} con ${ultimo.rated} valorados, en la media del equipo.`;
  }

  return (
    `Último partido (${ultimo.label}): ${formatRating(ultimo.avg)} con ${ultimo.rated} valorados, ` +
    `${formatRating(Math.abs(delta))} ${delta < 0 ? "por debajo" : "por encima"} de la media ${formatRating(media)}; ` +
    `un solo partido es tendencia, no un cambio de nivel.`
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

