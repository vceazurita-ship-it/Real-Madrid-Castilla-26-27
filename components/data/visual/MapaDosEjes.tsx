"use client";

/*
| MAPA DE DOS EJES (05/11/2026)
|
| Cada eje es un percentil 0-100 dentro de su grupo (su puesto, o la liga en
| el caso de equipos). Las diagonales suman los dos (100, 130, 160) y la
| esquina de arriba a la derecha (≥ 160) es la élite en las dos cosas. Las
| esquinas llevan nombre: «completos», «solo X», «solo Y» y «sin destacar
| todavía». Idea de @AlexDeLlano y The Eye Intelligence Unit.
|
| Lo nuestro se ve siempre: punto grande, anillo y rótulo. De los demás se
| rotulan sólo los que dicen algo (élite, mejor en cada eje) para que el mapa
| no sea una sopa de nombres.
*/

import { useState } from "react";

export type PuntoMapa = {
  id: string;
  nombre: string;
  /** Percentil 0-100. */
  x: number;
  y: number;
  /** El nuestro (o los nuestros): siempre a la vista. */
  propio?: boolean;
  detalle?: string;
  color?: string;
};

const W = 760;
const H = 560;
const M = { l: 58, r: 24, t: 44, b: 52 };
const ancho = W - M.l - M.r;
const alto = H - M.t - M.b;
const px = (v: number) => M.l + (v / 100) * ancho;
const py = (v: number) => M.t + alto - (v / 100) * alto;

/** Correlación de rangos (Spearman): ¿miden lo mismo los dos ejes? */
function spearman(puntos: PuntoMapa[]) {
  const n = puntos.length;
  if (n < 5) return null;
  const rango = (vals: number[]) => {
    const orden = vals.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(n);
    orden.forEach(([, i], k) => (r[i] = k));
    return r;
  };
  const rx = rango(puntos.map((p) => p.x));
  const ry = rango(puntos.map((p) => p.y));
  const d2 = rx.reduce((s, v, i) => s + (v - ry[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export function MapaDosEjes({
  puntos,
  ejeX,
  ejeY,
  rotulos,
  acento = "#D8B45A",
  umbral = 160,
}: {
  puntos: PuntoMapa[];
  ejeX: string;
  ejeY: string;
  rotulos: { ambos: string; soloX: string; soloY: string; nada: string };
  acento?: string;
  umbral?: number;
}) {
  const [encima, setEncima] = useState<string | null>(null);

  if (puntos.length < 5) return null;

  const elite = puntos.filter((p) => p.x + p.y >= umbral);
  const mejorAmbos = [...puntos].sort((a, b) => b.x + b.y - (a.x + a.y))[0];
  /* «Puro»: el que más destaca en un eje sin el otro. */
  const mejorX = [...puntos].sort((a, b) => b.x - b.y - (a.x - a.y))[0];
  const mejorY = [...puntos].sort((a, b) => b.y - b.x - (a.y - a.x))[0];
  const rotulados = new Set([...elite.map((p) => p.id), mejorX.id, mejorY.id, mejorAmbos.id, ...puntos.filter((p) => p.propio).map((p) => p.id)]);
  const rho = spearman(puntos);

  const diagonal = (s: number) => {
    /* x + y = s dentro del cuadro 0-100. */
    const a = [Math.max(0, s - 100), Math.min(100, s)];
    const b = [Math.min(100, s), Math.max(0, s - 100)];
    return { x1: px(a[0]), y1: py(a[1]), x2: px(b[0]), y2: py(b[1]) };
  };

  const ordenados = [...puntos].sort((a, b) => Number(Boolean(a.propio)) - Number(Boolean(b.propio)));

  /* Choques entre rótulos (05/11/2026): «Pol Fortuny» y «M. Valle» se escribían uno encima del otro. */
  const cajas: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const conRotulo = new Set<string>();
  const prioridad = [...puntos].sort((a, b) => Number(Boolean(b.propio)) - Number(Boolean(a.propio)) || b.x + b.y - (a.x + a.y));
  for (const p of prioridad) {
    if (!rotulados.has(p.id) && encima !== p.id) continue;
    const t = p.propio ? 14 : 11;
    const w = p.nombre.length * t * 0.56;
    const derecha = p.x <= 85;
    const x0 = derecha ? px(p.x) + 10 : px(p.x) - 10 - w;
    const y1 = py(p.y) - (p.propio ? 12 : 7) + 3;
    const caja = { x0, x1: x0 + w, y0: y1 - t, y1 };
    if (!p.propio && encima !== p.id && cajas.some((c) => c.x0 < caja.x1 && caja.x0 < c.x1 && c.y0 < caja.y1 && caja.y0 < c.y1)) continue;
    cajas.push(caja);
    conRotulo.add(p.id);
  }
  const activo = puntos.find((p) => p.id === encima);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[860px]" role="img" aria-label={`${ejeY} frente a ${ejeX}`} onMouseLeave={() => setEncima(null)}>
        {/* La élite: el triángulo de arriba a la derecha. */}
        <polygon points={`${px(umbral - 100)},${py(100)} ${px(100)},${py(100)} ${px(100)},${py(umbral - 100)}`} fill={acento} fillOpacity={0.14} />
        <line {...diagonal(umbral)} stroke={acento} strokeWidth={2} />

        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={py(0)} y2={py(100)} stroke="currentColor" strokeOpacity={v === 50 ? 0.22 : 0.08} />
            <line x1={px(0)} x2={px(100)} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={v === 50 ? 0.22 : 0.08} />
            <text x={px(v)} y={py(0) + 18} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.5}>{v}</text>
            <text x={px(0) - 8} y={py(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity={0.5}>{v}</text>
          </g>
        ))}

        {[100, 130].map((s) => (
          <g key={s}>
            <line {...diagonal(s)} stroke="currentColor" strokeOpacity={0.22} strokeDasharray="5 5" />
            <text x={px(s / 2) + 6} y={py(s / 2) - 6} fontSize="10" fill="currentColor" fillOpacity={0.45} transform={`rotate(36 ${px(s / 2)} ${py(s / 2)})`}>{`suma ${s}`}</text>
          </g>
        ))}

        <text x={px(99)} y={py(Math.min(98, umbral - 100 + 22))} textAnchor="end" fontSize="13" fontWeight="800" letterSpacing="0.16em" fill={acento}>{rotulos.ambos.toUpperCase()}</text>
        <text x={px(0)} y={M.t - 12} fontSize="11" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>{`↑ ${rotulos.soloY.toUpperCase()}`}</text>
        <text x={px(98)} y={py(3)} textAnchor="end" fontSize="11" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>{rotulos.soloX.toUpperCase()}</text>
        <text x={px(2)} y={py(3)} fontSize="11" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.4}>{rotulos.nada.toUpperCase()}</text>

        {ordenados.map((p, i) => {
          const propio = Boolean(p.propio);
          const color = p.color ?? (propio ? acento : "currentColor");
          const rotular = conRotulo.has(p.id);
          return (
            <g key={p.id} className="md-punto" style={{ animationDelay: `${Math.min(i, 60) * 12}ms` }} onMouseEnter={() => setEncima(p.id)}>
              {propio && <circle cx={px(p.x)} cy={py(p.y)} r={13} fill="none" stroke={acento} strokeWidth={2} className="md-pulso" />}
              <circle cx={px(p.x)} cy={py(p.y)} r={propio ? 7.5 : 4.2} fill={color} fillOpacity={propio ? 1 : rotular ? 0.85 : 0.35} stroke={propio ? "#fff" : "none"} strokeWidth={1.5}>
                <title>{`${p.nombre}${p.detalle ? ` · ${p.detalle}` : ""} · ${ejeX} ${Math.round(p.x)} · ${ejeY} ${Math.round(p.y)}`}</title>
              </circle>
              {rotular && (
                <text x={px(p.x) + (p.x > 85 ? -10 : 10)} y={py(p.y) - (propio ? 12 : 7)} textAnchor={p.x > 85 ? "end" : "start"} fontSize={propio ? 14 : 11} fontWeight={propio ? 800 : 600} fill={propio ? acento : "currentColor"} fillOpacity={propio ? 1 : 0.85}>
                  {p.nombre}
                </text>
              )}
            </g>
          );
        })}

        <text x={px(50)} y={H - 10} textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="0.12em" fill="currentColor" fillOpacity={0.75}>{`${ejeX.toUpperCase()} · PERCENTIL`}</text>
        <text x={16} y={py(50)} textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="0.12em" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 16 ${py(50)})`}>{`${ejeY.toUpperCase()} · PERCENTIL`}</text>
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/60">
        <span><b style={{ color: acento }}>Mejor en ambas:</b> {mejorAmbos.nombre} ({Math.round(mejorAmbos.x)} / {Math.round(mejorAmbos.y)})</span>
        <span><b className="text-white/80">Más «{rotulos.soloX.toLowerCase()}»:</b> {mejorX.nombre}</span>
        <span><b className="text-white/80">Más «{rotulos.soloY.toLowerCase()}»:</b> {mejorY.nombre}</span>
        <span>{elite.length} de {puntos.length} en la zona de élite (suma ≥ {umbral})</span>
        {rho !== null && (
          <span title="Correlación de rangos de Spearman entre los dos ejes">
            Relación entre ejes {rho.toFixed(2).replace(".", ",")}: {Math.abs(rho) < 0.3 ? "casi independientes, separan perfiles" : Math.abs(rho) < 0.6 ? "algo ligados" : "muy ligados, miden casi lo mismo"}
          </span>
        )}
      </div>
      {activo && !activo.propio && <p className="text-[12px] text-white/70">{activo.nombre}{activo.detalle ? ` · ${activo.detalle}` : ""} · {Math.round(activo.x)} / {Math.round(activo.y)}</p>}

      <style>{`.md-punto{animation:md-entra .5s ease-out both}@keyframes md-entra{from{opacity:0}to{opacity:1}}.md-pulso{transform-box:fill-box;transform-origin:center;animation:md-pulso 2.2s ease-out infinite}@keyframes md-pulso{0%{opacity:.9;transform:scale(.7)}100%{opacity:0;transform:scale(1.9)}}.rp-cuna{animation:md-entra .6s ease-out both}`}</style>
    </div>
  );
}
