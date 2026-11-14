"use client";

/**
 * DEPENDENCIA: cuánto pesa cada jugador en su equipo (su parte del total en
 * goles, xG, xA, ocasiones, toques en el área y pases). Se ordena por la
 * métrica elegida y cada fila lleva su barra de esa parte; al lado, las demás.
 */

import { useMemo, useState } from "react";

import { ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, PUESTO_OPTA } from "@/lib/opta";
import { dependenciaDe, METRICAS_DEPENDENCIA, nombreEquipo } from "@/lib/opta-analisis";
import { cortoMetrica, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, fmt, Panel } from "./comun";
import type { DatosOpta } from "./useOpta";

const FILAS = 10;

export function Dependencia({ datos, teamId, elegirEquipo = false }: { datos: DatosOpta; teamId?: string; elegirEquipo?: boolean }) {
  const { jugadores, equipos, catalogo } = datos;
  const [equipoElegido, setEquipoElegido] = useState(teamId ?? CASTILLA_OPTA);
  const id = elegirEquipo ? equipoElegido : (teamId ?? CASTILLA_OPTA);
  const [metrica, setMetrica] = useState("ExpG");
  const fila = equipos.find((f) => f.teamId === id) ?? null;

  const lista = useMemo(() => {
    const d = dependenciaDe(jugadores, fila, id);
    return d.filter((x) => (x.partes[metrica] ?? 0) > 0).sort((a, b) => (b.partes[metrica] ?? 0) - (a.partes[metrica] ?? 0));
  }, [jugadores, fila, id, metrica]);

  const top3 = lista.slice(0, 3).reduce((s, x) => s + (x.partes[metrica] ?? 0), 0);
  const nombre = fila ? nombreEquipo(fila) : "";

  return (
    <Panel
      titulo="Dependencia"
      subtitulo={
        lista.length
          ? `Qué parte del total del ${id === CASTILLA_OPTA ? "Castilla" : nombre} pone cada jugador. En ${nombreMetrica(metrica, catalogo).toLowerCase()}, los tres primeros suman el ${fmt(top3, "entero")} %.`
          : `Qué parte del total del equipo pone cada jugador.`
      }
      derecha={
        <>
          {elegirEquipo && (
            <Elegir
              etiqueta="Equipo"
              valor={equipoElegido}
              alCambiar={setEquipoElegido}
              opciones={[...equipos]
                .map((f) => ({ clave: String(f.teamId), nombre: nombreEquipo(f) }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))}
            />
          )}
          <Elegir
            etiqueta="Ordenar por"
            valor={metrica}
            alCambiar={setMetrica}
            opciones={METRICAS_DEPENDENCIA.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))}
          />
        </>
      }
    >
      {lista.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/55">
                <th className="py-1.5 pr-3 font-semibold">Jugador</th>
                <th className="w-[36%] py-1.5 pr-3 font-semibold">{nombreMetrica(metrica, catalogo)}</th>
                {METRICAS_DEPENDENCIA.filter((k) => k !== metrica).map((k) => (
                  <th key={k} className="py-1.5 pr-3 text-right font-semibold" title={`% del total del equipo en ${nombreMetrica(k, catalogo).toLowerCase()}`}>
                    {cortoMetrica(k, catalogo)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, FILAS).map((x) => {
                const p = x.partes[metrica] ?? 0;
                return (
                  <tr key={x.playerId} className="border-b border-white/[0.06]">
                    <td className="py-1.5 pr-3">
                      <span className="font-semibold text-white/85">{x.jugador}</span>
                      <span className="ml-1.5 text-xs text-white/45">{[PUESTO_OPTA[x.puesto] ?? "", `${x.min}′`].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
                          <span className="block h-2.5 rounded-full" style={{ width: `${Math.min(100, p)}%`, background: id === CASTILLA_OPTA ? "#C8A96B" : tinta(0.45) }} />
                        </span>
                        <span className="w-11 shrink-0 text-right font-semibold" style={{ color: ORO }}>
                          {fmt(p, "porcentaje")}
                        </span>
                      </span>
                    </td>
                    {METRICAS_DEPENDENCIA.filter((k) => k !== metrica).map((k) => (
                      <td key={k} className="py-1.5 pr-3 text-right text-white/70">
                        {x.partes[k] ? fmt(x.partes[k], "porcentaje") : ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length > FILAS && <p className="mt-2 text-xs text-white/45">Los {FILAS} que más pesan; el resto pone menos.</p>}
        </div>
      )}
    </Panel>
  );
}
