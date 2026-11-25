"use client";

/*
| LABORATORIO DE ABP · LAS PIEZAS DE DIBUJO DE OPTA Y DE DATOS (25/11/2026)
|
| Petición del analista: «mucho más visuales y mucho más top, con todos los
| escudos de los equipos». Aquí viven las tres piezas que comparten la pestaña
| Opta del laboratorio y la pantalla Datos:
|
| - `Escudo`: el escudo de un equipo en HTML (o su inicial si no lo hay).
| - `Ranking`: todos los equipos en una métrica, de mejor a peor, con escudo,
|   la mediana marcada y el Castilla (oro) y el próximo rival (azul) siempre a
|   la vista aunque caigan fuera de los primeros.
| - `Cuadrante`: dos métricas a la vez, un escudo por equipo, con las
|   medianas partiendo el dibujo y la esquina buena y la mala rotuladas.
|
| Colores: la escala de percentil de `components/data/graficas.tsx` (una sola
| en toda la app), el oro del club para nosotros y el azul de «comparado» para
| el próximo rival. Todo texto va con la tinta del tema: vale en día y noche.
*/

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { COMPARADO, MEJOR, ORO, PEOR, PERCENTIL_ALTO, PERCENTIL_BAJO, colorPercentil, tinta } from "@/components/data/graficas";

/** El oro de la marca como relleno (el `ORO` de graficas es el de texto, más oscuro en día). */
export const ORO_MARCA = "#C8A96B";
/** El acento de «en contra» del ABP. */
export const CORAL = "#D2553D";

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};

/* ------------------------------------------------------------------ */
/*  ESCUDO                                                             */
/* ------------------------------------------------------------------ */

export function Escudo({ src, nombre, lado = 20, anillo }: { src: string | null | undefined; nombre: string; lado?: number; anillo?: string }) {
  const marco = anillo ? { boxShadow: `0 0 0 2px ${anillo}` } : undefined;
  if (src) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: lado, height: lado, ...marco }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio */}
        <img src={src} alt="" width={lado} height={lado} className="object-contain" style={{ width: lado * (anillo ? 0.82 : 1), height: lado * (anillo ? 0.82 : 1) }} />
      </span>
    );
  }
  const inicial = nombre.replace(/^(Real|Club|C\.?D\.?|U\.?D\.?|S\.?D\.?|F\.?C\.?|C\.?F\.?|R\.?C\.?D\.?)\s+/i, "").trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-semibold text-white/60"
      style={{ width: lado, height: lado, fontSize: Math.max(9, lado * 0.45), ...marco }}
    >
      {inicial}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  CIFRA GRANDE                                                       */
/* ------------------------------------------------------------------ */

/**
 * Una cifra de cabecera. Si se le da `barra` (tanto por uno) y `referencia`,
 * dibuja debajo cuánto es frente a la referencia (la categoría, la liga).
 */
export function Cifra({
  rotulo,
  valor,
  detalle,
  barra,
  referencia,
  color = ORO_MARCA,
  acento,
}: {
  rotulo: string;
  valor: string;
  detalle?: ReactNode;
  barra?: number | null;
  referencia?: number | null;
  color?: string;
  acento?: string;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      {acento && <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: acento }} />}
      <p className="line-clamp-2 text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/45">{rotulo}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums text-white">{valor}</p>
      {barra != null && (
        <span className="relative mt-1.5 block h-1.5 rounded-full" style={{ background: tinta(0.08) }}>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, Math.min(100, barra * 100))}%`, background: color }} />
          {referencia != null && (
            <span aria-hidden className="absolute inset-y-[-3px] w-[2px] -translate-x-1/2 rounded-full" style={{ left: `${Math.min(100, referencia * 100)}%`, background: tinta(0.6) }} />
          )}
        </span>
      )}
      {detalle && <p className="mt-1 text-[11px] leading-snug text-white/50">{detalle}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RANKING                                                            */
/* ------------------------------------------------------------------ */

export type FilaRanking = { id: string; equipo: string; valor: number; texto: string; escudo: string | null; nota?: string };

/**
 * Todos los equipos de mejor a peor (en las de estilo, del que más al que
 * menos). La barra la colorea el puesto con la escala de percentil; nosotros
 * en oro, el próximo rival en azul y el que se mira con un filo. Con `tope`,
 * enseña los primeros y siempre a los protagonistas, con «Ver los N».
 */
export function Ranking({
  filas,
  mejorAlto,
  nuestro,
  rival,
  elegido,
  alPulsar,
  tope,
  pie,
}: {
  filas: FilaRanking[];
  mejorAlto: boolean | null;
  nuestro?: string | null;
  rival?: string | null;
  elegido?: string | null;
  alPulsar?: (id: string) => void;
  tope?: number;
  pie?: ReactNode;
}) {
  const [todos, setTodos] = useState(false);

  const orden = useMemo(() => [...filas].sort((a, b) => (mejorAlto === false ? a.valor - b.valor : b.valor - a.valor)), [filas, mejorAlto]);
  const n = orden.length;
  if (!n) return null;

  const maximo = Math.max(...orden.map((f) => Math.abs(f.valor)), 0) || 1;
  const med = mediana(orden.map((f) => f.valor));
  const pDe = (i: number) => (n > 1 ? Math.round((100 * (n - 1 - i)) / (n - 1)) : 50);
  const corta = !!tope && !todos && n > tope + 2;
  const visibles = orden.map((f, i) => ({ f, i })).filter(({ f, i }) => !corta || i < tope! || f.id === nuestro || f.id === rival || f.id === elegido);

  return (
    <div className="min-w-0">
      <div className="space-y-[3px]">
        {visibles.map(({ f, i }, k) => {
          const esNuestro = f.id === nuestro;
          const esRival = !!rival && f.id === rival;
          const esElegido = !!elegido && f.id === elegido && !esNuestro && !esRival;
          const p = pDe(i);
          const relleno = esNuestro ? ORO_MARCA : esRival ? COMPARADO : mejorAlto === null ? tinta(0.3) : p >= 60 ? `${MEJOR}B3` : p <= 40 ? `${PEOR}B3` : tinta(0.32);
          const salto = k > 0 && visibles[k - 1].i !== i - 1;
          const fila = (
            <>
              <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-white/35">{i + 1}</span>
              <Escudo src={f.escudo} nombre={f.equipo} lado={esNuestro || esRival ? 20 : 16} />
              <span className={`w-24 shrink-0 truncate text-[12px] sm:w-40 ${esNuestro || esRival || esElegido ? "font-semibold text-white" : "text-white/65"}`}>{f.equipo}</span>
              <span className="relative h-3.5 min-w-0 flex-1">
                <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${Math.max(2, (Math.abs(f.valor) / maximo) * 100)}%`, background: relleno, boxShadow: esNuestro ? `inset 0 0 0 1px ${ORO}` : undefined }} />
                {med != null && <span aria-hidden className="absolute inset-y-[-2px] w-px" style={{ left: `${(Math.abs(med) / maximo) * 100}%`, background: tinta(0.45) }} />}
              </span>
              <span className={`w-14 shrink-0 text-right text-[12px] tabular-nums ${esNuestro || esRival ? "font-semibold text-white" : "text-white/60"}`}>{f.texto}</span>
            </>
          );
          const clase = `flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 text-left ${esElegido ? "bg-white/[0.06]" : ""}`;
          const fondo = esNuestro ? { background: `${ORO_MARCA}1F` } : esRival ? { background: `${COMPARADO}1A` } : undefined;
          return (
            <div key={f.id}>
              {salto && <p aria-hidden className="py-0.5 pl-8 text-[10px] leading-none text-white/30">···</p>}
              {alPulsar ? (
                <button type="button" title={f.nota} onClick={() => alPulsar(f.id)} className={`${clase} transition hover:bg-white/[0.04]`} style={fondo}>
                  {fila}
                </button>
              ) : (
                <div className={clase} style={fondo} title={f.nota}>
                  {fila}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
        {med != null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-px" style={{ background: tinta(0.45) }} />
            Mediana de los {n}
          </span>
        )}
        {mejorAlto !== null && <span>{mejorAlto ? "Más es mejor" : "Menos es mejor"}</span>}
        {pie}
        {!!tope && n > tope + 2 && (
          <button type="button" onClick={() => setTodos(!todos)} className="font-semibold text-white/65 underline decoration-dotted underline-offset-4 hover:text-white">
            {todos ? `Sólo los ${tope} primeros` : `Ver los ${n}`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CUADRANTE                                                          */
/* ------------------------------------------------------------------ */

export type PuntoCuadrante = { id: string; equipo: string; x: number; y: number; escudo: string | null };

/** El ancho de una caja, medido: el SVG se dibuja a su tamaño real y la letra no se estira. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** El fondo del tema, para el halo de los rótulos (que se lean encima de un escudo o una raya). */
const FONDO = "var(--rmcf-surface, #11161C)";

type RolPlano = "nuestro" | "comparado" | "fondo";
/** El lado del escudo en el cuadrante (un poco mayor que el de DATA). */
const ladoPlano = (rol: RolPlano) => (rol === "fondo" ? 22 : 40);

/** Un escudo en el cuadrante: los protagonistas con halo de su color; al pasar, crece. */
function EscudoPlano({ cx, cy, escudo, rol, color, encima }: { cx: number; cy: number; escudo: string | null; rol: RolPlano; color: string; encima: boolean }) {
  const lado = ladoPlano(rol);
  const prota = rol !== "fondo";
  return (
    <g
      style={{
        opacity: prota || encima ? 1 : 0.72,
        transform: encima ? "scale(1.25)" : "none",
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: "transform 160ms ease, opacity 160ms ease",
      }}
    >
      {prota && (
        <>
          <circle cx={cx} cy={cy} r={lado / 2 + 14} style={{ fill: color, fillOpacity: 0.08 }} />
          <circle cx={cx} cy={cy} r={lado / 2 + 7} style={{ fill: color, fillOpacity: 0.16 }} />
        </>
      )}
      {escudo ? (
        <>
          <circle cx={cx} cy={cy} r={lado / 2 + 2} style={{ fill: FONDO, stroke: prota || encima ? color : tinta(0.18), strokeWidth: prota ? 2.5 : 1 }} />
          <image href={escudo} x={cx - lado / 2} y={cy - lado / 2} width={lado} height={lado} preserveAspectRatio="xMidYMid meet" />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={prota ? 8 : 5} style={{ fill: prota ? color : tinta(0.35), stroke: FONDO, strokeWidth: 2 }} />
      )}
    </g>
  );
}

/**
 * Un escudo por equipo en dos métricas. Las medianas de los que salen parten
 * el dibujo en cuatro; si las dos métricas se juzgan, la esquina buena va en
 * verde y la mala en naranja, y se dice cuál es debajo (no dentro, donde
 * pisaban escudos y nombres).
 *
 * 25/11/2026 («revisa el diseño, no está bien»): se dibuja al ancho real de
 * su caja (antes era un viewBox fijo que, a pantalla ancha, inflaba la letra
 * al doble), con la letra pequeña de la app; sólo llevan nombre el Castilla,
 * el próximo rival, el elegido y el que está bajo el ratón.
 */
export function Cuadrante({
  puntos,
  etiquetaX,
  etiquetaY,
  textoX,
  textoY,
  xMejorAlto,
  yMejorAlto,
  nuestro,
  rival,
  elegido,
  alPulsar,
  rotulos,
}: {
  puntos: PuntoCuadrante[];
  etiquetaX: string;
  etiquetaY: string;
  textoX: (v: number) => string;
  textoY: (v: number) => string;
  xMejorAlto: boolean | null;
  yMejorAlto: boolean | null;
  nuestro?: string | null;
  rival?: string | null;
  elegido?: string | null;
  alPulsar?: (id: string) => void;
  /** Rótulos de la esquina buena y la mala (si no, «Mejor en las dos» / «Peor en las dos»). */
  rotulos?: { bueno: string; malo: string };
}) {
  const id = useId();
  const gid = `cu${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const [encima, setEncima] = useState<PuntoCuadrante | null>(null);

  /* Lo que no depende del ratón, una vez por datos y ancho. */
  const dibujo = useMemo(() => {
    if (puntos.length < 3) return null;
    /* Sin medida todavía (pestaña escondida, observador que no ha llegado), se
       dibuja a 720 y el SVG, que va a lo ancho, se escala: nunca sale en blanco. */
    const W = ancho >= 120 ? ancho : 720;
    const H = Math.round(Math.max(260, Math.min(420, W * 0.6)));
    const M = { arriba: 30, derecha: 14, abajo: 38, izquierda: 44 };
    const dW = W - M.izquierda - M.derecha;
    const dH = H - M.arriba - M.abajo;
    const rango = (vals: number[]) => {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const aire = (max - min) * 0.08 || Math.abs(max) * 0.1 || 1;
      return { min: min - aire, max: max + aire };
    };
    const rx = rango(puntos.map((p) => p.x));
    const ry = rango(puntos.map((p) => p.y));
    const px = (v: number) => M.izquierda + ((v - rx.min) / (rx.max - rx.min)) * dW;
    const py = (v: number) => M.arriba + dH - ((v - ry.min) / (ry.max - ry.min)) * dH;
    const mx = mediana(puntos.map((p) => p.x)) ?? 0;
    const my = mediana(puntos.map((p) => p.y)) ?? 0;
    return { W, H, M, dW, dH, rx, ry, px, py, mx, my };
  }, [puntos, ancho]);

  const orden = useMemo(() => {
    const peso = (p: PuntoCuadrante) => (p.id === nuestro ? 3 : p.id === rival ? 2 : p.id === elegido ? 1 : 0);
    return [...puntos].sort((a, b) => peso(a) - peso(b));
  }, [puntos, nuestro, rival, elegido]);

  if (puntos.length < 3) return null;

  const juzga = xMejorAlto !== null && yMejorAlto !== null;
  const buenoDerecha = xMejorAlto !== false;
  const buenoArriba = yMejorAlto !== false;
  const rot = rotulos ?? { bueno: "Mejor en las dos", malo: "Peor en las dos" };
  const esquina = (arriba: boolean, derecha: boolean) => `${arriba ? "arriba" : "abajo"} a la ${derecha ? "derecha" : "izquierda"}`;

  let svg: ReactNode = null;
  if (dibujo) {
    const { W, H, M, dW, dH, rx, ry, px, py, mx, my } = dibujo;
    const caja4 = (derecha: boolean, arriba: boolean) => ({
      x: derecha ? px(mx) : M.izquierda,
      y: arriba ? M.arriba : py(my),
      w: derecha ? M.izquierda + dW - px(mx) : px(mx) - M.izquierda,
      h: arriba ? py(my) - M.arriba : M.arriba + dH - py(my),
    });
    const bueno = caja4(buenoDerecha, buenoArriba);
    const malo = caja4(!buenoDerecha, !buenoArriba);
    const eje = { fill: tinta(0.5), fontSize: 10, fontVariantNumeric: "tabular-nums" } as const;
    const halo = { stroke: FONDO, strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke" } as const;

    /* Los rótulos: arriba del escudo, o debajo si no cabe o si pisa a otro ya puesto. */
    const rotulados = orden.filter((p) => p.id === nuestro || p.id === rival || p.id === elegido || p.id === encima?.id);
    const ocupados: { x: number; y: number; w: number }[] = [];
    const etiquetas = [...rotulados].reverse().map((p) => {
      const rol = p.id === nuestro ? "nuestro" : p.id === rival || p.id === elegido ? "comparado" : "fondo";
      const lado = ladoPlano(rol) + (rol === "fondo" ? 6 : 0);
      const cx = px(p.x);
      const cy = py(p.y);
      const w = p.equipo.length * 6.2;
      const ancla: "start" | "middle" | "end" = cx - w / 2 < 4 ? "start" : cx + w / 2 > W - 4 ? "end" : "middle";
      const x0 = ancla === "start" ? cx - lado / 2 : ancla === "end" ? cx + lado / 2 - w : cx - w / 2;
      const arriba = cy - lado / 2 - 6;
      const abajo = cy + lado / 2 + 13;
      const pisa = (y: number) => ocupados.some((o) => Math.abs(o.y - y) < 13 && x0 < o.x + o.w && x0 + w > o.x);
      const y = arriba < 12 || pisa(arriba) ? (pisa(abajo) ? arriba : abajo) : arriba;
      ocupados.push({ x: x0, y, w });
      return { p, x: ancla === "start" ? cx - lado / 2 : ancla === "end" ? cx + lado / 2 : cx, y, ancla, rol };
    });

    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{`${etiquetaY} frente a ${etiquetaX}, un escudo por equipo`}</title>

        {juzga && (
          <>
            <defs>
              <radialGradient id={`${gid}-bueno`} cx={buenoDerecha ? "100%" : "0%"} cy={buenoArriba ? "0%" : "100%"} r="120%">
                <stop offset="0%" stopColor={MEJOR} stopOpacity={0.16} />
                <stop offset="100%" stopColor={MEJOR} stopOpacity={0.02} />
              </radialGradient>
              <radialGradient id={`${gid}-malo`} cx={buenoDerecha ? "0%" : "100%"} cy={buenoArriba ? "100%" : "0%"} r="120%">
                <stop offset="0%" stopColor={PEOR} stopOpacity={0.14} />
                <stop offset="100%" stopColor={PEOR} stopOpacity={0.02} />
              </radialGradient>
            </defs>
            <rect x={bueno.x} y={bueno.y} width={Math.max(0, bueno.w)} height={Math.max(0, bueno.h)} style={{ fill: `url(#${gid}-bueno)` }} />
            <rect x={malo.x} y={malo.y} width={Math.max(0, malo.w)} height={Math.max(0, malo.h)} style={{ fill: `url(#${gid}-malo)` }} />
          </>
        )}

        {/* Ejes y medianas */}
        <line x1={M.izquierda} y1={M.arriba + dH} x2={M.izquierda + dW} y2={M.arriba + dH} style={{ stroke: tinta(0.22), strokeWidth: 1 }} />
        <line x1={M.izquierda} y1={M.arriba} x2={M.izquierda} y2={M.arriba + dH} style={{ stroke: tinta(0.22), strokeWidth: 1 }} />
        <line x1={px(mx)} y1={M.arriba} x2={px(mx)} y2={M.arriba + dH} style={{ stroke: tinta(0.25), strokeWidth: 1, strokeDasharray: "3 4" }} />
        <line x1={M.izquierda} y1={py(my)} x2={M.izquierda + dW} y2={py(my)} style={{ stroke: tinta(0.25), strokeWidth: 1, strokeDasharray: "3 4" }} />

        {/* Valores de los ejes: los extremos y la mediana */}
        <text x={M.izquierda} y={M.arriba + dH + 14} textAnchor="start" style={eje}>
          {textoX(rx.min)}
        </text>
        {px(mx) - M.izquierda > 34 && M.izquierda + dW - px(mx) > 34 && (
          <text x={px(mx)} y={M.arriba + dH + 14} textAnchor="middle" style={{ ...eje, fill: tinta(0.7), fontWeight: 600 }}>
            {textoX(mx)}
          </text>
        )}
        <text x={M.izquierda + dW} y={M.arriba + dH + 14} textAnchor="end" style={eje}>
          {textoX(rx.max)}
        </text>
        <text x={M.izquierda - 6} y={M.arriba + dH} textAnchor="end" style={eje}>
          {textoY(ry.min)}
        </text>
        {M.arriba + dH - py(my) > 14 && py(my) - M.arriba > 14 && (
          <text x={M.izquierda - 6} y={py(my) + 3.5} textAnchor="end" style={{ ...eje, fill: tinta(0.7), fontWeight: 600 }}>
            {textoY(my)}
          </text>
        )}
        <text x={M.izquierda - 6} y={M.arriba + 7} textAnchor="end" style={eje}>
          {textoY(ry.max)}
        </text>

        {/* Títulos de los ejes, pequeños y fuera del dibujo */}
        <text x={M.izquierda + dW} y={H - 6} textAnchor="end" style={{ fill: tinta(0.65), fontSize: 11, fontWeight: 600 }}>
          {`${etiquetaX} →`}
        </text>
        <text x={M.izquierda} y={14} textAnchor="start" style={{ fill: tinta(0.65), fontSize: 11, fontWeight: 600 }}>
          {`↑ ${etiquetaY}`}
        </text>

        {/* Los escudos (los protagonistas, los últimos: encima) */}
        {orden.map((p) => {
          const rol = p.id === nuestro ? "nuestro" : p.id === rival || p.id === elegido ? "comparado" : "fondo";
          const lado = ladoPlano(rol);
          const cx = px(p.x);
          const cy = py(p.y);
          const color = rol === "nuestro" ? ORO_MARCA : p.id === rival ? COMPARADO : rol === "comparado" ? tinta(0.7) : tinta(0.6);
          return (
            <g key={p.id}>
              <EscudoPlano cx={cx} cy={cy} escudo={p.escudo} rol={rol} color={color} encima={encima?.id === p.id} />
              <circle
                cx={cx}
                cy={cy}
                r={lado / 2 + 4}
                style={{ fill: "transparent", cursor: alPulsar ? "pointer" : "default" }}
                onMouseEnter={() => setEncima(p)}
                onMouseLeave={() => setEncima(null)}
                onClick={() => {
                  setEncima(p);
                  alPulsar?.(p.id);
                }}
              >
                <title>{`${p.equipo} · ${etiquetaX} ${textoX(p.x)} · ${etiquetaY} ${textoY(p.y)}`}</title>
              </circle>
            </g>
          );
        })}

        {/* Los nombres, encima de todo y con halo */}
        {etiquetas.map(({ p, x, y, ancla, rol }) => (
          <text
            key={`n-${p.id}`}
            x={x}
            y={y}
            textAnchor={ancla}
            pointerEvents="none"
            style={{
              ...halo,
              fill: rol === "nuestro" ? ORO : p.id === rival ? COMPARADO : tinta(0.85),
              fontSize: 11,
              fontWeight: rol === "fondo" ? 500 : 700,
            }}
          >
            {p.equipo}
          </text>
        ))}
      </svg>
    );
  }

  const ficha =
    encima && dibujo
      ? {
          izq: Math.min(Math.max(dibujo.px(encima.x) / dibujo.W, 0.12), 0.88) * 100,
          arriba: dibujo.py(encima.y),
          abajo: dibujo.py(encima.y) < 90,
        }
      : null;

  return (
    <div className="min-w-0">
      <p className="mb-1 flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10.5px] font-medium text-white/60">
          <span aria-hidden className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{ background: ORO_MARCA }} />
            <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: ORO_MARCA }} />
          </span>
          {alPulsar ? "Pasa o toca un escudo: sus cifras; púlsalo para elegirlo" : "Pasa o toca un escudo para ver sus cifras"}
        </span>
      </p>
      <div ref={caja} className="relative w-full min-w-0">
        {svg}
        {ficha && encima && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-white/15 bg-[#0B0F14]/90 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-md"
            style={{ left: `${ficha.izq}%`, top: ficha.abajo ? ficha.arriba + 30 : ficha.arriba - 30, transform: `translate(-50%, ${ficha.abajo ? "0" : "-100%"})` }}
          >
            <p className="flex items-center gap-1.5 font-semibold text-white">
              <Escudo src={encima.escudo} nombre={encima.equipo} lado={16} />
              <span className="truncate">{encima.equipo}</span>
            </p>
            <p className="mt-0.5 tabular-nums text-white/65">
              {etiquetaX}: <span className="font-semibold text-white">{textoX(encima.x)}</span>
            </p>
            <p className="tabular-nums text-white/65">
              {etiquetaY}: <span className="font-semibold text-white">{textoY(encima.y)}</span>
            </p>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
        {juzga && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: MEJOR, opacity: 0.55 }} />
              {rot.bueno} ({esquina(buenoArriba, buenoDerecha)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: PEOR, opacity: 0.55 }} />
              {rot.malo} ({esquina(!buenoArriba, !buenoDerecha)})
            </span>
          </>
        )}
        {!juzga && yMejorAlto !== null && <span>{yMejorAlto ? "Más arriba, mejor" : "Más abajo, mejor"}</span>}
      </div>
      <p className="mt-1 min-h-4 text-[11px] tabular-nums text-white/50">
        {`Cada escudo es un equipo; las rayas, la mediana de los ${puntos.length}.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PISTA DE PERCENTIL                                                 */
/* ------------------------------------------------------------------ */

/**
 * Una pista de percentil: carril fino y neutro de P0 a P100, la mediana (P50)
 * con una raya, el equipo con un punto (oro si es el Castilla) y el próximo
 * rival con una raya azul; a la derecha, el puesto (con el color de la escala
 * de percentil) y el percentil.
 *
 * 25/11/2026: sustituye a la barra gruesa que salía del centro hasta el punto
 * y que se leía como una barra de diferencias sin explicar.
 */
export function PistaPercentil({
  rotulo,
  p,
  puesto,
  de,
  estilo = false,
  pocos = false,
  punto = ORO_MARCA,
  rival,
  tituloRival,
}: {
  rotulo?: string;
  p: number | null;
  puesto: number | null;
  de: number;
  /** Métrica de estilo: no hay mejor ni peor, sin color. */
  estilo?: boolean;
  /** Muestra pequeña: ni punto, ni puesto, ni percentil. */
  pocos?: boolean;
  punto?: string;
  rival?: number | null;
  tituloRival?: string;
}) {
  const color = estilo || pocos || p == null ? tinta(0.5) : colorPercentil(p);
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      {rotulo && <span className="w-[4.5rem] shrink-0 text-white/50">{rotulo}</span>}
      <span className="relative block h-3.5 min-w-0 flex-1">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: tinta(0.1) }} />
        <span aria-hidden className="absolute top-[1px] bottom-[1px] left-1/2 w-px" style={{ background: tinta(0.35) }} />
        {rival != null && <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${rival}%`, background: COMPARADO }} title={tituloRival} />}
        {p != null && !pocos && (
          <span
            aria-hidden
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${p}%`, background: punto, boxShadow: `0 0 0 2px ${FONDO}, 0 0 0 3px ${tinta(0.2)}` }}
          />
        )}
      </span>
      <span className="w-12 shrink-0 text-right font-semibold tabular-nums" style={{ color }} title={estilo ? "Del que más tiene al que menos" : "Del mejor al peor"}>
        {pocos || puesto == null ? "" : `${puesto}º/${de}`}
      </span>
      <span className="w-8 shrink-0 text-right tabular-nums text-white/45">{pocos || p == null ? "" : `P${Math.round(p)}`}</span>
    </div>
  );
}

/** Lo que cuenta cada pista, una vez, encima o debajo de la lista. */
export function LeyendaPista({ nuestro, rival, puntoNuestro = ORO_MARCA }: { nuestro: string; rival?: string; puntoNuestro?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: puntoNuestro }} />
        {nuestro}
      </span>
      {rival && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-[3px] rounded-full" style={{ background: COMPARADO }} />
          {rival}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-3 w-px" style={{ background: tinta(0.45) }} />
        Mediana (P50)
      </span>
      <span>Carril de P0 a P100: a la derecha, mejor (también en lo que se concede; en las de estilo, más). Puesto en verde, P60 o más; oro, en la media; naranja, P40 o menos.</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  SEGUNDA PASADA (25/11/2026): «muy visual, moderno, tecnológico,    */
/*  usable e impactante»                                               */
/* ------------------------------------------------------------------ */

/**
 * El color de relleno de un percentil: verde, naranja o el oro de la marca
 * en la franja media (el `ORO` de texto es marrón en modo día y ensuciaba
 * los rellenos).
 */
export const tonoPercentil = (p: number | null) => (p == null ? tinta(0.3) : p >= PERCENTIL_ALTO ? MEJOR : p <= PERCENTIL_BAJO ? PEOR : ORO_MARCA);
/** El mismo, como texto (el oro de texto del tema, legible en los dos). */
export const tintaPercentil = (p: number | null) => (p == null ? tinta(0.5) : p >= PERCENTIL_ALTO ? MEJOR : p <= PERCENTIL_BAJO ? PEOR : ORO);

/** Un anillo de percentil: el arco llega hasta el percentil y en medio va «P47». */
export function AnilloPercentil({ p, lado = 48, grosor = 4.5, rotulo }: { p: number | null; lado?: number; grosor?: number; rotulo?: string }) {
  const r = (lado - grosor) / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = p == null ? 0 : Math.max(0, Math.min(100, p));
  const tono = tonoPercentil(p);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: lado, height: lado }} title={rotulo}>
      <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={lado / 2} cy={lado / 2} r={r} style={{ fill: "none", stroke: tinta(0.1), strokeWidth: grosor }} />
        {p != null && (
          <circle
            cx={lado / 2}
            cy={lado / 2}
            r={r}
            className="abp-anillo"
            style={{ fill: "none", stroke: tono, strokeWidth: grosor, strokeLinecap: "round", strokeDasharray: `${(v / 100) * c} ${c}`, filter: `drop-shadow(0 0 3px ${tono})` }}
          />
        )}
      </svg>
      <span className="relative text-[10.5px] font-bold tabular-nums leading-none" style={{ color: tintaPercentil(p), fontSize: lado < 40 ? 9 : 10.5 }}>
        {p == null ? "" : `P${Math.round(p)}`}
      </span>
    </span>
  );
}

export type KpiVersus = {
  /** Rótulo corto (cabe en una línea); el nombre entero va en `titulo`. */
  rotulo: string;
  titulo?: string;
  valor: string;
  p: number | null;
  /** «11º de 20 en su grupo · mediana 3,9» */
  detalle?: string;
  /** «menos es mejor» y similares, en pequeño junto al rótulo. */
  nota?: string;
  rival?: { valor: string; p: number | null; detalle?: string } | null;
};

/**
 * Lo primero que ve el cuerpo técnico: el escudo grande, tres o cuatro cifras
 * con su anillo de percentil y, al lado, el próximo rival con las mismas.
 */
export function HeroVersus({
  etiqueta,
  nombre,
  escudo,
  sub,
  rival,
  kpis,
  acento = ORO_MARCA,
  alPulsarRival,
}: {
  etiqueta: string;
  nombre: string;
  escudo: string | null;
  sub?: ReactNode;
  rival?: { nombre: string; escudo: string | null; sub?: ReactNode } | null;
  kpis: KpiVersus[];
  acento?: string;
  alPulsarRival?: () => void;
}) {
  const fondo = rival
    ? `radial-gradient(ellipse at 0% 0%, ${acento}2E, transparent 55%), radial-gradient(ellipse at 100% 0%, ${COMPARADO}26, transparent 55%)`
    : `radial-gradient(ellipse at 0% 0%, ${acento}2E, transparent 60%)`;
  const ladoRival = (
    <>
      <span className="min-w-0 text-right">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: COMPARADO }}>
          Próximo rival
        </span>
        <span className="block truncate text-[15px] font-semibold text-white sm:text-lg">{rival?.nombre}</span>
        {rival?.sub && <span className="block truncate text-[11px] text-white/50">{rival.sub}</span>}
      </span>
      <span className="relative shrink-0">
        <span aria-hidden className="absolute -inset-3 rounded-full blur-xl" style={{ background: `${COMPARADO}40` }} />
        <span className="relative">
          <Escudo src={rival?.escudo} nombre={rival?.nombre ?? ""} lado={52} />
        </span>
      </span>
    </>
  );
  return (
    <section className="lab-aparece relative min-w-0 overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5" style={{ background: fondo }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: `linear-gradient(${tinta(0.05)} 1px, transparent 1px), linear-gradient(90deg, ${tinta(0.05)} 1px, transparent 1px)`, backgroundSize: "28px 28px", maskImage: "linear-gradient(to bottom, black, transparent 70%)" }} />
      <div className="relative grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <span aria-hidden className="absolute -inset-3 rounded-full blur-xl" style={{ background: `${acento}55` }} />
            <span className="relative">
              <Escudo src={escudo} nombre={nombre} lado={60} />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ORO }}>
              {etiqueta}
            </span>
            <span className="block truncate text-[15px] font-semibold text-white sm:text-xl">{nombre}</span>
            {sub && <span className="block truncate text-[11px] text-white/50">{sub}</span>}
          </span>
        </div>
        {rival ? (
          <span className="justify-self-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white/60">VS</span>
        ) : (
          <span />
        )}
        {rival ? (
          alPulsarRival ? (
            <button type="button" onClick={alPulsarRival} title={`Mirar a ${rival.nombre}`} className="flex min-w-0 items-center justify-end gap-3 rounded-xl text-left transition hover:brightness-110">
              {ladoRival}
            </button>
          ) : (
            <div className="flex min-w-0 items-center justify-end gap-3">{ladoRival}</div>
          )
        ) : (
          <span />
        )}
      </div>

      <div className={`relative mt-4 grid min-w-0 gap-2 sm:grid-cols-2 ${kpis.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {kpis.map((k, i) => (
          <div
            key={k.rotulo}
            className="lab-aparece min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-sm"
            style={{ animationDelay: `${60 + i * 60}ms` }}
          >
            {/* Rótulo y nota en dos líneas fijas: las cifras de las cuatro tarjetas quedan a la misma altura. */}
            <p className="min-h-[2.5em] text-[10px] leading-snug" title={k.titulo ?? k.rotulo}>
              <span className="block font-semibold uppercase tracking-[0.14em] text-white/55">{k.rotulo}</span>
              {k.nota && <span className="block font-medium text-white/40">{k.nota}</span>}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <AnilloPercentil p={k.p} lado={50} />
              <span className="min-w-0">
                <span className="block text-[28px] font-semibold leading-none tabular-nums text-white" style={{ textShadow: `0 0 18px ${acento}59` }}>
                  {k.valor}
                </span>
                {k.detalle && <span className="mt-1 block truncate text-[10.5px] tabular-nums text-white/50">{k.detalle}</span>}
              </span>
            </div>
            {k.rival && (
              <div className="mt-2.5 flex min-w-0 items-center gap-2 border-t border-white/[0.07] pt-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: COMPARADO, boxShadow: `0 0 6px ${COMPARADO}` }} />
                <span className="min-w-0 flex-1 truncate text-[10.5px] tabular-nums text-white/55">{k.rival.detalle}</span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums" style={{ color: COMPARADO }}>
                  {k.rival.valor}
                </span>
                <AnilloPercentil p={k.rival.p} lado={30} grosor={3} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export type CeldaCalor = { clave: string; nombre: string; valor: string; p: number | null; titulo?: string; alPulsar?: () => void };

/**
 * El perfil entero en un mapa de calor: una fila por sección, una celda por
 * métrica, rellena con el color de su percentil (más intenso cuanto más se
 * aleja de la media) y con su valor dentro.
 */
export function MapaCalor({ filas }: { filas: { seccion: string; celdas: CeldaCalor[] }[] }) {
  return (
    <div className="min-w-0">
      <div className="space-y-2">
        {filas.map((f, i) => (
          <div key={f.seccion} className="lab-aparece flex min-w-0 flex-col gap-1.5 sm:flex-row sm:gap-3" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="w-28 shrink-0 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {f.seccion}
              <span className="ml-1 font-normal tracking-normal text-white/30">{f.celdas.length}</span>
            </p>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {f.celdas.map((c) => {
                const tono = tonoPercentil(c.p);
                const fuerza = c.p == null ? 8 : Math.round(12 + Math.abs(c.p - 50) * 0.5);
                return (
                  <button
                    key={c.clave}
                    type="button"
                    onClick={c.alPulsar}
                    title={c.titulo}
                    className="group flex h-[68px] min-w-0 flex-col justify-between rounded-lg px-2.5 py-2 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    style={{ background: `color-mix(in srgb, ${tono} ${fuerza}%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tono} 32%, transparent)` }}
                  >
                    <span className="line-clamp-2 h-[2.5em] text-[10.5px] leading-[1.25] text-white/75">{c.nombre}</span>
                    <span className="flex min-w-0 items-baseline justify-between gap-1">
                      <span className="truncate text-[14px] font-semibold leading-none tabular-nums text-white">{c.valor}</span>
                      <span className="shrink-0 text-[10.5px] font-bold tabular-nums" style={{ color: tintaPercentil(c.p) }}>
                        {c.p == null ? "" : `P${Math.round(c.p)}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-white/50">
        <span className="inline-flex items-center gap-2">
          <span>P0</span>
          <span aria-hidden className="inline-block h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${PEOR}, ${PEOR}55 38%, ${ORO_MARCA}66 50%, ${MEJOR}55 62%, ${MEJOR})` }} />
          <span>P100</span>
        </span>
        <span>Naranja, P40 o menos · oro, en la media · verde, P60 o más. Cuanto más intenso, más lejos de la media. Pulsa una celda para ir a su métrica.</span>
      </div>
    </div>
  );
}

/** Lo alto de la cabecera fija de la app, para que lo pegajoso quede justo debajo. */
function useAltoCabecera() {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const cab = document.querySelector("header.sticky");
    if (!(cab instanceof HTMLElement)) return;
    const ro = new ResizeObserver(() => setAlto(Math.round(cab.getBoundingClientRect().height)));
    ro.observe(cab);
    return () => ro.disconnect();
  }, []);
  return alto;
}

export type ItemNav = { id: string; label: string; seccion?: string };

/** Pide a quien escucha (OptaBalonParado) que cambie de sección. */
export const EVENTO_SECCION = "abp-datos:seccion";
/** Lo avisa quien cambia de sección, para que la navegación la marque. */
export const EVENTO_SECCION_ACTUAL = "abp-datos:seccion-actual";

/**
 * La navegación pegajosa de una página larga: salta a cada bloque (o, si el
 * elemento lleva `seccion`, cambia además la sección del panel de Opta) y
 * marca dónde se está.
 */
/** `extra`: px de más bajo la cabecera (en el Laboratorio de ABP, su propia barra de pestañas va pegada encima). */
export function NavSecciones({ items, extra = 0 }: { items: ItemNav[]; extra?: number }) {
  const top = useAltoCabecera() + extra;
  const nav = useRef<HTMLElement>(null);
  const [activo, setActivo] = useState(items[0]?.id ?? "");
  const [seccion, setSeccion] = useState("");

  useEffect(() => {
    const oye = (e: Event) => setSeccion(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(EVENTO_SECCION_ACTUAL, oye);
    return () => window.removeEventListener(EVENTO_SECCION_ACTUAL, oye);
  }, []);

  /* Sin requestAnimationFrame: en una pestaña escondida no llega y la marca se quedaba quieta. */
  useEffect(() => {
    let ultimo = 0;
    const mira = () => {
      const linea = top + (nav.current?.offsetHeight ?? 0) + 24;
      let actual = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= linea) actual = it.id;
      }
      setActivo(actual);
    };
    const alMover = () => {
      const ahora = performance.now();
      if (ahora - ultimo < 80) return;
      ultimo = ahora;
      mira();
    };
    const alFinal = () => mira();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("scrollend", alFinal);
    const primera = window.setTimeout(mira, 0);
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("scrollend", alFinal);
      window.clearTimeout(primera);
    };
  }, [items, top]);

  const ir = (it: ItemNav) => {
    if (it.seccion) window.dispatchEvent(new CustomEvent(EVENTO_SECCION, { detail: it.seccion }));
    const el = document.getElementById(it.id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - top - (nav.current?.offsetHeight ?? 0) - 16;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: suave ? "smooth" : "auto" });
  };

  return (
    <nav ref={nav} aria-label="Ir a" className="sticky z-20 -mx-1 min-w-0 bg-[#0B0F14] px-1 py-2" style={{ top }}>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#0B0F14]/85 p-1 shadow-lg backdrop-blur-xl [scrollbar-width:none]">
        {items.map((it) => {
          const on = it.seccion ? activo === it.id && (seccion || items.find((x) => x.seccion)?.seccion) === it.seccion : activo === it.id;
          return (
            <button
              key={`${it.id}-${it.seccion ?? ""}`}
              type="button"
              onClick={() => ir(it)}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${on ? "shadow-sm" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
              style={on ? { background: ORO_MARCA, color: "#0B0F14" } : undefined}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** La cabecera de un bloque: título, una línea de «qué mirar aquí» y, a la derecha, sus mandos. */
export function CabeceraBloque({ titulo, queMirar, accion, id }: { titulo: string; queMirar?: ReactNode; accion?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold text-white">{titulo}</h3>
        {queMirar && (
          <p className="mt-0.5 text-[11.5px] text-white/50">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: ORO }}>
              Qué mirar
            </span>
            {queMirar}
          </p>
        )}
      </div>
      {accion}
    </div>
  );
}

/** La leyenda de los protagonistas: el oro nuestro y el azul del próximo rival. */
export function LeyendaProtagonistas({ nuestro, rival, elegido }: { nuestro?: string; rival?: string; elegido?: string }) {
  const punto = (color: string) => <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
      {nuestro && <span className="inline-flex items-center gap-1.5">{punto(ORO_MARCA)}{nuestro}</span>}
      {rival && <span className="inline-flex items-center gap-1.5">{punto(COMPARADO)}Próximo rival: {rival}</span>}
      {elegido && <span className="inline-flex items-center gap-1.5">{punto(tinta(0.6))}{elegido}</span>}
    </span>
  );
}
