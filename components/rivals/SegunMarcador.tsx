"use client";

/**
 * SEGÚN EL MARCADOR (Scout colectivo, 16/11/2026): tres columnas (va ganando,
 * empatando y perdiendo) con lo que hace el rival por cada 90′ en ese estado;
 * en rojo lo que se aparta más de un 25 % de su media. Debajo, una línea por
 * partido con el minuto de cada gol, para ver si ganando se repliega.
 *
 * Datos: `opta:partidos` (useOptaLigero), `opta:remates`, `opta:momento` y
 * `opta:jugadores-partidos` (para saber de quién es cada remate), todos por
 * `useDocsOpta` y sólo cuando el bloque asoma. Las cuentas, en
 * `lib/rivals/segun-marcador.ts`. Si el rival no cruza con Opta, no se pinta.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { MEJOR, PEOR, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { fechaCorta } from "@/lib/opta-analisis";
import { casaEquipo, pistaDe } from "@/lib/opta-eventos";
import {
  ESTADOS,
  lecturaMarcador,
  marcado,
  METRICAS,
  MINUTOS_MINIMOS,
  minutosTexto,
  NOMBRE_ESTADO,
  resultado,
  segunMarcador,
  UMBRAL,
  valorTexto,
  type Estado,
} from "@/lib/rivals/segun-marcador";

const COLOR_ESTADO: Record<Estado, string> = { ganando: MEJOR, empatando: tinta(0.22), perdiendo: PEOR };

export function SegunMarcador({ equipo }: { equipo: string }) {
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
  const { opta } = useOptaLigero();
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.remates, DOCS_OPTA.momento, DOCS_OPTA.jugadoresPartidos);
  const [remates, momento, jugadores] = docs;
  const [verTodos, setVerTodos] = useState(false);

  const pista = useMemo(() => pistaDe(aObjetos(jugadores)), [jugadores]);

  const datos = useMemo(() => {
    /* Hasta que lleguen los tres: `rematesDe` guarda la primera cuenta y, sin la pista de los jugadores, atribuiría mal los remates. */
    if (!opta || !remates || cargando) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombre = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const s = segunMarcador(opta.partidos, remates, momento, rivalId, pista);
    return s ? { s, nombre } : null;
  }, [opta, remates, momento, pista, equipo, cargando]);

  if (!datos) return null;
  const { s, nombre } = datos;
  const frase = lecturaMarcador(s, nombre);
  const lineas = verTodos ? s.lineas : s.lineas.slice(0, 8);
  const finEje = Math.max(...s.lineas.map((l) => l.fin), 5400);

  return (
    <section aria-label="Según el marcador" className="mt-8 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
        Según el marcador
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">
          dato · Opta, {s.partidos} {s.partidos === 1 ? "partido" : "partidos"}
        </span>
      </p>
      <p className="mt-1 text-sm leading-6 text-white/75">
        Lo que hace {nombre} por cada 90 minutos jugados yendo por delante, igualado o por detrás.
        {frase && <> <strong className="text-white">{frase}</strong></>}
      </p>

      {/* Tres columnas; en móvil, desliza de lado. */}
      <div className="mt-3 min-w-0 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th scope="col" className="py-1.5 pr-2 text-left font-semibold text-white/55">Por 90′</th>
              {s.columnas.map((c) => (
                <th key={c.estado} scope="col" className="px-2 py-1.5 text-right font-semibold text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_ESTADO[c.estado] }} />
                    {NOMBRE_ESTADO[c.estado]}
                  </span>
                  <span className={`block text-[10px] font-normal ${c.minutos < MINUTOS_MINIMOS ? "text-white/40" : "text-white/55"}`}>
                    {minutosTexto(c.minutos)}
                    {c.minutos < MINUTOS_MINIMOS && " · pocos minutos"}
                  </span>
                </th>
              ))}
              <th scope="col" className="py-1.5 pl-2 text-right font-semibold text-white/55">Su media</th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => (
              <tr key={m.clave}>
                <th scope="row" className="border-t border-white/10 py-1.5 pr-2 text-left font-semibold text-white" title={m.nota}>
                  {m.rotulo}
                  {m.unidad === "%" ? "" : <span className="font-normal text-white/45"> /90</span>}
                </th>
                {s.columnas.map((c) => {
                  const v = c.valores[m.clave];
                  const rojo = marcado(v);
                  const pct = v.desvio != null ? `${v.desvio > 0 ? "+" : "−"}${Math.abs(Math.round(v.desvio * 100))} %` : "";
                  return (
                    <td
                      key={c.estado}
                      className={`border-t border-white/10 px-2 py-1.5 text-right tabular-nums ${rojo ? "font-bold text-red-400" : "text-white/85"}`}
                      title={pct ? `${pct} sobre su media` : undefined}
                    >
                      {valorTexto(v.valor, m.unidad, m.decimales)}
                      {rojo && <span className="ml-1 text-[10px] font-semibold">{pct}</span>}
                    </td>
                  );
                })}
                <td className="border-t border-white/10 py-1.5 pl-2 text-right tabular-nums text-white/55">{valorTexto(s.media[m.clave], m.unidad, m.decimales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] font-semibold text-white">Partido a partido: cuándo cambió el marcador</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        {ESTADOS.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm" style={{ background: COLOR_ESTADO[e] }} />
            {NOMBRE_ESTADO[e]}
          </span>
        ))}
        <span>▲ gol suyo · ▼ gol en contra</span>
      </p>
      <ol className="mt-2 space-y-2">
        {lineas.map((l) => (
          <li key={l.partido} className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
              <span className="min-w-0 truncate text-white/85">
                <span className="text-white/50">{fechaCorta(l.fecha)}</span> · {l.rival} <strong className="text-white">{resultado(l)}</strong>
              </span>
              <span className="shrink-0 text-white/50">
                {l.goles.length ? l.goles.map((g) => `${g.minuto} ${g.marcador}`).join(" · ") : "sin goles"}
                {!l.cuadra && " · no entra en las cuentas (gol en propia)"}
              </span>
            </div>
            <div
              className={`relative mt-1 h-3 min-w-0 overflow-visible rounded-sm ${l.cuadra ? "" : "opacity-50"}`}
              style={{ background: tinta(0.06) }}
              role="img"
              aria-label={`${l.rival} ${resultado(l)}: ${l.goles.length ? l.goles.map((g) => `${g.suyo ? "gol suyo" : "gol en contra"} en el ${g.minuto}, ${g.marcador}`).join("; ") : "sin goles"}`}
            >
              {l.tramos.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{ left: `${(t.desde / finEje) * 100}%`, width: `${((t.hasta - t.desde) / finEje) * 100}%`, background: COLOR_ESTADO[t.estado] }}
                />
              ))}
              {/* El descanso. */}
              <div aria-hidden className="absolute top-0 h-full w-px" style={{ left: `${(2700 / finEje) * 100}%`, background: tinta(0.5) }} />
              {l.goles.map((g, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="absolute -translate-x-1/2 text-[9px] leading-none text-white"
                  style={{ left: `${(g.segundo / finEje) * 100}%`, top: g.suyo ? "-10px" : "13px" }}
                >
                  {g.suyo ? "▲" : "▼"}
                </span>
              ))}
            </div>
            <div className="h-2" />
          </li>
        ))}
      </ol>
      {s.lineas.length > 8 && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-1 text-[11px] font-semibold text-white/60 underline underline-offset-2 hover:text-white">
          {verTodos ? "Ver sólo los 8 últimos" : `Ver los ${s.lineas.length} partidos`}
        </button>
      )}

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Cada cifra va por 90 minutos jugados en ese estado; la posesión, en %. En rojo, lo que se aparta más de un {Math.round(UMBRAL * 100)} % de su media
        (sólo con {MINUTOS_MINIMOS}′ o más en ese estado). Remates y xG, de cada remate según el marcador en ese momento; posesión, toques en el último
        tercio y balones ganados arriba, de los tramos de 5′, repartidos por el tiempo en cada estado. Opta no trae, para todos los equipos, el pase a pase
        ni los centros: el juego en campo contrario se lee con la posesión y los toques en el último tercio, y la altura defensiva con los balones ganados en
        el último tercio. El descuento de la primera parte se cuenta en el 45′.
        {s.descartados > 0 && ` ${s.descartados} ${s.descartados === 1 ? "partido no entra" : "partidos no entran"} en las cuentas: un gol en propia puerta no es un remate y su marcador no se puede seguir.`}
      </p>
    </section>
  );
}
