"use client";

/**
 * ¿LE DEJAMOS REMATAR CÓMODO? (27/11/2026, idea de X). En el post del partido,
 * dentro de «El partido, cara a cara»: los remates que nos hizo el rival en
 * tres zonas (área central, área lateral, fuera del área), con su xG medio,
 * por partes y frente a lo que concedemos de media en la temporada. Las
 * cuentas, en `lib/data-analisis/zonas-remate-rival.ts`. Usa los remates que
 * el bloque ya ha pedido (opta:remates): no baja nada más.
 */

import { useMemo } from "react";

import { COMPARADO, PEOR, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { enArea, type Remate } from "@/lib/opta-eventos";
import { esPenalti } from "@/lib/data-analisis/ocasiones-concedidas";
import { lecturaZonas, ZONAS, zonasDelPartido, type CifraZona } from "@/lib/data-analisis/zonas-remate-rival";

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/* Medio campo de ataque, de x = 60 a 100 (Opta), con la portería arriba. 1 unidad ≈ 1 m. */
const ANCHO = 68;
const ALTO = 42;
const sx = (y: number) => ((100 - y) / 100) * ANCHO;
const sy = (x: number) => ((100 - Math.max(60, x)) / 100) * 105;

function Celda({ c }: { c: CifraZona }) {
  if (!c.remates) return <span className="text-white/40">—</span>;
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-white">{c.remates}</span>
      <span className="text-white/55"> · xG {coma(c.xGMedio ?? 0)}</span>
    </span>
  );
}

export function ZonasRemateRival({ delPartido, remates, partido, rival }: { delPartido: Remate[]; remates: Remate[]; partido: string; rival: string }) {
  const z = useMemo(() => zonasDelPartido(remates, partido, CASTILLA_OPTA), [remates, partido]);
  const puntos = useMemo(() => delPartido.filter((r) => r.teamId !== CASTILLA_OPTA && !esPenalti(r)), [delPartido]);
  if (!z) return null;
  const { titular, partes } = lecturaZonas(z, rival);
  const t = z.temporada;

  /* Carril central: postes prolongados (y 45,2-54,8) dentro del área (x ≥ 83). */
  const area = { x: sx(78.9), y: sy(100), w: sx(21.1) - sx(78.9), h: sy(83) - sy(100) };
  const carril = { x: sx(54.8), w: sx(45.2) - sx(54.8) };

  return (
    <div id="x-idea-2126405399641231380-1" className="mt-5 min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-white">¿Le dejamos rematar cómodo? Los remates de {rival} por zonas</h3>
      <p className="mt-1 text-[13px] leading-snug text-white/80">{titular}</p>
      {partes && <p className="mt-0.5 text-[13px] leading-snug text-white/70">{partes}</p>}

      <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-start">
        <figure className="mx-auto w-full max-w-[15rem] min-w-0">
          <svg viewBox={`-1 -1 ${ANCHO + 2} ${ALTO + 2}`} className="w-full" role="img" aria-label={`Remates de ${rival} en el partido por zona: azul primera parte, naranja segunda`}>
            <rect x={0} y={0} width={ANCHO} height={ALTO} fill={tinta(0.03)} stroke={tinta(0.3)} strokeWidth={0.3} />
            <rect x={area.x} y={area.y} width={area.w} height={area.h} fill={tinta(0.05)} stroke={tinta(0.35)} strokeWidth={0.3} />
            <rect x={carril.x} y={area.y} width={carril.w} height={area.h} fill="rgba(200,169,107,0.22)" stroke="rgba(200,169,107,0.7)" strokeWidth={0.3} />
            <rect x={sx(63.2)} y={0} width={sx(36.8) - sx(63.2)} height={sy(94.2)} fill="none" stroke={tinta(0.3)} strokeWidth={0.3} />
            <line x1={sx(54.8)} y1={-0.8} x2={sx(45.2)} y2={-0.8} stroke={tinta(0.7)} strokeWidth={0.8} />
            {puntos.map((r, i) => {
              const color = r.parte === 1 ? COMPARADO : PEOR;
              const radio = 0.9 + Math.sqrt(Math.max(0, r.xG)) * 3;
              return (
                <g key={`${r.parte}-${r.segundo}-${i}`}>
                  <title>{`${r.minuto}′ ${r.tirador || ""} · xG ${coma(r.xG)}${r.gol ? " · gol" : ""}${enArea(r.x, r.y) ? "" : " · fuera del área"}`}</title>
                  <circle cx={sx(r.y)} cy={sy(r.x)} r={radio} fill={color} fillOpacity={0.75} stroke={r.gol ? tinta(0.95) : "none"} strokeWidth={r.gol ? 0.6 : 0} />
                </g>
              );
            })}
          </svg>
          <figcaption className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] text-white/60">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: COMPARADO }} />1.ª parte</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: PEOR }} />2.ª parte</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: "rgba(200,169,107,0.45)" }} />área central</span>
            <span>tamaño = xG · aro = gol</span>
          </figcaption>
        </figure>

        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.1em] text-white/50">
                <th className="py-1 pr-2 font-semibold">Zona</th>
                <th className="py-1 pr-2 font-semibold">1.ª parte</th>
                <th className="py-1 pr-2 font-semibold">2.ª parte</th>
                <th className="py-1 pr-2 font-semibold">Partido</th>
                <th className="py-1 font-semibold">{t ? `Concedemos (${t.partidos} part.)` : "Concedemos"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {ZONAS.map((zona) => {
                const p = z.partido[zona.clave];
                const m = t?.porZona[zona.clave];
                const peor = m?.xGMedio != null && p.xGMedio != null && p.remates >= 2 && p.xGMedio - m.xGMedio >= 0.03;
                return (
                  <tr key={zona.clave} className={zona.clave === "central" ? "bg-[#C8A96B]/[0.07]" : undefined}>
                    <th scope="row" className="py-1.5 pr-2 font-semibold text-white" title={zona.detalle}>{zona.nombre}</th>
                    <td className="py-1.5 pr-2"><Celda c={z.primera[zona.clave]} /></td>
                    <td className="py-1.5 pr-2"><Celda c={z.segunda[zona.clave]} /></td>
                    <td className="py-1.5 pr-2">
                      <Celda c={p} />
                      {peor && <span className="ml-1 text-[11px] font-semibold" style={{ color: PEOR }} title="Remates más cómodos que los que solemos conceder ahí">▲</span>}
                    </td>
                    <td className="py-1.5 tabular-nums text-white/70">
                      {m ? (
                        <>
                          {coma(m.porPartido, 1)} por partido{m.xGMedio != null ? ` · xG ${coma(m.xGMedio)}` : ""}
                        </>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="text-white/70">
                <th scope="row" className="py-1.5 pr-2 font-semibold">Total</th>
                <td className="py-1.5 pr-2 tabular-nums">{z.totalPrimera}</td>
                <td className="py-1.5 pr-2 tabular-nums">{z.totalSegunda}</td>
                <td className="py-1.5 pr-2 tabular-nums">{z.total}</td>
                <td className="py-1.5 tabular-nums">{t ? `${coma(t.rematesPorPartido, 1)} por partido` : "—"}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-snug text-white/50">
            Cada celda: remates · xG medio de cada uno. Área central = dentro del área y entre los postes prolongados. Sin penaltis{z.penaltis ? ` (${z.penaltis} en este partido)` : ""}.
            {t ? ` «Concedemos»: lo que nos rematan por partido en los otros ${t.partidos} de la temporada${t.partidos < 15 ? " (tendencia)" : ""}; ▲ = remates más claros que los que solemos conceder en esa zona.` : " Aún no hay 3 partidos más de la temporada para comparar."}
          </p>
        </div>
      </div>
    </div>
  );
}
