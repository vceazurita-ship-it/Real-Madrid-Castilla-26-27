"use client";

/*
| OPTA · PARTIDO A PARTIDO (09/11/2026)
|
| Bloque de «Tendencia»: la evolución del jugador en cada partido de liga con
| `opta:castilla-partidos` (34 métricas por jugador y partido). Se elige la
| métrica; cada punto es un partido con el rival en el eje, la línea dorada es
| la media móvil de los tres últimos y la raya, su media del curso. Las cuentas
| se pueden ver tal cual o por 90′; los porcentajes, tal cual.
|
| Sólo los partidos en los que jugó (minutos > 0). Con menos de dos partidos,
| o si Opta no le tiene, el bloque no se pinta.
*/

import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";

import { DOCS_OPTA, aObjetos, num, traeOpta, type TablaOpta } from "@/lib/opta";
import { METRICAS_PARTIDO, casaOpta, type FilaOpta } from "@/lib/opta-ficha";

const ORO = "#D8B45A";

const coma = (n: number, d: number) => n.toFixed(d).replace(".", ",").replace(/^-/, "−");
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
/** "2026-09-18 19:15:00" → "18/09". */
const diaMes = (iso: string) => {
  const [, mes, resto] = iso.split("-");
  return mes && resto ? `${resto.slice(0, 2)}/${mes}` : iso;
};

export function OptaTendencia({ nombre, apodo }: { nombre: string; apodo?: string }) {
  const [tabla, setTabla] = useState<TablaOpta | null>(null);
  const [elegida, setElegida] = useState("");
  const [por90, setPor90] = useState(false);

  useEffect(() => {
    let vivo = true;
    void traeOpta(DOCS_OPTA.castillaPartidos).then((t) => {
      if (vivo && t?.filas?.length) setTabla(t);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const partidos = useMemo(() => {
    const filas = aObjetos(tabla) as FilaOpta[];
    if (!filas.length) return [];
    /* Un jugador por nombre: se casa contra la lista de nombres distintos. */
    const nombres = [...new Set(filas.map((f) => String(f.jugador ?? "")))].map((jugador) => ({ jugador }));
    const yo = casaOpta(nombre, apodo, nombres);
    if (!yo) return [];
    return filas
      .filter((f) => f.jugador === yo.jugador && (num(f.Min) ?? 0) > 0)
      .sort((a, b) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")));
  }, [tabla, nombre, apodo]);

  const esPortero = partidos.some((f) => (num(f.Saves) ?? 0) > 0 || (num(f.GAg) ?? 0) > 0);
  const opciones = METRICAS_PARTIDO.filter((m) => !esPortero || m.portero);
  const m = opciones.find((x) => x.a === elegida) ?? opciones.find((x) => x.a === (esPortero ? "Saves" : "Touches")) ?? opciones[0];

  if (partidos.length < 2 || !m) return null;

  const normaliza = por90 && !m.pct && m.a !== "Min";
  const puntos = partidos.map((f) => {
    const crudo = num(f[m.a]);
    const min = num(f.Min) ?? 0;
    const v = crudo == null ? null : m.pct ? crudo * 100 : normaliza ? (min > 0 ? (crudo / min) * 90 : null) : crudo;
    return { rival: String(f.rival ?? ""), fecha: diaMes(String(f.fecha ?? "")), min, v };
  });
  const conValor = puntos.filter((p): p is typeof p & { v: number } => p.v != null);
  if (conValor.length < 2) return null;

  /* Media móvil de los tres últimos partidos con valor. */
  const movil = puntos.map((_, i) => {
    const ult = puntos.slice(0, i + 1).filter((p) => p.v != null).slice(-3).map((p) => p.v as number);
    return puntos[i].v == null || !ult.length ? null : media(ult);
  });
  const mediaCurso = media(conValor.map((p) => p.v));
  const ultimos3 = media(conValor.slice(-3).map((p) => p.v));

  const decimales = m.pct ? 1 : Math.max(...conValor.map((p) => Math.abs(p.v))) >= 10 ? 1 : 2;
  const texto = (v: number) => `${coma(v, Number.isInteger(v) && !m.pct ? 0 : decimales)}${m.pct ? " %" : ""}`;

  /* El dibujo. */
  const an = 640;
  const al = 220;
  const izq = 36;
  const der = 12;
  const arriba = 14;
  const abajo = 58;
  const vals = conValor.map((p) => p.v);
  const maxV = m.pct ? 100 : Math.max(...vals) * 1.1 || 1;
  const minV = m.pct ? Math.max(0, Math.min(...vals) - 10) : 0;
  const x = (i: number) => izq + (puntos.length === 1 ? 0 : (i * (an - izq - der)) / (puntos.length - 1));
  const y = (v: number) => arriba + (1 - (v - minV) / (maxV - minV || 1)) * (al - arriba - abajo);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + t * (maxV - minV));
  const tramo = movil
    .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
      <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">
        <LineChart size={15} /> Opta · partido a partido
      </h4>
      <p className="mb-3 mt-1 text-[12px] text-white/55">
        Fuente: Opta, liga. {conValor.length} partidos jugados. Media del curso, <b className="tabular-nums text-white/80">{texto(mediaCurso)}</b>; los 3 últimos, <b className="tabular-nums text-white/80">{texto(ultimos3)}</b>
        {normaliza ? " (por 90′)" : ""}. Línea dorada: media móvil de 3 partidos; raya: su media del curso.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex min-w-0 items-center gap-1.5 text-white/60">
          Métrica
          <select
            value={m.a}
            onChange={(e) => setElegida(e.target.value)}
            className="min-w-0 max-w-[16rem] rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-white"
          >
            {[...new Set(opciones.map((o) => o.grupo))].map((g) => (
              <optgroup key={g} label={g}>
                {opciones.filter((o) => o.grupo === g).map((o) => (
                  <option key={o.a} value={o.a}>{o.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {!m.pct && m.a !== "Min" && (
          <div className="inline-flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Cómo se cuenta">
            {[
              { k: false, t: "En el partido" },
              { k: true, t: "Por 90′" },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                aria-pressed={por90 === o.k}
                onClick={() => setPor90(o.k)}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${por90 === o.k ? "bg-[#D8B45A] text-black" : "text-white/60 hover:text-white"}`}
              >
                {o.t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${an} ${al}`} className="h-auto w-full min-w-[480px]" role="img" aria-label={`${m.nombre} partido a partido`}>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={izq} x2={an - der} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={izq - 4} y={y(v)} fontSize="10" textAnchor="end" dominantBaseline="middle" fill="currentColor" fillOpacity={0.55}>
                {coma(v, maxV - minV < 4 && !m.pct ? 1 : 0)}
              </text>
            </g>
          ))}
          <line x1={izq} x2={an - der} y1={y(mediaCurso)} y2={y(mediaCurso)} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="4 4" />
          <polyline points={tramo} fill="none" stroke={ORO} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {puntos.map((p, i) => (
            <g key={`${p.rival}-${p.fecha}`}>
              {p.v != null && (
                <circle cx={x(i)} cy={y(p.v)} r={4.5} fill="currentColor" fillOpacity={0.85}>
                  <title>{`${p.fecha} · ${p.rival} · ${p.min}′: ${texto(p.v)}${movil[i] != null ? ` · media de 3: ${texto(movil[i] as number)}` : ""}`}</title>
                </circle>
              )}
              <text
                x={x(i)}
                y={al - abajo + 12}
                fontSize="10"
                textAnchor="end"
                fill="currentColor"
                fillOpacity={0.65}
                transform={`rotate(-35 ${x(i)} ${al - abajo + 12})`}
              >
                {p.rival.length > 14 ? `${p.rival.slice(0, 13)}…` : p.rival}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
