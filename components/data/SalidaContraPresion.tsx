"use client";

/**
 * NUESTRA SALIDA CONTRA LA PRESIÓN (Análisis de datos → Nuestra historia,
 * 18/11/2026). Dispersión del Castilla: PPDA del rival en cada partido (X)
 * contra nuestras pérdidas en campo propio (Y), con la recta y su r. Encima,
 * dónde cae el próximo rival según su PPDA medio, las pérdidas que cabe
 * esperar y la media de la liga en ese mismo tramo de PPDA.
 *
 * Datos: `opta:partidos` por `useOptaLigero`; el próximo rival, del
 * calendario de BeSoccer (`useProximoRival`) cruzado con `casaEquipo`. Las
 * cuentas, en `lib/data-analisis/presion-salida-propia.ts`. Sin dato no se
 * pinta. Nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { useAsoma } from "@/hooks/useAsoma";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { fechaCorta } from "@/lib/opta-analisis";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import { MARGEN_PPDA, MIN_PARTIDOS, salidaPropia, type SalidaPropia } from "@/lib/data-analisis/presion-salida-propia";

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const signo = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), d)}`;

export function SalidaContraPresion() {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);

  return <div ref={caja} className="min-w-0">{abierto && <Contenido />}</div>;
}

function Contenido() {
  const { opta } = useOptaLigero();
  const proximo = useProximoRival();

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = proximo ? casaEquipo(proximo, equipos) : null;
    const rivalId = id && id !== CASTILLA_OPTA ? id : null;
    const nombre = rivalId ? equipos.find((e) => e.teamId === rivalId)?.equipo || proximo : "";
    const porEquipo = partidosPorEquipo(opta.partidos);
    /* La liga es el grupo del Castilla, sin nosotros. */
    const g = opta.grupos.get(CASTILLA_OPTA);
    const liga = [...porEquipo.entries()]
      .filter(([t]) => t !== CASTILLA_OPTA && (g == null || opta.grupos.get(t) === g))
      .map(([, ps]) => ps);
    const p = salidaPropia(porEquipo.get(CASTILLA_OPTA) ?? [], rivalId ? porEquipo.get(rivalId) ?? [] : [], liga);
    return p ? { p, nombre } : null;
  }, [opta, proximo]);

  if (!datos) return null;
  const { p, nombre } = datos;
  const { puntos, porPunto, r, lectura, ppdaRival, esperadas, ligaTramo, nLigaTramo, mediaComoNosotros, nComoNosotros } = p;

  const titular =
    lectura === "se rompe"
      ? "Cuanto más nos aprietan, más perdemos atrás"
      : lectura === "aguanta"
        ? "Nuestra salida aguanta la presión"
        : lectura === "algo"
          ? "Perdemos algo más atrás cuando nos aprietan, sin ser regla"
          : lectura === "al revés"
            ? "Perdemos más atrás cuando nos dejan jugar que cuando nos aprietan"
            : `Con ${puntos.length} ${puntos.length === 1 ? "partido" : "partidos"} aún no hay tendencia`;

  /* El aviso de la semana: lo que da la recta con el PPDA del próximo rival, contra la liga en ese tramo. */
  const aviso =
    esperadas != null && ppdaRival != null && nombre
      ? `${nombre} deja dar ${dec(ppdaRival)} pases por acción defensiva de media: con nuestra recta, cabe esperar ${dec(esperadas)} pérdidas nuestras en campo propio${
          ligaTramo != null ? `, frente a ${dec(ligaTramo)} de media en la liga ante una presión así` : ""
        }.${
          ligaTramo != null && esperadas - ligaTramo >= 1
            ? " Semana para preparar la salida contra presión."
            : ligaTramo != null && ligaTramo - esperadas >= 1
              ? " Salimos mejor que la liga ante esa presión."
              : ""
        }`
      : lectura == null
        ? `Hacen falta ${MIN_PARTIDOS} partidos con dato para calcular la tendencia.`
        : null;

  return (
    <section aria-label="Nuestra salida contra la presión" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Nuestra salida contra la presión
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {puntos.length} {puntos.length === 1 ? "partido" : "partidos"} nuestros
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      {aviso && <p className="mt-1 text-sm leading-6 text-white/70">{aviso}</p>}

      {(porPunto != null || r != null || esperadas != null) && (
        <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {porPunto != null && <Cifra valor={signo(porPunto, 2)} que="pérdidas nuestras en campo propio por cada punto menos de PPDA del rival" />}
          {r != null && <Cifra valor={`r = ${signo(r, 2)}`} que="correlación (−1: cuanto más nos aprietan, más perdemos; 0: nada que ver)" />}
          {esperadas != null && ppdaRival != null && (
            <Cifra
              azul
              valor={dec(esperadas)}
              que={`pérdidas esperadas ante ${nombre} (PPDA medio ${dec(ppdaRival)})${
                nComoNosotros ? `; ${dec(mediaComoNosotros ?? 0)} de media en nuestros ${nComoNosotros} ${nComoNosotros === 1 ? "partido" : "partidos"} ante esa presión` : ""
              }`}
            />
          )}
          {ligaTramo != null && ppdaRival != null && (
            <Cifra
              valor={dec(ligaTramo)}
              que={`media de la liga ante un PPDA de ${dec(Math.max(0, ppdaRival - MARGEN_PPDA))}–${dec(ppdaRival + MARGEN_PPDA)} (${nLigaTramo} ${nLigaTramo === 1 ? "partido" : "partidos"} de los demás equipos del grupo)`}
            />
          )}
        </ul>
      )}

      <Grafica datos={p} nombre={nombre} />

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="3.5" style={{ fill: tinta(0.45) }} /></svg>
          Cada partido nuestro
        </span>
        {ppdaRival != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="4" style={{ fill: ORO }} /></svg>
            Ante quien presiona como {nombre} (PPDA {dec(ppdaRival)} ± {dec(MARGEN_PPDA)})
          </span>
        )}
        {r != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: COMPARADO, strokeWidth: 2.5 }} /></svg>
            Tendencia y {nombre || "próximo rival"} sobre ella
          </span>
        )}
        {ligaTramo != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: tinta(0.6), strokeWidth: 2, strokeDasharray: "4 3" }} /></svg>
            Media de la liga en ese tramo
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-white/55">
        PPDA: pases que deja dar el rival por cada acción defensiva; menos, más presión. Pérdidas en campo propio: balones que perdemos en nuestro primer tercio. «Cuanto más nos aprietan, más perdemos» si r ≤ −0,5; «aguanta» si r está entre −0,3 y 0,3.
      </p>
    </section>
  );
}

function Cifra({ valor, que, azul = false }: { valor: string; que: string; azul?: boolean }) {
  return (
    <li className="portada-celda min-w-0 px-3 py-2">
      <span className="fuente-club block text-[24px] font-bold leading-none tabular-nums" style={{ color: azul ? COMPARADO : tinta(0.92) }}>
        {valor}
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-white/65">{que}</span>
    </li>
  );
}

const W = 560;
const H = 260;
const M = { izq: 36, der: 14, arriba: 14, abajo: 36 };

function Grafica({ datos, nombre }: { datos: SalidaPropia; nombre: string }) {
  const { puntos, a, b, ppdaRival, esperadas, ligaTramo } = datos;
  const xs = puntos.map((q) => q.ppda);
  const ys = puntos.map((q) => q.perdidas);
  if (ppdaRival != null) xs.push(ppdaRival - MARGEN_PPDA, ppdaRival + MARGEN_PPDA);
  if (esperadas != null) ys.push(esperadas);
  if (ligaTramo != null) ys.push(ligaTramo);

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
  const tramoIzq = ppdaRival != null ? Math.max(xLo, ppdaRival - MARGEN_PPDA) : 0;
  const tramoDer = ppdaRival != null ? Math.min(xHi, ppdaRival + MARGEN_PPDA) : 0;

  return (
    <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="PPDA del rival contra nuestras pérdidas en campo propio, un punto por partido">
        {ppdaRival != null && (
          <rect x={xDe(tramoIzq)} y={M.arriba} width={Math.max(0, xDe(tramoDer) - xDe(tramoIzq))} height={alto} style={{ fill: ORO, opacity: 0.1 }} />
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
          ← más nos aprietan · PPDA del rival
        </text>
        <text x={W - M.der} y={H - 5} textAnchor="end" style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          nos dejan jugar →
        </text>
        <text x={M.izq + 4} y={M.arriba + 10} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          Nuestras pérdidas en campo propio
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
        {ligaTramo != null && ppdaRival != null && (
          <line
            x1={xDe(tramoIzq)}
            x2={xDe(tramoDer)}
            y1={yDe(ligaTramo)}
            y2={yDe(ligaTramo)}
            style={{ stroke: tinta(0.6), strokeWidth: 2, strokeDasharray: "4 3" }}
          >
            <title>{`Media de la liga ante un PPDA así: ${dec(ligaTramo)} pérdidas en campo propio`}</title>
          </line>
        )}
        {puntos.map((q, i) => (
          <circle
            key={`${q.fecha}-${i}`}
            cx={xDe(q.ppda)}
            cy={yDe(q.perdidas)}
            r={q.comoNosotros ? 5.5 : 4.5}
            style={{ fill: q.comoNosotros ? ORO : tinta(0.45), stroke: "var(--portada-sup)", strokeWidth: 1.25 }}
          >
            <title>{`${fechaCorta(q.fecha)}${q.oponente ? ` · ante ${q.oponente}` : ""}: PPDA del rival ${dec(q.ppda)}, ${dec(q.perdidas, 0)} pérdidas nuestras en campo propio`}</title>
          </circle>
        ))}
        {esperadas != null && ppdaRival != null && (
          <g>
            <circle cx={xDe(ppdaRival)} cy={yDe(esperadas)} r={8} style={{ fill: "none", stroke: COMPARADO, strokeWidth: 2.5 }} />
            <circle cx={xDe(ppdaRival)} cy={yDe(esperadas)} r={3} style={{ fill: COMPARADO }} />
            <text
              x={xDe(ppdaRival) + (xDe(ppdaRival) > W * 0.7 ? -12 : 12)}
              y={yDe(esperadas) - 10}
              textAnchor={xDe(ppdaRival) > W * 0.7 ? "end" : "start"}
              style={{ fill: COMPARADO, fontSize: 12, fontWeight: 700 }}
            >
              {`${nombre}: ${dec(esperadas)}`}
            </text>
            <title>{`${nombre}, PPDA medio ${dec(ppdaRival)}: cabe esperar ${dec(esperadas)} pérdidas nuestras en campo propio`}</title>
          </g>
        )}
      </svg>
    </figure>
  );
}
