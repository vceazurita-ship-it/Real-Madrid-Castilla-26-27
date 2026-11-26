"use client";

/**
 * QUIÉN CREA LA AMENAZA DEL RIVAL (Plantillas rivales, 26/11/2026, idea de X).
 * Ranking de sus jugadores por xT/90 de pases y conducciones (evento a evento
 * de Opta), con xG sin penaltis/90 y xA/90 al lado; sello de cuántos de sus
 * partidos tiene Opta evento a evento, y aviso a quien no ha jugado ninguna
 * de las últimas 3 jornadas.
 *
 * Datos: `opta:equipos`, `opta:partidos`, `opta:jugadores-partidos`,
 * `opta:remates`, `opta:directo:archivo` y `opta:directo:<partido>` (por
 * `useDocsOpta`, misma caché que los demás bloques; nada se pide hasta que
 * asoma). Las cuentas, en `lib/rivals/amenaza-xt.ts`.
 */

import { useMemo, useState } from "react";

import { ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, num, type TablaOpta } from "@/lib/opta";
import { casaEquipo, pistaDe, rematesDe } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";
import {
  CONDUCCION_MAX_S,
  CONDUCCION_MIN_M,
  JORNADAS_AVISO,
  MAX_PARTIDOS_XT,
  MIN_MINUTOS_XT,
  rankingAmenaza,
  type AmenazaJugador,
} from "@/lib/rivals/amenaza-xt";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { partido?: string; fecha?: string; eventos?: TablaOpta; jugadores?: TablaOpta };

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const A_LA_VISTA = 8;

export function AmenazaXT({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>();
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} nombres={nombres} />}</div>;
}

function Indice({ equipo, nombres }: { equipo: string; nombres: string[] }) {
  const { docs } = useDocsOpta<[TablaOpta, TablaOpta, Archivo]>(DOCS_OPTA.equipos, DOCS_OPTA.partidos, "opta:directo:archivo");
  const [tEquipos, tPartidos, archivo] = docs;

  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [tEquipos, equipo]);

  /* Sus partidos en Opta (cifras de equipo), del más reciente al más antiguo. */
  const suyos = useMemo(() => {
    if (!rival) return [];
    const vistos = new Map<string, string>();
    for (const f of aObjetos(tPartidos)) if (String(f.teamId ?? "") === rival.id && f.partido) vistos.set(String(f.partido), String(f.fecha ?? ""));
    return [...vistos].sort((a, b) => b[1].localeCompare(a[1])).map(([p]) => p);
  }, [rival, tPartidos]);

  const conEventos = useMemo(() => {
    if (!rival || !Array.isArray(archivo?.partidos)) return [];
    return archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
      .map((p) => String(p.partido));
  }, [rival, archivo]);

  if (!rival || !conEventos.length) return null;
  const total = Math.max(suyos.length, conEventos.length);
  return <Bloque teamId={rival.id} nombre={rival.nombre} ids={conEventos.slice(0, MAX_PARTIDOS_XT)} conEventos={conEventos.length} total={total} suyos={suyos} nombres={nombres} />;
}

function Bloque({
  teamId,
  nombre,
  ids,
  conEventos,
  total,
  suyos,
  nombres,
}: {
  teamId: string;
  nombre: string;
  ids: string[];
  conEventos: number;
  total: number;
  suyos: string[];
  nombres: string[];
}) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, ...DocDirecto[]]>(DOCS_OPTA.jugadoresPartidos, DOCS_OPTA.remates, ...ids.map(DOCS_OPTA.directo));
  const [verTodos, setVerTodos] = useState(false);

  /* `docs` es un array nuevo en cada pintada: la cuenta se guarda por documento (misma caché que useDocsOpta). */
  const datos = cargando ? null : calcula(docs as [TablaOpta | null, TablaOpta | null, ...(DocDirecto | null)[]], ids, teamId, suyos);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Quién crea la amenaza" className="portada-tarjeta mt-6 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Quién crea la amenaza · xT/90</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de sus últimos {ids.length} partidos…</p>
      </section>
    );
  }

  const { lista, leidos } = datos;
  const nombreDe = (j: AmenazaJugador) => (j.jugador && (nombreDePlantilla(j.jugador, nombres) || j.jugador)) || j.jugador;
  const visibles = verTodos ? lista : lista.slice(0, A_LA_VISTA);
  const tope = Math.max(...lista.map((j) => Math.max(0, j.xt90)), 0.001);
  const primero = lista[0];
  const primeroFuera = primero?.ausente;
  const sello = `${conEventos} de ${total}`;
  const conPenalti = lista.filter((j) => j.penaltis > 0);
  const frase = primero
    ? `${nombreDe(primero)} es quien más amenaza mueve en ${nombre}: ${coma(primero.xt90)} xT por 90′` +
      (primeroFuera ? `, pero no ha jugado ninguna de sus últimas ${JORNADAS_AVISO} jornadas.` : ".")
    : "";

  return (
    <section id="x-idea-2125576947971637586-1" aria-label="Quién crea la amenaza" className="portada-tarjeta portada-entra mt-6 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Quién crea la amenaza de {nombre} · xT/90
        <span
          className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60"
          title={`Opta tiene evento a evento de ${conEventos} de sus ${total} partidos${leidos < conEventos ? `; se leen los ${leidos} más recientes` : ""}`}
        >
          dato · Opta, {sello} partidos{leidos < conEventos ? ` · últimos ${leidos}` : ""}
        </span>
      </p>
      {frase && <h3 className="fuente-club mt-1.5 text-[20px] font-bold leading-[1.15] text-white sm:text-[24px]">{frase}</h3>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] font-semibold text-white/55">
              <th className="py-1.5 pr-2 font-semibold">#</th>
              <th className="py-1.5 pr-2 font-semibold">Jugador</th>
              <th className="px-2 py-1.5 font-semibold" title="Amenaza esperada que suma por 90′ con pases acertados y conducciones">xT/90</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="xT/90 de pases · de conducciones">Pase · Cond.</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="xG por 90′ sin los remates de penalti">npxG/90</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="xA por 90′ (Opta)">xA/90</th>
              <th className="py-1.5 pl-2 text-right font-semibold" title="Partidos que jugó de los que Opta tiene evento a evento · minutos">Muestra</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((j, i) => (
              <tr key={j.playerId} className={`border-b border-white/5 ${j.ausente ? "opacity-70" : ""}`}>
                <td className="py-1.5 pr-2 text-white/50">{i + 1}</td>
                <td className="max-w-[14rem] py-1.5 pr-2 font-semibold text-white">
                  <span className="block truncate">{nombreDe(j)}</span>
                  {j.ausente && (
                    <span
                      className="mt-0.5 inline-block rounded-full border border-amber-400/60 px-1.5 py-px text-[11px] font-bold text-amber-300"
                      title={`No ha tenido minutos en ninguna de las últimas ${JORNADAS_AVISO} jornadas de ${nombre} (Opta)`}
                    >
                      ⚠ sin jugar las últimas {JORNADAS_AVISO}
                    </span>
                  )}
                  {j.penaltis > 0 && (
                    <span className="ml-1 mt-0.5 inline-block rounded-full border border-white/20 px-1.5 py-px text-[11px] font-semibold text-white/60" title="Remates de penalti fuera del npxG">
                      {j.penaltis} pen. fuera
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex min-w-[8rem] items-center gap-2">
                    <div className="h-2 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (Math.max(0, j.xt90) / tope) * 100)}%`, background: i === 0 ? ORO : tinta(0.45) }} />
                    </div>
                    <span className={`w-10 text-right ${i === 0 ? "font-bold text-white" : "text-white/80"}`}>{coma(j.xt90)}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right text-white/65">
                  {coma(j.xtPases90)} · {coma(j.xtConducciones90)}
                </td>
                <td className="px-2 py-1.5 text-right text-white/80">{coma(j.npxg90)}</td>
                <td className="px-2 py-1.5 text-right text-white/80">{coma(j.xa90)}</td>
                <td className="py-1.5 pl-2 text-right">
                  <span className="whitespace-nowrap rounded-full border border-white/15 px-1.5 py-px text-[11px] font-semibold text-white/60" title={`Jugó ${j.partidos} de los ${leidos} partidos leídos; Opta tiene evento a evento de ${sello} partidos de ${nombre}`}>
                    {j.partidos} de {leidos} · {Math.round(j.minutos)}′
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length > A_LA_VISTA && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-[12px] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline">
          {verTodos ? `Ver sólo los ${A_LA_VISTA} primeros` : `Ver los ${lista.length} jugadores`}
        </button>
      )}

      <p className="mt-3 text-[12px] leading-5 text-white/55">
        xT = cuánto sube la amenaza esperada (rejilla pública de 12 × 8 de K. Singh) entre el origen y el destino de cada pase acertado en juego y de cada conducción; neto, así que el pase atrás resta. Conducción: de dónde le llega el balón a dónde hace su siguiente acción, en {CONDUCCION_MAX_S} s como mucho y con {CONDUCCION_MIN_M} m o más. npxG sin los remates de penalti
        {conPenalti.length ? ` (${conPenalti.length === 1 ? "a uno se le quitan" : `a ${conPenalti.length} se les quitan`})` : ""}; todo por 90′ con los mismos partidos y minutos. Entran con {MIN_MINUTOS_XT}′ o más. El aviso ⚠ marca a quien no ha tenido minutos en ninguna de las últimas {JORNADAS_AVISO} jornadas que Opta tiene de {nombre}.
      </p>
    </section>
  );
}

type Calculo = { lista: AmenazaJugador[]; leidos: number } | null;
const hechos = new WeakMap<object, Map<string, Calculo>>();

function calcula(docs: [TablaOpta | null, TablaOpta | null, ...(DocDirecto | null)[]], ids: string[], teamId: string, suyos: string[]): Calculo {
  const [tJugPartidos, tRemates, ...directos] = docs;
  if (!tJugPartidos) return null;
  const clave = `${teamId}|${ids.join(",")}|${suyos.join(",")}|${directos.map((d) => (d ? 1 : 0)).join("")}|${tRemates ? 1 : 0}`;
  const guardados = hechos.get(tJugPartidos) ?? new Map<string, Calculo>();
  hechos.set(tJugPartidos, guardados);
  if (guardados.has(clave)) return guardados.get(clave)!;
  const r = (() => {
      const partidos = directos
        .map((d, i) => (d ? { partido: ids[i], eventos: leeEventos(d.eventos), jugadores: leeJugadores(d.jugadores) } : null))
        .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
      if (!partidos.length) return null;

      const objetos = aObjetos(tJugPartidos);
      const suyas = objetos.filter((f) => String(f.teamId ?? "") === teamId);
      const filas = suyas.map((f) => ({
        partido: String(f.partido ?? ""),
        playerId: String(f.playerId ?? ""),
        jugador: String(f.jugador ?? ""),
        minutos: num(f.Min) ?? 0,
        xA: num(f.xA) ?? 0,
      }));
      const remates = rematesDe(tRemates, pistaDe(objetos))
        .filter((r) => r.teamId === teamId)
        .map((r) => ({ partido: r.partido, tiradorId: r.tiradorId, xG: r.xG, penalti: r.situacion === "Penalty" || r.tipo === "PenaltyGoal" }));

      /* Quién tuvo minutos en cada partido suyo; las últimas jornadas, las más recientes que tienen alineación. */
      const jugaron = new Map<string, Set<string>>();
      for (const f of filas) {
        if (!f.partido) continue;
        if (!jugaron.has(f.partido)) jugaron.set(f.partido, new Set());
        if (f.minutos > 0) jugaron.get(f.partido)!.add(f.playerId);
      }
      const ultimos = suyos.filter((p) => jugaron.has(p)).slice(0, JORNADAS_AVISO);

      const lista = rankingAmenaza(partidos, teamId, filas, remates, ultimos, jugaron);
      return lista.length ? { lista, leidos: partidos.length } : null;
  })();
  guardados.set(clave, r);
  return r;
}
