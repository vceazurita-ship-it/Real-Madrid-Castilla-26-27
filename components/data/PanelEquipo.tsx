"use client";

/**
 * UN EQUIPO, DE UN VISTAZO (06/10/2026).
 *
 * Cualquier equipo de la categoría resumido en una pantalla, de arriba abajo:
 * quién es (resultados, forma, sistema), la síntesis en frases, cómo juega
 * (fases, estilo, en qué destaca y en qué sufre, contra su competición) y
 * quién lo hace (once tipo por minutos y la plantilla con lo que destaca cada
 * uno contra los de su puesto). Abre con el próximo rival.
 *
 * El modelo vive en `lib/data-analisis/equipo.ts`; aquí sólo se pinta.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { GRUPOS, formatea } from "@/lib/data-analisis/metricas";
import { PUESTOS } from "@/lib/data-analisis/individual";
import {
  onceTipoDe,
  perfilDe,
  plantillaDe,
  resumenDe,
  sintesisDe,
  type JugadorEquipo,
  type MetricaEquipo,
} from "@/lib/data-analisis/equipo";
import { mismoClub } from "@/lib/rivals/mismoClub";

const NOSOTROS = "Real Madrid Castilla";

const colorP = (p: number | null) => (p === null ? tinta(0.3) : p >= 60 ? MEJOR : p <= 40 ? PEOR : ORO);
const ordinal = (n: number) => `${n}º`;
const apellido = (n: string) => {
  const t = n.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : n;
};

const COLOR_RES = { G: MEJOR, E: "#C8A96B", P: PEOR } as const;

/** Sitio de cada hueco en un campo vertical (atacando hacia arriba), en %. */
const SITIO: Record<string, { x: number; y: number }> = {
  por: { x: 50, y: 90 },
  "lat-d": { x: 86, y: 68 },
  "cen-d": { x: 63, y: 75 },
  "cen-i": { x: 37, y: 75 },
  "lat-i": { x: 14, y: 68 },
  "piv-d": { x: 63, y: 53 },
  "piv-i": { x: 37, y: 53 },
  "ban-d": { x: 84, y: 31 },
  media: { x: 50, y: 35 },
  "ban-i": { x: 16, y: 31 },
  del: { x: 50, y: 12 },
};

function Barra({ valor, color }: { valor: number | null; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, valor ?? 0))}%`, background: color }} />
    </div>
  );
}

function Tarjeta({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{titulo}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

export function PanelEquipo({ liga, jugadores }: { liga: FilaPartido[]; jugadores: FilaJugador[] }) {
  const escudoDe = useEscudos();
  const [elegido, setElegido] = useState("");
  const [proximo, setProximo] = useState("");
  const [todas, setTodas] = useState(false);

  /* El próximo rival, del calendario de BeSoccer: con él se abre. */
  useEffect(() => {
    let vivo = true;
    fetch(`/api/docs?key=${encodeURIComponent("castilla:calendario")}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: { partidos?: { cuando: string; local: string; visitante: string }[] } }) => {
        const hoy = new Date().toISOString().slice(0, 10);
        const sig = (j?.data?.partidos ?? [])
          .filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy)
          .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];
        if (vivo && sig) setProximo(/castilla/i.test(sig.local) ? sig.visitante : sig.local);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  /* Los equipos, por competición (la del Castilla primero). */
  const porCompeticion = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const f of liga) {
      if (!m.has(f.competicion)) m.set(f.competicion, new Set());
      m.get(f.competicion)!.add(f.equipo);
    }
    const nuestra = liga.find((f) => f.equipo === NOSOTROS)?.competicion ?? "";
    return [...m.entries()]
      .map(([c, s]) => ({ competicion: c, equipos: [...s].sort((a, b) => a.localeCompare(b, "es")) }))
      .sort((a, b) => Number(b.competicion === nuestra) - Number(a.competicion === nuestra) || a.competicion.localeCompare(b.competicion));
  }, [liga]);

  const todos = useMemo(() => [...new Set(porCompeticion.flatMap((c) => c.equipos))], [porCompeticion]);
  const delProximo = proximo ? todos.find((e) => mismoClub(e, proximo)) ?? "" : "";
  const equipo = (elegido && todos.includes(elegido) ? elegido : "") || delProximo || (todos.includes(NOSOTROS) ? NOSOTROS : todos[0] ?? "");

  const resumen = useMemo(() => resumenDe(equipo, liga, liga), [equipo, liga]);
  const perfil = useMemo(() => perfilDe(equipo, liga), [equipo, liga]);
  const plantilla = useMemo(() => plantillaDe(equipo, jugadores), [equipo, jugadores]);
  const once = useMemo(() => onceTipoDe(plantilla), [plantilla]);
  const frases = useMemo(() => sintesisDe(equipo, resumen, perfil, plantilla), [equipo, resumen, perfil, plantilla]);

  const escudo = escudoDe(equipo);
  const lideres = useMemo(() => {
    const max = (f: (j: JugadorEquipo) => number) => [...plantilla].sort((a, b) => f(b) - f(a))[0];
    const conMinutos = plantilla.filter((j) => j.fila.minutos >= 270);
    return [
      { t: "Goles", j: max((j) => j.goles), v: (j: JugadorEquipo) => String(j.goles) },
      { t: "Asistencias", j: max((j) => j.asistencias), v: (j: JugadorEquipo) => String(j.asistencias) },
      { t: "Minutos", j: max((j) => j.fila.minutos), v: (j: JugadorEquipo) => `${j.fila.minutos}′` },
      {
        t: "Mejor índice",
        j: [...conMinutos].sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0))[0],
        v: (j: JugadorEquipo) => String(j.indice ?? "—"),
      },
    ].filter((x) => x.j);
  }, [plantilla]);

  if (!equipo) return <p className="mt-6 text-sm text-white/50">No hay partidos de Wyscout con estos filtros.</p>;

  const filaMetrica = (x: MetricaEquipo) => (
    <div key={x.metrica.key} title={x.metrica.comoLeer}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-white/80">{x.metrica.nombre}</span>
        <span className="shrink-0 tabular-nums text-white/45">
          {formatea(x.valor, x.metrica.unidad)} · {ordinal(x.puesto)}/{x.de}
        </span>
      </div>
      <div className="mt-1">
        <Barra valor={x.percentil} color={colorP(x.percentil)} />
      </div>
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* ---------------- quién es ---------------- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          {escudo ? (
            // eslint-disable-next-line @next/next/no-img-element -- escudo por el proxy propio
            <img src={escudo} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <span className="h-14 w-14 rounded-full bg-white/10" />
          )}
          <div className="min-w-0 flex-1">
            <select
              value={equipo}
              onChange={(e) => setElegido(e.target.value)}
              className="max-w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-lg font-semibold text-white"
              aria-label="Equipo"
            >
              {porCompeticion.map((c) => (
                <optgroup key={c.competicion} label={c.competicion} className="bg-[#11161C]">
                  {c.equipos.map((e) => (
                    <option key={e} value={e} className="bg-[#11161C]">
                      {e}
                      {e === delProximo ? " · próximo rival" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-white/45">
              {perfil?.competicion ?? ""}
              {resumen.tabla ? ` · ${ordinal(resumen.tabla.puesto)} de ${resumen.tabla.de} por puntos por partido` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {delProximo && equipo !== delProximo && (
                <button type="button" onClick={() => setElegido(delProximo)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:text-white">
                  Próximo rival: {delProximo}
                </button>
              )}
              {equipo !== NOSOTROS && todos.includes(NOSOTROS) && (
                <button type="button" onClick={() => setElegido(NOSOTROS)} className="rounded-full border border-[#C8A96B]/40 px-2.5 py-1 text-[11px] text-[#C8A96B]">
                  Ver el Castilla
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {[
              { t: "PJ", v: resumen.partidos },
              { t: "G-E-P", v: `${resumen.g}-${resumen.e}-${resumen.p}` },
              { t: "Goles", v: `${resumen.gf}-${resumen.gc}` },
              { t: "Pts/partido", v: resumen.partidos ? (resumen.puntos / resumen.partidos).toFixed(2).replace(".", ",") : "—" },
            ].map((k) => (
              <div key={k.t} className="text-center">
                <p className="text-xl font-semibold tabular-nums">{k.v}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{k.t}</p>
              </div>
            ))}
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Últimos 5</p>
              <div className="flex gap-1">
                {resumen.forma.map((f) => (
                  <span
                    key={f.fecha + f.rival}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-[#0B0F14]"
                    style={{ background: COLOR_RES[f.resultado] }}
                    title={`${f.fecha.split("-").reverse().join("/")} · ${f.casa ? "vs" : "en"} ${f.rival} ${f.marcador}`}
                  >
                    {f.resultado}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Sistemas</p>
              <div className="flex flex-wrap gap-1">
                {resumen.sistemas.slice(0, 3).map((s, i) => (
                  <span key={s.sistema} className={`rounded-md px-2 py-1 text-xs ${i === 0 ? "bg-white/10 text-white" : "text-white/50"}`}>
                    {s.sistema} <span className="text-white/40">×{s.partidos}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- la síntesis y las fases ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="En pocas palabras">
          <ul className="space-y-2 text-sm leading-relaxed text-white/80">
            {frases.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo={`Por fases · contra ${perfil?.equipos ?? "—"} equipos`}>
          {perfil ? (
            <div className="space-y-3">
              {perfil.fases.map((f) => (
                <div key={f.fase}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-white/80">{f.label}</span>
                    <b className="tabular-nums" style={{ color: colorP(f.percentil) }}>
                      {f.percentil === null ? "—" : `P${f.percentil}`}
                    </b>
                  </div>
                  <div className="mt-1">
                    <Barra valor={f.percentil} color={colorP(f.percentil)} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-white/35">Media de sus percentiles en cada fase (P50 = la media de su competición).</p>
            </div>
          ) : (
            <p className="text-sm text-white/45">No hay bastantes equipos de su competición para compararle.</p>
          )}
        </Tarjeta>
      </div>

      {/* ---------------- cómo juega ---------------- */}
      {perfil && (
        <div className="grid gap-4 md:grid-cols-3">
          <Tarjeta titulo="Donde destaca">
            <div className="space-y-2.5">{perfil.fuertes.length ? perfil.fuertes.map(filaMetrica) : <p className="text-sm text-white/45">Nada por encima del P60.</p>}</div>
          </Tarjeta>
          <Tarjeta titulo="Donde sufre">
            <div className="space-y-2.5">{perfil.flojos.length ? perfil.flojos.map(filaMetrica) : <p className="text-sm text-white/45">Nada por debajo del P40.</p>}</div>
          </Tarjeta>
          <Tarjeta titulo="Su estilo">
            <div className="space-y-1.5">
              {perfil.estilo.map((x) => (
                <div key={x.metrica.key} className="flex items-baseline justify-between gap-2 text-xs" title={x.metrica.comoLeer}>
                  <span className="truncate text-white/75">{x.metrica.nombre}</span>
                  <span className="shrink-0 tabular-nums">
                    <b className="text-white/90">{formatea(x.valor, x.metrica.unidad)}</b>
                    <span className="text-white/40">
                      {" "}
                      · mediana {formatea(x.mediana, x.metrica.unidad)} · {ordinal(x.puestoDeMas)}
                    </span>
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-white/35">Cómo juega, no si lo hace bien: 1º = el que más (en PPDA, el que menos presiona; el que más aprieta es el último).</p>
            </div>
          </Tarjeta>
        </div>
      )}

      {/* ---------------- quién lo hace ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Tarjeta titulo="Once tipo por minutos">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[340px] overflow-hidden rounded-xl bg-[#12301f]">
            <div className="absolute inset-2 rounded-lg border border-white/15" />
            <div className="absolute left-2 right-2 top-1/2 border-t border-white/15" />
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
            {Object.entries(SITIO).map(([h, p]) => {
              const j = once[h];
              return (
                <div key={h} className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-[#0B0F14]"
                    style={{ background: j ? colorP(j.indice) : tinta(0.3) }}
                    title={j ? `${j.fila.jugador} · ${j.fila.posicion} · ${j.fila.minutos}′ · índice ${j.indice ?? "—"}` : "Sin jugador"}
                  >
                    {j?.indice ?? "–"}
                  </span>
                  <span className="mt-0.5 max-w-full truncate text-[10px] font-medium text-white/90">{j ? apellido(j.fila.jugador) : "—"}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/35">
            Los de más minutos en 4-2-3-1. El número es su índice contra los de su puesto en la categoría.
          </p>
        </Tarjeta>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lideres.map((l) => (
              <div key={l.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{l.t}</p>
                <p className="mt-1 truncate text-sm font-medium text-white/90">{l.j.fila.jugador}</p>
                <p className="text-lg font-semibold tabular-nums text-[#C8A96B]">{l.v(l.j)}</p>
              </div>
            ))}
          </div>

          <Tarjeta titulo={`La plantilla · ${plantilla.length} con minutos`}>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="sticky top-0 bg-[#10151b]">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/40">
                    <th className="py-2 pr-2 font-medium">Jugador</th>
                    <th className="px-1 font-medium">Pos.</th>
                    <th className="px-1 text-right font-medium">Edad</th>
                    <th className="px-1 text-right font-medium">Min.</th>
                    <th className="px-1 text-right font-medium">G</th>
                    <th className="px-1 text-right font-medium">A</th>
                    <th className="w-28 px-2 font-medium">Índice</th>
                    <th className="px-1 font-medium">Destaca / flojea (percentil en su puesto)</th>
                  </tr>
                </thead>
                <tbody>
                  {plantilla.map((j) => (
                    <tr key={j.fila.jugador} className="border-t border-white/[0.05] align-top">
                      <td className="py-1.5 pr-2 font-medium text-white/85">{j.fila.jugador}</td>
                      <td className="px-1 text-white/55" title={j.fila.posicion}>
                        {PUESTOS.find((p) => p.key === j.puesto)?.corto} <span className="text-white/30">{j.fila.posicion.split(",")[0]}</span>
                      </td>
                      <td className="px-1 text-right tabular-nums text-white/60">{j.fila.edad || "—"}</td>
                      <td className="px-1 text-right tabular-nums text-white/60">{j.fila.minutos}′</td>
                      <td className="px-1 text-right tabular-nums text-white/75">{j.goles || ""}</td>
                      <td className="px-1 text-right tabular-nums text-white/75">{j.asistencias || ""}</td>
                      <td className="px-2 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 text-right font-semibold tabular-nums" style={{ color: colorP(j.indice) }}>
                            {j.indice ?? "—"}
                          </span>
                          <Barra valor={j.indice} color={colorP(j.indice)} />
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex flex-wrap gap-1">
                          {j.destaca.map((p) => (
                            <span key={p.metrica.columna} className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${MEJOR}22`, color: MEJOR }}>
                              {p.metrica.nombre} P{p.percentil}
                            </span>
                          ))}
                          {j.flojea.map((p) => (
                            <span key={p.metrica.columna} className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${PEOR}22`, color: PEOR }}>
                              {p.metrica.nombre} P{p.percentil}
                            </span>
                          ))}
                          {j.fila.minutos < 90 && <span className="text-[10px] text-white/30">menos de 90′: sin percentil</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </div>
      </div>

      {/* ---------------- todo el detalle ---------------- */}
      {perfil && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <button type="button" onClick={() => setTodas((t) => !t)} className="flex w-full items-center justify-between px-4 py-3 text-sm text-white/75">
            <span>Todas sus métricas de equipo ({perfil.metricas.length}), por grupos</span>
            {todas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {todas && (
            <div className="grid gap-x-6 gap-y-5 border-t border-white/[0.06] p-4 md:grid-cols-2 xl:grid-cols-3">
              {GRUPOS.map((g) => {
                const del = perfil.metricas.filter((x) => x.metrica.grupo === g);
                if (!del.length) return null;
                return (
                  <div key={g}>
                    <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">{g}</p>
                    <div className="space-y-2">{del.map(filaMetrica)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-white/35">
        Equipo: media por partido de sus informes de Wyscout con los filtros de arriba, en percentil contra los equipos de su
        competición (P100 = el mejor; en las de estilo, el puesto va de más a menos). Jugadores: descarga de jugadores de Wyscout
        de esta temporada, cada uno contra los de su puesto en toda la categoría con al menos 90′; los porcentajes de muy pocas
        acciones no cuentan.
      </p>
    </div>
  );
}
