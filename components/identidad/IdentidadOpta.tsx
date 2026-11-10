"use client";

/**
 * IDENTIDAD EN EL CAMPO · LO QUE DICE OPTA (10/11/2026).
 *
 * Cada principio de la Identidad de Juego que Opta mide con una cifra de
 * equipo defendible: la del Castilla, su puesto en el grupo y en la
 * categoría, el percentil y cómo va en los últimos partidos. El cálculo y el
 * porqué de cada relación están en `lib/opta-identidad.ts`. El dominio
 * (momentum, ~1 MB) sólo se pide al abrir su tarjeta.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import { LeyendaPercentil, colorPercentil, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { formatea } from "@/lib/data-analisis/metricas";
import { BLOQUES } from "@/lib/identidad/campo";
import { DOCS_OPTA, aObjetos, type MetaOpta, type TablaOpta } from "@/lib/opta";
import { gruposDe } from "@/lib/opta-analisis";
import { momentoDe } from "@/lib/opta-eventos";
import { ULTIMOS, dominioOpta, identidadOpta, type MedidaOpta, type Tendencia } from "@/lib/opta-identidad";

const ORO = "var(--rmcf-gold-ink, #C8A96B)";

/** Sin dato, nada (ni guion). */
const cifra = (v: number | null | undefined, m: MedidaOpta["rasgo"]) => (v == null || !Number.isFinite(v) ? "" : formatea(v, m.unidad));

/** «2026-11-08 19:30:00» → «08/11/2026». */
const dia = (iso: string | undefined) => {
  const [a, m, d] = String(iso ?? "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};

const TEXTO_TENDENCIA: Record<Tendencia, { texto: string; color: string }> = {
  mejora: { texto: "mejora", color: "#1B9E77" },
  empeora: { texto: "empeora", color: "#D95F02" },
  estable: { texto: "sin cambio claro", color: tinta(0.55) },
};

/** El partido a partido del Castilla en una línea, con la mediana de la categoría de referencia. */
function Serie({ m }: { m: MedidaOpta }) {
  const pts = m.serie.map((s, i) => ({ ...s, i })).filter((s): s is typeof s & { valor: number } => s.valor != null);
  if (pts.length < 3) return null;
  const an = 300;
  const al = 44;
  const vals = [...pts.map((p) => p.valor), m.mediana];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i: number) => 4 + (i * (an - 8)) / Math.max(1, m.serie.length - 1);
  /* Si menos es mejor, se da la vuelta: arriba siempre es «más nuestro». */
  const y = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return 4 + (m.rasgo.mejorAlto ? 1 - t : t) * (al - 8);
  };
  const camino = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const corte = m.serie.length - ULTIMOS;

  return (
    <svg viewBox={`0 0 ${an} ${al}`} className="mt-1.5 block h-auto w-full max-w-[22rem]" role="img" aria-label={`${m.rasgo.nombre} partido a partido`}>
      {corte > 0 && <rect x={x(corte) - 4} y={0} width={an - x(corte) + 4} height={al} fill={tinta(0.05)} rx={4} />}
      <line x1={0} x2={an} y1={y(m.mediana)} y2={y(m.mediana)} stroke={tinta(0.3)} strokeDasharray="3 3" />
      <path d={camino} fill="none" stroke={ORO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.partido} cx={x(p.i)} cy={y(p.valor)} r={3} fill={ORO}>
          <title>{`${dia(p.fecha)} · ${p.rival}: ${cifra(p.valor, m.rasgo)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Fila({ m }: { m: MedidaOpta }) {
  const color = colorPercentil(m.percentil);
  const t = m.tendencia ? TEXTO_TENDENCIA[m.tendencia] : null;

  return (
    <li className="min-w-0 py-3 first:pt-0 last:pb-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{m.rasgo.principio}</p>
      <div className="mt-0.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[13px] font-medium text-white/90">
          {m.rasgo.nombre}
          {!m.rasgo.mejorAlto && <span className="ml-1 text-[10px] font-normal text-white/40">(menos es mejor)</span>}
        </span>
        <span className="shrink-0 text-[13px] tabular-nums">
          <b className="text-white">{cifra(m.valor, m.rasgo)}</b>
          <b className="ml-2" style={{ color }}>P{m.percentil}</b>
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full" style={{ background: tinta(0.08) }}>
        <span className="absolute inset-y-[-3px] w-px" style={{ left: "50%", background: tinta(0.3) }} aria-hidden />
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, m.percentil)}%`, background: color }} />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-white/55">
        {[
          m.puestoGrupo ? `${m.puestoGrupo}º de ${m.deGrupo} en el grupo` : "",
          `${m.puestoCategoria}º de ${m.deCategoria} en la categoría`,
          `mediana ${cifra(m.mediana, m.rasgo)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-white/45">{m.rasgo.que}</p>
      {m.serie.length > 0 && (
        <>
          <Serie m={m} />
          {m.ultimos != null && m.antes != null && (
            <p className="mt-0.5 text-[11px] tabular-nums text-white/55">
              Últimos {ULTIMOS}: <b className="text-white/80">{cifra(m.ultimos, m.rasgo)}</b> · antes: {cifra(m.antes, m.rasgo)}
              {t && (
                <>
                  {" · "}
                  <span style={{ color: t.color }}>{t.texto}</span>
                </>
              )}
            </p>
          )}
        </>
      )}
    </li>
  );
}

function Dominio({ partidos, grupos }: { partidos: ReturnType<typeof aObjetos>; grupos: Map<string, number> }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.momento);
  const [tMomento] = docs;
  const m = useMemo(() => dominioOpta(momentoDe(tMomento), partidos, grupos), [tMomento, partidos, grupos]);
  if (cargando) return <div className="h-24 animate-pulse rounded-xl bg-white/[0.05]" role="status" aria-label="Cargando el momentum de Opta" />;
  if (!m) return null;
  return (
    <ul>
      <Fila m={m} />
    </ul>
  );
}

export function IdentidadOpta() {
  const { docs, cargando } = useDocsOpta<[MetaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.meta, DOCS_OPTA.equipos, DOCS_OPTA.partidos);
  const [meta, tEquipos, tPartidos] = docs;
  const [verDominio, setVerDominio] = useState(false);

  const grupos = useMemo(() => gruposDe(tPartidos), [tPartidos]);
  const partidos = useMemo(() => aObjetos(tPartidos), [tPartidos]);
  const medidas = useMemo(() => identidadOpta(aObjetos(tEquipos), partidos, grupos), [tEquipos, partidos, grupos]);
  const nuestros = medidas.find((m) => m.serie.length)?.serie.length ?? 0;

  if (cargando) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los datos de Opta" />;
  if (!medidas.length) return null;

  const porBloque = BLOQUES.map((b) => ({ b, ms: medidas.filter((m) => m.rasgo.bloque === b.key) })).filter((x) => x.ms.length);
  const hasta = dia(meta?.temporada?.ultimoPartido);

  return (
    <section className="min-w-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: ORO }}>
        Medido con Opta
      </h2>
      <p className="mt-1 text-[13px] text-white/55">
        Los principios que Opta puede medir con una cifra de equipo, frente a los {medidas[0].deCategoria} equipos de Primera RFEF (los dos grupos). Es otra fuente que la de arriba (Wyscout): cuando
        las dos dicen lo mismo, la lectura es firme.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <LeyendaPercentil poblacion="la categoría" />
        <Link href="/opta?pestana=castilla" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white">
          Área Opta <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {porBloque.map(({ b, ms }) => (
          <article key={b.key} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">{b.fase === "ATAQUE" ? "Con balón" : "Sin balón"}</p>
            <h3 className="text-base font-semibold text-white">{b.label}</h3>
            <ul className="mt-3 divide-y divide-white/10">
              {ms.map((m) => (
                <Fila key={m.rasgo.id} m={m} />
              ))}
            </ul>
          </article>
        ))}

        <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Con balón y sin él</p>
          <h3 className="text-base font-semibold text-white">Dominio del partido</h3>
          <p className="mt-1 text-[12px] text-white/55">No es un principio escrito: resume cuánto del partido vivimos más cerca de su portería que ellos de la nuestra.</p>
          <div className="mt-3">
            {verDominio ? (
              <Dominio partidos={partidos} grupos={grupos} />
            ) : (
              <button
                type="button"
                onClick={() => setVerDominio(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-white/75 hover:text-white"
              >
                <ChevronDown size={14} aria-hidden /> Ver el dominio (carga el momentum de Opta)
              </button>
            )}
          </div>
        </article>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/45">
        Fuente: Opta{hasta ? ` · hasta el partido del ${hasta}` : ""}{nuestros ? ` · ${nuestros} partidos del Castilla` : ""}. La cifra es por partido (los porcentajes y el PPDA, tal cual) y el percentil, contra
        la categoría: más alto, más nuestro. La línea es nuestro partido a partido (arriba, mejor; la raya, la mediana de la categoría; sombreados, los {ULTIMOS} últimos); «mejora» o «empeora»
        sólo cuando la diferencia con los partidos anteriores es mayor que lo que oscila de un partido a otro. No se pintan la transición defensiva (Opta no da por equipo los contraataques del rival)
        ni los pases al hueco (menos de uno por partido: muestra demasiado pequeña).
      </p>
    </section>
  );
}
