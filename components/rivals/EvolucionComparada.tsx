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

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { useAsoma } from "@/hooks/useAsoma";
import { evolucionComparada, ultimoDe, ultimosCincoFrenteAntes, type PuntoComparado, type SerieComparada } from "@/lib/rivals/evolucion-comparada";

const coma = (v: number) => v.toFixed(2).replace(".", ",");

export function EvolucionComparada({ equipo }: { equipo: string }) {
  /* Al asomar o, como muy tarde, a los 2 s (16/11/2026): en el móvil no salía si no se bajaba. Sin dato, no se pinta. */
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);

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

  /* Últimos 5 frente a los anteriores, como el Plan de partido (16/11/2026), con la base escrita. */
  const vFavor = ultimosCincoFrenteAntes(favor.valoresRival);
  const vContra = ultimosCincoFrenteAntes(contra.valoresRival);
  const verbo = (v: ReturnType<typeof ultimosCincoFrenteAntes>, mas: string, menos: string, igual: string) =>
    v ? `${v.cambio === "sube" ? mas : v.cambio === "baja" ? menos : igual} (${coma(v.ultimos)} en los últimos ${v.enUltimos}, ${coma(v.previos)} en los ${v.enPrevios} anteriores)` : null;
  const frase = [
    verbo(vFavor, "genera más xG", "genera menos xG", "genera lo mismo"),
    verbo(vContra, "concede más", "concede menos", "concede lo mismo"),
  ].filter(Boolean);

  return (
    <section aria-label="Evolución comparada" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Evolución comparada · jornada a jornada
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {favor.partidosRival} {favor.partidosRival === 1 ? "partido" : "partidos"} suyos, media acumulada
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">
        {vFavor || vContra
          ? `${nombreRival}: ${[
              vFavor && (vFavor.cambio === "sube" ? "más xG a favor" : vFavor.cambio === "baja" ? "menos xG a favor" : "mismo xG a favor"),
              vContra && (vContra.cambio === "sube" ? "concede más" : vContra.cambio === "baja" ? "concede menos" : "concede lo mismo"),
            ]
              .filter(Boolean)
              .join(", ")} en sus últimos partidos`
          : `${nombreRival} y el Castilla, jornada a jornada`}
      </h3>
      <p className="mt-1 text-sm leading-6 text-white/70">
        xG (goles esperados: lo que valen sus remates por la ocasión) por partido de {nombreRival} y del Castilla, la media hasta cada jornada.
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
const M = { izq: 30, der: 36, arriba: 12, abajo: 22 };

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
    <figure className="portada-celda m-0 min-w-0 p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[13px] font-semibold text-white">{titulo}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{nota}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label={`${titulo}: Castilla, ${rival} y la media del grupo por jornada`}>
        {marcas.map((m, i) => (
          <g key={i}>
            <line x1={M.izq} x2={W - M.der} y1={yDe(m)} y2={yDe(m)} style={{ stroke: tinta(0.08), strokeWidth: 1 }} />
            <text x={M.izq - 4} y={yDe(m) + 3} textAnchor="end" style={{ fill: tinta(0.6), fontSize: 11 }}>
              {coma(m)}
            </text>
          </g>
        ))}
        {ps.map((p, i) =>
          i % cada === 0 || i === n - 1 ? (
            <text key={p.jornada} x={xDe(i)} y={H - 6} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 11 }}>
              J{p.jornada}
            </text>
          ) : null,
        )}
        <path d={trazo(pts("liga"))} style={{ fill: "none", stroke: tinta(0.45), strokeWidth: 1.75, strokeDasharray: "4 3" }} />
        <path d={trazo(pts("rival"))} pathLength={1} className="idea-trazo" style={{ fill: "none", stroke: COMPARADO, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
        <path d={trazo(pts("castilla"))} pathLength={1} className="idea-trazo" style={{ fill: "none", stroke: ORO, strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }} />
        {ps.map((p, i) => (
          <g key={`p${p.jornada}`}>
            {p.rival != null && (
              <circle cx={xDe(i)} cy={yDe(p.rival)} r={3} style={{ fill: COMPARADO, stroke: "var(--portada-sup)", strokeWidth: 1.25 }}>
                <title>{`J${p.jornada} · ${rival}: ${coma(p.rival)}`}</title>
              </circle>
            )}
            {p.castilla != null && (
              <circle cx={xDe(i)} cy={yDe(p.castilla)} r={3.25} style={{ fill: ORO, stroke: "var(--portada-sup)", strokeWidth: 1.25 }}>
                <title>{`J${p.jornada} · Castilla: ${coma(p.castilla)}`}</title>
              </circle>
            )}
          </g>
        ))}
        {/* Como el original de X: la última cifra de cada línea, a su derecha. Se separan si caen encima. */}
        {(() => {
          const finales = [
            { u: uC, color: ORO },
            { u: uR, color: COMPARADO },
            { u: uL, color: tinta(0.6) },
          ]
            .filter((f): f is { u: { jornada: number; valor: number }; color: string } => f.u != null)
            .map((f) => ({ ...f, y: yDe(f.u.valor) }))
            .sort((a, b) => a.y - b.y);
          for (let k = 1; k < finales.length; k++) if (finales[k].y - finales[k - 1].y < 12) finales[k].y = finales[k - 1].y + 12;
          return finales.map((f) => (
            <text key={f.color} x={W - M.der + 4} y={f.y + 4} className="fuente-club" style={{ fill: f.color, fontSize: 13, fontWeight: 700 }}>
              {coma(f.u.valor)}
            </text>
          ));
        })()}
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
        <span className="fuente-club text-lg font-bold text-white">{coma(u.valor)}</span> <span className="text-white/45">J{u.jornada}</span>
      </dd>
    </div>
  );
}
