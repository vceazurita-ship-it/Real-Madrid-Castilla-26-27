"use client";

/**
 * ESTADÍSTICAS DE LA PLANTILLA (26/11/2026).
 *
 * El analista: «que haya una sección general de estadísticas de nuestra
 * plantilla: minutos, tarjetas, goles, asistencias, etc.». Una tabla con
 * todos, ordenable por cualquier columna, con los líderes arriba:
 * - De Valoraciones (partido a partido, BeSoccer cada noche + la nota del
 *   cuerpo técnico): PJ, titular, suplente, minutos y % de los posibles,
 *   goles, asistencias, G+A, minutos por gol o asistencia, amarillas,
 *   expulsiones y nota media.
 * - De Opta (temporada en liga, opta:castilla): xG, xA, remates (a puerta),
 *   pases y acierto, ocasiones creadas, recuperaciones, duelos ganados; del
 *   portero, paradas y goles encajados.
 * El cálculo vive en lib/plantilla/estadisticas.ts.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { useRatingsSeason } from "@/hooks/useRatings";
import { esDelCastilla } from "@/lib/fichajes";
import { getPlayerImage } from "@/lib/playerImages";
import { posicionDe } from "@/lib/posiciones";
import { dorsalDe } from "@/lib/dorsales";
import { puestoDeLaHoja } from "@/lib/data-analisis/once";
import { PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import { DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";
import { casaOpta, estadisticasDe, optaDe, type EstadisticaJugador, type FiltroCompeticion, type OptaJugador } from "@/lib/plantilla/estadisticas";

type Fila = {
  id: string;
  nombre: string;
  dorsal: string;
  foto: string;
  puesto: Puesto;
  e: EstadisticaJugador | null;
  o: OptaJugador | null;
};

type Col = {
  key: string;
  label: string;
  corto: string;
  grupo: "val" | "opta";
  valor: (f: Fila, posibles: number) => number | null;
  fmt?: (v: number) => string;
  titulo: string;
  /** Más bajo es mejor (para el orden inicial al pinchar). */
  bajo?: boolean;
};

const ent = (v: number) => String(Math.round(v));
const dec1 = (v: number) => v.toFixed(1).replace(".", ",");
const dec2 = (v: number) => v.toFixed(2).replace(".", ",");
const pc = (v: number) => `${Math.round(v)} %`;

const COLS: Col[] = [
  { key: "pj", label: "Partidos", corto: "PJ", grupo: "val", valor: (f) => f.e?.pj ?? 0, fmt: ent, titulo: "Partidos jugados (con minutos)" },
  { key: "tit", label: "Titular", corto: "Tit", grupo: "val", valor: (f) => f.e?.titular ?? 0, fmt: ent, titulo: "Partidos de titular" },
  { key: "sup", label: "Suplente", corto: "Sup", grupo: "val", valor: (f) => f.e?.suplente ?? 0, fmt: ent, titulo: "Partidos entrando desde el banquillo" },
  { key: "min", label: "Minutos", corto: "Min", grupo: "val", valor: (f) => f.e?.minutos ?? 0, fmt: ent, titulo: "Minutos jugados" },
  { key: "pct", label: "% minutos", corto: "%Min", grupo: "val", valor: (f, p) => (p ? ((f.e?.minutos ?? 0) / p) * 100 : null), fmt: pc, titulo: "Minutos sobre los posibles (partidos × 90)" },
  { key: "g", label: "Goles", corto: "G", grupo: "val", valor: (f) => f.e?.goles ?? 0, fmt: ent, titulo: "Goles" },
  { key: "a", label: "Asistencias", corto: "A", grupo: "val", valor: (f) => f.e?.asistencias ?? 0, fmt: ent, titulo: "Asistencias" },
  { key: "ga", label: "G+A", corto: "G+A", grupo: "val", valor: (f) => (f.e?.goles ?? 0) + (f.e?.asistencias ?? 0), fmt: ent, titulo: "Goles más asistencias" },
  { key: "mga", label: "Min por G+A", corto: "Min/G+A", grupo: "val", valor: (f) => { const n = (f.e?.goles ?? 0) + (f.e?.asistencias ?? 0); return n ? (f.e?.minutos ?? 0) / n : null; }, fmt: ent, titulo: "Cada cuántos minutos marca o da un gol", bajo: true },
  { key: "ta", label: "Amarillas", corto: "TA", grupo: "val", valor: (f) => f.e?.amarillas ?? 0, fmt: ent, titulo: "Tarjetas amarillas" },
  { key: "tr", label: "Expulsiones", corto: "TR", grupo: "val", valor: (f) => f.e?.rojas ?? 0, fmt: ent, titulo: "Expulsiones (roja directa o doble amarilla)" },
  { key: "nota", label: "Nota", corto: "Nota", grupo: "val", valor: (f) => f.e?.nota ?? null, fmt: dec1, titulo: "Nota media del cuerpo técnico (Valoraciones)" },
  { key: "xg", label: "xG", corto: "xG", grupo: "opta", valor: (f) => f.o?.xG ?? null, fmt: dec2, titulo: "Goles esperados (Opta, liga)" },
  { key: "xa", label: "xA", corto: "xA", grupo: "opta", valor: (f) => f.o?.xA ?? null, fmt: dec2, titulo: "Asistencias esperadas (Opta, liga)" },
  { key: "rem", label: "Remates", corto: "Rem", grupo: "opta", valor: (f) => f.o?.remates ?? null, fmt: ent, titulo: "Remates (Opta, liga)" },
  { key: "rp", label: "A puerta", corto: "Puerta", grupo: "opta", valor: (f) => f.o?.aPuerta ?? null, fmt: ent, titulo: "Remates a puerta (Opta, liga)" },
  { key: "oc", label: "Ocasiones", corto: "Ocas.", grupo: "opta", valor: (f) => f.o?.ocasiones ?? null, fmt: ent, titulo: "Ocasiones creadas: pases que acaban en remate (Opta, liga)" },
  { key: "pas", label: "Pases", corto: "Pases", grupo: "opta", valor: (f) => f.o?.pases ?? null, fmt: ent, titulo: "Pases intentados (Opta, liga)" },
  { key: "ap", label: "% pase", corto: "%Pase", grupo: "opta", valor: (f) => f.o?.aciertoPase ?? null, fmt: pc, titulo: "Acierto de pase (Opta, liga)" },
  { key: "rec", label: "Recuperaciones", corto: "Recup.", grupo: "opta", valor: (f) => f.o?.recuperaciones ?? null, fmt: ent, titulo: "Recuperaciones (Opta, liga)" },
  { key: "due", label: "% duelos", corto: "%Duel.", grupo: "opta", valor: (f) => f.o?.duelos ?? null, fmt: pc, titulo: "Duelos ganados (Opta, liga)" },
  { key: "par", label: "Paradas", corto: "Parad.", grupo: "opta", valor: (f) => (f.puesto === "POR" ? (f.o?.paradas ?? null) : null), fmt: ent, titulo: "Paradas del portero (Opta, liga)" },
  { key: "enc", label: "Encajados", corto: "GC", grupo: "opta", valor: (f) => (f.puesto === "POR" ? (f.o?.encajados ?? null) : null), fmt: ent, titulo: "Goles encajados con él en el campo (Opta, liga)", bajo: true },
];

const LIDERES: { key: string; titulo: string; sufijo: string }[] = [
  { key: "g", titulo: "Goles", sufijo: "" },
  { key: "a", titulo: "Asistencias", sufijo: "" },
  { key: "min", titulo: "Minutos", sufijo: "'" },
  { key: "ta", titulo: "Amarillas", sufijo: "" },
];

export default function EstadisticasPlantilla() {
  const { players } = usePlayers();
  const { season, loading } = useRatingsSeason();
  const [opta, setOpta] = useState<Record<string, unknown>[]>([]);
  const [ahora] = useState(() => Date.now());
  const hoy = useMemo(() => new Date(ahora).toISOString().slice(0, 10), [ahora]);
  const [filtro, setFiltro] = useState<FiltroCompeticion>("todas");
  const [puesto, setPuesto] = useState<Puesto | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [soloJugado, setSoloJugado] = useState(true);
  const [orden, setOrden] = useState<{ key: string; desc: boolean }>({ key: "min", desc: true });

  useEffect(() => {
    let vivo = true;
    void traeOpta<TablaOpta>(DOCS_OPTA.castilla).then((t) => {
      if (vivo) setOpta(aObjetos(t));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const stats = useMemo(() => estadisticasDe(season, hoy, filtro), [season, hoy, filtro]);
  const posibles = stats.partidos * 90;

  const filas = useMemo<Fila[]>(() => {
    const lista: Fila[] = [];
    for (const p of players) {
      if (!esDelCastilla(p.nombre, p.licencia) && !stats.jugadores.has(p.id)) continue;
      const e = stats.jugadores.get(p.id) ?? null;
      const posicion = posicionDe(p.nombre, p.posicion);
      lista.push({
        id: p.id,
        nombre: p.nombre,
        dorsal: p.dorsal != null ? String(p.dorsal) : String(dorsalDe(p.nombre) ?? ""),
        foto: getPlayerImage(p.nombre, "cerca", p.id) || p.foto || "",
        puesto: puestoDeLaHoja(posicion),
        e,
        o: optaDe(casaOpta(p.nombre, "", opta)),
      });
    }
    return lista;
  }, [players, stats, opta]);

  const vistas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const col = COLS.find((c) => c.key === orden.key);
    return filas
      .filter((f) => (puesto === "todos" || f.puesto === puesto) && (!soloJugado || (f.e?.pj ?? 0) > 0) && (!q || f.nombre.toLowerCase().includes(q) || f.dorsal === q))
      .sort((x, y) => {
        if (!col) return 0;
        const a = col.valor(x, posibles);
        const b = col.valor(y, posibles);
        if (a == null && b == null) return x.nombre.localeCompare(y.nombre);
        if (a == null) return 1;
        if (b == null) return -1;
        return orden.desc ? b - a : a - b;
      });
  }, [filas, puesto, soloJugado, busca, orden, posibles]);

  const totales = useMemo(() => {
    const suma = (k: keyof EstadisticaJugador) => vistas.reduce((s, f) => s + (Number(f.e?.[k]) || 0), 0);
    return { g: suma("goles"), a: suma("asistencias"), ta: suma("amarillas"), tr: suma("rojas"), min: suma("minutos") };
  }, [vistas]);

  const lideres = (key: string) => {
    const col = COLS.find((c) => c.key === key)!;
    return filas
      .map((f) => ({ f, v: col.valor(f, posibles) ?? 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
  };

  const pincha = (key: string) => {
    const col = COLS.find((c) => c.key === key);
    setOrden((o) => (o.key === key ? { key, desc: !o.desc } : { key, desc: !col?.bajo }));
  };

  const hayOpta = opta.length > 0;

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />
      <main className="min-w-0 flex-1 max-sm:pb-20">
        <Topbar />
        <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · PLANTILLA</p>
            <div className="mt-4 flex min-w-0 items-center gap-4">
              <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">Estadísticas de la plantilla</h1>
              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-white/60">
              {loading ? "Cargando…" : `${stats.partidos} partidos jugados · minutos, goles, asistencias, tarjetas y nota de Valoraciones (BeSoccer cada noche)`}
              {hayOpta ? " · el resto, de Opta (temporada en liga)" : ""}
            </p>
          </div>

          {/* Líderes. */}
          <section className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Líderes de la plantilla">
            {LIDERES.map((l) => {
              const top = lideres(l.key);
              return (
                <div key={l.key} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">{l.titulo}</p>
                  {top.length ? (
                    <ol className="mt-2 space-y-1.5">
                      {top.map(({ f, v }, i) => (
                        <li key={f.id} className="flex min-w-0 items-center gap-2">
                          {f.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.foto} alt="" className={`shrink-0 rounded-full object-cover ${i === 0 ? "h-9 w-9" : "h-7 w-7"}`} />
                          ) : (
                            <span className={`shrink-0 rounded-full bg-white/10 ${i === 0 ? "h-9 w-9" : "h-7 w-7"}`} />
                          )}
                          <span className={`min-w-0 flex-1 truncate ${i === 0 ? "text-sm font-semibold text-white" : "text-[12.5px] text-white/75"}`}>{f.nombre}</span>
                          <span className={`shrink-0 tabular-nums ${i === 0 ? "text-lg font-bold text-white" : "text-sm text-white/70"}`}>
                            {Math.round(v)}
                            {l.sufijo}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-[12px] text-white/45">Nadie todavía.</p>
                  )}
                </div>
              );
            })}
          </section>

          {/* Filtros. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {stats.competiciones.length > 1 && (
              <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Competición">
                {(["todas", "liga"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k} className={`min-h-9 rounded-lg px-3 text-xs ${filtro === k ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "text-white/60 hover:text-white"}`}>
                    {k === "todas" ? "Todas" : "Sólo liga"}
                  </button>
                ))}
              </div>
            )}
            <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Puesto">
              {[{ key: "todos" as const, corto: "Todos" }, ...PUESTOS].map((p) => (
                <button key={p.key} type="button" onClick={() => setPuesto(p.key)} aria-pressed={puesto === p.key} title={"label" in p ? p.label : "Todos los puestos"} className={`min-h-9 rounded-lg px-3 text-xs ${puesto === p.key ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "text-white/60 hover:text-white"}`}>
                  {p.corto}
                </button>
              ))}
            </div>
            <label className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 sm:max-w-xs">
              <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jugador o dorsal" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-white/35" />
            </label>
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
              <input type="checkbox" checked={soloJugado} onChange={(e) => setSoloJugado(e.target.checked)} className="h-4 w-4 accent-[#C8A96B]" />
              Sólo los que han jugado
            </label>
          </div>

          {/* La tabla. */}
          <div className="min-w-0 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[60rem] border-collapse text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-white/45">
                  <th className="sticky left-0 z-20 bg-[#0B0F14]" />
                  <th colSpan={COLS.filter((c) => c.grupo === "val").length} className="border-b border-white/10 py-1.5 text-center font-semibold text-[#C8A96B]">
                    Valoraciones · todos los partidos{filtro === "liga" ? " de liga" : ""}
                  </th>
                  {hayOpta && (
                    <th colSpan={COLS.filter((c) => c.grupo === "opta").length} className="border-b border-l border-white/10 py-1.5 text-center font-semibold text-[#6FC3E8]">
                      Opta · temporada en liga
                    </th>
                  )}
                </tr>
                <tr className="text-[11px] text-white/55">
                  <th className="sticky left-0 z-20 min-w-[11rem] bg-[#0B0F14] px-3 py-2 text-left font-medium">Jugador</th>
                  {COLS.filter((c) => hayOpta || c.grupo === "val").map((c, i, arr) => (
                    <th key={c.key} className={`px-2 py-2 text-right font-medium ${c.grupo === "opta" && arr[i - 1]?.grupo === "val" ? "border-l border-white/10" : ""}`} title={c.titulo}>
                      <button type="button" onClick={() => pincha(c.key)} className={`inline-flex min-h-8 items-center gap-0.5 whitespace-nowrap hover:text-white ${orden.key === c.key ? "text-white" : ""}`}>
                        {c.corto}
                        {orden.key === c.key ? orden.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vistas.map((f) => (
                  <tr key={f.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                    <td className="sticky left-0 z-10 bg-[#0B0F14] px-3 py-1.5">
                      <Link href={`/individual?nombre=${encodeURIComponent(f.nombre)}`} className="flex min-w-0 items-center gap-2" title="Su ficha individual">
                        {f.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.foto} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="h-7 w-7 shrink-0 rounded-full bg-white/10" />
                        )}
                        <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-white/40">{f.dorsal}</span>
                        <span className="min-w-0 truncate font-semibold text-white">{f.nombre}</span>
                        <span className="shrink-0 text-[10px] text-white/40">{f.puesto}</span>
                      </Link>
                    </td>
                    {COLS.filter((c) => hayOpta || c.grupo === "val").map((c, i, arr) => {
                      const v = c.valor(f, posibles);
                      const fuerte = orden.key === c.key;
                      const roja = c.key === "tr" && (v ?? 0) > 0;
                      return (
                        <td key={c.key} className={`px-2 py-1.5 text-right tabular-nums ${c.grupo === "opta" && arr[i - 1]?.grupo === "val" ? "border-l border-white/10" : ""} ${fuerte ? "font-semibold text-white" : "text-white/75"} ${roja ? "text-[#E8735F]" : ""}`}>
                          {v == null ? <span className="text-white/25">·</span> : c.fmt ? c.fmt(v) : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {vistas.length > 0 && (
                  <tr className="border-t border-white/15 text-[12px] text-white/60">
                    <td className="sticky left-0 z-10 bg-[#0B0F14] px-3 py-2 font-semibold">Total ({vistas.length})</td>
                    {COLS.filter((c) => hayOpta || c.grupo === "val").map((c) => (
                      <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                        {c.key === "g" ? totales.g : c.key === "a" ? totales.a : c.key === "ga" ? totales.g + totales.a : c.key === "ta" ? totales.ta : c.key === "tr" ? totales.tr : c.key === "min" ? totales.min : ""}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            {!loading && vistas.length === 0 && <p className="p-4 text-sm text-white/55">Nadie con ese filtro.</p>}
          </div>

          <p className="text-[11.5px] leading-relaxed text-white/45">
            Pincha en una columna para ordenar; en el móvil, la tabla se desliza de lado con el nombre fijo. Valoraciones cuenta todos los partidos oficiales jugados (BeSoccer rellena minutos, titular, goles, asistencias y tarjetas cada noche; la nota la pone el cuerpo técnico). Opta, sólo la liga y de la temporada entera, cruzado por nombre: un punto (·) es que Opta no lo tiene o no casa. % minutos sobre {stats.partidos} partidos × 90.
          </p>
        </div>
      </main>
    </div>
  );
}
