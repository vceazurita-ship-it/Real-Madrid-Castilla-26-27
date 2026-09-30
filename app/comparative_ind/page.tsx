"use client";

/**
 * Comparativa con la categoría (antes «Comparativo U-21», un Power BI).
 *
 * Cada jugador del Castilla frente a los de su puesto en la categoría —los
 * sub-21, los sub-23 o todos—, con lo que recopilamos de él:
 * - la descarga de jugadores de Wyscout de TODA la categoría (edad, puesto,
 *   minutos y 86 métricas por noventa);
 * - nuestras valoraciones de partido (nota, titularidades, goles, asistencias);
 * - los seguimientos individuales.
 *
 * Tres pestañas con los mismos filtros arriba: el ranking de la plantilla, los
 * gráficos por fase del juego (una batería de preguntas como la de DATA, o dos
 * métricas a elección) y la ficha de cada uno. Pinchar en un jugador —en la
 * tabla o en un gráfico— abre su ficha.
 *
 * El modelo vive en `lib/comparativa-u21.ts` y reutiliza el de DATA
 * (`lib/data-analisis/individual.ts`), con sus reglas: percentil siempre, nada
 * de porcentajes de una acción y el portero sólo contra porteros.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  Loader2,
  Minus,
  ScatterChart,
  UserRound,
  Users,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useRatingsSeason } from "@/hooks/useRatings";
import { traeJson } from "@/lib/hojaCsv";
import { alineaSeguimiento } from "@/lib/seguimiento";
import { summarizeAll } from "@/lib/ratings/compute";
import { casaNombre } from "@/lib/data-analisis/once";
import {
  METRICAS_JUGADOR,
  METRICA_JUGADOR_POR_COLUMNA,
  PUESTOS,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  FASES,
  PREGUNTAS,
  REFERENCIAS,
  comparativa,
  mediana,
  mejoresDe,
  nubeDe,
  puntosDe,
  type FilaComparativa,
  type PuntoJugador,
  type Referencia,
} from "@/lib/comparativa-u21";

type Respuesta = { ok: boolean; jugadores?: FilaJugador[]; error?: string };
type RegistroSeguimiento = { ID_JUGADOR: string; NOMBRE?: string; FECHA?: string };
type Pestana = "ranking" | "graficos" | "ficha";
type Orden = "nombre" | "edad" | "minutos" | "nota" | "indice" | "ranking" | "evolucion" | "seguimientos";

const colorIndice = (i: number | null) => (i === null ? tinta(0.2) : i >= 60 ? MEJOR : i < 45 ? PEOR : ORO);

const ordinal = (n: number) => `${n}º`;

const apellido = (nombre: string) => nombre.split(" ").slice(-1)[0];

const formatea = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ""));

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

function Chip({ activo, onClick, children, fuerte }: { activo: boolean; onClick: () => void; children: React.ReactNode; fuerte?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        activo
          ? fuerte
            ? "border-[#C8A96B] bg-[#C8A96B]/15 font-medium text-[#C8A96B]"
            : "border-white/40 bg-white/10 text-white"
          : "border-white/10 text-white/55 hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

export default function ComparativaCategoria() {
  const { players } = usePlayers();
  const { season } = useRatingsSeason();
  const escudoDe = useEscudos();

  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [seguimientos, setSeguimientos] = useState<RegistroSeguimiento[]>([]);
  const [ref, setRef] = useState<Referencia>("u21");
  const [filtroPuesto, setFiltroPuesto] = useState<Puesto | "todos">("todos");
  const [pestana, setPestana] = useState<Pestana>("ranking");
  const [elegido, setElegido] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ por: Orden; desc: boolean }>({ por: "indice", desc: true });

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

  /*
  | De la fila de Wyscout a la ficha de la plantilla (foto, ID para
  | valoraciones y seguimientos). Contra la plantilla ENTERA —Alexis juega con
  | nosotros sin licencia nuestra— y por cuatro caminos, porque la hoja no
  | siempre escribe el nombre completo: nombre, apodo, inicial y apellido
  | («S. Martínez») y nombre de pila cuando no hay otro igual («Roberto»).
  */
  const fichaDe = useMemo(() => {
    const limpio = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    return (fila: FilaJugador) =>
      casaNombre(fila.jugador, players, (p) => p.nombre) ??
      casaNombre(fila.jugador, players, (p) => p.apodo ?? "") ??
      (() => {
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

  /* Todo lo nuestro de cada fila, resuelto una vez: la tabla ordena por ello. */
  const conFicha = useMemo(
    () =>
      filas.map((f) => {
        const ficha = fichaDe(f.jugador);
        const nota = ficha ? resumenes.get(ficha.id) : undefined;
        const seg = ficha ? cuentaSeguimientos.get(ficha.id) : undefined;
        return { f, ficha, nota, seg };
      }),
    [filas, fichaDe, resumenes, cuentaSeguimientos],
  );

  const visibles = useMemo(() => {
    const valor = (x: (typeof conFicha)[number]): number | string => {
      switch (orden.por) {
        case "nombre": return x.ficha?.nombre ?? x.f.jugador.jugador;
        case "edad": return x.f.jugador.edad;
        case "minutos": return x.f.jugador.minutos;
        case "nota": return x.nota?.played ? x.nota.avg : -1;
        case "indice": return x.f.indice ?? -1;
        case "ranking": return x.f.ranking ? -x.f.ranking.posicion / x.f.ranking.de : -99;
        case "evolucion": return x.f.evolucion?.salto ?? -99;
        case "seguimientos": return x.seg?.n ?? 0;
      }
    };
    return conFicha
      .filter((x) => filtroPuesto === "todos" || x.f.puesto === filtroPuesto)
      .sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        const c = typeof va === "string" ? va.localeCompare(String(vb), "es") : va - (vb as number);
        return orden.desc ? -c : c;
      });
  }, [conFicha, filtroPuesto, orden]);

  const activo =
    conFicha.find((x) => x.f.jugador.jugador === elegido) ??
    visibles[0] ??
    conFicha[0] ??
    null;

  const abreFicha = (nombre: string) => {
    setElegido(nombre);
    setPestana("ficha");
  };

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

  const PESTANAS: { key: Pestana; label: string; icono: React.ReactNode }[] = [
    { key: "ranking", label: "Ranking de la plantilla", icono: <Users size={15} /> },
    { key: "graficos", label: "Gráficos por fase", icono: <ScatterChart size={15} /> },
    { key: "ficha", label: "Ficha del jugador", icono: <UserRound size={15} /> },
  ];

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · INDIVIDUAL</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <BarChart3 className="h-7 w-7 text-[#C8A96B]" />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Comparativa con la categoría</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/55">
              Cada jugador del Castilla frente a los de su puesto en la categoría —los sub-21, los sub-23 o todos—: dónde
              queda, en qué destaca por fase del juego y cómo ha cambiado desde el año pasado, junto a nuestras valoraciones
              y seguimientos.
            </p>

            {/* ---------------- filtros y pestañas, siempre a la vista ---------------- */}
            <div className="sticky top-0 z-20 -mx-4 mt-6 border-b border-white/[0.06] bg-[#0B0F14]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Contra</span>
                {REFERENCIAS.map((r) => (
                  <Chip key={r.key} activo={ref === r.key} onClick={() => setRef(r.key)} fuerte>
                    {r.label}
                  </Chip>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
                <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Puesto</span>
                {[{ key: "todos" as const, label: "Todos" }, ...PUESTOS.map((p) => ({ key: p.key, label: p.label }))].map((p) => (
                  <Chip key={p.key} activo={filtroPuesto === p.key} onClick={() => setFiltroPuesto(p.key)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
                {PESTANAS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    role="tab"
                    aria-selected={pestana === p.key}
                    onClick={() => setPestana(p.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${
                      pestana === p.key ? "bg-white/10 font-medium text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    {p.icono}
                    {p.label}
                  </button>
                ))}
              </div>
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
                {pestana === "ranking" && (
                  <>
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

                    <p className="mt-5 text-xs text-white/40">Pincha en una columna para ordenar y en un jugador para abrir su ficha.</p>
                    <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                            {(
                              [
                                ["nombre", "Jugador", "px-4"],
                                ["edad", "Edad", "px-2"],
                                [null, "Puesto", "px-2"],
                                ["minutos", "Minutos", "px-2 text-right"],
                                ["nota", "Nota", "px-2 text-right"],
                                ["indice", `Índice vs ${ref === "todos" ? "categoría" : ref.toUpperCase()}`, "w-44 px-3"],
                                ["ranking", "Ranking", "px-2"],
                                ["evolucion", "Evolución", "px-2"],
                                ["seguimientos", "Seguim.", "px-2 text-right"],
                              ] as [Orden | null, string, string][]
                            ).map(([clave, texto, clase]) => (
                              <th key={texto} className={`py-3 font-medium ${clase}`}>
                                {clave ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOrden((o) => ({ por: clave, desc: o.por === clave ? !o.desc : clave !== "nombre" }))
                                    }
                                    className={`inline-flex items-center gap-1 uppercase hover:text-white/80 ${orden.por === clave ? "text-[#C8A96B]" : ""}`}
                                  >
                                    {texto}
                                    <ArrowDownUp size={10} className={orden.por === clave ? "" : "opacity-40"} />
                                  </button>
                                ) : (
                                  texto
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibles.map(({ f, ficha, nota, seg }) => (
                            <tr
                              key={f.jugador.jugador}
                              onClick={() => abreFicha(f.jugador.jugador)}
                              className="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04]"
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
                              <td className="px-2 text-right tabular-nums text-white/70">{nota && nota.played ? nota.avg.toFixed(1) : "—"}</td>
                              <td className="px-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 text-right text-xs font-semibold tabular-nums" style={{ color: colorIndice(f.indice) }}>
                                    {f.indice ?? "—"}
                                  </span>
                                  <Barra valor={f.indice ?? 0} color={colorIndice(f.indice)} />
                                </div>
                              </td>
                              <td className="px-2 text-xs text-white/70">{f.ranking ? `${ordinal(f.ranking.posicion)} de ${f.ranking.de}` : "—"}</td>
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {pestana === "graficos" && (
                  <Graficos
                    jugadores={jugadores}
                    refe={ref}
                    refLabel={refLabel}
                    puesto={filtroPuesto}
                    elegido={activo?.f.jugador.jugador ?? null}
                    nombreDe={(j) => fichaDe(j)?.nombre ?? j.jugador}
                    onElige={abreFicha}
                  />
                )}

                {pestana === "ficha" && activo && (
                  <>
                    <label className="mt-6 flex max-w-sm flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
                      Jugador
                      <select
                        value={activo.f.jugador.jugador}
                        onChange={(e) => setElegido(e.target.value)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-white"
                      >
                        {[...conFicha]
                          .sort((a, b) => (a.ficha?.nombre ?? a.f.jugador.jugador).localeCompare(b.ficha?.nombre ?? b.f.jugador.jugador, "es"))
                          .map((x) => (
                            <option key={x.f.jugador.jugador} value={x.f.jugador.jugador} className="bg-[#11161C]">
                              {x.ficha?.nombre ?? x.f.jugador.jugador} · {PUESTOS.find((p) => p.key === x.f.puesto)?.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Detalle
                      fila={activo.f}
                      jugadores={jugadores}
                      refe={ref}
                      refLabel={refLabel}
                      ficha={activo.ficha}
                      nota={activo.nota}
                      seg={activo.seg}
                      escudoDe={escudoDe}
                    />
                  </>
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
/*  LOS GRÁFICOS POR FASE                                              */
/* ------------------------------------------------------------------ */

const etiquetaDe = (columna: string) => {
  const m = METRICA_JUGADOR_POR_COLUMNA.get(columna);
  if (!m) return columna;
  return `${m.nombre}${m.unidad === "porcentaje" ? "" : " /90"}${m.mejorAlto === false ? " (menos es mejor)" : ""}`;
};

function Graficos({
  jugadores,
  refe,
  refLabel,
  puesto,
  elegido,
  nombreDe,
  onElige,
}: {
  jugadores: FilaJugador[];
  refe: Referencia;
  refLabel: string;
  puesto: Puesto | "todos";
  elegido: string | null;
  nombreDe: (j: FilaJugador) => string;
  onElige: (nombre: string) => void;
}) {
  const [pregunta, setPregunta] = useState(0);
  const [ejes, setEjes] = useState<{ x: string; y: string } | null>(null);

  const p = PREGUNTAS[pregunta];
  const x = ejes?.x ?? p.x;
  const y = ejes?.y ?? p.y;

  /* Las de porteros, sólo con porteros; el resto, con el puesto de arriba. */
  const puestoGrafico: Puesto | "todos" = !ejes && p.fase === "por" ? "POR" : puesto;
  const puntos = useMemo(() => puntosDe(jugadores, refe, puestoGrafico, x, y), [jugadores, refe, puestoGrafico, x, y]);

  const mx = mediana(puntos.filter((q) => !q.nuestro).map((q) => q.x));
  const my = mediana(puntos.filter((q) => !q.nuestro).map((q) => q.y));
  const mejorX = METRICA_JUGADOR_POR_COLUMNA.get(x)?.mejorAlto;
  const mejorY = METRICA_JUGADOR_POR_COLUMNA.get(y)?.mejorAlto;
  const porEncima = (v: number, m: number, mejor: boolean | null | undefined) => (mejor === false ? v < m : v > m);
  const destacan = puntos.filter((q) => q.nuestro && porEncima(q.x, mx, mejorX) && porEncima(q.y, my, mejorY));

  const puestoTexto = puestoGrafico === "todos" ? "jugadores de campo" : PUESTOS.find((q) => q.key === puestoGrafico)?.label.toLowerCase();

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        {FASES.map((fase) => (
          <div key={fase.key}>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">{fase.label}</p>
            <div className="space-y-1">
              {PREGUNTAS.map((q, i) =>
                q.fase === fase.key ? (
                  <button
                    key={q.pregunta}
                    type="button"
                    onClick={() => {
                      setPregunta(i);
                      setEjes(null);
                    }}
                    className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                      !ejes && pregunta === i ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "text-white/70 hover:bg-white/[0.05]"
                    }`}
                  >
                    {q.pregunta}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wider text-white/40">O elige tú las dos métricas</p>
          {(["x", "y"] as const).map((eje) => (
            <label key={eje} className="mt-2 block text-[11px] text-white/45">
              {eje === "x" ? "Eje horizontal" : "Eje vertical"}
              <select
                value={eje === "x" ? x : y}
                onChange={(e) => setEjes({ x: eje === "x" ? e.target.value : x, y: eje === "y" ? e.target.value : y })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white"
              >
                {[
                  ["con", "Con balón"],
                  ["sin", "Sin balón"],
                  ["abp", "Balón parado"],
                  ["general", "General"],
                ].map(([fase, rotulo]) => (
                  <optgroup key={fase} label={rotulo} className="bg-[#11161C]">
                    {METRICAS_JUGADOR.filter((m) => m.fase === fase).map((m) => (
                      <option key={m.columna} value={m.columna} className="bg-[#11161C]">
                        {m.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ))}
        </div>
      </aside>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <p className="text-base font-semibold">{ejes ? `${etiquetaDe(x)} frente a ${etiquetaDe(y)}` : p.pregunta}</p>
        <p className="mt-1 text-xs text-white/45">
          {ejes ? "Las dos métricas elegidas." : p.lectura} {puntos.length} {puestoTexto} ({refLabel.toLowerCase()} y todos los
          nuestros), con al menos 90′. Las líneas son la mediana de la categoría.
        </p>

        {puntos.length < 3 ? (
          <p className="mt-6 text-sm text-white/45">No hay bastantes jugadores con esas dos métricas para dibujarlas.</p>
        ) : (
          <Dispersion puntos={puntos} x={x} y={y} mx={mx} my={my} elegido={elegido} nombreDe={nombreDe} onElige={onElige} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Castilla (pincha para abrir su ficha)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: tinta(0.3) }} /> Resto de la categoría
          </span>
        </div>
        {destacan.length > 0 && (
          <p className="mt-3 text-sm text-white/70">
            <b className="text-[#C8A96B]">Por encima de la mediana en las dos:</b>{" "}
            {destacan.map((q) => nombreDe(q.jugador)).join(", ")}.
          </p>
        )}
      </div>
    </div>
  );
}

function Dispersion({
  puntos,
  x,
  y,
  mx,
  my,
  elegido,
  nombreDe,
  onElige,
}: {
  puntos: PuntoJugador[];
  x: string;
  y: string;
  mx: number;
  my: number;
  elegido: string | null;
  nombreDe: (j: FilaJugador) => string;
  onElige: (nombre: string) => void;
}) {
  const W = 640;
  const H = 420;
  const M = { l: 48, r: 16, t: 14, b: 40 };
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const rango = (v: number[]) => {
    const min = Math.min(...v);
    const max = Math.max(...v);
    const pad = (max - min || 1) * 0.06;
    return [min - pad, max + pad] as const;
  };
  const [x0, x1] = rango(xs);
  const [y0, y1] = rango(ys);
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const ticks = (a: number, b: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => a + (b - a) * t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${etiquetaDe(x)} frente a ${etiquetaDe(y)}`}>
      {ticks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={tinta(0.06)} />
          <text x={sx(t)} y={H - M.b + 14} fontSize={10} textAnchor="middle" fill={tinta(0.45)}>
            {formatea(t)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={tinta(0.06)} />
          <text x={M.l - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" fill={tinta(0.45)}>
            {formatea(t)}
          </text>
        </g>
      ))}
      <line x1={sx(mx)} x2={sx(mx)} y1={M.t} y2={H - M.b} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <line x1={M.l} x2={W - M.r} y1={sy(my)} y2={sy(my)} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" fill={tinta(0.6)}>
        {etiquetaDe(x)}
      </text>
      <text x={12} y={(M.t + H - M.b) / 2} fontSize={11} textAnchor="middle" fill={tinta(0.6)} transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
        {etiquetaDe(y)}
      </text>

      {puntos
        .filter((p) => !p.nuestro)
        .map((p) => (
          <circle key={`${p.jugador.jugador}-${p.jugador.equipo}`} cx={sx(p.x)} cy={sy(p.y)} r={3.4} fill={tinta(0.28)}>
            <title>{`${p.jugador.jugador} (${p.jugador.equipo}), ${p.jugador.edad} años · ${formatea(p.x)} · ${formatea(p.y)}`}</title>
          </circle>
        ))}
      {puntos
        .filter((p) => p.nuestro)
        .map((p) => {
          const es = p.jugador.jugador === elegido;
          return (
            <g key={p.jugador.jugador} className="cursor-pointer" onClick={() => onElige(p.jugador.jugador)}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={es ? 6.5 : 5} fill={ORO} stroke={es ? "white" : "rgba(0,0,0,.35)"} strokeWidth={es ? 1.5 : 0.8}>
                <title>{`${nombreDe(p.jugador)}, ${p.jugador.edad} años · ${formatea(p.x)} · ${formatea(p.y)}`}</title>
              </circle>
              <text x={sx(p.x) + 7} y={sy(p.y) - 6} fontSize={10} fill={ORO} fontWeight={es ? 700 : 500}>
                {apellido(nombreDe(p.jugador))}
              </text>
            </g>
          );
        })}
    </svg>
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
  ficha: { id: string; nombre: string; foto?: string } | null | undefined;
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
