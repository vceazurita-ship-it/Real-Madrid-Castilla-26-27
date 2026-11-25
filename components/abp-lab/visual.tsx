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

import { useId, useMemo, useState, type ReactNode } from "react";

import { COMPARADO, EscudoPunto, MEJOR, ORO, PEOR, ladoEscudo, tinta } from "@/components/data/graficas";

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
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</p>
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

/**
 * Un escudo por equipo en dos métricas. Las medianas de los que salen parten
 * el dibujo en cuatro; si las dos métricas se juzgan, la esquina buena va en
 * verde y la mala en naranja, rotuladas. Responde al ancho (sin ancho mínimo).
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
  const [encima, setEncima] = useState<PuntoCuadrante | null>(null);

  if (puntos.length < 3) return null;

  const W = 600;
  const H = 420;
  const M = { arriba: 22, derecha: 18, abajo: 40, izquierda: 46 };
  const dW = W - M.izquierda - M.derecha;
  const dH = H - M.arriba - M.abajo;

  const rango = (vals: number[]) => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const aire = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
    return { min: min - aire, max: max + aire };
  };
  const rx = rango(puntos.map((p) => p.x));
  const ry = rango(puntos.map((p) => p.y));
  const px = (v: number) => M.izquierda + ((v - rx.min) / (rx.max - rx.min)) * dW;
  const py = (v: number) => M.arriba + dH - ((v - ry.min) / (ry.max - ry.min)) * dH;
  const mx = mediana(puntos.map((p) => p.x)) ?? 0;
  const my = mediana(puntos.map((p) => p.y)) ?? 0;

  /* La esquina buena: a la derecha si en X más es mejor, arriba si en Y más es mejor. */
  const juzga = xMejorAlto !== null && yMejorAlto !== null;
  const buenoDerecha = xMejorAlto !== false;
  const buenoArriba = yMejorAlto !== false;
  const caja = (derecha: boolean, arriba: boolean) => ({
    x: derecha ? px(mx) : M.izquierda,
    y: arriba ? M.arriba : py(my),
    w: derecha ? M.izquierda + dW - px(mx) : px(mx) - M.izquierda,
    h: arriba ? py(my) - M.arriba : M.arriba + dH - py(my),
  });
  const bueno = caja(buenoDerecha, buenoArriba);
  const malo = caja(!buenoDerecha, !buenoArriba);
  const rot = rotulos ?? { bueno: "Mejor en las dos", malo: "Peor en las dos" };

  const orden = [...puntos].sort((a, b) => {
    const peso = (p: PuntoCuadrante) => (p.id === nuestro ? 3 : p.id === rival ? 2 : p.id === elegido ? 1 : 0);
    return peso(a) - peso(b);
  });

  const extremos = new Set<string>();
  for (const f of [(p: PuntoCuadrante) => p.x, (p: PuntoCuadrante) => p.y]) {
    const o = [...puntos].sort((a, b) => f(a) - f(b));
    extremos.add(o[0].id);
    extremos.add(o[o.length - 1].id);
  }

  const texto = (x: number, y: number, s: string, anchor: "start" | "end" | "middle", color: string, size = 10, peso = 500) => (
    <text x={x} y={y} textAnchor={anchor} style={{ fill: color, fontSize: size, fontWeight: peso }}>
      {s}
    </text>
  );

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{`${etiquetaY} frente a ${etiquetaX}, un escudo por equipo`}</title>

        {juzga && (
          <>
            <rect x={bueno.x} y={bueno.y} width={Math.max(0, bueno.w)} height={Math.max(0, bueno.h)} style={{ fill: MEJOR, fillOpacity: 0.07 }} />
            <rect x={malo.x} y={malo.y} width={Math.max(0, malo.w)} height={Math.max(0, malo.h)} style={{ fill: PEOR, fillOpacity: 0.06 }} />
            {texto(buenoDerecha ? M.izquierda + dW - 6 : M.izquierda + 6, buenoArriba ? M.arriba + 14 : M.arriba + dH - 8, rot.bueno, buenoDerecha ? "end" : "start", MEJOR, 11, 700)}
            {texto(buenoDerecha ? M.izquierda + 6 : M.izquierda + dW - 6, buenoArriba ? M.arriba + dH - 8 : M.arriba + 14, rot.malo, buenoDerecha ? "start" : "end", PEOR, 11, 700)}
          </>
        )}

        <line x1={px(mx)} y1={M.arriba} x2={px(mx)} y2={M.arriba + dH} style={{ stroke: tinta(0.22), strokeWidth: 1, strokeDasharray: "4 4" }} />
        <line x1={M.izquierda} y1={py(my)} x2={M.izquierda + dW} y2={py(my)} style={{ stroke: tinta(0.22), strokeWidth: 1, strokeDasharray: "4 4" }} />
        <line x1={M.izquierda} y1={M.arriba + dH} x2={M.izquierda + dW} y2={M.arriba + dH} style={{ stroke: tinta(0.25), strokeWidth: 1 }} />
        <line x1={M.izquierda} y1={M.arriba} x2={M.izquierda} y2={M.arriba + dH} style={{ stroke: tinta(0.25), strokeWidth: 1 }} />

        {texto(M.izquierda, H - 24, textoX(rx.min), "start", tinta(0.45))}
        {texto(px(mx), H - 24, textoX(mx), "middle", tinta(0.55))}
        {texto(M.izquierda + dW, H - 24, textoX(rx.max), "end", tinta(0.45))}
        {texto(M.izquierda - 6, M.arriba + dH, textoY(ry.min), "end", tinta(0.45))}
        {texto(M.izquierda - 6, py(my) + 3, textoY(my), "end", tinta(0.55))}
        {texto(M.izquierda - 6, M.arriba + 8, textoY(ry.max), "end", tinta(0.45))}
        {texto(M.izquierda + dW / 2, H - 6, `${etiquetaX} →`, "middle", tinta(0.65), 12, 600)}
        <text x={14} y={M.arriba + dH / 2} textAnchor="middle" transform={`rotate(-90 14 ${M.arriba + dH / 2})`} style={{ fill: tinta(0.65), fontSize: 12, fontWeight: 600 }}>
          {`${etiquetaY} →`}
        </text>

        {orden.map((p) => {
          const rol = p.id === nuestro ? "nuestro" : p.id === rival || p.id === elegido ? "comparado" : "fondo";
          const lado = ladoEscudo(rol);
          const cx = px(p.x);
          const cy = py(p.y);
          const nombre = rol !== "fondo" || extremos.has(p.id);
          return (
            <g key={p.id}>
              <EscudoPunto cx={cx} cy={cy} escudo={p.escudo} rol={rol} color={p.id === elegido && p.id !== rival ? tinta(0.7) : undefined} />
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
              {nombre &&
                texto(
                  cx,
                  cy - lado / 2 - 6,
                  p.equipo,
                  cx < M.izquierda + 60 ? "start" : cx > W - M.derecha - 60 ? "end" : "middle",
                  rol === "nuestro" ? tinta(0.92) : rol === "comparado" ? (p.id === rival ? COMPARADO : tinta(0.8)) : tinta(0.55),
                  rol === "fondo" ? 10 : 12,
                  rol === "fondo" ? 500 : 700,
                )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 min-h-4 text-[11px] tabular-nums text-white/50">
        {encima
          ? `${encima.equipo} · ${etiquetaX} ${textoX(encima.x)} · ${etiquetaY} ${textoY(encima.y)}`
          : `Cada escudo es un equipo; las rayas, la mediana de los ${puntos.length}. Toca un escudo para ver sus cifras${alPulsar ? " y elegirlo" : ""}.`}
      </p>
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
