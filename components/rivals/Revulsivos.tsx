"use client";

/**
 * REVULSIVOS (Plantillas rivales, 16/11/2026): los jugadores del rival que
 * salen del banquillo, con lo que dan entrando frente a lo que dan de titular,
 * el minuto medio de su cambio y la banda de sus remates tras entrar. Los que
 * rinden mucho más entrando, arriba y marcados.
 *
 * Datos: `opta:equipos`, `opta:jugadores-partidos` y `opta:remates` (por
 * `useDocsOpta`, se piden al asomar). Las cuentas, en `lib/rivals/revulsivos.ts`.
 */

import { useMemo, useState } from "react";

import { useAsoma } from "@/hooks/useAsoma";

import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo, pistaDe, rematesDe } from "@/lib/opta-eventos";
import { lecturaRevulsivos, NOMBRE_BANDA, revulsivos } from "@/lib/rivals/revulsivos";

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

export function Revulsivos({ equipo }: { equipo: string }) {
  /* El mismo «al asomar o, como muy tarde, a los 2,5 s» que los demás bloques del rival: sin bajar (captura, exportación) también se pinta. */
  const { caja, abierto } = useAsoma<HTMLDivElement>();

  return <div ref={caja} className="min-w-0">{abierto && <Bloque equipo={equipo} />}</div>;
}

function Bloque({ equipo }: { equipo: string }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.jugadoresPartidos, DOCS_OPTA.remates);
  const [tEquipos, tJugPartidos, tRemates] = docs;
  const [verTodos, setVerTodos] = useState(false);

  const datos = useMemo(() => {
    /* Hasta que lleguen los tres: `rematesDe` guarda la primera cuenta y, sin la pista de los jugadores, atribuiría mal los remates. */
    if (!tEquipos || !tJugPartidos || cargando) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    const filas = aObjetos(tJugPartidos);
    const remates = rematesDe(tRemates, pistaDe(filas)).filter((r) => r.teamId === id);
    const lista = revulsivos(filas, remates, id);
    if (!lista.length) return null;
    const nombre = equipos.find((e) => e.teamId === id)?.equipo || equipo;
    return { lista, nombre };
  }, [tEquipos, tJugPartidos, tRemates, equipo, cargando]);

  if (!datos) return null;
  const { lista, nombre } = datos;
  const frase = lecturaRevulsivos(lista, nombre);
  const visibles = verTodos ? lista : lista.slice(0, 8);
  const hayBanda = lista.some((j) => j.banda);

  return (
    <section aria-label="Revulsivos" className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
        Revulsivos
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Opta, esta temporada</span>
      </p>
      {frase && <p className="mt-1 text-sm leading-6 text-white/75">{frase}</p>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] font-semibold text-white/55">
              <th className="py-1.5 pr-2 font-semibold">Jugador</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Partidos que entra desde el banquillo">Entra</th>
              <th className="px-2 py-1.5 text-right font-semibold">Min. suplente</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Goles y asistencias entrando">G · A</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Goles + asistencias por 90 minutos como suplente">G+A/90 sup.</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Goles + asistencias por 90 minutos como titular">G+A/90 tit.</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Minuto medio de su entrada (90 − minutos jugados)">Entra ≈</th>
              {hayBanda && <th className="py-1.5 pl-2 font-semibold" title="Banda de sus remates en los partidos que entra">Banda</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((j) => (
              <tr key={j.playerId} className={`border-b border-white/5 ${j.destacado ? "bg-[#C8A96B]/10" : ""}`}>
                <td className="max-w-[12rem] truncate py-1.5 pr-2 font-semibold text-white">
                  {j.destacado && (
                    <span className="mr-1.5 rounded-full border border-[#C8A96B]/50 px-1.5 py-px text-[10px] font-bold text-[#C8A96B]" title="Rinde mucho más entrando que de titular">
                      revulsivo
                    </span>
                  )}
                  {j.jugador}
                </td>
                <td className="px-2 py-1.5 text-right text-white/75">{j.entradas}</td>
                <td className="px-2 py-1.5 text-right text-white/75">{Math.round(j.minSup)}′</td>
                <td className="px-2 py-1.5 text-right text-white">
                  {j.golesSup} · {j.asistSup}
                </td>
                <td className={`px-2 py-1.5 text-right ${j.destacado ? "font-bold text-white" : "text-white/75"}`}>
                  {j.ga90Sup != null ? coma(j.ga90Sup) : ""}
                </td>
                <td className="px-2 py-1.5 text-right text-white/60" title={j.titularidades ? `${j.titularidades} de titular, ${Math.round(j.minTit)}′` : undefined}>
                  {j.ga90Tit != null ? coma(j.ga90Tit) : ""}
                </td>
                <td className="px-2 py-1.5 text-right text-white/75">{j.minutoEntrada != null ? `${j.minutoEntrada}′` : ""}</td>
                {hayBanda && (
                  <td className="py-1.5 pl-2 text-white/75" title={j.banda ? `${j.rematesSup} remates tras entrar` : undefined}>
                    {j.banda ? NOMBRE_BANDA[j.banda] : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length > 8 && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-[11px] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline">
          {verTodos ? "Ver menos" : `Ver los ${lista.length}`}
        </button>
      )}

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Sólo lo hecho con este equipo. «Revulsivo»: 90′ o más entrando, 0,3 G+A/90 o más y al menos 1,5 veces lo que da de titular. Los /90 salen con 45′ (suplente) o 90′ (titular). El minuto de entrada es aproximado (90 − minutos jugados) y la banda sale de sus remates tras entrar, con dos o más.
      </p>
    </section>
  );
}
