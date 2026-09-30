"use client";

/**
 * Comparativo U-21 — ya no es un Power BI incrustado: es nuestro.
 *
 * Junta lo que recopilamos de cada jugador:
 * - la descarga de jugadores de Wyscout de TODA la categoría (edad, puesto,
 *   minutos y 86 métricas por noventa), que es lo que permite compararle con
 *   los sub-21 de su puesto de los otros diecinueve equipos;
 * - nuestras valoraciones de partido (nota, titularidades, goles, asistencias);
 * - los seguimientos individuales.
 *
 * El modelo vive en `lib/comparativa-u21.ts` y reutiliza el de DATA
 * (`lib/data-analisis/individual.ts`), con sus reglas: percentil siempre,
 * nada de porcentajes de una acción y el portero sólo contra porteros.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Minus, Scale } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useRatingsSeason } from "@/hooks/useRatings";
import { traeJson } from "@/lib/hojaCsv";
import { alineaSeguimiento } from "@/lib/seguimiento";
import { summarizeAll } from "@/lib/ratings/compute";
import { casaNombre } from "@/lib/data-analisis/once";
import { PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  REFERENCIAS,
  comparativa,
  mejoresDe,
  nubeDe,
  type FilaComparativa,
  type Referencia,
} from "@/lib/comparativa-u21";

type Respuesta = { ok: boolean; jugadores?: FilaJugador[]; error?: string };
type RegistroSeguimiento = { ID_JUGADOR: string; NOMBRE?: string; FECHA?: string };

const colorIndice = (i: number | null) => (i === null ? tinta(0.2) : i >= 60 ? MEJOR : i < 45 ? PEOR : ORO);

const ordinal = (n: number) => `${n}º`;

function Barra({ valor, color }: { valor: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, valor))}%`, background: color }} />
    </div>
  );
}

function Foto({ src, nombre, size = 36 }: { src?: string; nombre: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- recortes propios, ya optimizados
    <img src={src} alt={nombre} width={size} height={size} className="shrink-0 rounded-full bg-white/5 object-cover object-top" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/50" style={{ width: size, height: size }}>
      {nombre.slice(0, 1)}
    </span>
  );
}

export default function ComparativoU21() {
  const { players } = usePlayers();
  const { season } = useRatingsSeason();
  const escudoDe = useEscudos();

  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [seguimientos, setSeguimientos] = useState<RegistroSeguimiento[]>([]);
  const [ref, setRef] = useState<Referencia>("u21");
  const [filtroPuesto, setFiltroPuesto] = useState<Puesto | "todos">("todos");
  const [elegido, setElegido] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();
    fetch("/api/data-analisis", { signal: control.signal })
      .then((r) => r.json())
      .then((r: Respuesta) => setDatos(r))
      .catch(() => {
        if (!control.signal.aborted) setDatos({ ok: false, error: "No se han podido leer los datos de Wyscout." });
      });
    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((d) => setSeguimientos(Array.isArray(d) ? (d as RegistroSeguimiento[]) : []))
      .catch(() => setSeguimientos([]));
    return () => control.abort();
  }, []);

  const jugadores = useMemo(() => datos?.jugadores ?? [], [datos]);

  const filas = useMemo(() => (jugadores.length ? comparativa(jugadores, ref) : []), [jugadores, ref]);

  /* De la fila de Wyscout a la ficha de la plantilla (foto, ID para valoraciones y seguimientos). */
  /*
  | Contra la plantilla ENTERA, no sólo las licencias del Castilla: Alexis
  | Ciria juega con nosotros sin licencia nuestra. Y por tres caminos, porque
  | la hoja no siempre escribe el nombre completo («Roberto» es «Roberto
  | Martín» en Wyscout): nombre, apodo y, si la hoja sólo pone el nombre de
  | pila y no hay otro igual, ese nombre.
  */
  const fichaDe = useMemo(() => {
    const limpio = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    return (fila: FilaJugador) =>
      casaNombre(fila.jugador, players, (p) => p.nombre) ??
      casaNombre(fila.jugador, players, (p) => p.apodo ?? "") ??
      (() => {
        /* «S. Martínez»: inicial y apellido juntos, que el apellido solo lo comparten tres. */
        const inicial = limpio(fila.jugador).match(/^(\p{L})\.\s*(.+)$/u);
        if (inicial) {
          const suyos = players.filter((p) => {
            const n = limpio(p.nombre);
            return n.startsWith(inicial[1]) && n.endsWith(inicial[2]);
          });
          if (suyos.length === 1) return suyos[0];
        }
        const pila = limpio(fila.jugador).split(/\s+/)[0];
        const suyos = players.filter((p) => limpio(p.nombre) === pila || limpio(p.apodo ?? "") === pila);
        return suyos.length === 1 ? suyos[0] : null;
      })();
  }, [players]);

  const resumenes = useMemo(() => summarizeAll(season), [season]);

  const cuentaSeguimientos = useMemo(() => {
    const m = new Map<string, { n: number; ultima: string }>();
    for (const s of alineaSeguimiento(seguimientos, players)) {
      const previo = m.get(s.ID_JUGADOR) ?? { n: 0, ultima: "" };
      const fecha = String(s.FECHA ?? "").slice(0, 10);
      m.set(s.ID_JUGADOR, { n: previo.n + 1, ultima: fecha > previo.ultima ? fecha : previo.ultima });
    }
    return m;
  }, [seguimientos, players]);

  const visibles = useMemo(
    () =>
      filas
        .filter((f) => filtroPuesto === "todos" || f.puesto === filtroPuesto)
        .sort((a, b) => (b.indice ?? -1) - (a.indice ?? -1)),
    [filas, filtroPuesto],
  );

  const activo: FilaComparativa | null =
    visibles.find((f) => f.jugador.jugador === elegido) ?? visibles[0] ?? null;

  const refLabel = REFERENCIAS.find((r) => r.key === ref)?.label ?? "";
  const cargando = datos === null;

  const kpis = useMemo(() => {
    const conIndice = filas.filter((f) => f.indice !== null);
    return {
      comparados: conIndice.length,
      top3: filas.filter((f) => f.ranking && f.ranking.posicion <= 3).length,
      media: conIndice.length ? Math.round(conIndice.reduce((s, f) => s + (f.indice ?? 0), 0) / conIndice.length) : null,
      mejoran: filas.filter((f) => f.evolucion?.fiable && f.evolucion.salto > 0).length,
    };
  }, [filas]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · INDIVIDUAL</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Scale className="h-7 w-7 text-[#C8A96B]" />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Comparativo U-21</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/55">
              Cada jugador del Castilla frente a los jóvenes de su puesto que juegan en la categoría: sus percentiles en las
              métricas de Wyscout de su puesto, dónde queda en el ranking, cómo ha cambiado desde el año pasado y lo que
              dicen nuestras valoraciones y seguimientos.
            </p>

            {/* ---------------- controles ---------------- */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {REFERENCIAS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRef(r.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    ref === r.key ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
              {[{ key: "todos" as const, label: "Todos" }, ...PUESTOS.map((p) => ({ key: p.key, label: p.label }))].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFiltroPuesto(p.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    filtroPuesto === p.key ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/50 hover:border-white/25"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {cargando ? (
              <p className="mt-10 flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando los datos de la categoría…
              </p>
            ) : !datos?.ok || filas.length === 0 ? (
              <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {datos?.error ?? "No hay datos de jugadores de Wyscout de esta temporada."}
              </p>
            ) : (
              <>
                {/* ---------------- KPIs ---------------- */}
                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { t: "Jugadores comparados", v: kpis.comparados, h: `contra ${refLabel.toLowerCase()}` },
                    { t: "Top 3 de su puesto", v: kpis.top3, h: "en el ranking de la referencia" },
                    { t: "Índice medio", v: kpis.media ?? "—", h: "50 = en la media del grupo" },
                    { t: "Mejoran respecto a 25/26", v: kpis.mejoran, h: "con muestra suficiente el año pasado" },
                  ].map((k) => (
                    <div key={k.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs text-white/50">{k.t}</p>
                      <p className="mt-1 text-2xl font-semibold">{k.v}</p>
                      <p className="mt-1 text-[11px] text-white/35">{k.h}</p>
                    </div>
                  ))}
                </div>

                {/* ---------------- tabla ---------------- */}
                <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                        <th className="px-4 py-3 font-medium">Jugador</th>
                        <th className="px-2 py-3 font-medium">Edad</th>
                        <th className="px-2 py-3 font-medium">Puesto</th>
                        <th className="px-2 py-3 text-right font-medium">Minutos</th>
                        <th className="px-2 py-3 text-right font-medium">Nota</th>
                        <th className="w-44 px-3 py-3 font-medium">Índice vs {ref === "todos" ? "categoría" : ref.toUpperCase()}</th>
                        <th className="px-2 py-3 font-medium">Ranking</th>
                        <th className="px-2 py-3 font-medium">Evolución</th>
                        <th className="px-2 py-3 text-right font-medium">Seguim.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((f) => {
                        const ficha = fichaDe(f.jugador);
                        const nota = ficha ? resumenes.get(ficha.id) : undefined;
                        const seg = ficha ? cuentaSeguimientos.get(ficha.id) : undefined;
                        const sel = activo?.jugador === f.jugador;
                        return (
                          <tr
                            key={f.jugador.jugador}
                            onClick={() => setElegido(f.jugador.jugador)}
                            className={`cursor-pointer border-t border-white/[0.06] transition ${sel ? "bg-[#C8A96B]/10" : "hover:bg-white/[0.03]"}`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Foto src={ficha?.foto} nombre={f.jugador.jugador} size={30} />
                                <span className="font-medium text-white/90">{ficha?.nombre ?? f.jugador.jugador}</span>
                              </div>
                            </td>
                            <td className="px-2 text-white/70">{f.jugador.edad}</td>
                            <td className="px-2 text-white/60">{PUESTOS.find((p) => p.key === f.puesto)?.corto}</td>
                            <td className="px-2 text-right tabular-nums text-white/70">{f.jugador.minutos}′</td>
                            <td className="px-2 text-right tabular-nums text-white/70">
                              {nota && nota.played ? nota.avg.toFixed(1) : "—"}
                            </td>
                            <td className="px-3">
                              <div className="flex items-center gap-2">
                                <span className="w-7 text-right text-xs font-semibold tabular-nums" style={{ color: colorIndice(f.indice) }}>
                                  {f.indice ?? "—"}
                                </span>
                                <Barra valor={f.indice ?? 0} color={colorIndice(f.indice)} />
                              </div>
                            </td>
                            <td className="px-2 text-xs text-white/70">
                              {f.ranking ? `${ordinal(f.ranking.posicion)} de ${f.ranking.de}` : "—"}
                            </td>
                            <td className="px-2 text-xs">
                              {f.evolucion ? (
                                <span
                                  className={`inline-flex items-center gap-0.5 ${f.evolucion.fiable ? "" : "opacity-45"}`}
                                  style={{ color: f.evolucion.salto > 2 ? MEJOR : f.evolucion.salto < -2 ? PEOR : tinta(0.6) }}
                                  title={f.evolucion.fiable ? "Salto medio de percentil frente a su categoría del año pasado" : "El año pasado jugó menos de 450′: poca muestra"}
                                >
                                  {f.evolucion.salto > 2 ? <ArrowUpRight size={13} /> : f.evolucion.salto < -2 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  {f.evolucion.salto > 0 ? "+" : ""}
                                  {f.evolucion.salto}
                                </span>
                              ) : (
                                <span className="text-white/30">nuevo</span>
                              )}
                            </td>
                            <td className="px-2 text-right tabular-nums text-white/60">{seg?.n ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activo && (
                  <Detalle
                    fila={activo}
                    jugadores={jugadores}
                    refe={ref}
                    refLabel={refLabel}
                    ficha={fichaDe(activo.jugador)}
                    nota={(() => {
                      const f = fichaDe(activo.jugador);
                      return f ? resumenes.get(f.id) : undefined;
                    })()}
                    seg={(() => {
                      const f = fichaDe(activo.jugador);
                      return f ? cuentaSeguimientos.get(f.id) : undefined;
                    })()}
                    escudoDe={escudoDe}
                  />
                )}

                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  Índice = media de sus percentiles en las métricas de su puesto frente a {refLabel.toLowerCase()} con al
                  menos 90′ esta temporada (Wyscout, datos por 90′). Es un resumen para ordenar, no una nota: la ficha dice
                  en qué destaca cada uno. Los porcentajes sacados de muy pocas acciones no cuentan. La evolución compara su
                  percentil de este año con el del año pasado, cada uno contra su categoría; si el año pasado jugó menos de
                  450′ sale atenuada.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  LA FICHA                                                           */
/* ------------------------------------------------------------------ */

function Detalle({
  fila,
  jugadores,
  refe,
  refLabel,
  ficha,
  nota,
  seg,
  escudoDe,
}: {
  fila: FilaComparativa;
  jugadores: FilaJugador[];
  refe: Referencia;
  refLabel: string;
  ficha: ReturnType<typeof casaNombre<{ id: string; nombre: string; foto?: string }>>;
  nota?: ReturnType<ReturnType<typeof summarizeAll>["get"]>;
  seg?: { n: number; ultima: string };
  escudoDe: (equipo: string) => string | null;
}) {
  const j = fila.jugador;
  const orden = [...fila.percentiles].sort((a, b) => b.percentil - a.percentil);
  const cuantas = Math.min(5, Math.floor(orden.length / 2));
  const fuertes = orden.slice(0, cuantas);
  const flojos = cuantas ? orden.slice(-cuantas).reverse() : [];
  const mejores = useMemo(() => mejoresDe(jugadores, fila.puesto, refe, 8), [jugadores, fila.puesto, refe]);
  const nube = useMemo(() => nubeDe(jugadores, fila.puesto), [jugadores, fila.puesto]);
  const puestoLabel = PUESTOS.find((p) => p.key === fila.puesto)?.label.toLowerCase() ?? "";

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[320px_1fr_1fr]">
      {/* ---- quién es ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <Foto src={ficha?.foto} nombre={j.jugador} size={64} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{ficha?.nombre ?? j.jugador}</p>
            <p className="text-xs text-white/50">
              {j.edad} años · {PUESTOS.find((p) => p.key === fila.puesto)?.label} · {j.posicion}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-semibold" style={{ color: colorIndice(fila.indice) }}>
            {fila.indice ?? "—"}
          </span>
          <span className="text-xs text-white/45">
            índice vs {refLabel.toLowerCase()}
            {fila.ranking ? ` · ${ordinal(fila.ranking.posicion)} de ${fila.ranking.de}` : ""}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {[
            ["Minutos Wyscout", `${j.minutos}′ en ${j.partidos} partidos`],
            ["Altura · peso", j.altura ? `${j.altura} cm · ${j.peso || "—"} kg` : "—"],
            ["Pie", j.pie || "—"],
            ["Contrato", j.contrato || "—"],
            ["Nota media", nota && nota.played ? `${nota.avg.toFixed(1)} (${nota.played} partidos)` : "sin valorar"],
            ["Titularidades", nota ? String(nota.starts) : "—"],
            ["Goles · asist.", nota ? `${nota.goals} · ${nota.assists}` : "—"],
            ["Seguimientos", seg ? `${seg.n}${seg.ultima ? ` · último ${seg.ultima.split("-").reverse().join("/")}` : ""}` : "0"],
            [
              "Evolución",
              fila.evolucion ? `${fila.evolucion.salto > 0 ? "+" : ""}${fila.evolucion.salto} pts${fila.evolucion.fiable ? "" : " (poca muestra)"}` : "no jugó aquí el año pasado",
            ],
          ].map(([t, v]) => (
            <div key={t} className="contents">
              <dt className="text-white/40">{t}</dt>
              <dd className="text-right text-white/80">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- fuertes y a mejorar ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold">Frente a {refLabel.toLowerCase().replace(" de la categoría", "")} ({puestoLabel})</p>
        <p className="mt-1 text-[11px] text-white/40">Percentil en cada métrica de su puesto: 100 = el mejor del grupo.</p>
        {fila.percentiles.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">No hay bastantes jugadores de su puesto en la referencia para compararle.</p>
        ) : (
          [
            { t: "Donde destaca", lista: fuertes, color: MEJOR },
            { t: "Donde está por debajo", lista: flojos, color: PEOR },
          ].map((g) => (
            <div key={g.t} className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">{g.t}</p>
              <div className="space-y-2.5">
                {g.lista.map((p) => (
                  <div key={p.metrica.columna} title={p.metrica.comoLeer}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-white/80">{p.metrica.nombre}</span>
                      <span className="shrink-0 tabular-nums text-white/45">
                        {Number(p.valor.toFixed(2))} · <b style={{ color: g.color }}>P{p.percentil}</b>
                      </span>
                    </div>
                    <div className="mt-1">
                      <Barra valor={p.percentil} color={g.color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ---- los mejores de su edad y la nube ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold">Los mejores {refe === "todos" ? "" : refe.toUpperCase() + " "}del puesto en la categoría</p>
        <ol className="mt-3 space-y-1.5">
          {mejores.map((m, i) => {
            const suyo = m.jugador === j;
            const escudo = escudoDe(m.jugador.equipo);
            return (
              <li
                key={`${m.jugador.jugador}-${m.jugador.equipo}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${suyo ? "bg-[#C8A96B]/15" : ""}`}
              >
                <span className="w-5 text-white/35">{i + 1}</span>
                {escudo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                  <img src={escudo} alt="" className="h-4 w-4 object-contain" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                <span className={`min-w-0 flex-1 truncate ${suyo ? "font-semibold text-[#C8A96B]" : "text-white/80"}`}>
                  {m.jugador.jugador}
                </span>
                <span className="text-white/40">{m.jugador.edad}</span>
                <span className="w-7 text-right font-semibold tabular-nums" style={{ color: colorIndice(m.indice) }}>
                  {m.indice}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 text-sm font-semibold">Proyección: edad y nivel</p>
        <p className="mt-1 text-[11px] text-white/40">
          Todos los {puestoLabel} de la categoría con minutos. Arriba a la izquierda, jóvenes que ya rinden.
        </p>
        <Nube puntos={nube} activo={j} />
      </div>
    </div>
  );
}

function Nube({
  puntos,
  activo,
}: {
  puntos: { jugador: FilaJugador; edad: number; indice: number; nuestro: boolean }[];
  activo: FilaJugador;
}) {
  const W = 320;
  const H = 200;
  const edades = puntos.map((p) => p.edad);
  const xMin = Math.min(17, ...edades);
  const xMax = Math.max(34, ...edades);
  const x = (e: number) => 28 + ((e - xMin) / (xMax - xMin)) * (W - 40);
  const y = (i: number) => H - 22 - (i / 100) * (H - 34);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Edad frente a índice de nivel">
      <rect x={x(xMin)} y={y(100)} width={x(21.5) - x(xMin)} height={y(0) - y(100)} fill={ORO} opacity={0.07} />
      <text x={x(xMin) + 3} y={y(100) + 10} fontSize={8} fill={ORO} opacity={0.8}>
        sub-21
      </text>
      <line x1={x(xMin)} x2={W - 8} y1={y(50)} y2={y(50)} stroke={tinta(0.15)} strokeDasharray="3 3" />
      {[18, 21, 24, 27, 30, 33].filter((e) => e >= xMin && e <= xMax).map((e) => (
        <text key={e} x={x(e)} y={H - 6} fontSize={8} textAnchor="middle" fill={tinta(0.4)}>
          {e}
        </text>
      ))}
      {[0, 50, 100].map((v) => (
        <text key={v} x={20} y={y(v) + 3} fontSize={8} textAnchor="end" fill={tinta(0.4)}>
          {v}
        </text>
      ))}
      {puntos
        .filter((p) => !p.nuestro)
        .map((p) => (
          <circle key={`${p.jugador.jugador}-${p.jugador.equipo}`} cx={x(p.edad)} cy={y(p.indice)} r={2.6} fill={tinta(0.28)}>
            <title>{`${p.jugador.jugador} (${p.jugador.equipo}), ${p.edad} años · ${p.indice}`}</title>
          </circle>
        ))}
      {puntos
        .filter((p) => p.nuestro)
        .map((p) => {
          const es = p.jugador === activo;
          return (
            <g key={p.jugador.jugador}>
              <circle cx={x(p.edad)} cy={y(p.indice)} r={es ? 5.5 : 3.6} fill={ORO} stroke={es ? "white" : "none"} strokeWidth={1.2}>
                <title>{`${p.jugador.jugador}, ${p.edad} años · ${p.indice}`}</title>
              </circle>
              {es && (
                <text x={x(p.edad) + 7} y={y(p.indice) + 3} fontSize={9} fill={ORO} fontWeight={600}>
                  {p.jugador.jugador.split(" ").slice(-1)[0]}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}
