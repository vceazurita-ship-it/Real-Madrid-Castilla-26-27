"use client";

import { useMemo, useState } from "react";

import { Sparkles } from "lucide-react";

import PositionHeatmap from "@/components/rivals/PositionHeatmap";

import { chipInk } from "@/lib/theme";

import { defaultSeason, type RivalPlayerStats } from "@/lib/rivals/stats";

import {
  columnasTemporada,
  TEMPORADAS_VISIBLES,
} from "@/lib/rivals/stats-table";

/*
|--------------------------------------------------------------------------
| RENDIMIENTO DEL JUGADOR RIVAL
|--------------------------------------------------------------------------
|
| Dos cosas en la misma tarjeta porque se leen juntas: **dónde** juega (mapa
| de calor deducido de la posición) y **cuánto** juega (partidos, minutos,
| goles, tarjetas).
|
| El formato es de tabla, como en BeSoccer: una fila por temporada y todas a
| la vista. Antes había un selector de temporada y seis cuadraditos con la
| elegida, que es exactamente lo contrario de lo que se necesita —lo que dice
| algo de un jugador no es su 2026/27 aislado, sino ver que pasó de 2.400
| minutos a 600, o que las tarjetas se le han disparado este año.
|
| Qué columnas son y cómo se formatean está en `lib/rivals/stats-table.ts`:
| el PDF del once pinta esta misma tabla y no puede irse por su lado.
|
| Los números son de BeSoccer y llegan desde Supabase; el mapa no es medido y
| la propia tarjeta lo advierte.
*/

/*
| Un club del historial: su escudo y su nombre.
|
| El nombre iba a 9 px bajo la temporada y no se leía —y es justo el dato que
| dice si el jugador viene de Segunda o de un filial—, así que ahora manda él:
| escudo al lado y tipografía de lectura. El escudo puede faltar (el documento
| subido antes de que el script los bajara no los trae, y BeSoccer se deja
| alguno), y entonces queda la inicial dentro del mismo círculo: el hueco es
| el mismo y las filas no se descuadran.
*/
function ClubDelHistorial({
  nombre,
  escudo,
}: {
  nombre: string;
  escudo?: string;
}) {
  const [roto, setRoto] = useState(false);

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[9px] font-bold text-white/45"
      >
        {escudo && !roto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={escudo}
            alt=""
            loading="lazy"
            onError={() => setRoto(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          nombre.charAt(0).toUpperCase()
        )}
      </span>

      <span className="min-w-0 truncate text-[11px] font-medium text-white/60">
        {nombre}
      </span>
    </span>
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
  const temporadas = useMemo(
    () => (stats?.temporadas ?? []).slice(0, TEMPORADAS_VISIBLES),
    [stats],
  );

  const portero = Boolean(stats?.portero);

  const cols = useMemo(() => columnasTemporada(portero), [portero]);

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
                            className={`block text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              actual ? "text-[#C8A96B]" : "text-white/45"
                            }`}
                          >
                            {season.temporada}
                          </span>

                          {season.equipos.length > 0 && (
                            <span
                              title={season.equipos.join(" / ")}
                              className="mt-0.5 flex max-w-[160px] flex-wrap items-center gap-x-2 gap-y-0.5"
                            >
                              {season.equipos.map((equipo, index) => (
                                <ClubDelHistorial
                                  key={`${equipo}-${index}`}
                                  nombre={equipo}
                                  escudo={season.escudos?.[index]}
                                />
                              ))}
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
                                /* Ni el número ni su color se escriben en
                                   blanco fijo: en modo día eso quedaba blanco
                                   sobre blanco y la tabla entera desaparecía.
                                   La tinta sale de la variable del tema, y el
                                   color de columna pasa por `chipInk`, que
                                   oscurece el pastel lo justo para leerlo
                                   sobre el lienzo claro. */
                                style={
                                  vivo && col.color
                                    ? { color: chipInk(col.color) }
                                    : {
                                        color:
                                          "rgb(var(--rmcf-ink-rgb) / .86)",
                                      }
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
