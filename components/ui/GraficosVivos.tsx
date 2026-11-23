"use client";

/**
 * GRÁFICOS PEQUEÑOS CON VIDA (22/11/2026). SVG y CSS propios, sin librerías.
 *
 * - `Sparkline`: curva suave (Catmull-Rom), área con degradado, brillo
 *   (filtro SVG) y el último dato con su onda «en vivo».
 * - `Variacion`: flecha y color de cuánto cambió lo último.
 * - `AnilloVivo`: anillo de progreso con degradado de marca y halo, que se
 *   dibuja al entrar en pantalla.
 *
 * Todos llevan role="img" y un aria-label con los datos. Con
 * prefers-reduced-motion no se mueven (efectos.css).
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

/* Oro de la tinta del tema: en modo día se oscurece para llegar a 3:1 sobre blanco. */
const ORO = "var(--rmcf-gold-ink)";
const ORO_CLARO = "#E3C98F";

/** Catmull-Rom → curvas de Bézier cúbicas: pasa por todos los puntos sin picos. */
export function curvaSuave(p: [number, number][]): string {
  if (p.length === 0) return "";
  if (p.length === 1) return `M${p[0][0]},${p[0][1]}`;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}

/** Se dibuja una sola vez, al entrar en pantalla. */
function useVisto<T extends Element>() {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisto(true));
      return () => cancelAnimationFrame(id);
    }
    const ob = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setVisto(true);
        ob.disconnect();
      }
    }, { threshold: 0.3 });
    ob.observe(el);
    return () => ob.disconnect();
  }, [visto]);
  return [ref, visto] as const;
}

export function Sparkline({
  valores,
  descripcion,
  ancho = 160,
  alto = 44,
  color = ORO,
}: {
  valores: number[];
  /** Lo que oye el lector de pantalla, con los datos. */
  descripcion: string;
  ancho?: number;
  alto?: number;
  color?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ref, visto] = useVisto<SVGSVGElement>();
  /* Se dibuja a su ancho real, medido: estirado, los puntos salían ovalados. */
  const caja = useRef<HTMLDivElement>(null);
  const [medido, setMedido] = useState(0);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ob = new ResizeObserver(([e]) => setMedido(Math.round(e.contentRect.width)));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  if (valores.length < 2) return null;
  ancho = medido || ancho;
  const max = Math.max(...valores);
  const min = Math.min(0, ...valores);
  const rango = max - min || 1;
  const m = 5;
  const pts: [number, number][] = valores.map((v, i) => [
    m + (i / (valores.length - 1)) * (ancho - 2 * m),
    m + (1 - (v - min) / rango) * (alto - 2 * m),
  ]);
  const linea = curvaSuave(pts);
  const area = `${linea} L${pts[pts.length - 1][0]},${alto} L${pts[0][0]},${alto} Z`;
  const [ux, uy] = pts[pts.length - 1];
  return (
    <div ref={caja} className="w-full">
    <svg ref={ref} role="img" aria-label={descripcion} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="block max-w-full overflow-visible">
      <defs>
        <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.35 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.55 }} />
          <stop offset="100%" style={{ stopColor: color }} />
        </linearGradient>
        <filter id={`g${id}`} x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={area} fill={`url(#a${id})`} className={visto ? "grafico-funde" : "opacity-0"} />
      <path
        d={linea}
        fill="none"
        stroke={`url(#l${id})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#g${id})`}
        pathLength={1}
        className={visto ? "grafico-traza" : "opacity-0"}
      />
      <circle className="punto-vivo" cx={ux} cy={uy} r={3.5} style={{ fill: color }} />
      <circle cx={ux} cy={uy} r={3.5} strokeWidth={1.5} style={{ fill: color, stroke: "var(--background)" }} />
    </svg>
    </div>
  );
}

/** «▲ 3 frente a la semana anterior», en verde o naranja según qué sea mejor. */
export function Variacion({ actual, anterior, mejorAlto = true, texto }: { actual: number; anterior: number; mejorAlto?: boolean; texto?: string }) {
  const d = actual - anterior;
  const bien = d === 0 ? null : (d > 0) === mejorAlto;
  const Icono = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : ArrowRight;
  const color = bien == null ? "rgb(var(--rmcf-ink-rgb) / 0.6)" : bien ? "var(--rmcf-dif-mejor)" : "var(--rmcf-dif-peor)";
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums" style={{ color }}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {d > 0 ? "+" : d < 0 ? "−" : ""}
      {Math.abs(d).toLocaleString("es-ES")}
      {texto && <span className="font-normal opacity-80">&nbsp;{texto}</span>}
    </span>
  );
}

export function AnilloVivo({
  pct,
  lado = 40,
  grosor = 4,
  descripcion,
  children,
}: {
  pct: number;
  lado?: number;
  grosor?: number;
  descripcion?: string;
  children?: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ref, visto] = useVisto<SVGSVGElement>();
  const r = (lado - grosor) / 2 - 1;
  const largo = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const c = lado / 2;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: lado, height: lado }}>
      <svg
        ref={ref}
        width={lado}
        height={lado}
        viewBox={`0 0 ${lado} ${lado}`}
        className="-rotate-90 overflow-visible"
        {...(descripcion ? { role: "img", "aria-label": descripcion } : { "aria-hidden": true })}
      >
        <defs>
          <linearGradient id={`r${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: ORO_CLARO }} />
            <stop offset="100%" style={{ stopColor: ORO }} />
          </linearGradient>
          <filter id={`h${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={grosor * 0.9} />
          </filter>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={grosor} style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .12)" }} />
        {/* El halo: la misma pista, desenfocada y tenue. */}
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={grosor} strokeLinecap="round" style={{ stroke: ORO, strokeOpacity: 0.45 }} filter={`url(#h${id})`} strokeDasharray={largo} strokeDashoffset={visto ? largo * (1 - p / 100) : largo} className="anillo-traza" />
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={grosor} strokeLinecap="round" stroke={`url(#r${id})`} strokeDasharray={largo} strokeDashoffset={visto ? largo * (1 - p / 100) : largo} className="anillo-traza" />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}
