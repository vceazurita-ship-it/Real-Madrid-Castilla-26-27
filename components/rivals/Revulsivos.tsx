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
import { tinta } from "@/components/data/graficas";
import { lecturaRevulsivos, NOMBRE_BANDA, revulsivos, type Revulsivo } from "@/lib/rivals/revulsivos";

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
  /*
  | 16/11/2026 (ronda 18, jueces de fútbol): la tabla de ocho filas era casi
  | toda ceros. A la vista, la conclusión y sólo quien ha hecho algo entrando
  | (G+A o «revulsivo»), hasta tres; la tabla entera, plegada. Y un /90 sacado
  | de menos de 90′ de suplente se marca «tendencia».
  */
  /*
  | 17/11/2026 (ronda 20, fútbol): la frase nombra al que más sale (Álvaro
  | Bustos, 8 veces) y no estaba en la tabla. Ahora va el primero si la frase
  | habla de él (ningún revulsivo claro).
  */
  const elQueMasSale = lista.some((j) => j.destacado) ? null : [...lista].sort((x, y) => y.entradas - x.entradas)[0] ?? null;
  const conAlgo = [...(elQueMasSale ? [elQueMasSale] : []), ...lista.filter((j) => j !== elQueMasSale && (j.destacado || j.golesSup + j.asistSup > 0))].slice(0, 3);
  const visibles = verTodos ? lista : conAlgo;
  const hayBanda = lista.some((j) => j.banda);

  return (
    <section id="x-idea-2122059133062947319-1" aria-label="Revulsivos" className="portada-tarjeta portada-entra mt-6 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Revulsivos · el banquillo de {nombre}
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">dato · Opta, esta temporada</span>
      </p>
      {frase && <h3 className="fuente-club mt-1.5 text-[20px] font-bold leading-[1.15] text-white sm:text-[24px]">{frase}</h3>}

      {/* Como el original de X (la ficha de Lidueña): nombre, fila de cifras grandes y, en barras, lo que da entrando frente a de titular. La tabla, al pedirla. */}
      {!verTodos && conAlgo.length > 0 && (
        <ul className="mt-3 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {conAlgo.map((j, i) => (
            <FichaRevulsivo key={j.playerId} j={j} orden={i} />
          ))}
        </ul>
      )}

      {verTodos && visibles.length > 0 && (
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
                    <span className="mr-1.5 rounded-full border border-[#C8A96B]/50 px-1.5 py-px text-[11px] font-bold text-[#C8A96B]" title="Rinde mucho más entrando que de titular">
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
                  {j.ga90Sup != null ? coma(j.ga90Sup, 1) : ""}
                  {j.ga90Sup != null && j.minSup < 90 && (
                    <span className="ml-1 rounded-full border border-white/20 px-1.5 py-px text-[11px] font-semibold text-white/60" title={`Sale de ${Math.round(j.minSup)}′ de suplente: menos de 90′`}>
                      tendencia
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-white/60" title={j.titularidades ? `${j.titularidades} de titular, ${Math.round(j.minTit)}′` : undefined}>
                  {j.ga90Tit != null ? coma(j.ga90Tit, 1) : ""}
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
      )}

      {(lista.length > conAlgo.length || verTodos) && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-[12px] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline">
          {verTodos ? (conAlgo.length ? "Ver sólo los que han hecho algo entrando" : "Ocultar la tabla") : `Ver la tabla de los ${lista.length} suplentes`}
        </button>
      )}

      <p className="mt-3 text-[12px] leading-5 text-white/55">
        Sólo lo hecho con este equipo. «Revulsivo»: 90′ o más entrando, 0,3 G+A/90 o más y al menos 1,5 veces lo que da de titular. Los /90 salen con 45′ (suplente) o 90′ (titular). El minuto de entrada es aproximado (90 − minutos jugados) y la banda sale de sus remates tras entrar, con dos o más.
      </p>
    </section>
  );
}

/** Una ficha por revulsivo: cifras en fila (como las del original de X) y dos barras, G+A/90 entrando y de titular. */
function FichaRevulsivo({ j, orden }: { j: Revulsivo; orden: number }) {
  const tope = Math.max(j.ga90Sup ?? 0, j.ga90Tit ?? 0, 0.01);
  const barras = [
    { k: "Entrando", v: j.ga90Sup, color: "var(--rmcf-gold-ink)", nota: j.ga90Sup != null && j.minSup < 90 ? "tendencia" : `${Math.round(j.minSup)}′` },
    { k: "De titular", v: j.ga90Tit, color: tinta(0.35), nota: j.titularidades ? `${Math.round(j.minTit)}′` : "" },
  ];
  const cifras = [
    { k: "Entra", v: `${j.entradas}`, sub: j.entradas === 1 ? "vez" : "veces" },
    { k: "G · A", v: `${j.golesSup} · ${j.asistSup}`, sub: "entrando" },
    ...(j.minutoEntrada != null ? [{ k: "Entra ≈", v: `${j.minutoEntrada}′`, sub: "minuto medio" }] : []),
    ...(j.banda ? [{ k: "Banda", v: NOMBRE_BANDA[j.banda], sub: `${j.rematesSup} remates` }] : []),
  ];

  return (
    <li className={`portada-celda portada-entra min-w-0 p-3 ${j.destacado ? "ring-1 ring-[#C8A96B]/50" : ""}`} style={{ animationDelay: `${orden * 80}ms` }}>
      <p className="flex min-w-0 items-center gap-2">
        <span className="fuente-club min-w-0 truncate text-[22px] font-bold uppercase leading-none text-white">{j.jugador}</span>
        {j.destacado && (
          <span className="shrink-0 rounded-full border border-[#C8A96B]/50 px-1.5 py-px text-[11px] font-bold text-[#C8A96B]" title="Rinde mucho más entrando que de titular">
            revulsivo
          </span>
        )}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.k} className="min-w-0 rounded-lg px-2 py-1.5" style={{ background: tinta(0.05) }}>
            <dt className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-white/50">{c.k}</dt>
            <dd className="fuente-club truncate text-[18px] font-bold leading-tight tabular-nums text-white">{c.v}</dd>
            <dd className="truncate text-[11px] text-white/45">{c.sub}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">G+A por 90′</p>
      <div className="mt-1 flex h-24 items-end gap-3" role="img" aria-label={`G+A por 90: entrando ${j.ga90Sup != null ? coma(j.ga90Sup, 1) : "sin minutos"}, de titular ${j.ga90Tit != null ? coma(j.ga90Tit, 1) : "sin minutos"}`}>
        {barras.map((b) =>
          b.v == null ? null : (
            <div key={b.k} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
              <span className="fuente-club text-[18px] font-bold leading-none tabular-nums text-white">{coma(b.v, 1)}</span>
              <div className="portada-entra mx-auto mt-1 w-full max-w-[5rem] rounded-t-md" style={{ height: `${Math.max(4, (b.v / tope) * 60)}px`, background: b.color }} />
              <span className="mt-1 truncate text-[11px] text-white/55">
                {b.k}
                {b.nota && ` · ${b.nota}`}
              </span>
            </div>
          ),
        )}
      </div>
    </li>
  );
}
