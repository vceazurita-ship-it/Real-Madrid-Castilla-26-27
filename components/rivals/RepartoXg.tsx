"use client";

/**
 * REPARTO DEL xG (Scout colectivo, 13/11/2026): los 10 jugadores que más xG
 * suman en la temporada, con su % del xG del equipo, minutos, xG/90 y una raya
 * con lo que aportarían rindiendo como la media del equipo por minuto. Dice a
 * quién vigilar en el área y si el gol está concentrado o repartido. El mismo
 * bloque se cambia al Castilla con el selector.
 *
 * Datos: `opta:jugadores-partidos` (por `useDocsOpta`, se pide al asomar) y
 * `opta:equipos` para cruzar el nombre del rival con `casaEquipo`. Las
 * cuentas, en `lib/rivals/reparto-xg.ts`.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { lecturaConcentracion, repartoXg } from "@/lib/rivals/reparto-xg";

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const miles = (v: number) => Math.round(v).toLocaleString("es-ES");

export function RepartoXg({ equipo }: { equipo: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || abierto) return;
    const io = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setAbierto(true);
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [abierto]);

  return <div ref={caja} className="min-w-0">{abierto && <Bloque equipo={equipo} />}</div>;
}

function Bloque({ equipo }: { equipo: string }) {
  const { docs } = useDocsOpta<[TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.jugadoresPartidos);
  const [tEquipos, tJugPartidos] = docs;
  const [lado, setLado] = useState<"rival" | "castilla">("rival");

  const filas = useMemo(() => aObjetos(tJugPartidos), [tJugPartidos]);
  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [tEquipos, equipo]);

  const repartoRival = useMemo(() => (rival && filas.length ? repartoXg(filas, rival.id) : null), [filas, rival]);
  const repartoCastilla = useMemo(() => (filas.length ? repartoXg(filas, CASTILLA_OPTA) : null), [filas]);

  if (!rival || !repartoRival) return null;
  const esCastilla = lado === "castilla" && repartoCastilla != null;
  const r = esCastilla ? repartoCastilla! : repartoRival;
  const nombre = esCastilla ? "Real Madrid Castilla" : rival.nombre;
  const color = esCastilla ? ORO : COMPARADO;
  const primero = r.jugadores[0];
  const escala = Math.max(...r.jugadores.map((j) => Math.max(j.xg, j.esperado)), 0.01);

  return (
    <section aria-label="Reparto del xG" className="mt-8 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
          Reparto del xG
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">
            dato · Opta, {r.sinPenaltis ? "xG sin penaltis" : "xG total (con penaltis)"}
          </span>
        </p>
        <div role="group" aria-label="Equipo" className="flex rounded-full border border-white/15 p-0.5 text-[11px] font-semibold">
          {(["rival", "castilla"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setLado(k)}
              disabled={k === "castilla" && !repartoCastilla}
              aria-pressed={lado === k}
              className={`max-w-[11rem] truncate rounded-full px-3 py-1 transition ${lado === k ? "bg-white/15 text-white" : "text-white/55 hover:text-white"} disabled:opacity-40`}
            >
              {k === "rival" ? rival.nombre : "Castilla"}
            </button>
          ))}
        </div>
      </div>

      {primero && (
        <p className="mt-2 text-sm leading-6 text-white/75">
          <span className="text-2xl font-bold tabular-nums text-white">{coma(r.pctPrimero, 0)} %</span>{" "}
          del xG de {nombre} es de <strong className="text-white">{primero.jugador}</strong>; los tres primeros suman el {coma(r.pctTres, 0)} %. Gol{" "}
          {lecturaConcentracion(r)} ({r.conXg} jugadores con xG, {coma(r.total, 1)} xG en total).
        </p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm" style={{ background: color }} />
          xG del jugador
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-0.5" style={{ background: tinta(0.85) }} />
          lo que haría con la media del equipo por minuto
        </span>
      </p>

      <ol className="mt-3 space-y-2.5">
        {r.jugadores.map((j, i) => {
          const sobre = j.veces != null && j.veces >= 1.5;
          return (
            <li key={j.playerId} className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
                <span className="min-w-0 truncate font-semibold text-white">
                  <span className="mr-1.5 tabular-nums text-white/40">{i + 1}</span>
                  {j.jugador}
                </span>
                <span className="shrink-0 tabular-nums text-white/60">
                  <strong className="text-white">{coma(j.pct, 0)} %</strong> · {coma(j.xg)} xG · {miles(j.minutos)}′
                  {j.xg90 != null && <> · {coma(j.xg90)}/90</>}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div
                  className="relative h-3 min-w-0 flex-1 rounded-sm"
                  style={{ background: tinta(0.06) }}
                  role="img"
                  aria-label={`${j.jugador}: ${coma(j.xg)} xG; con la media del equipo haría ${coma(j.esperado)}`}
                >
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(j.xg / escala) * 100}%`, background: color }} />
                  <div
                    className="absolute -inset-y-0.5 w-0.5"
                    style={{ left: `calc(${Math.min(100, (j.esperado / escala) * 100)}% - 1px)`, background: tinta(0.85) }}
                    title={`Con la media del equipo por minuto: ${coma(j.esperado)} xG`}
                  />
                </div>
                <span
                  className={`w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums ${sobre ? "font-bold text-white" : "text-white/55"}`}
                  title="Su xG entre lo que haría con la media del equipo por minuto"
                >
                  {j.veces != null ? `×${coma(j.veces, 1)} media` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Temporada entera con este equipo. La raya es el xG del equipo entre sus minutos, por los minutos del jugador; «×N media» es cuántas veces eso hace.
      </p>
    </section>
  );
}
