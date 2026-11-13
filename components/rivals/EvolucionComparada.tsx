"use client";

/**
 * EVOLUCIÓN COMPARADA (Scout colectivo, 13/11/2026): xG a favor y xG en contra
 * por partido, como media acumulada jornada a jornada, del Castilla y del
 * rival, con la media de nuestro grupo en gris. Dice si el rival llega en
 * subida o en caída sin fiarse sólo de los resultados.
 *
 * Datos: `opta:partidos` por `useOptaLigero` (la misma descarga que la
 * portada). Las cuentas, en `lib/rivals/evolucion-comparada.ts`. El rival se
 * cruza con Opta por `casaEquipo`, como en «Datos del rival»; si no cruza o
 * no tiene partidos, el bloque no se pinta. Nada se pide hasta que asoma.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { evolucionComparada, tendencia, ultimoDe, type PuntoComparado, type SerieComparada } from "@/lib/rivals/evolucion-comparada";

const coma = (v: number) => v.toFixed(2).replace(".", ",");

export function EvolucionComparada({ equipo }: { equipo: string }) {
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

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombreRival = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const g = opta.grupos.get(CASTILLA_OPTA);
    const grupo = new Set([...opta.grupos.entries()].filter(([, n]) => n === g).map(([id]) => id));
    const series = evolucionComparada(opta.partidos, CASTILLA_OPTA, rivalId, grupo);
    if (!series.some((s) => s.partidosRival > 0)) return null;
    return { series, nombreRival };
  }, [opta, equipo]);

  if (!datos) return null;
  const { series, nombreRival } = datos;
  const favor = series.find((s) => s.lado === "favor")!;
  const contra = series.find((s) => s.lado === "contra")!;

  const tFavor = tendencia(favor.puntos, "rival");
  const tContra = tendencia(contra.puntos, "rival");
  const frase = [
    tFavor === "sube" ? "genera más que hace tres partidos" : tFavor === "baja" ? "genera menos que hace tres partidos" : tFavor === "igual" ? "genera lo mismo que hace tres partidos" : null,
    tContra === "sube" ? "concede más" : tContra === "baja" ? "concede menos" : tContra === "igual" ? "concede lo mismo" : null,
  ].filter(Boolean);

  return (
    <section aria-label="Evolución comparada" className="mt-8 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
        Evolución comparada
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Opta, media acumulada</span>
      </p>
      <p className="mt-1 text-sm leading-6 text-white/75">
        xG por partido de {nombreRival} y del Castilla, la media hasta cada jornada.
        {frase.length > 0 && ` ${nombreRival} ${frase.join(" y ")}.`}
      </p>

      <Leyenda rival={nombreRival} />

      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        <Grafico titulo="xG a favor por partido" nota="más es mejor" serie={favor} rival={nombreRival} />
        <Grafico titulo="xG en contra por partido" nota="menos es mejor" serie={contra} rival={nombreRival} />
      </div>
    </section>
  );
}

function raya(color: string, discontinua = false) {
  return (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" style={{ stroke: color, strokeWidth: 2.5, strokeDasharray: discontinua ? "4 3" : undefined }} />
    </svg>
  );
}

function Leyenda({ rival }: { rival: string }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
      <span className="inline-flex items-center gap-1.5">{raya(ORO)}Real Madrid Castilla</span>
      <span className="inline-flex min-w-0 items-center gap-1.5">{raya(COMPARADO)}<span className="truncate">{rival}</span></span>
      <span className="inline-flex items-center gap-1.5">{raya(tinta(0.45), true)}Media de nuestro grupo</span>
    </p>
  );
}

const W = 340;
const H = 180;
const M = { izq: 30, der: 12, arriba: 12, abajo: 22 };

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

function Grafico({ titulo, nota, serie, rival }: { titulo: string; nota: string; serie: SerieComparada; rival: string }) {
  const ps = serie.puntos;
  const n = ps.length;
  const valores = ps.flatMap((p) => [p.castilla, p.rival, p.liga]).filter((v): v is number => v != null);
  if (!n || !valores.length) return null;

  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const rango = hi - lo || 0.5;
  lo = Math.max(0, lo - rango * 0.15);
  hi += rango * 0.15;
  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (i: number) => (n === 1 ? M.izq + ancho / 2 : M.izq + (i / (n - 1)) * ancho);
  const yDe = (v: number) => M.arriba + (1 - (v - lo) / (hi - lo)) * alto;
  const pts = (k: keyof Omit<PuntoComparado, "jornada">) => ps.map((p, i) => (p[k] == null ? null : ([xDe(i), yDe(p[k]!)] as [number, number])));
  const marcas = [lo, (lo + hi) / 2, hi];
  const cada = Math.max(1, Math.ceil(n / 10));

  const uC = ultimoDe(ps, "castilla");
  const uR = ultimoDe(ps, "rival");
  const uL = ultimoDe(ps, "liga");

  return (
    <figure className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[13px] font-semibold text-white">{titulo}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{nota}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${titulo}: Castilla, ${rival} y la media del grupo por jornada`}>
        {marcas.map((m, i) => (
          <g key={i}>
            <line x1={M.izq} x2={W - M.der} y1={yDe(m)} y2={yDe(m)} style={{ stroke: tinta(0.08), strokeWidth: 1 }} />
            <text x={M.izq - 4} y={yDe(m) + 3} textAnchor="end" style={{ fill: tinta(0.5), fontSize: 9 }}>
              {coma(m)}
            </text>
          </g>
        ))}
        {ps.map((p, i) =>
          i % cada === 0 || i === n - 1 ? (
            <text key={p.jornada} x={xDe(i)} y={H - 6} textAnchor="middle" style={{ fill: tinta(0.5), fontSize: 9 }}>
              J{p.jornada}
            </text>
          ) : null,
        )}
        <path d={trazo(pts("liga"))} style={{ fill: "none", stroke: tinta(0.45), strokeWidth: 1.75, strokeDasharray: "4 3" }} />
        <path d={trazo(pts("rival"))} style={{ fill: "none", stroke: COMPARADO, strokeWidth: 2.25 }} />
        <path d={trazo(pts("castilla"))} style={{ fill: "none", stroke: ORO, strokeWidth: 2.5 }} />
        {ps.map((p, i) => (
          <g key={`p${p.jornada}`}>
            {p.rival != null && (
              <circle cx={xDe(i)} cy={yDe(p.rival)} r={2.5} style={{ fill: COMPARADO }}>
                <title>{`J${p.jornada} · ${rival}: ${coma(p.rival)}`}</title>
              </circle>
            )}
            {p.castilla != null && (
              <circle cx={xDe(i)} cy={yDe(p.castilla)} r={2.75} style={{ fill: ORO }}>
                <title>{`J${p.jornada} · Castilla: ${coma(p.castilla)}`}</title>
              </circle>
            )}
          </g>
        ))}
      </svg>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <Pie etiqueta="Castilla" color={ORO} u={uC} />
        <Pie etiqueta={rival} color={COMPARADO} u={uR} />
        <Pie etiqueta="Media grupo" color={tinta(0.55)} u={uL} />
      </dl>
    </figure>
  );
}

function Pie({ etiqueta, color, u }: { etiqueta: string; color: string; u: { jornada: number; valor: number } | null }) {
  if (!u) return <div />;
  return (
    <div className="min-w-0">
      <dt className="truncate font-semibold" style={{ color }} title={etiqueta}>
        {etiqueta}
      </dt>
      <dd className="text-white/80">
        <span className="text-sm font-bold text-white">{coma(u.valor)}</span> <span className="text-white/45">J{u.jornada}</span>
      </dd>
    </div>
  );
}
