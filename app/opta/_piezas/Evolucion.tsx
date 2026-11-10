"use client";

/**
 * EVOLUCIÓN (10/11/2026): cualquier equipo de la categoría jornada a jornada.
 *
 * - Una cuadrícula de gráficos pequeños, uno por métrica de `opta:partidos`,
 *   con tres líneas: el equipo, sus rivales en esos mismos partidos y la media
 *   de la liga (su grupo o toda la categoría) en esa jornada. Por partido o
 *   acumulado (la media hasta esa jornada), cada punto rotulado y, debajo, la
 *   tabla con los números (plegada en el móvil).
 * - Arranque contra proceso: las primeras N jornadas frente a las últimas N,
 *   del equipo y de sus rivales, con la diferencia, una frase sobre lo que más
 *   ha cambiado y el mapa de remates a favor de cada tramo.
 *
 * Las cuentas, en `lib/opta-evolucion.ts` (qué es «la jornada k»: el k-ésimo
 * partido de cada equipo).
 */

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { COMPARADO, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, type PartidoEquipo } from "@/lib/opta-analisis";
import {
  aMejor,
  arranqueProceso,
  defDe,
  mayoresCambios,
  metricasPartido,
  partidosPorEquipo,
  rotuloCorto,
  serieEvolucion,
  tramosDe,
  type FilaArranque,
  type Modo,
  type PuntoEvo,
} from "@/lib/opta-evolucion";
import type { Unidad } from "@/lib/data-analisis/metricas";
import { nombreMetrica } from "@/lib/opta-nombres";
import type { DefMetrica } from "@/lib/opta-nombres";

import { Botonera, Elegir, fmt, Panel } from "./comun";
import { equiposDe, nombreDe, useRemates } from "./eventos";
import { MapaRemates } from "./Remates";
import type { DatosOpta } from "./useOpta";

const POR_DEFECTO = ["ExpG", "SOG", "Ps%InA3rd", "TouchOpBox", "PPDA", "PsLostD3"];

/** Lo que entra siempre en «arranque contra proceso», además de lo elegido arriba. */
const BASE_ARRANQUE = ["Goal", "GA", "ExpG", "ExpGAg", "ShtIncBl", "SOG", "ShotsAg", "TouchOpBox", "Poss%", "PPDA", "Ps%InA3rd", "PsLostD3", "PosWonA3rd", "Duel%"];

type AmbitoLiga = "grupo" | "todos";

/** Una media de recuentos lleva decimales (0,8 goles por partido, no «1»). */
const enMedia = (u: Unidad): Unidad => (u === "entero" ? "decimal" : u);

/** Una diferencia: con signo, y en puntos si es un porcentaje. */
const diferencia = (d: number | null, u: Unidad) =>
  d == null ? "" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${u === "porcentaje" ? `${Math.abs(d).toFixed(1).replace(".", ",")} pts` : fmt(Math.abs(d), enMedia(u))}`;

export const nombreDeMetrica = (a: string, datos: DatosOpta) => defDe(a, datos.catalogo).nombre || nombreMetrica(a, datos.catalogo);

export function Evolucion({ datos }: { datos: DatosOpta }) {
  const { partidos, grupos, catalogo } = datos;
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const [teamId, setTeamId] = useState(CASTILLA_OPTA);
  const [ambito, setAmbito] = useState<AmbitoLiga>("grupo");
  const [modo, setModo] = useState<Modo>("partido");
  const [elegidas, setElegidas] = useState<string[]>(POR_DEFECTO);

  const porEquipo = useMemo(() => partidosPorEquipo(partidos), [partidos]);
  const disponibles = useMemo(() => metricasPartido(partidos, catalogo), [partidos, catalogo]);
  const metricas = elegidas.filter((a) => disponibles.includes(a));
  const restantes = disponibles
    .filter((a) => !metricas.includes(a))
    .map((a) => ({ clave: a, nombre: nombreDeMetrica(a, datos) }))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

  const grupo = grupos.get(teamId);
  const muestra = useMemo(
    () => new Set([...porEquipo.keys()].filter((id) => ambito === "todos" || grupos.size === 0 || grupos.get(id) === grupo)),
    [porEquipo, grupos, grupo, ambito],
  );
  const suyos = porEquipo.get(teamId) ?? [];
  const nombre = nombreDe(teamId, equipos.find((e) => e.teamId === teamId)?.equipo ?? "");
  const quienLiga = ambito === "todos" ? "toda la categoría" : "su grupo";

  return (
    <div className="mt-6 space-y-4">
      <Panel
        titulo="Jornada a jornada"
        subtitulo={`Cada métrica partido a partido: ${nombre}, sus rivales en esos mismos partidos y la media de ${quienLiga} en esa jornada (el partido n.º 1, 2, 3… de cada equipo).`}
        derecha={
          <Elegir
            etiqueta="Equipo"
            valor={teamId}
            alCambiar={setTeamId}
            opciones={equipos.map((e) => ({ clave: e.teamId, nombre: e.equipo }))}
          />
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Botonera
            etiqueta="Cómo se cuenta"
            valor={modo}
            alCambiar={setModo}
            opciones={[
              { clave: "partido", nombre: "Por partido" },
              { clave: "acumulado", nombre: "Acumulado" },
            ]}
          />
          <Botonera
            etiqueta="La media de"
            valor={ambito}
            alCambiar={setAmbito}
            opciones={[
              { clave: "grupo", nombre: "Su grupo" },
              { clave: "todos", nombre: "Toda la categoría" },
            ]}
          />
          {restantes.length > 0 && (
            <label className="inline-flex min-w-0 items-center gap-2 text-xs text-white/55">
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Añadir una métrica</span>
              <select
                value=""
                onChange={(e) => e.target.value && setElegidas([...metricas, e.target.value])}
                className="min-w-0 max-w-[220px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white"
              >
                <option value="" className="bg-[#11161C]">
                  Añadir métrica…
                </option>
                {restantes.map((o) => (
                  <option key={o.clave} value={o.clave} className="bg-[#11161C]">
                    {o.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Leyenda nombre={nombre} liga={quienLiga} modo={modo} />

        {suyos.length === 0 ? (
          <p className="mt-3 text-sm text-white/55">Este equipo aún no tiene partidos en la descarga de Opta.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {metricas.map((a) => (
              <MiniEvolucion
                key={a}
                nombre={nombreDeMetrica(a, datos)}
                def={defDe(a, catalogo)}
                serie={serieEvolucion(porEquipo, teamId, a, muestra, modo, catalogo)}
                equipo={nombre}
                alQuitar={metricas.length > 1 ? () => setElegidas(metricas.filter((x) => x !== a)) : undefined}
              />
            ))}
          </div>
        )}
      </Panel>

      {suyos.length >= 4 && <ArranqueProceso datos={datos} teamId={teamId} nombre={nombre} suyos={suyos} metricas={metricas} />}
    </div>
  );
}

export function Leyenda({ nombre, liga, modo }: { nombre: string; liga: string; modo: Modo }) {
  const raya = (color: string, discontinua = false) => (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" style={{ stroke: color, strokeWidth: 2.5, strokeDasharray: discontinua ? "4 3" : undefined }} />
    </svg>
  );
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
      <span className="inline-flex items-center gap-1.5">{raya(ORO)}{nombre}</span>
      <span className="inline-flex items-center gap-1.5">{raya(COMPARADO)}Sus rivales</span>
      <span className="inline-flex items-center gap-1.5">{raya(tinta(0.5), true)}Media de {liga}</span>
      {modo === "acumulado" && <span>Cada punto es la media hasta esa jornada.</span>}
      <span>Porcentajes, en %.</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  EL GRÁFICO PEQUEÑO                                                 */
/* ------------------------------------------------------------------ */

const W = 340;
const H = 190;
const M = { izq: 14, der: 14, arriba: 20, abajo: 22 };

type Linea = "equipo" | "rivales" | "liga";

function trazo(puntos: ([number, number] | null)[]): string {
  let d = "";
  let suelto = true;
  for (const p of puntos) {
    if (!p) {
      suelto = true;
      continue;
    }
    d += `${suelto ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
    suelto = false;
  }
  return d.trim();
}

export function MiniEvolucion({
  nombre,
  def,
  serie,
  equipo,
  alQuitar,
}: {
  nombre: string;
  def: DefMetrica;
  serie: PuntoEvo[];
  equipo: string;
  alQuitar?: () => void;
}) {
  const n = serie.length;
  /* Acumulado, los recuentos ya son medias. */
  const u = serie.some((p) => p.equipo != null && !Number.isInteger(p.equipo)) ? enMedia(def.unidad) : def.unidad;
  const valores = serie.flatMap((p) => [p.equipo, p.rivales, p.liga]).filter((v): v is number => v != null);
  if (!valores.length) return null;
  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const rango = hi - lo || Math.abs(hi) || 1;
  lo -= rango * 0.18;
  hi += rango * 0.18;
  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (i: number) => (n === 1 ? M.izq + ancho / 2 : M.izq + (i / (n - 1)) * ancho);
  const yDe = (v: number) => M.arriba + (1 - (v - lo) / (hi - lo)) * alto;
  const pts = (k: Linea) => serie.map((p, i) => (p[k] == null ? null : ([xDe(i), yDe(p[k]!)] as [number, number])));
  /* Con muchas jornadas, un rótulo de cada pocos (y siempre el último). */
  const cada = Math.max(1, Math.ceil(n / 12));
  const rotula = (i: number) => i % cada === 0 || i === n - 1;

  return (
    <figure className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <figcaption className="mb-1 flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-tight text-white">{nombre}</span>
          {def.mejor === false && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">↓ menos es mejor</span>}
        </span>
        {alQuitar && (
          <button type="button" onClick={alQuitar} aria-label={`Quitar ${nombre}`} className="shrink-0 rounded-lg p-1 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${nombre}: ${equipo}, sus rivales y la media de la liga por jornada`}>
        {/* Las jornadas. */}
        {serie.map((p, i) =>
          rotula(i) ? (
            <text key={p.partido} x={xDe(i)} y={H - 6} textAnchor="middle" style={{ fill: tinta(0.45), fontSize: 10 }}>
              {`J${p.jornada}`}
            </text>
          ) : null,
        )}
        <line x1={M.izq} y1={H - M.abajo + 2} x2={W - M.der} y2={H - M.abajo + 2} style={{ stroke: tinta(0.12), strokeWidth: 1 }} />

        <path d={trazo(pts("liga"))} style={{ fill: "none", stroke: tinta(0.45), strokeWidth: 1.75, strokeDasharray: "4 3" }} />
        <path d={trazo(pts("rivales"))} style={{ fill: "none", stroke: COMPARADO, strokeWidth: 2 }} />
        <path d={trazo(pts("equipo"))} style={{ fill: "none", stroke: ORO, strokeWidth: 2.5 }} />

        {serie.map((p, i) => {
          const x = xDe(i);
          const nota = [`J${p.jornada}`, fechaCorta(p.fecha), p.rival ? `contra ${p.rival}` : "", p.gf != null && p.gc != null ? `${p.gf}-${p.gc}` : ""].filter(Boolean).join(" · ");
          /* El rótulo del que va más alto, encima; el del otro, debajo: así no se pisan. */
          const equipoArriba = p.equipo != null && (p.rivales == null || p.equipo >= p.rivales);
          return (
            <g key={p.partido}>
              {p.liga != null && <circle cx={x} cy={yDe(p.liga)} r={2} style={{ fill: tinta(0.5) }} />}
              {p.rivales != null && (
                <circle cx={x} cy={yDe(p.rivales)} r={3} style={{ fill: COMPARADO }}>
                  <title>{`${nota} · sus rivales: ${fmt(p.rivales, u)}`}</title>
                </circle>
              )}
              {p.equipo != null && (
                <circle cx={x} cy={yDe(p.equipo)} r={3.5} style={{ fill: ORO, stroke: tinta(0.85), strokeWidth: 0.75 }}>
                  <title>{`${nota} · ${equipo}: ${fmt(p.equipo, u)}${p.liga != null ? ` · media ${fmt(p.liga, enMedia(def.unidad))}` : ""}`}</title>
                </circle>
              )}
              {rotula(i) && p.equipo != null && (
                <text x={x} y={yDe(p.equipo) + (equipoArriba ? -7 : 13)} textAnchor="middle" style={{ fill: ORO, fontSize: 10, fontWeight: 700 }}>
                  {rotuloCorto(p.equipo, def.unidad)}
                </text>
              )}
              {rotula(i) && p.rivales != null && (
                <text x={x} y={yDe(p.rivales) + (equipoArriba ? 13 : -7)} textAnchor="middle" style={{ fill: COMPARADO, fontSize: 9.5, fontWeight: 600 }}>
                  {rotuloCorto(p.rivales, def.unidad)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Los números: a la vista desde tableta; en el móvil, plegados. */}
      <div className="mt-2 hidden sm:block">
        <TablaSerie serie={serie} def={def} equipo={equipo} />
      </div>
      <details className="mt-2 sm:hidden">
        <summary className="cursor-pointer text-[11px] font-semibold text-white/55">Ver los números</summary>
        <div className="mt-1">
          <TablaSerie serie={serie} def={def} equipo={equipo} />
        </div>
      </details>
    </figure>
  );
}

function TablaSerie({ serie, def, equipo }: { serie: PuntoEvo[]; def: DefMetrica; equipo: string }) {
  const filas: { k: Linea; nombre: string; color: string }[] = [
    { k: "equipo", nombre: equipo, color: ORO },
    { k: "rivales", nombre: "Rivales", color: COMPARADO },
    { k: "liga", nombre: "Liga", color: tinta(0.55) },
  ];
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-[10.5px] tabular-nums">
        <thead>
          <tr className="text-white/45">
            <th className="py-0.5 pr-2 text-left font-semibold" />
            {serie.map((p) => (
              <th key={p.partido} className="px-1 py-0.5 text-right font-semibold" title={p.rival}>
                {`J${p.jornada}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.k} className="border-t border-white/[0.06]">
              <td className="max-w-[90px] truncate py-0.5 pr-2 text-left font-semibold" style={{ color: f.color }}>
                {f.nombre}
              </td>
              {serie.map((p) => (
                <td key={p.partido} className="whitespace-nowrap px-1 py-0.5 text-right text-white/75">
                  {rotuloCorto(p[f.k], def.unidad)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ARRANQUE CONTRA PROCESO                                            */
/* ------------------------------------------------------------------ */

const TRAMOS_N = [2, 3, 4, 5, 6, 7, 8];

function ArranqueProceso({
  datos,
  teamId,
  nombre,
  suyos,
  metricas,
}: {
  datos: DatosOpta;
  teamId: string;
  nombre: string;
  suyos: PartidoEquipo[];
  metricas: string[];
}) {
  const { catalogo, partidos } = datos;
  const [nElegido, setN] = useState(5);
  const opciones = TRAMOS_N.filter((k) => 2 * k <= suyos.length);
  const n = opciones.includes(nElegido) ? nElegido : (opciones.at(-1) ?? 2);
  const { remates, cargando } = useRemates(datos);

  /* Barato (una veintena de métricas sobre unas 400 filas): sin memo, que la lista cambia con lo elegido arriba. */
  const lista = [...new Set([...BASE_ARRANQUE, ...metricas])].filter((a) => a.startsWith("·") || partidos.some((f) => f[a] != null));
  const filas = arranqueProceso(suyos, n, lista, partidos, catalogo);
  const { primeras, ultimas } = tramosDe(suyos, n);
  const enPrimeras = new Set(primeras.map((p) => String(p.fila.partido)));
  const enUltimas = new Set(ultimas.map((p) => String(p.fila.partido)));
  const rPrimeras = remates.filter((r) => r.teamId === teamId && enPrimeras.has(r.partido));
  const rUltimas = remates.filter((r) => r.teamId === teamId && enUltimas.has(r.partido));
  const cambios = mayoresCambios(filas, 2);
  const tramoA = `J1–J${n}`;
  const tramoB = `J${suyos.length - n + 1}–J${suyos.length}`;

  const frase = (c: (typeof cambios)[number]) => {
    const def = defDe(c.fila.a, catalogo);
    const t = c.lado === "equipo" ? c.fila.equipo : c.fila.rivales;
    const mejor = aMejor(def, t.dif, c.lado === "rivales");
    return `${def.nombre}${c.lado === "rivales" ? " de sus rivales" : ""}: de ${fmt(t.antes, enMedia(def.unidad))} a ${fmt(t.despues, enMedia(def.unidad))} por partido${
      mejor === null ? "" : mejor ? `, a mejor para ${nombre}` : `, a peor para ${nombre}`
    }.`;
  };

  return (
    <Panel
      titulo="Arranque contra proceso"
      subtitulo={`Media por partido de las primeras ${n} jornadas (${tramoA}) frente a las últimas ${n} (${tramoB}).`}
      derecha={
        opciones.length > 1 ? (
          <Botonera etiqueta="Jornadas de cada tramo" valor={String(n)} alCambiar={(v) => setN(Number(v))} opciones={opciones.map((k) => ({ clave: String(k), nombre: `${k}` }))} />
        ) : undefined
      }
    >
      {cambios.length > 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/85">
          <span className="font-semibold text-white">Lo que más ha cambiado</span>{" "}
          <span className="text-white/55">(medido contra lo que se mueve esa cifra en la liga)</span>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {cambios.map((c) => (
              <li key={`${c.fila.a}-${c.lado}`}>{frase(c)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px] tabular-nums">
          <thead>
            <tr className="text-[11px] text-white/55">
              <th rowSpan={2} className="py-1 pr-2 align-bottom font-semibold">
                Métrica
              </th>
              <th colSpan={3} className="border-b border-white/10 py-1 text-center font-semibold" style={{ color: ORO }}>
                {nombre}
              </th>
              <th colSpan={3} className="border-b border-white/10 py-1 pl-3 text-center font-semibold" style={{ color: COMPARADO }}>
                Sus rivales
              </th>
            </tr>
            <tr className="border-b border-white/10 text-[11px] text-white/45">
              {[0, 1].map((i) => (
                <FilaCabecera key={i} a={tramoA} b={tramoB} izquierda={i === 1} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaTramo key={f.a} fila={f} def={defDe(f.a, catalogo)} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-white/45">En verde, el cambio a mejor para {nombre}; en naranja, a peor (en los rivales, que suban sus cifras de ataque es a peor). Las de estilo, sin color.</p>

      {!cargando && (rPrimeras.length > 0 || rUltimas.length > 0) && (
        <div className="mt-5 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
          {[
            { t: tramoA, rs: rPrimeras },
            { t: tramoB, rs: rUltimas },
          ].map((x) => (
            <div key={x.t} className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-white">Remates a favor · {x.t}</h3>
              {x.rs.length ? <MapaRemates remates={x.rs} ariaLabel={`Remates de ${nombre} en ${x.t}`} maxAlto={340} /> : <p className="text-sm text-white/55">No remató.</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function FilaCabecera({ a, b, izquierda }: { a: string; b: string; izquierda: boolean }) {
  return (
    <>
      <th className={`py-1 pr-2 text-right font-semibold ${izquierda ? "pl-3" : ""}`}>{a}</th>
      <th className="py-1 pr-2 text-right font-semibold">{b}</th>
      <th className="py-1 pr-2 text-right font-semibold">Dif.</th>
    </>
  );
}

function FilaTramo({ fila, def }: { fila: FilaArranque; def: DefMetrica }) {
  const celdas = (t: FilaArranque["equipo"], deRivales: boolean) => {
    const mejor = aMejor(def, t.dif, deRivales);
    const color = mejor === null ? undefined : mejor ? MEJOR : PEOR;
    const dif = diferencia(t.dif, def.unidad);
    return (
      <>
        <td className={`py-1 pr-2 text-right text-white/75 ${deRivales ? "pl-3" : ""}`}>{fmt(t.antes, enMedia(def.unidad))}</td>
        <td className="py-1 pr-2 text-right text-white/75">{fmt(t.despues, enMedia(def.unidad))}</td>
        <td className="py-1 pr-2 text-right font-semibold" style={color ? { color } : undefined}>
          {dif}
        </td>
      </>
    );
  };
  if (fila.equipo.antes == null && fila.rivales.antes == null) return null;
  return (
    <tr className="border-b border-white/[0.06]">
      <td className="max-w-[220px] py-1 pr-2 text-white/85">
        {def.nombre}
        {def.mejor === false && <span className="ml-1 text-[10px] text-white/40">↓</span>}
      </td>
      {celdas(fila.equipo, false)}
      {celdas(fila.rivales, true)}
    </tr>
  );
}
