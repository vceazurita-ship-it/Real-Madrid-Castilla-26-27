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

import { COMPARADO, EscudoPunto, MEJOR, ORO, PEOR, colorPercentil, ladoEscudo, tinta } from "@/components/data/graficas";

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
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const [encima, setEncima] = useState<PuntoCuadrante | null>(null);

  /* Lo que no depende del ratón, una vez por datos y ancho. */
  const dibujo = useMemo(() => {
    if (puntos.length < 3 || ancho < 120) return null;
    const W = ancho;
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
      const lado = ladoEscudo(rol);
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
            <rect x={bueno.x} y={bueno.y} width={Math.max(0, bueno.w)} height={Math.max(0, bueno.h)} style={{ fill: MEJOR, fillOpacity: 0.07 }} />
            <rect x={malo.x} y={malo.y} width={Math.max(0, malo.w)} height={Math.max(0, malo.h)} style={{ fill: PEOR, fillOpacity: 0.06 }} />
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
          const lado = ladoEscudo(rol);
          const cx = px(p.x);
          const cy = py(p.y);
          return (
            <g key={p.id}>
              <EscudoPunto cx={cx} cy={cy} escudo={p.escudo} rol={rol} color={p.id === elegido && p.id !== rival ? tinta(0.7) : undefined} />
              {encima?.id === p.id && rol === "fondo" && <circle cx={cx} cy={cy} r={lado / 2 + 3} style={{ fill: "none", stroke: tinta(0.6), strokeWidth: 1.5 }} />}
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

  return (
    <div className="min-w-0">
      <div ref={caja} className="w-full min-w-0" style={dibujo ? undefined : { aspectRatio: "5 / 3" }}>
        {svg}
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
        {encima
          ? `${encima.equipo} · ${etiquetaX} ${textoX(encima.x)} · ${etiquetaY} ${textoY(encima.y)}`
          : `Cada escudo es un equipo; las rayas, la mediana de los ${puntos.length}. Pasa por un escudo para ver sus cifras${alPulsar ? "; púlsalo para elegirlo" : ""}.`}
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
