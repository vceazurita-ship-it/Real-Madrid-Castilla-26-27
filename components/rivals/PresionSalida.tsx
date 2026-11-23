"use client";

/**
 * CÓMO SALE · ¿SE LE ROMPE LA SALIDA SI LE PRESIONAMOS? (Scout colectivo,
 * 18/11/2026). Dispersión con un punto por partido del rival: PPDA de su
 * oponente (X) contra sus pérdidas en campo propio (Y), con la recta, la
 * pendiente, la r y una frase. Los partidos contra equipos que presionan como
 * nosotros (nuestro PPDA medio ± 1,5), en oro y con su media aparte.
 *
 * Datos: `opta:partidos` por `useOptaLigero`, cruzado con `casaEquipo` como en
 * «¿Ha cambiado su modelo?». Las cuentas, en `lib/rivals/presion-salida.ts`.
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
import { MARGEN_PPDA, MIN_PARTIDOS, presionSalida } from "@/lib/rivals/presion-salida";

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const signo = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), d)}`;

export function PresionSalida({ equipo }: { equipo: string }) {
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
    const p = presionSalida(porEquipo.get(rivalId) ?? [], porEquipo.get(CASTILLA_OPTA) ?? []);
    return p ? { p, nombre } : null;
  }, [opta, equipo]);

  if (!datos) return null;
  const { p, nombre } = datos;
  const { puntos, porPunto, r, lectura, nuestroPpda, mediaComoNosotros, mediaResto, nComoNosotros } = p;

  const titular =
    lectura === "se rompe"
      ? "Cuanto más le aprietan, más pierde atrás"
      : lectura === "aguanta"
        ? "Aguanta la presión"
        : lectura === "algo"
          ? "Pierde algo más atrás cuando le aprietan, sin ser regla"
          : lectura === "al revés"
            ? "Pierde más atrás cuando le dejan jugar que cuando le aprietan"
            : `Con ${puntos.length} ${puntos.length === 1 ? "partido" : "partidos"} aún no hay tendencia`;

  const explica =
    lectura === "se rompe"
      ? `Presionarle arriba tiene premio: en los partidos en que el rival le deja dar menos pases, ${nombre} pierde más balones en su campo.`
      : lectura === "aguanta"
        ? `Le apriete mucho o poco su rival, ${nombre} pierde parecido en su campo: presionarle arriba no le rompe la salida y nos desgasta.`
        : lectura === "algo"
          ? `Hay algo de relación, pero floja: presionarle puede dar algún balón, no es un plan seguro.`
          : lectura === "al revés"
            ? `La presión no le hace perder más en su campo: cuando le aprietan, se la quita de encima.`
            : `Hacen falta ${MIN_PARTIDOS} partidos con dato para calcular la tendencia.`;

  return (
    <section id="x-idea-2122640996244533358-1" aria-label="¿Se le rompe la salida si le presionamos?" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Cómo sale · ¿se le rompe la salida si le presionamos?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {puntos.length} {puntos.length === 1 ? "partido" : "partidos"} suyos
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{explica}</p>

      {(porPunto != null || r != null || mediaComoNosotros != null) && (
        <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {porPunto != null && (
            <Cifra valor={`${signo(porPunto, 2)}`} que="pérdidas en su campo por cada punto menos de PPDA del rival" />
          )}
          {r != null && <Cifra valor={`r = ${signo(r, 2)}`} que="correlación (−1: cuanto más le aprietan, más pierde; 0: nada que ver)" />}
          {mediaComoNosotros != null && nuestroPpda != null && (
            <Cifra
              oro
              valor={dec(mediaComoNosotros)}
              que={`pérdidas de media en ${nComoNosotros} ${nComoNosotros === 1 ? "partido" : "partidos"} ante quien presiona como nosotros (PPDA ${dec(nuestroPpda - MARGEN_PPDA)}–${dec(nuestroPpda + MARGEN_PPDA)})${mediaResto != null ? `; ${dec(mediaResto)} en el resto` : ""}`}
            />
          )}
        </ul>
      )}

      <Grafica datos={p} />

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="3.5" style={{ fill: tinta(0.45) }} /></svg>
          Cada partido
        </span>
        {nuestroPpda != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="4" style={{ fill: ORO }} /></svg>
            Ante quien presiona como nosotros (nuestro PPDA {dec(nuestroPpda)} ± {dec(MARGEN_PPDA)})
          </span>
        )}
        {r != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: COMPARADO, strokeWidth: 2.5 }} /></svg>
            Tendencia
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-white/55">
        PPDA: pases que deja dar el oponente por cada acción defensiva; menos, más presión. Pérdidas en campo propio: balones perdidos en su primer tercio. «Cuanto más le aprietan, más pierde» si r ≤ −0,5; «aguanta» si r está entre −0,3 y 0,3.
      </p>
    </section>
  );
}

function Cifra({ valor, que, oro = false }: { valor: string; que: string; oro?: boolean }) {
  return (
    <li className="portada-celda min-w-0 px-3 py-2">
      <span className="fuente-club block text-[24px] font-bold leading-none tabular-nums" style={{ color: oro ? ORO : tinta(0.92) }}>
        {valor}
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-white/65">{que}</span>
    </li>
  );
}

const W = 720;
const H = 260;
const M = { izq: 36, der: 14, arriba: 14, abajo: 36 };

function Grafica({ datos }: { datos: NonNullable<ReturnType<typeof presionSalida>> }) {
  const { puntos, a, b, nuestroPpda } = datos;
  const xs = puntos.map((q) => q.ppda);
  const ys = puntos.map((q) => q.perdidas);
  if (nuestroPpda != null) xs.push(nuestroPpda - MARGEN_PPDA, nuestroPpda + MARGEN_PPDA);

  let xLo = Math.min(...xs);
  let xHi = Math.max(...xs);
  const rx = xHi - xLo || 1;
  xLo = Math.max(0, xLo - rx * 0.08);
  xHi += rx * 0.08;
  const yLo = 0;
  const yHi = Math.max(...ys) * 1.12 || 1;

  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (v: number) => M.izq + ((v - xLo) / (xHi - xLo)) * ancho;
  const yDe = (v: number) => M.arriba + (1 - (v - yLo) / (yHi - yLo)) * alto;
  const marcasY = [0, yHi / 2, yHi];
  const marcasX = [xLo, (xLo + xHi) / 2, xHi];

  return (
    <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label="PPDA del oponente contra pérdidas en campo propio, un punto por partido">
        {nuestroPpda != null && (
          <rect
            x={xDe(Math.max(xLo, nuestroPpda - MARGEN_PPDA))}
            y={M.arriba}
            width={Math.max(0, xDe(Math.min(xHi, nuestroPpda + MARGEN_PPDA)) - xDe(Math.max(xLo, nuestroPpda - MARGEN_PPDA)))}
            height={alto}
            style={{ fill: ORO, opacity: 0.1 }}
          />
        )}
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
          le dejan jugar →
        </text>
        <text x={M.izq + 4} y={M.arriba + 10} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          Pérdidas en su campo
        </text>
        {a != null && b != null && (
          <line
            x1={xDe(xLo)}
            y1={yDe(Math.min(yHi, Math.max(yLo, a + b * xLo)))}
            x2={xDe(xHi)}
            y2={yDe(Math.min(yHi, Math.max(yLo, a + b * xHi)))}
            pathLength={1}
            className="idea-trazo"
            style={{ stroke: COMPARADO, strokeWidth: 2.5, strokeLinecap: "round" }}
          />
        )}
        {puntos.map((q, i) => (
          <circle
            key={`${q.fecha}-${i}`}
            cx={xDe(q.ppda)}
            cy={yDe(q.perdidas)}
            r={q.comoNosotros ? 5.5 : 4.5}
            style={{ fill: q.comoNosotros ? ORO : tinta(0.45), stroke: "var(--portada-sup)", strokeWidth: 1.25 }}
          >
            <title>{`${fechaCorta(q.fecha)}${q.oponente ? ` · ante ${q.oponente}` : ""}: PPDA del oponente ${dec(q.ppda)}, ${dec(q.perdidas, 0)} pérdidas en su campo${q.comoNosotros ? " · presiona como nosotros" : ""}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
