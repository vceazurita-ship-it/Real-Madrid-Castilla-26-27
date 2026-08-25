"use client";

import { useMemo } from "react";

import { Sparkles } from "lucide-react";

import PositionHeatmap from "@/components/rivals/PositionHeatmap";

import {
  defaultSeason,
  goalsAgainstPerGame,
  minutesPerGame,
  starterShare,
  type RivalPlayerStats,
  type RivalSeasonStats,
} from "@/lib/rivals/stats";

/*
|--------------------------------------------------------------------------
| RENDIMIENTO DEL JUGADOR RIVAL
|--------------------------------------------------------------------------
|
| Dos cosas en la misma tarjeta porque se leen juntas: **dónde** juega (mapa
| de calor deducido de la posición) y **cuánto** juega (partidos, minutos,
| goles, tarjetas). Los porteros cambian dos columnas: donde los de campo
| llevan goles y asistencias, ellos llevan goles encajados y penaltis parados.
|
| El formato es de tabla, como en BeSoccer: una fila por temporada y todas a
| la vista. Antes había un selector de temporada y seis cuadraditos con la
| elegida, que es exactamente lo contrario de lo que se necesita —lo que dice
| algo de un jugador no es su 2026/27 aislado, sino ver que pasó de 2.400
| minutos a 600, o que las tarjetas se le han disparado este año.
|
| Los números son de BeSoccer y llegan desde Supabase; el mapa no es medido y
| la propia tarjeta lo advierte.
*/

type Columna = {
  key: string;
  /** Cabecera corta, la de una tabla de fútbol. */
  label: string;
  /** Nombre completo, en el `title` de la cabecera. */
  titulo: string;
  valor: (season: RivalSeasonStats) => string;
  /** Segunda línea pequeña bajo el número (ritmo, porcentaje…). */
  detalle?: (season: RivalSeasonStats) => string | undefined;
  /** Color del número cuando no es cero. */
  color?: string;
  /** Se estrecha en móvil. */
  secundaria?: boolean;
};

function fmt(value: number | undefined | null) {
  return value === undefined || value === null ? "—" : String(value);
}

/*
| Por debajo de esto el ritmo por 90' no dice nada: el gol suelto de un
| central sale como "0.07 cada 90'", que es ruido. Con volumen sí distingue
| al que marca porque juega del que marca de verdad.
*/
const MIN_PARA_RITMO = 3;

/** Ritmo por 90 minutos, con dos decimales y sin ceros de adorno. */
function per90(total: number, minutos: number) {
  if (!minutos) return "0";

  return String(Math.round((total / minutos) * 90 * 100) / 100);
}

function ritmo(total: number | undefined, minutos: number) {
  if (!total || total < MIN_PARA_RITMO) return undefined;

  return `${per90(total, minutos)}/90'`;
}

const COMUNES_INICIO: Columna[] = [
  {
    key: "partidos",
    label: "PJ",
    titulo: "Partidos jugados",
    valor: (s) => String(s.partidos),
  },
  {
    key: "titular",
    label: "Tit",
    titulo: "Partidos de titular",
    valor: (s) => String(s.titular),
    detalle: (s) => {
      const share = starterShare(s);

      return share === null ? undefined : `${share}%`;
    },
  },
  {
    key: "minutos",
    label: "Min",
    titulo: "Minutos jugados",
    valor: (s) => s.minutos.toLocaleString("es-ES"),
    detalle: (s) => (s.partidos ? `${minutesPerGame(s)}'/pj` : undefined),
  },
];

const COMUNES_FIN: Columna[] = [
  {
    key: "amarillas",
    label: "TA",
    titulo: "Tarjetas amarillas",
    valor: (s) => String(s.amarillas),
    color: "#FACC15",
    secundaria: true,
  },
  {
    key: "rojas",
    label: "TR",
    titulo: "Tarjetas rojas",
    valor: (s) => String(s.rojas),
    color: "#EF4444",
    secundaria: true,
  },
];

const DE_CAMPO: Columna[] = [
  {
    key: "goles",
    label: "G",
    titulo: "Goles",
    valor: (s) => fmt(s.goles),
    detalle: (s) => ritmo(s.goles, s.minutos),
    color: "#F87171",
  },
  {
    key: "asistencias",
    label: "A",
    titulo: "Asistencias",
    valor: (s) => fmt(s.asistencias),
    detalle: (s) => ritmo(s.asistencias, s.minutos),
    color: "#34D399",
  },
];

const DE_PORTERO: Columna[] = [
  {
    key: "encajados",
    label: "GC",
    titulo: "Goles encajados",
    valor: (s) => fmt(s.encajados),
    detalle: (s) => {
      const porPartido = goalsAgainstPerGame(s);

      return porPartido === null ? undefined : `${porPartido}/pj`;
    },
    color: "#F87171",
  },
  {
    key: "penaltis",
    label: "PP",
    titulo: "Penaltis parados",
    valor: (s) => fmt(s.penaltisParados),
    color: "#34D399",
  },
];

function columnas(portero: boolean): Columna[] {
  return [
    ...COMUNES_INICIO,
    ...(portero ? DE_PORTERO : DE_CAMPO),
    ...COMUNES_FIN,
  ];
}

export function PlayerStatsCard({
  stats,
  slot,
  side = 0,
  positionCode,
  loading = false,
  missing = false,
}: {
  stats: RivalPlayerStats | null;
  /** Clave de slot para el mapa de calor (`ld`, `dfc`, `mc`…). */
  slot: string | null;
  side?: -1 | 0 | 1;
  positionCode?: string;
  loading?: boolean;
  /** No hay documento de estadísticas: falta correr el script de descarga. */
  missing?: boolean;
}) {
  /* Sólo las últimas: más atrás ya no dice nada de cómo llega al partido. */
  const temporadas = useMemo(
    () => (stats?.temporadas ?? []).slice(0, 5),
    [stats],
  );

  const portero = Boolean(stats?.portero);

  const cols = useMemo(() => columnas(portero), [portero]);

  /* La que manda: la que se resalta y la que se lee de un vistazo. */
  const destacada = defaultSeason(stats)?.temporada ?? null;

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <Sparkles size={12} className="text-[#C8A96B]" />
          Rendimiento
        </h3>

        {stats?.url && (
          <span className="text-[10px] text-white/25">BeSoccer</span>
        )}
      </header>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[104px_minmax(0,1fr)]">
        <div className="min-w-0">
          <PositionHeatmap
            slot={slot}
            side={side}
            label={positionCode}
            className="aspect-[2/3] w-full"
          />

          <p className="mt-1 text-center text-[9px] leading-tight text-white/30">
            Zona estimada por posición
          </p>
        </div>

        <div className="min-w-0">
          {loading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-9 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
                />
              ))}
            </div>
          ) : temporadas.length ? (
            /* La tabla nunca empuja el ancho de la ficha: se desplaza sola. */
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[380px] border-collapse text-right tabular-nums">
                <thead>
                  <tr className="border-b border-white/10">
                    <th
                      scope="col"
                      className="py-1.5 pr-2 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35"
                    >
                      Temporada
                    </th>

                    {cols.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        title={col.titulo}
                        className={`px-1.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35 ${
                          col.secundaria ? "hidden sm:table-cell" : ""
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {temporadas.map((season) => {
                    const actual = season.temporada === destacada;

                    return (
                      <tr
                        key={season.temporada}
                        className={`border-b border-white/[0.06] last:border-0 ${
                          actual ? "bg-[#C8A96B]/[0.07]" : ""
                        }`}
                      >
                        <th
                          scope="row"
                          className="min-w-0 py-1.5 pr-2 text-left font-normal"
                        >
                          <span
                            className={`block text-[11px] font-semibold ${
                              actual ? "text-[#C8A96B]" : "text-white/70"
                            }`}
                          >
                            {season.temporada}
                          </span>

                          {season.equipos.length > 0 && (
                            <span
                              title={season.equipos.join(" / ")}
                              className="block max-w-[140px] truncate text-[9px] text-white/30"
                            >
                              {season.equipos.join(" / ")}
                            </span>
                          )}
                        </th>

                        {cols.map((col) => {
                          const valor = col.valor(season);
                          const detalle = col.detalle?.(season);

                          /* El color sólo cuando hay algo que destacar: una
                             columna de ceros en rojo y amarillo es ruido. */
                          const vivo =
                            col.color && valor !== "0" && valor !== "—";

                          return (
                            <td
                              key={col.key}
                              className={`px-1.5 py-1.5 ${
                                col.secundaria ? "hidden sm:table-cell" : ""
                              }`}
                            >
                              <span
                                className="block text-[13px] font-semibold leading-tight"
                                style={
                                  vivo
                                    ? { color: col.color }
                                    : { color: "rgba(255,255,255,0.82)" }
                                }
                              >
                                {valor}
                              </span>

                              {detalle && (
                                <span className="block text-[9px] leading-tight text-white/30">
                                  {detalle}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs text-white/35">
              {missing
                ? "Todavía no se han descargado las estadísticas: ejecuta node scripts/rivals-stats.mjs."
                : "Sin estadísticas de este jugador en BeSoccer."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PlayerStatsCard;
