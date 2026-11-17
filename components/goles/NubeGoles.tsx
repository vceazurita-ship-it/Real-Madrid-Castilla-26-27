"use client";

/*
|--------------------------------------------------------------------------
| ¿DÓNDE ESTÁ EN LA LIGA? LA NUBE DE GOLES (17/11/2026, ronda 19)
|--------------------------------------------------------------------------
|
| Los jueces (análisis, fútbol y marketing): «el mapa de dispersión es
| ilegible en el móvil (escudos amontonados, letra de 8 px, “RM Castill”
| cortado), las rayas son medianas y los textos hablan de la media, y no dice
| qué cuadrante es bueno». Ésta es la nube propia de /analisis-goles:
|
| - el lienzo mide lo que mide su caja (la letra va en píxeles de verdad: 11
|   como mínimo en el móvil);
| - las rayas son las MEDIAS de la liga, la misma población que el titular;
| - rótulo sólo para el equipo elegido, el comparado y los extremos;
| - en las esquinas, qué quiere decir cada cuadrante (abajo a la derecha,
|   marca más y encaja menos).
|
| `Dispersion` de components/data/graficas.tsx sigue igual para el resto.
*/

import { useEffect, useRef, useState } from "react";

import { useEscudos } from "@/hooks/useEscudos";

export type PuntoNube = { equipo: string; x: number; y: number };

const ORO = "#C8A96B";
const AZUL = "#4F8FE8";

const coma = (v: number) => v.toFixed(1).replace(".", ",");

export function NubeGoles({
  puntos,
  destacado,
  comparado,
  alPulsar,
}: {
  puntos: PuntoNube[];
  destacado: string;
  comparado?: string;
  alPulsar?: (equipo: string) => void;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  const [encima, setEncima] = useState<PuntoNube | null>(null);
  const escudoDe = useEscudos();

  useEffect(() => {
    const el = caja.current;

    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  if (puntos.length < 2) return null;

  const estrecho = W < 480;
  const H = Math.round(Math.min(440, Math.max(300, W * 0.7)));
  const M = { arriba: 26, derecha: 14, abajo: 46, izquierda: 44 };
  const dentroW = W - M.izquierda - M.derecha;
  const dentroH = H - M.arriba - M.abajo;

  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const rango = (v: number[]) => {
    const min = Math.min(...v);
    const max = Math.max(...v);
    const aire = (max - min) * 0.12 || 0.5;

    return { min: min - aire, max: max + aire };
  };
  const rx = rango(xs);
  const ry = rango(ys);
  const px = (v: number) => M.izquierda + ((v - rx.min) / (rx.max - rx.min)) * dentroW;
  const py = (v: number) => M.arriba + dentroH - ((v - ry.min) / (ry.max - ry.min)) * dentroH;
  const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = media(xs);
  const my = media(ys);

  const extremos = new Set<string>();
  if (puntos.length > 3) {
    const por = (f: (p: PuntoNube) => number) => [...puntos].sort((a, b) => f(a) - f(b));
    const ox = por((p) => p.x);
    const oy = por((p) => p.y);

    for (const p of [ox[ox.length - 1], oy[0]]) if (p) extremos.add(p.equipo);
  }

  const lado = estrecho ? 18 : 24;
  const ladoGrande = estrecho ? 24 : 30;
  const orden = [...puntos].sort((a, b) => Number(a.equipo === destacado || a.equipo === comparado) - Number(b.equipo === destacado || b.equipo === comparado));

  return (
    <div ref={caja} className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto max-w-full" role="img" aria-label={`Goles en contra frente a goles a favor por partido, un punto por equipo; ${destacado}: ${coma(puntos.find((p) => p.equipo === destacado)?.x ?? 0)} a favor y ${coma(puntos.find((p) => p.equipo === destacado)?.y ?? 0)} en contra`}>
        {/* Las esquinas: qué quiere decir cada cuadrante. */}
        <rect x={px(mx)} y={py(my)} width={M.izquierda + dentroW - px(mx)} height={M.arriba + dentroH - py(my)} fill="var(--rmcf-dif-mejor, #2e7d32)" opacity={0.06} />
        <rect x={M.izquierda} y={M.arriba} width={px(mx) - M.izquierda} height={py(my) - M.arriba} fill="var(--rmcf-dif-peor, #c62828)" opacity={0.05} />
        <text x={M.izquierda + dentroW - 4} y={M.arriba + dentroH - 6} textAnchor="end" fontSize={11} fontWeight={600} style={{ fill: "var(--rmcf-dif-mejor, #2e7d32)" }}>
          Marca más, encaja menos
        </text>
        <text x={M.izquierda + 4} y={M.arriba + 12} fontSize={11} fontWeight={600} style={{ fill: "var(--rmcf-dif-peor, #c62828)" }}>
          Marca menos, encaja más
        </text>

        {/* Las medias de la liga (la misma población que el titular). */}
        <line x1={px(mx)} x2={px(mx)} y1={M.arriba} y2={M.arriba + dentroH} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 3" />
        <line x1={M.izquierda} x2={M.izquierda + dentroW} y1={py(my)} y2={py(my)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 3" />

        {/* Ejes y sus marcas: el mínimo, la media y el máximo de la liga. */}
        <line x1={M.izquierda} x2={M.izquierda + dentroW} y1={M.arriba + dentroH} y2={M.arriba + dentroH} stroke="currentColor" strokeOpacity={0.25} />
        <line x1={M.izquierda} x2={M.izquierda} y1={M.arriba} y2={M.arriba + dentroH} stroke="currentColor" strokeOpacity={0.25} />
        {[Math.min(...xs), mx, Math.max(...xs)].map((v, i) => (
          <text key={`x${i}`} x={px(v)} y={M.arriba + dentroH + 15} textAnchor="middle" fontSize={11} fontWeight={i === 1 ? 700 : 400} fill="currentColor" fillOpacity={i === 1 ? 0.75 : 0.6}>
            {i === 1 ? `media ${coma(v)}` : coma(v)}
          </text>
        ))}
        {[Math.min(...ys), my, Math.max(...ys)].map((v, i) => (
          <text key={`y${i}`} x={M.izquierda - 5} y={py(v) + 4} textAnchor="end" fontSize={11} fontWeight={i === 1 ? 700 : 400} fill="currentColor" fillOpacity={i === 1 ? 0.75 : 0.6}>
            {coma(v)}
          </text>
        ))}
        <text x={M.izquierda + dentroW / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.7}>
          {estrecho ? "A favor por partido →" : "Goles a favor por partido →"}
        </text>
        <text x={12} y={M.arriba + dentroH / 2} textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.7} transform={`rotate(-90 12 ${M.arriba + dentroH / 2})`}>
          {estrecho ? "En contra / partido →" : "Goles en contra por partido →"}
        </text>

        {orden.map((p) => {
          const esYo = p.equipo === destacado;
          const esOtro = !!comparado && p.equipo === comparado;
          const l = esYo || esOtro ? ladoGrande : lado;
          const cx = px(p.x);
          const cy = py(p.y);
          const escudo = escudoDe(p.equipo);
          /* 17/11/2026 (ronda 20, fútbol): a 390 px los rótulos se pisaban; en estrecho sólo lleva rótulo el elegido, sacado del grupo con una línea guía, y el comparado va al pie. */
          const rotulo = estrecho ? esYo : esYo || esOtro || extremos.has(p.equipo);
          const ancla = cx < M.izquierda + 70 ? "start" : cx > W - M.derecha - 70 ? "end" : "middle";
          const fueraX = estrecho && esYo ? Math.max(M.izquierda + 4, Math.min(W - M.derecha - 4, cx + (cx < W / 2 ? 46 : -46))) : cx;
          const fueraY = estrecho && esYo ? Math.max(M.arriba + 24, cy - l / 2 - 34) : cy - l / 2 - 6;
          const anclaFuera = estrecho && esYo ? (cx < W / 2 ? "start" : "end") : ancla;

          return (
            <g key={p.equipo}>
              <circle cx={cx} cy={cy} r={l / 2 + 2} fill="var(--rmcf-surface, #11161C)" stroke={esYo ? ORO : esOtro ? AZUL : "currentColor"} strokeOpacity={esYo || esOtro ? 1 : 0.2} strokeWidth={esYo || esOtro ? 2.5 : 1} />
              {escudo ? (
                <image href={escudo} x={cx - l / 2} y={cy - l / 2} width={l} height={l} preserveAspectRatio="xMidYMid meet" />
              ) : (
                <circle cx={cx} cy={cy} r={l / 3} fill={esYo ? ORO : esOtro ? AZUL : "currentColor"} fillOpacity={esYo || esOtro ? 1 : 0.35} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={l / 2 + 4}
                fill="transparent"
                onMouseEnter={() => setEncima(p)}
                onMouseLeave={() => setEncima(null)}
                onClick={() => {
                  setEncima(p);
                  alPulsar?.(p.equipo);
                }}
                style={{ cursor: alPulsar ? "pointer" : "default" }}
              >
                <title>{`${p.equipo}: ${coma(p.x)} a favor y ${coma(p.y)} en contra por partido`}</title>
              </circle>
              {rotulo && estrecho && esYo ? (
                <line x1={cx} y1={cy - l / 2 - 2} x2={fueraX} y2={fueraY + 3} stroke={ORO} strokeWidth={1.5} pointerEvents="none" />
              ) : null}
              {rotulo ? (
                <text
                  x={fueraX}
                  y={fueraY}
                  textAnchor={anclaFuera}
                  fontSize={esYo || esOtro ? 12 : 11}
                  fontWeight={esYo || esOtro ? 700 : 500}
                  style={{ fill: esYo ? "var(--rmcf-gold-ink, #8a6d2f)" : esOtro ? AZUL : "currentColor" }}
                  fillOpacity={esYo || esOtro ? 1 : 0.7}
                  pointerEvents="none"
                >
                  {p.equipo}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {estrecho && comparado ? (
        <p className="mt-1 flex items-center gap-1.5 text-[12px] tabular-nums text-white/75">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: AZUL }} aria-hidden />
          <span className="font-semibold" style={{ color: AZUL }}>{comparado}</span>
          {(() => {
            const c = puntos.find((p) => p.equipo === comparado);
            return c ? `: ${coma(c.x)} a favor y ${coma(c.y)} en contra por partido` : "";
          })()}
        </p>
      ) : null}
      <p className="mt-1 min-h-4 text-[12px] tabular-nums text-white/60">
        {encima
          ? `${encima.equipo}: ${coma(encima.x)} a favor y ${coma(encima.y)} en contra por partido`
          : "Cada escudo es un equipo; las rayas, las medias de la liga. Tócalo para verlo."}
      </p>
    </div>
  );
}
