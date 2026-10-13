"use client";

/*
|--------------------------------------------------------------------------
| LA TIPOLOGÍA DE LOS GOLES, EN DIBUJO (13/10/2026)
|--------------------------------------------------------------------------
|
| Dos gráficos para `/analisis-goles`, en SVG a mano (sin librería):
|
|   - `AnillosTipologia`: dos anillos, a favor y en contra. El de dentro es la
|     fase (ataque organizado, transición, ABP) y el de fuera el tipo dentro
|     de esa fase, con el mismo tono más claro u oscuro.
|   - `LineaGoles`: el partido de 1' a 90+ en horizontal; cada gol es un punto
|     en su minuto con el color de su tipo, arriba los a favor y abajo los en
|     contra. Se ve a la vez cuándo y cómo llegan.
|
| Los colores son fijos (no dependen del modo día/noche) porque codifican la
| categoría; cada fase tiene su familia: azules para el ataque organizado,
| verdes para la transición y ocres para el balón parado.
*/

import { useState } from "react";

import { FASES, NOMBRE_TIPO, FASE_DE, rotuloMinuto, type GolVisto, type TipoGol } from "@/lib/goles/analisis";

export const COLOR_FASE: Record<string, string> = {
  "AT. ORGANIZADO": "#3B7DD8",
  TRANSICIÓN: "#1B9E77",
  ABP: "#D9A21B",
};

export const COLOR_TIPO: Record<TipoGol, string> = {
  dentro: "#1F4E99",
  bandaD: "#2F6FC4",
  bandaI: "#4F8FE8",
  espalda: "#7FB0F2",
  caida: "#9B8CE6",
  error: "#6A5ACD",
  transContrario: "#127A5C",
  transPropio: "#4CC79F",
  corner: "#B07D0B",
  faltaLateral: "#D9A21B",
  faltaDirecta: "#F0C24B",
  banda: "#E07B39",
  penalti: "#C2410C",
};

const SIN = "#94A3B8";

const NOMBRE_FASE: Record<string, string> = { "AT. ORGANIZADO": "Ataque organizado", TRANSICIÓN: "Transición", ABP: "Balón parado" };

export type GolConTipo = GolVisto & { tipoFinal: TipoGol | null };

/* ------------------------------------------------------------------ */
/*  Anillos                                                            */
/* ------------------------------------------------------------------ */

/** Un trozo de anillo entre dos ángulos (en vueltas, 0 arriba y en el sentido del reloj). */
function arco(r1: number, r2: number, a0: number, a1: number) {
  const punto = (r: number, a: number) => [Math.sin(a * 2 * Math.PI) * r, -Math.cos(a * 2 * Math.PI) * r];
  const grande = a1 - a0 > 0.5 ? 1 : 0;

  /* Un anillo entero no se dibuja con un arco (empieza y acaba en el mismo punto). */
  if (a1 - a0 >= 0.9999) a1 = a0 + 0.9999;

  const [x0, y0] = punto(r2, a0);
  const [x1, y1] = punto(r2, a1);
  const [x2, y2] = punto(r1, a1);
  const [x3, y3] = punto(r1, a0);

  return `M ${x0} ${y0} A ${r2} ${r2} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 ${grande} 0 ${x3} ${y3} Z`;
}

function Anillo({ titulo, goles, color, resaltado, onResalta }: { titulo: string; goles: GolConTipo[]; color: string; resaltado: string | null; onResalta: (k: string | null) => void }) {
  const total = goles.length;
  const porTipo = new Map<string, number>();

  for (const g of goles) porTipo.set(g.tipoFinal ?? "sin", (porTipo.get(g.tipoFinal ?? "sin") ?? 0) + 1);

  /* Fases y tipos en el orden de la hoja, para que los dos anillos se lean igual. */
  const trozosFase: { clave: string; n: number; a0: number; a1: number }[] = [];
  const trozosTipo: { clave: string; n: number; a0: number; a1: number; fase: string }[] = [];
  let a = 0;

  for (const f of FASES) {
    const inicio = a;

    for (const t of f.tipos) {
      const n = porTipo.get(t.clave) ?? 0;

      if (!n) continue;

      trozosTipo.push({ clave: t.clave, n, a0: a, a1: a + n / total, fase: f.fase });
      a += n / total;
    }

    if (a > inicio) trozosFase.push({ clave: f.fase, n: Math.round((a - inicio) * total), a0: inicio, a1: a });
  }

  const sin = porTipo.get("sin") ?? 0;

  if (sin) {
    trozosTipo.push({ clave: "sin", n: sin, a0: a, a1: a + sin / total, fase: "sin" });
    trozosFase.push({ clave: "sin", n: sin, a0: a, a1: a + sin / total });
  }

  const atenua = (clave: string, fase?: string) => (resaltado && resaltado !== clave && resaltado !== fase ? 0.25 : 1);

  return (
    <figure className="min-w-0 text-center">
      <svg viewBox="-110 -110 220 220" className="mx-auto h-auto w-full max-w-[230px]" role="img" aria-label={`${titulo}: ${total} goles`}>
        {total === 0 ? <circle r={80} fill="none" stroke={SIN} strokeOpacity={0.3} strokeWidth={30} /> : null}
        {trozosFase.map((t) => (
          <path
            key={`f-${t.clave}`}
            d={arco(44, 70, t.a0, t.a1)}
            fill={t.clave === "sin" ? SIN : COLOR_FASE[t.clave]}
            stroke="var(--rmcf-surface, #0B0F14)"
            strokeWidth={1.5}
            opacity={atenua(t.clave)}
            onMouseEnter={() => onResalta(t.clave)}
            onMouseLeave={() => onResalta(null)}
          >
            <title>{`${t.clave === "sin" ? "Sin clasificar" : NOMBRE_FASE[t.clave]}: ${t.n} de ${total}`}</title>
          </path>
        ))}
        {trozosTipo.map((t) => (
          <path
            key={`t-${t.clave}`}
            d={arco(73, 104, t.a0, t.a1)}
            fill={t.clave === "sin" ? SIN : COLOR_TIPO[t.clave as TipoGol]}
            stroke="var(--rmcf-surface, #0B0F14)"
            strokeWidth={1.5}
            opacity={atenua(t.clave, t.fase)}
            onMouseEnter={() => onResalta(t.clave)}
            onMouseLeave={() => onResalta(null)}
          >
            <title>{`${t.clave === "sin" ? "Sin clasificar" : NOMBRE_TIPO[t.clave as TipoGol]}: ${t.n} de ${total}`}</title>
          </path>
        ))}
        {/* El número dentro de cada trozo de fuera, si cabe. */}
        {trozosTipo
          .filter((t) => t.a1 - t.a0 >= 0.07)
          .map((t) => {
            const m = (t.a0 + t.a1) / 2;

            return (
              <text key={`n-${t.clave}`} x={Math.sin(m * 2 * Math.PI) * 88.5} y={-Math.cos(m * 2 * Math.PI) * 88.5 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" pointerEvents="none" opacity={atenua(t.clave, t.fase)}>
                {t.n}
              </text>
            );
          })}
        <text y={-4} textAnchor="middle" fontSize={30} fontWeight={700} fill={color}>
          {total}
        </text>
        <text y={16} textAnchor="middle" fontSize={10} letterSpacing={1.5} fill="currentColor" opacity={0.55}>
          GOLES
        </text>
      </svg>
      <figcaption className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
        {titulo}
      </figcaption>
    </figure>
  );
}

/** Leyenda compartida: las tres fases con sus tipos; al pasar por encima se resalta en los dos gráficos. */
function Leyenda({ usados, resaltado, onResalta }: { usados: Set<string>; resaltado: string | null; onResalta: (k: string | null) => void }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      {FASES.map((f) => (
        <div key={f.fase} className="min-w-0" onMouseEnter={() => onResalta(f.fase)} onMouseLeave={() => onResalta(null)}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: COLOR_FASE[f.fase] }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_FASE[f.fase] }} /> {NOMBRE_FASE[f.fase]}
          </p>
          <ul className="space-y-0.5">
            {f.tipos.map((t) => (
              <li
                key={t.clave}
                className={`flex items-center gap-1.5 text-[11px] transition ${usados.has(t.clave) ? "text-white/75" : "text-white/30"} ${resaltado && resaltado !== t.clave && resaltado !== f.fase ? "opacity-40" : ""}`}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  onResalta(t.clave);
                }}
                onMouseLeave={() => onResalta(f.fase)}
              >
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: COLOR_TIPO[t.clave] }} />
                {t.nombre}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Línea del partido                                                  */
/* ------------------------------------------------------------------ */

const ANCHO = 1000;
const MARGEN = 14;
const X_DESC1 = 452; // dónde empieza el 45+
const X_P2 = 512; // dónde empieza el 46'
const X_DESC2 = 952; // dónde empieza el 90+

/** El minuto en la línea: las dos partes y, entre medias, el descuento de cada una (hasta 10' de añadido). */
function xDe(g: { min: number; extra: number; parte: 1 | 2 }) {
  if (g.parte === 1) return g.extra || g.min > 45 ? X_DESC1 + (Math.min(10, g.extra || g.min - 45) / 10) * (X_P2 - X_DESC1 - 14) : MARGEN + ((g.min - 1) / 44) * (X_DESC1 - MARGEN - 8);

  return g.extra || g.min > 90 ? X_DESC2 + (Math.min(10, g.extra || g.min - 90) / 10) * (ANCHO - X_DESC2 - MARGEN) : X_P2 + ((g.min - 46) / 44) * (X_DESC2 - X_P2 - 8);
}

function LineaGoles({ goles, resaltado, onResalta }: { goles: GolConTipo[]; resaltado: string | null; onResalta: (k: string | null) => void }) {
  const ALTO = 230;
  const EJE = ALTO / 2;
  const R = 9;

  /* Los goles que caen en el mismo sitio se apilan hacia fuera del eje. */
  const colocados: (GolConTipo & { x: number; y: number })[] = [];

  for (const g of [...goles].sort((a, b) => xDe(a) - xDe(b))) {
    const x = xDe(g);
    const mismos = colocados.filter((c) => c.aFavor === g.aFavor && Math.abs(c.x - x) < R * 2);
    /* Cada punto lleva su minuto al lado de fuera: los apilados dejan sitio para él. */
    const paso = R * 2 + 14;
    const y = g.aFavor ? EJE - 22 - mismos.length * paso : EJE + 30 + mismos.length * paso;

    colocados.push({ ...g, x, y });
  }

  const marcas = [1, 15, 30, 45, 60, 75, 90];

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" role="img" aria-label="Los goles en su minuto, con su tipo">
      {/* Fondos: cada parte y los descuentos. */}
      <rect x={MARGEN} y={EJE - 100} width={X_DESC1 - MARGEN - 6} height={200} rx={8} fill="currentColor" opacity={0.03} />
      <rect x={X_DESC1 - 4} y={EJE - 100} width={X_P2 - X_DESC1 - 6} height={200} rx={8} fill="#C8A96B" opacity={0.08} />
      <rect x={X_P2} y={EJE - 100} width={X_DESC2 - X_P2 - 6} height={200} rx={8} fill="currentColor" opacity={0.03} />
      <rect x={X_DESC2 - 4} y={EJE - 100} width={ANCHO - X_DESC2 - MARGEN + 4} height={200} rx={8} fill="#C8A96B" opacity={0.08} />

      <text x={MARGEN + 6} y={EJE - 86} fontSize={11} fontWeight={700} letterSpacing={1.2} fill="var(--rmcf-gold-ink, #C8A96B)">
        A FAVOR
      </text>
      <text x={MARGEN + 6} y={EJE + 94} fontSize={11} fontWeight={700} letterSpacing={1.2} fill="#D95F02">
        EN CONTRA
      </text>

      <line x1={MARGEN} x2={ANCHO - MARGEN} y1={EJE} y2={EJE} stroke="currentColor" strokeOpacity={0.35} />
      {marcas.map((m) => {
        const x = xDe({ min: m, extra: 0, parte: m <= 45 ? 1 : 2 });

        return (
          <g key={m}>
            <line x1={x} x2={x} y1={EJE - 4} y2={EJE + 4} stroke="currentColor" strokeOpacity={0.4} />
            <text x={x} y={EJE + 16} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.45}>
              {m}&apos;
            </text>
          </g>
        );
      })}
      <text x={(X_DESC1 + X_P2) / 2 - 6} y={EJE + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#C8A96B">
        45+
      </text>
      <text x={(X_DESC2 + ANCHO) / 2 - 6} y={EJE + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#C8A96B">
        90+
      </text>

      {colocados.map((g) => {
        const color = g.tipoFinal ? COLOR_TIPO[g.tipoFinal] : SIN;
        const apagado = resaltado && resaltado !== g.tipoFinal && resaltado !== (g.tipoFinal ? FASE_DE[g.tipoFinal] : "sin");

        return (
          <g key={g.clave} opacity={apagado ? 0.15 : 1} onMouseEnter={() => onResalta(g.tipoFinal)} onMouseLeave={() => onResalta(null)} style={{ cursor: "default" }}>
            <line x1={g.x} x2={g.x} y1={EJE} y2={g.y} stroke={color} strokeOpacity={0.35} />
            <circle cx={g.x} cy={g.y} r={R} fill={color} stroke={g.aFavor ? "none" : "#fff"} strokeWidth={g.aFavor ? 0 : 1.5} />
            <text x={g.x} y={g.aFavor ? g.y - R - 4 : g.y + R + 11} textAnchor="middle" fontSize={10} fontWeight={600} fill="currentColor" opacity={0.7}>
              {rotuloMinuto(g)}
            </text>
            <title>{`J${g.partido.jornada} · ${rotuloMinuto(g)} · ${g.jugador || "—"} · ${g.aFavor ? "a favor" : "en contra"} · ${g.tipoFinal ? NOMBRE_TIPO[g.tipoFinal] : "sin clasificar"}\n${g.partido.local} ${g.partido.gl}-${g.partido.gv} ${g.partido.visitante}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Los dos juntos                                                     */
/* ------------------------------------------------------------------ */

export function GraficasTipologia({ goles, colorFavor, colorContra }: { goles: GolConTipo[]; colorFavor: string; colorContra: string }) {
  const [resaltado, setResaltado] = useState<string | null>(null);
  const favor = goles.filter((g) => g.aFavor);
  const contra = goles.filter((g) => !g.aFavor);
  const usados = new Set(goles.map((g) => g.tipoFinal ?? "sin"));

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <Anillo titulo="A favor" goles={favor} color={colorFavor} resaltado={resaltado} onResalta={setResaltado} />
        <Anillo titulo="En contra" goles={contra} color={colorContra} resaltado={resaltado} onResalta={setResaltado} />
        <div className="min-w-0">
          <p className="mb-2 text-[11px] text-white/45">Anillo de dentro: la fase. De fuera: el tipo. Pasa por encima para resaltarlo.</p>
          <Leyenda usados={usados} resaltado={resaltado} onResalta={setResaltado} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Cuándo y cómo: cada punto es un gol en su minuto</p>
        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-[560px] text-white">
            <LineaGoles goles={goles} resaltado={resaltado} onResalta={setResaltado} />
          </div>
        </div>
      </div>
    </div>
  );
}
