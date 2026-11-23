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

import { useMemo, useState } from "react";

import { useAsoma } from "@/hooks/useAsoma";

import { MEJOR, PEOR, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { useEnlaceClipOpta } from "@/hooks/useCortesOpta";
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
  type ClaveMetrica as ClaveMetricaMarcador,
  type Estado,
  type SegunMarcador as SegunMarcadorDatos,
} from "@/lib/rivals/segun-marcador";
import { VistaVisualDetalle } from "@/components/ui/VistaVisual";
import { chipInk } from "@/lib/theme";

const COLOR_ESTADO: Record<Estado, string> = { ganando: MEJOR, empatando: tinta(0.22), perdiendo: PEOR };

/** Por debajo de tres partidos enteros en un estado, lo que se lee es tendencia (16/11/2026, ronda 18, fútbol: «Va perdiendo» con 188′). */
const MINUTOS_TENDENCIA = 270;

const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const baseDe = (min: number) => `${Math.round(min)}′ de base${min < MINUTOS_TENDENCIA ? ", tendencia" : ""}`;

/*
| LA ORDEN DE VESTUARIO QUE SALE DEL DATO (16/11/2026, ronda 18, fútbol): «si
| nos adelantamos, sube a 16,7 remates/90 con 188′ de base (tendencia):
| defender el área y la segunda jugada». Sólo con lo que se aparta más del
| umbral de su media y con al menos 90′ en ese estado; si nada se aparta, no hay orden.
*/
function ordenesDelMarcador(s: SegunMarcadorDatos, nombre: string): string[] {
  const col = (e: Estado) => s.columnas.find((c) => c.estado === e);
  const ordenes: string[] = [];
  const perdiendo = col("perdiendo");

  if (perdiendo && perdiendo.minutos >= MINUTOS_MINIMOS) {
    const r = perdiendo.valores.remates;
    const t = perdiendo.valores.tercio;

    if (r.valor != null && r.desvio != null && r.desvio > UMBRAL) {
      ordenes.push(
        `Si nos adelantamos, ${nombre} sube a ${coma(r.valor)} remates por 90′ (su media, ${coma(s.media.remates ?? 0)}; ${baseDe(perdiendo.minutos)}): defender el área y la segunda jugada.`,
      );
    } else if (t.valor != null && t.desvio != null && t.desvio > UMBRAL) {
      ordenes.push(
        `Si nos adelantamos, ${nombre} vive en nuestro campo: ${coma(t.valor)} toques por 90′ en el último tercio (su media, ${coma(s.media.tercio ?? 0)}; ${baseDe(perdiendo.minutos)}). Salida limpia y transición a su espalda.`,
      );
    }
  }

  const ganando = col("ganando");

  if (ganando && ganando.minutos >= MINUTOS_MINIMOS) {
    const p = ganando.valores.posesion;
    const x = ganando.valores.xgc;

    if (p.valor != null && p.desvio != null && p.desvio < -UMBRAL / 2) {
      ordenes.push(
        `Si se adelanta, ${nombre} nos da el balón (${coma(p.valor, 0)} % de posesión; su media, ${coma(s.media.posesion ?? 0, 0)} %; ${baseDe(ganando.minutos)}): no precipitarnos; amplitud, paciencia y llegada al área.`,
      );
    } else if (x.valor != null && x.desvio != null && x.desvio > UMBRAL) {
      ordenes.push(
        `Si se adelanta, le llegan más (${coma(x.valor, 2)} xG en contra por 90′; su media, ${coma(s.media.xgc ?? 0, 2)}; ${baseDe(ganando.minutos)}): no bajar los brazos, el empate llega.`,
      );
    }
  }

  return ordenes;
}

/* Las métricas que se comparan en barras: las cuatro «/90» con la misma escala dentro de cada una. */
const EN_BARRAS: ClaveMetricaMarcador[] = ["remates", "xg", "xgc", "tercio"];

/** Barras agrupadas: por métrica, los tres estados y la raya de su media (Visual, 16/11/2026, ronda 18, marketing). */
function BarrasMarcador({ s }: { s: SegunMarcadorDatos }) {
  const metricas = METRICAS.filter((m) => EN_BARRAS.includes(m.clave));

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/65">
        {s.columnas.map((c) => (
          <span key={c.estado} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: COLOR_ESTADO[c.estado] }} />
            {NOMBRE_ESTADO[c.estado]} · {minutosTexto(c.minutos)}
            {c.minutos < MINUTOS_MINIMOS ? " (pocos minutos)" : c.minutos < MINUTOS_TENDENCIA ? " (tendencia)" : ""}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-0.5" style={{ background: tinta(0.7) }} />
          su media
        </span>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {metricas.map((m) => {
          const valores = s.columnas.map((c) => c.valores[m.clave].valor ?? 0);
          const media = s.media[m.clave] ?? 0;
          const tope = Math.max(...valores, media, 0.0001) * 1.08;

          return (
            <div key={m.clave} className="portada-celda min-w-0 px-3 py-2.5">
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-white/80" title={m.nota}>
                {m.rotulo} <span className="font-normal normal-case tracking-normal text-white/50">por 90′</span>
              </p>
              <div className="relative space-y-1">
                {s.columnas.map((c, i) => {
                  const v = c.valores[m.clave];
                  const poco = c.minutos < MINUTOS_MINIMOS;

                  return (
                    <div key={c.estado} className="flex min-w-0 items-center gap-2">
                      <div className="relative h-4 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.06) }}>
                        {v.valor != null && (
                          <div
                            className="portada-llena absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${(v.valor / tope) * 100}%`, background: COLOR_ESTADO[c.estado], opacity: poco ? 0.4 : 1, animationDelay: `${i * 80}ms` }}
                          />
                        )}
                        <div aria-hidden className="absolute inset-y-[-3px] w-[3px] rounded-full" style={{ left: `calc(${(media / tope) * 100}% - 1.5px)`, background: tinta(0.75) }} />
                      </div>
                      <span className={`fuente-club w-14 shrink-0 text-right text-[16px] tabular-nums ${marcado(v) && !poco ? "font-bold text-white" : "font-semibold text-white/70"}`}>
                        {valorTexto(v.valor, m.unidad, m.decimales)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SegunMarcador({ equipo }: { equipo: string }) {
  /* El mismo «al asomar o, como muy tarde, a los 2,5 s» que los demás bloques del rival: sin bajar (captura, exportación) también se pinta. */
  const { caja, abierto } = useAsoma<HTMLDivElement>();

  return <div ref={caja} className="min-w-0">{abierto && <Bloque equipo={equipo} />}</div>;
}

function Bloque({ equipo }: { equipo: string }) {
  const { opta } = useOptaLigero();
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.remates, DOCS_OPTA.momento, DOCS_OPTA.jugadoresPartidos);
  const [remates, momento, jugadores] = docs;
  const [verTodos, setVerTodos] = useState(false);
  const clip = useEnlaceClipOpta();

  const pista =useMemo(() => pistaDe(aObjetos(jugadores)), [jugadores]);

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

  /* La tabla de siempre: en «Detalle» (16/11/2026, ronda 18). En móvil, desliza de lado. */
  const tabla = (
      <div className="min-w-0 overflow-x-auto">
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
                  <span className={`block text-[11px] font-normal ${c.minutos < MINUTOS_MINIMOS ? "text-white/40" : "text-white/55"}`}>
                    {minutosTexto(c.minutos)}
                    {c.minutos < MINUTOS_MINIMOS ? " · pocos minutos" : c.minutos < MINUTOS_TENDENCIA ? " · tendencia" : ""}
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
                      {rojo && <span className="ml-1 text-[11px] font-semibold">{pct}</span>}
                    </td>
                  );
                })}
                <td className="border-t border-white/10 py-1.5 pl-2 text-right tabular-nums text-white/55">{valorTexto(s.media[m.clave], m.unidad, m.decimales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
  const ordenes = ordenesDelMarcador(s, nombre);

  return (
    <section id="x-idea-2121989190145429790-1" aria-label="Según el marcador" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Según el marcador · ganando, empatando, perdiendo
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {s.partidos} {s.partidos === 1 ? "partido" : "partidos"}
        </span>
      </p>
      {frase && <h3 className="fuente-club mt-1.5 text-[22px] font-bold leading-[1.1] text-white sm:text-[26px]">{frase}</h3>}
      <p className="mt-1 text-sm leading-6 text-white/70">
        Lo que hace {nombre} por cada 90 minutos jugados yendo por delante, igualado o por detrás.
      </p>

      {/* La orden de vestuario que sale del dato (16/11/2026, ronda 18, fútbol). */}
      {ordenes.length > 0 && (
        <ul className="mt-2 min-w-0 space-y-1">
          {ordenes.map((o) => (
            <li key={o} className="rounded-lg border border-[#C8A96B]/30 bg-[#C8A96B]/[0.07] px-3 py-1.5 text-[13px] leading-snug text-white/85">
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: chipInk("#C8A96B") }}>
                Qué hacemos
              </span>{" "}
              {o}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 min-w-0">
        <VistaVisualDetalle
          pantalla="scout-colectivo-marcador"
          visual={<BarrasMarcador s={s} />}
          detalle={tabla}
        />
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
              {/* 18/11/2026: cada gol abre su vídeo (nuestro corte de B2 o ProVision en ese segundo). */}
              {l.goles.map((g, i) => {
                const url = clip({ partido: l.partido, fecha: l.fecha, parte: g.parte, segundo: g.reloj }, "shots");
                const marca = g.suyo ? "▲" : "▼";
                const sitio = { left: `${(g.segundo / finEje) * 100}%`, top: g.suyo ? "-10px" : "13px" };
                return url ? (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Vídeo del ${g.suyo ? "gol suyo" : "gol en contra"} en el ${g.minuto} contra ${l.rival}`}
                    title={`${g.suyo ? "Gol suyo" : "Gol en contra"}, ${g.minuto} (${g.marcador}): pincha para ver el vídeo`}
                    className="absolute -translate-x-1/2 text-[12px] leading-none text-white hover:text-[#C8A96B]"
                    style={sitio}
                  >
                    {marca}
                  </a>
                ) : (
                  <span key={i} aria-hidden className="absolute -translate-x-1/2 text-[12px] leading-none text-white" style={sitio}>
                    {marca}
                  </span>
                );
              })}
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
