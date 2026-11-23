"use client";

/**
 * PROYECCIÓN DEL JUEGO · SI LE DEJAMOS TOCAR, ¿SE NOS VA? (Plan de partido,
 * 18/11/2026). Dispersión con un punto por partido del rival: PPDA de su
 * oponente (X) contra sus pases por posesión (Y), con la recta, la r y dos
 * escenarios nuestros sobre la recta: como venimos (PPDA medio de los últimos
 * 5) y en bloque bajo (el tercio de partidos en que menos presionamos).
 *
 * Datos: `opta:partidos` por `useOptaLigero`, cruzado con `casaEquipo` como en
 * «¿Se le rompe la salida?». Cuentas en `lib/proyeccion/pases-segun-presion.ts`.
 * Sin cruce o sin dato, no se pinta. Nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { useAsoma } from "@/hooks/useAsoma";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { fechaCorta } from "@/lib/opta-analisis";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import { MIN_PARTIDOS, ULTIMOS, pasesSegunPresion, type PasesSegunPresion as Datos } from "@/lib/proyeccion/pases-segun-presion";

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const signo = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), d)}`;
/** El escenario «en bloque bajo», en un tono que se distingue del oro en día y noche. */
const BAJO = COMPARADO;

export function PasesSegunPresion({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && <Contenido equipo={equipo} />}</div>;
}

function Contenido({ equipo }: { equipo: string }) {
  const { opta } = useOptaLigero();

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombre = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const porEquipo = partidosPorEquipo(opta.partidos);
    const p = pasesSegunPresion(porEquipo.get(rivalId) ?? [], porEquipo.get(CASTILLA_OPTA) ?? []);
    return p ? { p, nombre } : null;
  }, [opta, equipo]);

  if (!datos) return null;
  const { p, nombre } = datos;
  const { puntos, r, lectura, venimos, bloqueBajo } = p;

  const titular =
    lectura === "depende"
      ? "Su juego depende de que le dejen"
      : lectura === "mantiene"
        ? "Juega igual le aprieten o no"
        : lectura === "algo"
          ? "Le dejan tocar y alarga algo la posesión"
          : `Con ${puntos.length} ${puntos.length === 1 ? "partido" : "partidos"} aún no hay recta`;

  const explica =
    lectura === "depende"
      ? `Su juego depende de que le dejen; presionar le acorta las posesiones: cuando su rival le quita tiempo, ${nombre} encadena menos pases.`
      : lectura === "mantiene"
        ? `${nombre} mantiene su forma de jugar aprieten o no: la altura del bloque no le cambia la posesión, así que elegirla por otras razones (salida, espalda, desgaste).`
        : lectura === "algo"
          ? `Hay relación, pero floja: presionarle le quita algún pase por posesión, no le cambia el juego.`
          : `Hacen falta ${MIN_PARTIDOS} partidos suyos con dato para trazar la recta.`;

  const diferencia = venimos && bloqueBajo ? bloqueBajo.pases - venimos.pases : null;
  /*
  | 20/11/2026 (jueces de fútbol y análisis): «3,1 frente a 3,1» con r = 0,44
  | en 12 partidos no lleva a ninguna decisión. Con menos de 15 partidos es
  | tendencia, y si la altura del bloque le cambia menos de 0,3 pases por
  | posesión, el detalle va plegado bajo «Ver más».
  */
  const tendencia = puntos.length < 15;
  const sinDecision = diferencia == null || Math.abs(diferencia) < 0.3;

  return (
    <section id="x-idea-2122635655683481916-1" aria-label="Si le dejamos tocar, ¿se nos va?" className="portada-tarjeta portada-entra mt-4 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Proyección del juego · si le dejamos tocar, ¿se nos va?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {puntos.length} {puntos.length === 1 ? "partido" : "partidos"} suyos{tendencia ? " · tendencia" : ""}
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">
        {explica}
        {sinDecision && diferencia != null && " La altura del bloque le cambia menos de 0,3 pases por posesión: no decide cómo presionarle."}
      </p>

      <details open={!sinDecision} className="mt-1">
      <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#C8A96B] hover:underline">{sinDecision ? "Ver más" : "Las cifras y la recta"}</summary>
      {(venimos || bloqueBajo || r != null) && (
        <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {venimos && (
            <Cifra
              color={ORO}
              valor={dec(venimos.pases)}
              que={`pases por posesión suyos si presionamos como venimos (nuestro PPDA ${dec(venimos.ppda)}, media de los últimos ${venimos.n})`}
            />
          )}
          {bloqueBajo && (
            <Cifra
              color={BAJO}
              valor={dec(bloqueBajo.pases)}
              que={`si vamos en bloque bajo (nuestro PPDA ${dec(bloqueBajo.ppda)}, los ${bloqueBajo.n} partidos en que menos apretamos)${diferencia != null ? `: ${signo(diferencia)} pases por posesión` : ""}`}
            />
          )}
          {r != null && <Cifra valor={`r = ${signo(r, 2)}`} que="correlación (+1: cuanto más le dejan, más toca; 0: nada que ver)" />}
        </ul>
      )}

      <Grafica datos={p} />

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="3.5" style={{ fill: tinta(0.45) }} /></svg>
          Cada partido suyo
        </span>
        {p.a != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: tinta(0.7), strokeWidth: 2.5 }} /></svg>
            Recta
          </span>
        )}
        {venimos && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden className="shrink-0"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" style={{ fill: ORO }} /></svg>
            Como venimos
          </span>
        )}
        {bloqueBajo && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden className="shrink-0"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" style={{ fill: BAJO }} /></svg>
            En bloque bajo
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-white/55">
        PPDA: pases que deja dar el defensor por cada acción defensiva; menos, más presión. Pases por posesión: pases intentados entre secuencias de posesión. Como venimos: nuestro PPDA medio de los últimos {ULTIMOS} partidos; en bloque bajo: el del tercio de partidos de la temporada con nuestro PPDA más alto. «Depende de que le dejen» si r ≥ 0,6; «juega igual» si r está entre −0,3 y 0,3.{tendencia ? ` Con menos de 15 partidos se lee como tendencia.` : ""}
      </p>
      </details>
    </section>
  );
}

function Cifra({ valor, que, color }: { valor: string; que: string; color?: string }) {
  return (
    <li className="portada-celda min-w-0 px-3 py-2">
      <span className="fuente-club block text-[24px] font-bold leading-none tabular-nums" style={{ color: color ?? tinta(0.92) }}>
        {valor}
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-white/65">{que}</span>
    </li>
  );
}

const W = 720;
const H = 260;
const M = { izq: 36, der: 14, arriba: 14, abajo: 36 };

function Grafica({ datos }: { datos: Datos }) {
  const { puntos, a, b, venimos, bloqueBajo } = datos;
  const escenarios = [
    venimos ? { e: venimos, color: ORO, rotulo: "Como venimos" } : null,
    bloqueBajo ? { e: bloqueBajo, color: BAJO, rotulo: "Bloque bajo" } : null,
  ].filter((x): x is NonNullable<typeof x> => x != null);

  const xs = [...puntos.map((q) => q.ppda), ...escenarios.map((s) => s.e.ppda)];
  const ys = [...puntos.map((q) => q.pases), ...escenarios.map((s) => s.e.pases)];
  let xLo = Math.min(...xs);
  let xHi = Math.max(...xs);
  const rx = xHi - xLo || 1;
  xLo = Math.max(0, xLo - rx * 0.08);
  xHi += rx * 0.08;
  const yLo = 0;
  const yHi = Math.max(...ys) * 1.15 || 1;

  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (v: number) => M.izq + ((v - xLo) / (xHi - xLo)) * ancho;
  const yDe = (v: number) => M.arriba + (1 - (Math.min(yHi, Math.max(yLo, v)) - yLo) / (yHi - yLo)) * alto;
  const marcasY = [0, yHi / 2, yHi];
  const marcasX = [xLo, (xLo + xHi) / 2, xHi];

  return (
    <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label="PPDA del oponente contra pases por posesión del rival, un punto por partido, con la recta y nuestros dos escenarios">
        {marcasY.map((m, i) => (
          <g key={`y${i}`}>
            <line x1={M.izq} x2={W - M.der} y1={yDe(m)} y2={yDe(m)} style={{ stroke: tinta(0.08), strokeWidth: 1 }} />
            <text x={M.izq - 4} y={yDe(m) + 3} textAnchor="end" style={{ fill: tinta(0.55), fontSize: 11 }}>
              {dec(m, 0)}
            </text>
          </g>
        ))}
        {marcasX.map((m, i) => (
          <text key={`x${i}`} x={xDe(m)} y={H - 20} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} style={{ fill: tinta(0.55), fontSize: 11 }}>
            {dec(m)}
          </text>
        ))}
        <text x={M.izq} y={H - 5} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          ← más le aprietan · PPDA de su oponente
        </text>
        <text x={W - M.der} y={H - 5} textAnchor="end" style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          le dejan tocar →
        </text>
        <text x={M.izq + 4} y={M.arriba + 10} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          Pases por posesión
        </text>
        {a != null && b != null && (
          <line
            x1={xDe(xLo)}
            y1={yDe(a + b * xLo)}
            x2={xDe(xHi)}
            y2={yDe(a + b * xHi)}
            pathLength={1}
            className="idea-trazo"
            style={{ stroke: tinta(0.7), strokeWidth: 2.5, strokeLinecap: "round" }}
          />
        )}
        {puntos.map((q, i) => (
          <circle
            key={`${q.fecha}-${i}`}
            cx={xDe(q.ppda)}
            cy={yDe(q.pases)}
            r={4.5}
            style={{ fill: tinta(0.4), stroke: "var(--portada-sup)", strokeWidth: 1.25 }}
          >
            <title>{`${fechaCorta(q.fecha)}${q.oponente ? ` · ante ${q.oponente}` : ""}: PPDA del oponente ${dec(q.ppda)}, ${dec(q.pases)} pases por posesión`}</title>
          </circle>
        ))}
        {escenarios.map(({ e, color, rotulo }, i) => {
          const x = xDe(e.ppda);
          const y = yDe(e.pases);
          const derecha = x < W / 2;
          return (
            <g key={rotulo}>
              <line x1={x} x2={x} y1={y} y2={M.arriba + alto} style={{ stroke: color, strokeWidth: 1.25, strokeDasharray: "4 3", opacity: 0.8 }} />
              <rect x={x - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x} ${y})`} style={{ fill: color, stroke: "var(--portada-sup)", strokeWidth: 1.5 }}>
                <title>{`${rotulo}: nuestro PPDA ${dec(e.ppda)} → ${dec(e.pases)} pases por posesión suyos`}</title>
              </rect>
              <text
                x={x + (derecha ? 10 : -10)}
                y={y + (i === 0 ? -10 : 18)}
                textAnchor={derecha ? "start" : "end"}
                style={{ fill: color, fontSize: 12, fontWeight: 700 }}
              >
                {`${rotulo} · ${dec(e.pases)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
