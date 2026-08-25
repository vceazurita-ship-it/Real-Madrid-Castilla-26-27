"use client";

import { useMemo, useState } from "react";

import {
  Clock,
  Goal,
  Handshake,
  Hand,
  RectangleHorizontal,
  ShieldAlert,
  Shirt,
  Sparkles,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import PositionHeatmap from "@/components/rivals/PositionHeatmap";
import { chipInk } from "@/lib/theme";

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
| goles, tarjetas). Los porteros cambian dos casillas: donde los de campo
| llevan goles y asistencias, ellos llevan goles encajados y penaltis parados.
|
| Los números son de BeSoccer y llegan desde Supabase; el mapa no es medido y
| la propia tarjeta lo advierte.
*/

type Tile = {
  key: string;
  label: string;
  value: string;
  /** Segunda línea pequeña. */
  hint?: string;
  icon: LucideIcon;
  color: string;
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

function rateHint(total: number | undefined, minutos: number) {
  if (!total || total < MIN_PARA_RITMO) return undefined;

  return `${per90(total, minutos)} cada 90'`;
}

function outfieldTiles(season: RivalSeasonStats): Tile[] {
  return [
    {
      key: "goles",
      label: "Goles",
      value: fmt(season.goles),
      hint: rateHint(season.goles, season.minutos),
      icon: Goal,
      color: "#F87171",
    },
    {
      key: "asistencias",
      label: "Asistencias",
      value: fmt(season.asistencias),
      hint: rateHint(season.asistencias, season.minutos),
      icon: Handshake,
      color: "#34D399",
    },
  ];
}

function keeperTiles(season: RivalSeasonStats): Tile[] {
  const perGame = goalsAgainstPerGame(season);

  return [
    {
      key: "encajados",
      label: "Encajados",
      value: fmt(season.encajados),
      hint: perGame === null ? undefined : `${perGame} por partido`,
      icon: ShieldAlert,
      color: "#F87171",
    },
    {
      key: "penaltis",
      label: "Penaltis parados",
      value: fmt(season.penaltisParados),
      icon: Hand,
      color: "#34D399",
    },
  ];
}

/** Ritmo por 90 minutos, con un decimal y sin ceros de adorno. */
function per90(total: number, minutos: number) {
  if (!minutos) return "0";

  const value = Math.round((total / minutos) * 90 * 100) / 100;

  return String(value);
}

function buildTiles(season: RivalSeasonStats, portero: boolean): Tile[] {
  const share = starterShare(season);

  return [
    {
      key: "partidos",
      label: "Partidos",
      /* El paréntesis son las titularidades: un 24 (6) y un 24 (24) son dos
         jugadores muy distintos y el número suelto no los separa. */
      value: `${season.partidos} (${season.titular})`,
      hint: share === null ? undefined : `${share}% de titular`,
      icon: Shirt,
      color: "#C8A96B",
    },
    {
      key: "minutos",
      label: "Minutos",
      value: season.minutos.toLocaleString("es-ES"),
      hint: season.partidos ? `${minutesPerGame(season)}' por partido` : undefined,
      icon: Clock,
      color: "#7DD3FC",
    },
    ...(portero ? keeperTiles(season) : outfieldTiles(season)),
    {
      key: "amarillas",
      label: "Amarillas",
      value: String(season.amarillas),
      icon: RectangleHorizontal,
      color: "#FACC15",
    },
    {
      key: "rojas",
      label: "Rojas",
      value: String(season.rojas),
      icon: RectangleHorizontal,
      color: "#EF4444",
    },
  ];
}

function StatTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon;

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        {/* `chipInk` para que el pastel del tema oscuro siga leyéndose en
            modo día, donde un amarillo 400 sobre blanco no llega a 2:1. */}
        <Icon
          size={12}
          style={{ color: chipInk(tile.color) }}
          className="shrink-0"
        />

        <span className="truncate text-[9px] uppercase tracking-[0.14em] text-white/40">
          {tile.label}
        </span>
      </div>

      <p className="mt-0.5 truncate text-lg font-semibold leading-tight text-white">
        {tile.value}
      </p>

      <p className="truncate text-[10px] text-white/35">{tile.hint ?? " "}</p>
    </div>
  );
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
  const selectable = useMemo(
    () => (stats?.temporadas ?? []).slice(0, 4),
    [stats],
  );

  const [temporada, setTemporada] = useState<string | null>(null);

  /*
  | La temporada elegida se guarda como texto, no como índice, y se resuelve
  | contra el jugador que hay delante. Así al pasar de ficha en ficha con las
  | flechas del modal se mantiene la comparación —todos en 2025/26, por
  | ejemplo— y quien no tenga esa temporada cae solo en la suya por defecto,
  | sin necesidad de un efecto que reinicie el estado.
  */
  const season =
    selectable.find((item) => item.temporada === temporada) ??
    defaultSeason(stats);

  const tiles = season ? buildTiles(season, Boolean(stats?.portero)) : [];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <Sparkles size={12} className="text-[#C8A96B]" />
          Rendimiento
        </h3>

        {/*
        | En el PNG / PDF sólo sobrevive la temporada que se está viendo: las
        | otras son un selector que en papel no se puede pulsar, y la que
        | queda se lee como el rótulo del bloque.
        */}
        {selectable.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {selectable.map((item) => {
              const active = item.temporada === season?.temporada;

              return (
                <button
                  key={item.temporada}
                  type="button"
                  {...(active ? {} : { "data-export-hide": "" })}
                  onClick={() => setTemporada(item.temporada)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    active
                      ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                  }`}
                >
                  {item.temporada}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div>
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[68px] animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
                />
              ))}
            </div>
          ) : season ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tiles.map((tile) => (
                  <StatTile key={tile.key} tile={tile} />
                ))}
              </div>

              <p className="mt-2 truncate text-[10px] text-white/30">
                {season.temporada}
                {season.equipos.length ? ` · ${season.equipos.join(" / ")}` : ""}
                {stats?.url ? " · BeSoccer" : ""}
              </p>
            </>
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
