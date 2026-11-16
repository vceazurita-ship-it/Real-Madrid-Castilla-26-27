"use client";

/**
 * Ficha de penaltis de cada lanzador del rival, para nuestro portero
 * (15/11/2026). Una tarjeta por lanzador: la línea con su lado más repetido y
 * si lo cambió en el último, y la portería en seis zonas con cada penalti
 * (gol, parado o fuera), esta temporada aparte de las anteriores.
 *
 * Datos: `opta:penaltis` (Opta, evento a evento), por `lib/abp/penaltis-lanzador.ts`.
 * La misma hoja sale en el PDF del portero de la pizarra de ABP
 * (`components/abp/pizarra/MesaPdfs.tsx`).
 */

import { useMemo } from "react";
import { urlVideoOpta } from "@/lib/opta-video";
import { CircleDot } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { ORO, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { fechaCorta } from "@/lib/opta-analisis";
import type { Penalti } from "@/lib/opta-eventos";
import { fichasDeDocs, resultadoDe, zonaDe, type FichaLanzador } from "@/lib/abp/penaltis-lanzador";

/* Gol en el oro de la app (cambia con el modo), parado en azul, fuera hueco. */
const COLOR = { gol: ORO, parado: "#3B82F6", fuera: tinta(0.6) } as const;

const W = 300;
const H = 110;

/** La portería en seis zonas vista desde el punto de penalti (izquierda = la del lanzador). */
function PorteriaSeis({ penaltis, rotulo }: { penaltis: Penalti[]; rotulo: string }) {
  const celdas = new Map<string, Penalti[]>();
  for (const p of penaltis) {
    const z = zonaDe(p);
    if (!z) continue;
    const k = `${z.col}-${z.fila}`;
    celdas.set(k, [...(celdas.get(k) ?? []), p]);
  }
  const cw = W / 3;
  const ch = H / 2;
  return (
    <svg viewBox={`-8 -8 ${W + 16} ${H + 12}`} role="img" aria-label={rotulo} className="block h-auto w-full">
      <rect x={0} y={0} width={W} height={H} style={{ fill: tinta(0.04) }} />
      <g style={{ stroke: tinta(0.22), strokeWidth: 1, strokeDasharray: "4 4" }}>
        <line x1={cw} y1={0} x2={cw} y2={H} />
        <line x1={cw * 2} y1={0} x2={cw * 2} y2={H} />
        <line x1={0} y1={ch} x2={W} y2={ch} />
      </g>
      <line x1={-8} y1={H} x2={W + 8} y2={H} style={{ stroke: tinta(0.35), strokeWidth: 2 }} />
      <path d={`M 0 ${H} L 0 0 L ${W} 0 L ${W} ${H}`} style={{ fill: "none", stroke: tinta(0.85), strokeWidth: 5, strokeLinejoin: "round" }} />
      {[0, 1, 2].flatMap((col) =>
        [0, 1].map((fila) => {
          const ps = celdas.get(`${col}-${fila}`) ?? [];
          const x0 = col * cw;
          const y0 = fila * ch;
          return (
            <g key={`${col}-${fila}`}>
              {ps.length > 0 && (
                <text x={x0 + cw - 6} y={y0 + 14} textAnchor="end" style={{ fill: tinta(0.55), fontSize: 11, fontWeight: 700 }}>
                  {ps.length}
                </text>
              )}
              {ps.map((p, i) => {
                const r = resultadoDe(p);
                const cx = x0 + 18 + (i % 4) * 20;
                const cy = y0 + 18 + Math.floor(i / 4) * 18;
                return (
                  <a key={i} href={urlVideoOpta(p, "shots") ?? undefined} target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer" }}>
                  <circle
                    cx={cx}
                    cy={Math.min(cy, y0 + ch - 8)}
                    r={7}
                    style={{
                      fill: r === "fuera" ? "transparent" : COLOR[r],
                      stroke: r === "fuera" ? COLOR.fuera : tinta(0.35),
                      strokeWidth: r === "fuera" ? 2 : 1,
                    }}
                  >
                    <title>{`${fechaCorta(p.fecha)} · ${r === "gol" ? "gol" : r === "parado" ? "parado" : p.tipo === "Post" ? "al palo" : "fuera"}${p.portero ? ` · portero ${p.portero}` : ""} · ${p.minuto}′ · pincha: vídeo en Opta`}</title>
                  </circle>
                  </a>
                );
              })}
            </g>
          );
        }),
      )}
    </svg>
  );
}

function Bloque({ titulo, penaltis, quien }: { titulo: string; penaltis: Penalti[]; quien: string }) {
  if (!penaltis.length) return null;
  const goles = penaltis.filter((p) => p.gol).length;
  const parados = penaltis.filter((p) => p.parado).length;
  const fuera = penaltis.length - goles - parados;
  return (
    <div className="min-w-0">
      <p className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] uppercase tracking-[0.12em] text-white/50">
        <span>{titulo}</span>
        <span className="normal-case tracking-normal text-white/60">
          {[`${penaltis.length} ${penaltis.length === 1 ? "penalti" : "penaltis"}`, goles ? `${goles} ${goles === 1 ? "gol" : "goles"}` : "", parados ? `${parados} ${parados === 1 ? "parado" : "parados"}` : "", fuera ? `${fuera} fuera` : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </p>
      <PorteriaSeis penaltis={penaltis} rotulo={`Penaltis de ${quien}, ${titulo.toLowerCase()}, en seis zonas de la portería`} />
    </div>
  );
}

function Tarjeta({ f }: { f: FichaLanzador }) {
  return (
    <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <header className="mb-2">
        <h4 className="truncate text-sm font-semibold text-white/90">
          {f.tirador}
          {f.pie && <span className="ml-2 text-xs font-normal text-white/50">{f.pie}</span>}
        </h4>
        <p className={`mt-1 text-[13px] leading-snug ${f.cambio ? "text-[color:var(--rmcf-gold-ink)]" : "text-white/75"}`}>{f.linea}</p>
      </header>
      <div className="space-y-3">
        <Bloque titulo="Esta temporada" penaltis={f.esta} quien={f.tirador} />
        <Bloque titulo="Temporadas anteriores" penaltis={f.antes} quien={f.tirador} />
      </div>
    </article>
  );
}

export function PenaltisLanzadores({ equipo }: { equipo: string }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.penaltis, DOCS_OPTA.equipos, DOCS_OPTA.jugadores);
  const { fichas } = useMemo(() => fichasDeDocs(equipo, { penaltis: docs[0], equipos: docs[1], jugadores: docs[2] }), [equipo, docs]);

  if (cargando) return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando sus penaltis" />;
  /* Sin penaltis suyos en Opta, el panel no sale (informes sin huecos). */
  if (!fichas.length) return null;

  return (
    <Panel
      title="Sus lanzadores de penalti"
      subtitle="Para nuestro portero: cada penalti en la portería vista desde el punto (la izquierda es la del lanzador). Sale también en el PDF del portero de la pizarra de ABP."
      icon={CircleDot}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fichas.map((f) => (
          <Tarjeta key={f.tiradorId || f.tirador} f={f} />
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR.gol }} />
          Gol
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR.parado }} />
          Parado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${COLOR.fuera}` }} />
          Fuera o al palo
        </span>
        <span>Fuente: Opta. Zonas: izquierda, centro y derecha del lanzador; raso o arriba.</span>
      </p>
    </Panel>
  );
}
