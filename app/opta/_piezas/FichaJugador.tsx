"use client";

/**
 * LA FICHA DE UN JUGADOR: sus métricas por 90 con el percentil contra los de
 * su puesto en la categoría (con un mínimo de minutos), y —si es del
 * Castilla— su partido a partido. Si sale en temporadas pasadas de Opta,
 * una tarjeta por temporada (`Temporadas.tsx`).
 */

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { colorPercentil, Evolucion, LeyendaPercentil, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, num, PUESTO_OPTA } from "@/lib/opta";
import { CLAVES_JUGADOR, enAmbito, familiaDe, fechaCorta, posicionEn, valorJugador, valorPartido, type Ambito, type Fila } from "@/lib/opta-analisis";
import { cortoMetrica, defMetrica, METRICAS_OPTA, nombreMetrica, PERFIL_FAMILIA } from "@/lib/opta-nombres";

import { Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import { PerfilRemate } from "./PerfilRemate";
import { RematesJugador } from "./Remates";
import { TemporadasJugador } from "./Temporadas";
import type { DatosOpta } from "./useOpta";

const PERFIL_GENERAL = ["Goal", "ExpG", "Chance", "xA", "Pass%", "Recovery", "Duel%", "PossLost"];

function FilaBarra({ nombre, valor, p, puesto, de, mejor, sufijo }: { nombre: string; valor: string; p: number | null; puesto: number | null; de: number; mejor: boolean | null; sufijo: string }) {
  const estilo = mejor === null;
  const color = estilo ? tinta(0.45) : colorPercentil(p);
  return (
    <div className="min-w-0 border-b border-white/[0.06] py-2 last:border-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
          {nombre}
          {sufijo && <span className="ml-1 text-xs text-white/40">{sufijo}</span>}
          {mejor === false && <span className="ml-1.5 text-xs text-white/40">(menos es mejor)</span>}
          {estilo && <span className="ml-1.5 text-xs text-white/40">(estilo)</span>}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">{valor}</span>
        <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
          {puesto ? `${puesto}º/${de}` : ""}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative h-2 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
          <span className="absolute inset-y-[-3px] w-px" style={{ left: "50%", background: tinta(0.3) }} aria-hidden />
          {p != null && (
            <span className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(50, p)}%`, width: `${Math.abs(p - 50)}%`, background: color }} />
          )}
        </div>
        <span className="w-9 shrink-0 text-right text-xs tabular-nums" style={{ color: tinta(0.45) }}>
          {p != null ? `P${p}` : ""}
        </span>
      </div>
    </div>
  );
}

export function FichaJugador({
  datos,
  jugador,
  minimo,
  alCerrar,
}: {
  datos: DatosOpta;
  jugador: Fila;
  minimo: number;
  alCerrar?: () => void;
}) {
  const { jugadores, castilla, castillaPartidos, grupos, catalogo } = datos;
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const familia = familiaDe(jugador);
  const perfil = PERFIL_FAMILIA[familia] ?? PERFIL_GENERAL;

  const pares = useMemo(
    () =>
      jugadores.filter(
        (f) => (!familia || familiaDe(f) === familia) && (num(f.Min) ?? 0) >= minimo && enAmbito(f.teamId, grupos, ambito),
      ),
    [jugadores, familia, minimo, grupos, ambito],
  );

  const minutos = num(jugador.Min) ?? 0;
  const esNuestro = jugador.teamId === CASTILLA_OPTA;
  const puesto = PUESTO_OPTA[String(jugador.puesto ?? "")] ?? "";

  /* Partido a partido: sólo los del Castilla tienen esa tabla. */
  const susPartidos = useMemo(
    () =>
      castillaPartidos
        .filter((f) => f.playerId === jugador.playerId && (num(f.Min) ?? 0) > 0)
        .sort((a, b) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? ""))),
    [castillaPartidos, jugador.playerId],
  );
  const columnasPartido = useMemo(() => {
    const cols = Object.keys(castillaPartidos[0] ?? {}).filter((k) => !CLAVES_JUGADOR.has(k) && k !== "Min");
    return cols.filter((k) => METRICAS_OPTA[k]);
  }, [castillaPartidos]);
  const [metricaEvo, setMetricaEvo] = useState("");
  const evo = columnasPartido.includes(metricaEvo) ? metricaEvo : (perfil.find((k) => columnasPartido.includes(k)) ?? columnasPartido[0] ?? "");
  const defEvo = defMetrica(evo, catalogo);
  const tablaPartido = perfil.filter((k) => columnasPartido.includes(k)).slice(0, 6);

  const completa = esNuestro ? castilla.find((f) => f.playerId === jugador.playerId) : undefined;

  const quien = familia ? familia.toLowerCase() : "jugadores";
  const ambitoTexto = ambito === "grupo" ? "del grupo del Castilla" : ambito === "otro" ? "del otro grupo" : "de la categoría";

  return (
    <Panel
      titulo={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{String(jugador.jugador ?? "")}</span>
          <span className="text-sm font-normal text-white/55">
            {[esNuestro ? "Real Madrid Castilla" : String(jugador.equipo ?? ""), puesto, num(jugador.Age) ? `${num(jugador.Age)} años` : ""].filter(Boolean).join(" · ")}
          </span>
        </span>
      }
      subtitulo={[minutos ? `${minutos}′` : "", num(jugador.GM) ? `${num(jugador.GM)} partidos` : ""].filter(Boolean).join(" · ")}
      derecha={
        alCerrar && (
          <button type="button" onClick={alCerrar} className="rounded-lg p-1.5 text-white/55 hover:text-white" aria-label="Cerrar la ficha">
            <X size={16} />
          </button>
        )
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
        <LeyendaPercentil poblacion={`${pares.length} ${quien} ${ambitoTexto} con ${minimo}′ o más`} />
      </div>
      {minutos < minimo && (
        <p className="mb-2 text-xs text-white/55">
          Con {minutos}′ está por debajo del mínimo de {minimo}′: sus cifras por 90 salen de pocos minutos y conviene leerlas como tendencia.
        </p>
      )}

      <div className="grid gap-x-6 md:grid-cols-2">
        {perfil.map((a) => {
          const def = defMetrica(a, catalogo);
          const valor = valorJugador(jugador, a, 1, catalogo);
          if (valor == null) return null;
          const pos = posicionEn(
            valor,
            pares.map((f) => valorJugador(f, a, minimo, catalogo)),
            def.mejor,
          );
          return (
            <FilaBarra
              key={a}
              nombre={nombreMetrica(a, catalogo)}
              sufijo={def.tasa ? "" : "por 90"}
              valor={fmt(valor, def.unidad)}
              p={pos.percentil}
              puesto={pos.puesto}
              de={pos.deCuantos}
              mejor={def.mejor}
            />
          );
        })}
      </div>

      {completa && <PerfilRemate fila={completa} />}

      <RematesJugador datos={datos} jugador={jugador} />

      <TemporadasJugador datos={datos} playerId={String(jugador.playerId ?? "")} minimo={minimo} />

      {esNuestro && susPartidos.length > 0 && evo && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Partido a partido</h3>
            <Elegir
              etiqueta="Métrica"
              valor={evo}
              alCambiar={setMetricaEvo}
              opciones={columnasPartido.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))}
            />
          </div>
          <Evolucion
            serie={susPartidos.map((f) => ({
              etiqueta: String(f.rival ?? "") || fechaCorta(String(f.fecha ?? "")),
              valor: valorPartido(f, evo, catalogo),
              nota: `${fechaCorta(String(f.fecha ?? ""))} · ${num(f.Min) ?? 0}′`,
            }))}
            unidad={defEvo.unidad}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/55">
                  <th className="py-1.5 pr-3 font-semibold">Fecha</th>
                  <th className="py-1.5 pr-3 font-semibold">Rival</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Min</th>
                  {tablaPartido.map((k) => (
                    <th key={k} className="py-1.5 pr-3 text-right font-semibold" title={nombreMetrica(k, catalogo)}>
                      {cortoMetrica(k, catalogo)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {susPartidos.map((f) => (
                  <tr key={String(f.partido)} className="border-b border-white/[0.06]">
                    <td className="py-1.5 pr-3 text-white/55">{fechaCorta(String(f.fecha ?? ""))}</td>
                    <td className="py-1.5 pr-3 text-white/80">{String(f.rival ?? "")}</td>
                    <td className="py-1.5 pr-3 text-right text-white/75">{num(f.Min) ?? ""}</td>
                    {tablaPartido.map((k) => (
                      <td key={k} className="py-1.5 pr-3 text-right text-white/75">
                        {fmt(valorPartido(f, k, catalogo), defMetrica(k, catalogo).unidad)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
