"use client";

/*
| RADIOGRAFÍA DE PERCENTILES (05/11/2026)
|
| La «pizza» de percentiles: una cuña por métrica, tan larga como su
| percentil, con el valor por 90 grande y el percentil al lado. A la derecha
| lo que hace con balón y a la izquierda lo que hace sin él, como se leen en
| el campo. Idea de The Eye Intelligence Unit (Radiografía de percentiles).
|
| Es SVG puro y escala con el ancho. Por debajo de 620 px de hueco (móvil y
| tablet en vertical, 18/11/2026, el analista) se dibuja la versión COMPACTA:
| la misma pizza más grande, el percentil fuera de cada cuña y un número
| dentro, y debajo la leyenda en HTML (nombre, valor y percentil) que se lee
| a tamaño de letra normal. Antes, en el móvil se escondía y salían barras.
*/

import { useEffect, useRef, useState } from "react";

export type CunaPercentil = {
  nombre: string;
  /** El valor ya escrito («0,45», «76,7 %»). */
  valor: string;
  percentil: number;
  lado: "con" | "sin";
  ayuda?: string;
  /** La columna de la métrica, para casar a otros jugadores en la misma cuña. */
  clave?: string;
};

/**
 * Otro jugador encima (07/11/2026, «comparar con la élite»): un arco de su
 * color a la altura de su percentil en cada cuña, y su percentil bajo el
 * rótulo. `percentiles` va en el orden de `cunas`; null = sin dato.
 */
export type Superpuesto = { nombre: string; color: string; percentiles: (number | null)[] };

const ANCHO = 1000;
const ALTO = 720;
const CX = ANCHO / 2;
const CY = ALTO / 2;
const R0 = 34;
const R = 210;

function trozo(a0: number, a1: number, r0: number, r1: number) {
  const p = (a: number, r: number) => [CX + Math.sin(a) * r, CY - Math.cos(a) * r];
  const [x0, y0] = p(a0, r1);
  const [x1, y1] = p(a1, r1);
  const [x2, y2] = p(a1, r0);
  const [x3, y3] = p(a0, r0);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${grande} 0 ${x3},${y3} Z`;
}

/** Parte un rótulo largo en dos líneas por el espacio más centrado. */
function dosLineas(texto: string, max = 22): string[] {
  if (texto.length <= max) return [texto];
  const mitad = texto.length / 2;
  let corte = -1;
  for (let i = 0; i < texto.length; i++) if (texto[i] === " " && (corte < 0 || Math.abs(i - mitad) < Math.abs(corte - mitad))) corte = i;
  return corte < 0 ? [texto] : [texto.slice(0, corte), texto.slice(corte + 1)];
}

/** Ancho del hueco que tiene el gráfico (0 hasta medirlo). */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setAncho(Math.round(e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Por debajo de este hueco, los rótulos de la versión ancha bajan de 7 px: se pasa a la compacta. */
const CORTE_COMPACTA = 620;

export function RadiografiaPercentiles(props: { cunas: CunaPercentil[]; acento?: string; centro?: string; superpuestos?: Superpuesto[] }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const compacta = ancho > 0 && ancho < CORTE_COMPACTA;
  return <div ref={ref} className="min-w-0">{compacta ? <RadiografiaCompacta {...props} dosColumnas={ancho >= 560} /> : <RadiografiaAncha {...props} />}</div>;
}

/* ------------------------------------------------------------------ */
/* Compacta: móvil y tablet en vertical                                */
/* ------------------------------------------------------------------ */

const C_CX = 300;
const C_CY = 300;
const C_R0 = 30;
const C_R = 222;

function trozoC(a0: number, a1: number, r0: number, r1: number) {
  const p = (a: number, r: number) => [C_CX + Math.sin(a) * r, C_CY - Math.cos(a) * r];
  const [x0, y0] = p(a0, r1);
  const [x1, y1] = p(a1, r1);
  const [x2, y2] = p(a1, r0);
  const [x3, y3] = p(a0, r0);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${grande} 0 ${x3},${y3} Z`;
}

function RadiografiaCompacta({ cunas, acento = "#EC4899", centro = "/90′", superpuestos = [], dosColumnas = false }: { cunas: CunaPercentil[]; acento?: string; centro?: string; superpuestos?: Superpuesto[]; dosColumnas?: boolean }) {
  const indice = new Map(cunas.map((c, i) => [c, i]));
  const der = cunas.filter((c) => c.lado === "con");
  const izq = cunas.filter((c) => c.lado === "sin");
  /* Con balón de arriba abajo a la derecha; sin balón de abajo arriba a la izquierda (como la ancha). */
  const colocadas = [
    ...der.map((c, i) => ({ c, a0: (Math.PI * i) / der.length, a1: (Math.PI * (i + 1)) / der.length })),
    ...izq.map((c, i) => ({ c, a0: Math.PI + (Math.PI * i) / izq.length, a1: Math.PI + (Math.PI * (i + 1)) / izq.length })),
  ].map((x, n) => ({ ...x, n: n + 1 }));
  if (colocadas.length < 4) return null;
  const numero = new Map(colocadas.map((x) => [x.c, x.n]));
  const pct = (c: CunaPercentil, s: Superpuesto) => s.percentiles[indice.get(c) ?? -1];

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
        <span>← Sin balón</span>
        <span>Con balón →</span>
      </div>
      <svg viewBox="-22 -22 644 644" className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={`Radiografía de percentiles: ${cunas.map((c) => `${c.nombre} p${Math.round(c.percentil)}`).join(", ")}`}>
        <circle cx={C_CX} cy={C_CY} r={C_R + 4} fill="currentColor" fillOpacity={0.04} />
        {colocadas.map(({ c, a0, a1, n }, i) => {
          const p = Math.max(2, Math.min(100, c.percentil));
          const r1 = C_R0 + ((C_R - C_R0) * p) / 100;
          const medio = (a0 + a1) / 2;
          const sx = Math.sin(medio);
          const cy = -Math.cos(medio);
          const rot = C_R + 40;
          const rn = C_R - 22;
          return (
            <g key={c.nombre} className="rp-cuna" style={{ animationDelay: `${i * 45}ms` }}>
              <title>{`${n}. ${c.nombre}: ${c.valor} · percentil ${Math.round(c.percentil)}${c.ayuda ? ` · ${c.ayuda}` : ""}`}</title>
              <path d={trozoC(a0 + 0.014, a1 - 0.014, C_R0, C_R)} fill="currentColor" fillOpacity={0.08} />
              <path d={trozoC(a0 + 0.014, a1 - 0.014, C_R0, r1)} fill={acento} fillOpacity={0.35 + (0.65 * p) / 100} />
              {superpuestos.map((s) => {
                const sp = pct(c, s);
                if (sp == null) return null;
                const rr = C_R0 + ((C_R - C_R0) * Math.max(2, Math.min(100, sp))) / 100;
                const pa = (a: number) => `${C_CX + Math.sin(a) * rr},${C_CY - Math.cos(a) * rr}`;
                return <path key={s.nombre} d={`M${pa(a0 + 0.04)} A${rr},${rr} 0 0 1 ${pa(a1 - 0.04)}`} fill="none" stroke={s.color} strokeWidth={6} strokeLinecap="round" />;
              })}
              {/* El número que casa con la leyenda, dentro del borde de la cuña. */}
              <text x={C_CX + sx * rn} y={C_CY + cy * rn + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor" fillOpacity={0.75}>{n}</text>
              {/* El percentil, fuera: lo primero que se lee. */}
              <text x={C_CX + sx * rot} y={C_CY + cy * rot + 10} textAnchor="middle" fontSize="30" fontWeight="800" fill={acento}>{Math.round(c.percentil)}</text>
            </g>
          );
        })}
        <circle cx={C_CX} cy={C_CY} r={C_R0 + (C_R - C_R0) / 2} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 5" />
        <line x1={C_CX} y1={C_CY - C_R - 8} x2={C_CX} y2={C_CY + C_R + 8} stroke="currentColor" strokeOpacity={0.3} />
        <circle cx={C_CX} cy={C_CY} r={C_R0 - 3} fill="#0B0F14" stroke="currentColor" strokeOpacity={0.4} />
        <text x={C_CX} y={C_CY + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">{centro}</text>
        <style>{`.rp-cuna{animation:rp-entra .6s ease-out both}@keyframes rp-entra{from{opacity:0}to{opacity:1}}`}</style>
      </svg>
      {/* La leyenda: lo que en la ancha va en los rótulos, aquí a letra normal. */}
      {/* Dos columnas sólo con hueco de verdad (≥ 560 px): con menos, los nombres se cortaban. */}
      <div className={`mt-2 grid gap-x-6 gap-y-3 ${dosColumnas ? "grid-cols-2" : ""}`}>
        {([["con", der], ["sin", izq]] as const).map(([lado, lista]) =>
          lista.length === 0 ? null : (
            <div key={lado} className="min-w-0">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">{lado === "con" ? "Con balón" : "Sin balón"}</p>
              <ul className="space-y-1">
                {lista.map((c) => (
                  <li key={c.nombre} className="flex min-w-0 items-baseline gap-2 text-[13px]" title={c.ayuda}>
                    <span className="w-5 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/45">{numero.get(c)}</span>
                    <span className="min-w-0 flex-1 truncate text-white/80">{c.nombre}</span>
                    <span className="shrink-0 tabular-nums">
                      <b className="text-white">{c.valor}</b> <b style={{ color: acento }}>P{Math.round(c.percentil)}</b>
                      {superpuestos.map((s) => {
                        const sp = pct(c, s);
                        return sp == null ? null : (
                          <b key={s.nombre} className="ml-1.5" style={{ color: s.color }}>{Math.round(sp)}</b>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
      {superpuestos.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60">
          <span><b style={{ color: acento }}>■</b> él</span>
          {superpuestos.map((s) => (
            <span key={s.nombre}><b style={{ color: s.color }}>■</b> {s.nombre}</span>
          ))}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ancha: escritorio y tablet en horizontal                            */
/* ------------------------------------------------------------------ */

function RadiografiaAncha({ cunas, acento = "#EC4899", centro = "/90′", superpuestos = [] }: { cunas: CunaPercentil[]; acento?: string; centro?: string; superpuestos?: Superpuesto[] }) {
  const indice = new Map(cunas.map((c, i) => [c, i]));
  const der = cunas.filter((c) => c.lado === "con");
  const izq = cunas.filter((c) => c.lado === "sin");

  /* Cada lado ocupa medio círculo; las cuñas se reparten dentro de su mitad. */
  const colocadas = [
    ...der.map((c, i) => ({ c, fila: i, total: der.length, a0: (Math.PI * i) / der.length, a1: (Math.PI * (i + 1)) / der.length })),
    ...izq.map((c, i) => ({ c, fila: izq.length - 1 - i, total: izq.length, a0: Math.PI + (Math.PI * i) / izq.length, a1: Math.PI + (Math.PI * (i + 1)) / izq.length })),
  ];

  if (colocadas.length < 4) return null;

  return (
    <svg viewBox={`-40 100 ${ANCHO + 80} ${ALTO - 180}`} className="grafico-cabe-alto h-auto w-full" role="img" aria-label={`Radiografía de percentiles: ${cunas.map((c) => `${c.nombre} p${Math.round(c.percentil)}`).join(", ")}`}>
      <defs>
        <radialGradient id="rp-halo">
          <stop offset="55%" stopColor={acento} stopOpacity="0.10" />
          <stop offset="100%" stopColor={acento} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r={R + 70} fill="url(#rp-halo)" />
      <circle cx={CX} cy={CY} r={R + 4} fill="currentColor" fillOpacity={0.04} />

      {colocadas.map(({ c, a0, a1, fila, total }, i) => {
        const p = Math.max(2, Math.min(100, c.percentil));
        const r1 = R0 + ((R - R0) * p) / 100;
        const intensidad = 0.35 + (0.65 * p) / 100;
        const medio = (a0 + a1) / 2;
        const dch = medio < Math.PI;
        const ax = CX + Math.sin(medio) * (R + 6);
        const ay = CY - Math.cos(medio) * (R + 6);
        const lx = dch ? CX + R + 62 : CX - R - 62;
        /* Alturas fijas por lado (05/11/2026): por el coseno, los de arriba y abajo se pisaban. */
        const ly = total < 2 ? CY : CY - R - 6 + (fila * (2 * R + 30)) / (total - 1);
        const lineas = dosLineas(c.nombre.toUpperCase(), 18);

        return (
          <g key={c.nombre} className="rp-cuna" style={{ animationDelay: `${i * 45}ms` }}>
            <title>{`${c.nombre}: ${c.valor} · percentil ${Math.round(c.percentil)}${superpuestos.map((s) => { const sp = s.percentiles[indice.get(c) ?? -1]; return sp == null ? "" : ` · ${s.nombre} ${Math.round(sp)}`; }).join("")}${c.ayuda ? ` · ${c.ayuda}` : ""}`}</title>
            {/* El fondo de la cuña entera: dónde está el techo. */}
            <path d={trozo(a0 + 0.012, a1 - 0.012, R0, R)} fill="currentColor" fillOpacity={0.07} />
            <path d={trozo(a0 + 0.012, a1 - 0.012, R0, r1)} fill={acento} fillOpacity={intensidad} />
            {/* Los superpuestos: un arco de su color a la altura de su percentil. */}
            {superpuestos.map((s) => {
              const sp = s.percentiles[indice.get(c) ?? -1];
              if (sp == null) return null;
              const rr = R0 + ((R - R0) * Math.max(2, Math.min(100, sp))) / 100;
              const pa = (a: number) => `${CX + Math.sin(a) * rr},${CY - Math.cos(a) * rr}`;
              return <path key={s.nombre} d={`M${pa(a0 + 0.03)} A${rr},${rr} 0 0 1 ${pa(a1 - 0.03)}`} fill="none" stroke={s.color} strokeWidth={5} strokeLinecap="round" />;
            })}
            <circle cx={ax} cy={ay} r={3.5} fill="currentColor" fillOpacity={0.7} />
            <polyline points={`${ax},${ay} ${dch ? lx - 14 : lx + 14},${ly}`} fill="none" stroke="currentColor" strokeOpacity={0.35} />
            <text x={lx} y={ly - 6} textAnchor={dch ? "start" : "end"} fontSize="38" fontWeight="800" fill="currentColor">
              {c.valor}
            </text>
            {lineas.map((l, k) => (
              <text key={k} x={lx} y={ly + 20 + k * 20} textAnchor={dch ? "start" : "end"} fontSize="18" fontWeight="700" letterSpacing="0.02em" fill="currentColor" fillOpacity={0.6}>
                {l}
                {k === lineas.length - 1 && (
                  <tspan fill={acento} fillOpacity={1} fontWeight="800">{` · P${Math.round(c.percentil)}`}</tspan>
                )}
                {/* Los superpuestos, en la misma línea (una línea aparte se montaba sobre la cifra de la métrica siguiente). */}
                {/* Con uno solo: con dos o tres el rótulo se saldría del gráfico (se leen en el arco y en el título). */}
                {k === lineas.length - 1 &&
                  superpuestos.length === 1 &&
                  superpuestos.map((s) => {
                    const sp = s.percentiles[indice.get(c) ?? -1];
                    return sp == null ? null : (
                      <tspan key={s.nombre} fill={s.color} fillOpacity={1} fontWeight="800">{`  ● ${Math.round(sp)}`}</tspan>
                    );
                  })}
              </text>
            ))}
          </g>
        );
      })}

      {/* La mitad: 50 es lo normal en su puesto. */}
      <circle cx={CX} cy={CY} r={R0 + (R - R0) / 2} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 5" />
      <line x1={CX} y1={CY - R - 14} x2={CX} y2={CY + R + 14} stroke="currentColor" strokeOpacity={0.25} />
      <text x={CX + 10} y={CY - R - 22} fontSize="13" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>CON BALÓN →</text>
      <text x={CX - 10} y={CY - R - 22} textAnchor="end" fontSize="13" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>← SIN BALÓN</text>
      <circle cx={CX} cy={CY} r={R0 - 4} fill="#0B0F14" stroke="currentColor" strokeOpacity={0.4} />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">{centro}</text>
      <style>{`.rp-cuna{animation:rp-entra .6s ease-out both}@keyframes rp-entra{from{opacity:0}to{opacity:1}}`}</style>
    </svg>
  );
}
