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

import { useMemo, useState } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { useAsoma } from "@/hooks/useAsoma";
import { lecturaConcentracion, repartoXg } from "@/lib/rivals/reparto-xg";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const miles = (v: number) => Math.round(v).toLocaleString("es-ES");

/* El nombre de la plantilla en vez del de Opta: «Flakus», no «David Flakus Bosilj» (lib/rivals/nombre-jugador.ts). */
export { nombreDePlantilla };

export function RepartoXg({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  /* Al asomar o, como muy tarde, a los 2 s (16/11/2026): en el móvil no salía si no se bajaba. Sin dato, no se pinta. */
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);

  return <div ref={caja} className="min-w-0">{abierto && <Bloque equipo={equipo} nombres={nombres} />}</div>;
}

function Bloque({ equipo, nombres }: { equipo: string; nombres: string[] }) {
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
  /* Los del rival con el nombre de su plantilla; los nuestros, como vienen. */
  const nombreVisto = (jugador: string) => (esCastilla ? jugador : nombreDePlantilla(jugador, nombres));
  const escala = Math.max(...r.jugadores.map((j) => Math.max(j.xg, j.esperado)), 0.01);

  return (
    <section aria-label="Reparto del xG" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
          Reparto del xG · {nombre}
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
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
        <>
          <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">
            El {coma(r.pctPrimero, 0)} % lo hace {nombreVisto(primero.jugador)}
          </h3>
          <p className="mt-1 text-sm leading-6 text-white/70">
            Los tres primeros suman el {coma(r.pctTres, 0)} %. Gol {lecturaConcentracion(r)} ({r.conXg} jugadores con xG, {coma(r.total, 1)} xG en total).
          </p>
        </>
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

      {/* Como el original de X: rango grande, nombre con su ficha corta, barra con la raya de la media y el % grande a la derecha. */}
      <ol className="portada-celda mt-3 divide-y divide-white/[0.06] px-2 sm:px-3">
        {r.jugadores.map((j, i) => {
          const sobre = j.veces != null && j.veces >= 1.5;
          return (
            <li key={j.playerId} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2 py-2 sm:grid-cols-[2.25rem_minmax(0,13rem)_minmax(0,1fr)_auto] sm:gap-x-3">
              <span className={`fuente-club text-center text-[22px] font-bold tabular-nums leading-none sm:text-[26px] ${i < 3 ? "text-white" : "text-white/40"}`}>{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-white">{nombreVisto(j.jugador)}</p>
                <p className="truncate text-[12px] tabular-nums text-white/55">
                  {miles(j.minutos)}′{j.xg90 != null && <> · {coma(j.xg90)} xG/90</>}
                  {j.veces != null && <span className={sobre ? "font-bold text-white" : ""}> · ×{coma(j.veces, 1)} la media</span>}
                </p>
              </div>
              <div
                className="relative col-span-3 col-start-1 row-start-2 mt-1 h-3 min-w-0 rounded-full sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-3.5"
                style={{ background: tinta(0.07) }}
                role="img"
                aria-label={`${j.jugador}: ${coma(j.xg)} xG; con la media del equipo haría ${coma(j.esperado)}`}
              >
                <div
                  className="portada-llena absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(j.xg / escala) * 100}%`, background: color, animationDelay: `${i * 45}ms` }}
                />
                <div
                  className="absolute -inset-y-1 w-[3px] rounded-full"
                  style={{ left: `calc(${Math.min(100, (j.esperado / escala) * 100)}% - 1.5px)`, background: tinta(0.85) }}
                  title={`Con la media del equipo por minuto: ${coma(j.esperado)} xG`}
                />
              </div>
              <p className="col-start-3 row-start-1 text-right leading-none sm:col-start-4">
                <span className="fuente-club block text-[22px] font-bold tabular-nums text-white sm:text-[26px]">{coma(j.pct, 1)} %</span>
                <span className="text-[12px] font-semibold tabular-nums text-white/55">{coma(j.xg)} xG</span>
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Temporada entera con este equipo. xG: goles esperados por la calidad de sus remates. La raya es lo que le tocaría por sus minutos con la media del
        equipo; «×3,2 media» = remata 3,2 veces lo que le tocaría por sus minutos.
      </p>
    </section>
  );
}
