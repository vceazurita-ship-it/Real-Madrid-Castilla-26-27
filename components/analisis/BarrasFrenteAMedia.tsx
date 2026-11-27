"use client";

/*
|--------------------------------------------------------------------------
| ESTE PARTIDO FRENTE A LOS ANTERIORES, EN BARRAS (17/11/2026, ronda 19)
|--------------------------------------------------------------------------
|
| Jueces de análisis y marketing: «Todas las cifras mejoran nuestra media…»
| era sólo texto, y la tabla de faltas repetía el método en cada fila con
| letra pequeña. Aquí cada cifra es una barra (este partido) con la raya de
| la media de los anteriores y una franja gris con su rango; a la derecha la
| cifra y la palabra («mejor», «peor», «normal») en todas las filas. El
| sentido (▲ más es mejor / ▼ menos es mejor) va junto al nombre y el método
| una sola vez, al pie.
|
| Lo usan robos, pérdidas y faltas en «Visual». La tabla de siempre sigue en
| «Detalle».
*/

import type { ReactNode } from "react";
import { formatoPorcentaje, type MetricaComparada } from "@/components/abp/ComparativaPartido";

const ORO = "#C8A96B";

function juicio(m: MetricaComparada): { palabra: string; color: string } {
  const a = m.actual!;
  const media = m.media!;

  const rango = m.rango && m.rango[0] !== m.rango[1] ? [Math.min(m.rango[0], m.rango[1]), Math.max(m.rango[0], m.rango[1])] : null;

  /* 17/11/2026 (ronda 20, fútbol): lo que no se juzga (las faltas a favor) dice igual dónde cae, como estilo. */
  if (m.mejorAlto !== true && m.mejorAlto !== false) {
    if (!rango) return { palabra: "", color: ORO };
    return { palabra: a > rango[1] ? "por encima de lo habitual" : a < rango[0] ? "por debajo de lo habitual" : "lo normal", color: ORO };
  }

  const dentro = rango ? a >= rango[0] && a <= rango[1] : Math.abs(a - media) < Math.max(0.5, Math.abs(media) * 0.1);
  const mejor = m.mejorAlto ? a > media : a < media;

  if (dentro) return { palabra: Math.abs(a - media) < Math.max(0.05, Math.abs(media) * 0.03) ? "igual" : mejor ? "normal, algo mejor" : "normal, algo peor", color: ORO };

  return mejor ? { palabra: "mejor", color: "var(--rmcf-dif-mejor, #1B9E77)" } : { palabra: "peor", color: "var(--rmcf-dif-peor, #D95F02)" };
}

/*
| 17/11/2026 (ronda 20, análisis): «peor» con 7 de 27 se leía como sentencia.
| Si la cifra del partido se apoya en menos de 15 acciones (lo dice su pie,
| «7 de 27…»), o el partido sale de otra fuente que la media, la palabra
| lleva «tendencia»; y «mejor»/«peor» dicen el rango con el que se miden.
*/
const UMBRAL_MUESTRA = 15;

function baseDe(m: MetricaComparada): number | null {
  const b = m.pie?.match(/^\d+ de (\d+)/)?.[1];
  return b ? Number(b) : null;
}

export function BarrasFrenteAMedia({
  metricas,
  anteriores,
  titulo,
  pie,
  tendencia = false,
  cabecera,
}: {
  metricas: MetricaComparada[];
  /** Cuántos partidos hay detrás de la media. */
  anteriores: number;
  titulo?: string;
  /** Una línea más al pie: con qué partidos (y de qué fuente) se compara. */
  pie?: string;
  /** Todo el bloque es tendencia (p. ej. el partido sale de Opta y la media, del vídeo). */
  tendencia?: boolean;
  /** 27/11/2026 (ronda 11): la conclusión de la semana dentro del mismo bloque, encima de las barras (opcional; sin ella, como siempre). */
  cabecera?: ReactNode;
}) {
  const filas = metricas.filter((m) => m.actual !== null && m.media !== null);

  if (filas.length === 0) return null;

  return (
    <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      {cabecera ? <div className="mb-3 min-w-0">{cabecera}</div> : null}
      {titulo ? <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">{titulo}</p> : null}
      <ul className="space-y-2.5">
        {filas.map((m) => {
          const f = m.formato ?? ((n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",")));
          const rango = m.rango && m.rango[0] !== m.rango[1] ? [Math.min(m.rango[0], m.rango[1]), Math.max(m.rango[0], m.rango[1])] : null;
          /* 27/11/2026 (ronda 9, fútbol): un porcentaje, en su escala de 0 a 100 %
             (con el tope en la propia cifra la barra salía siempre entera). */
          const esPct = m.formato === formatoPorcentaje;
          const tope = esPct ? 100 : Math.max(m.actual!, m.media!, rango?.[1] ?? 0, 0.0001) * 1.1;
          const pos = (v: number) => `${Math.max(0, Math.min(100, (v / tope) * 100))}%`;
          const j = juicio(m);
          const b = baseDe(m);
          /* 20/11/2026 (ronda 4, marketing): la fila con pocos casos (p. ej. 4 faltas en nuestro campo) también dice «tendencia». */
          const esTendencia = tendencia || Boolean(m.tendencia) || (b != null && b < UMBRAL_MUESTRA);
          const fuerte = j.palabra === "mejor" || j.palabra === "peor";
          const palabra = j.palabra ? `${j.palabra}${esTendencia ? ", tendencia" : ""}` : "";
          const sentido = m.mejorAlto === true ? "▲ más es mejor" : m.mejorAlto === false ? "▼ menos es mejor" : "estilo, sin veredicto";

          return (
            <li key={m.clave} className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_8rem_12.5rem] sm:items-center sm:gap-3">
              <span className="min-w-0 text-[13px] font-medium leading-tight text-white/85">
                {m.nombre}
                {sentido ? <span className="ml-1.5 text-[11px] font-normal text-white/55">{sentido}</span> : null}
              </span>
              <span className="relative block h-3 rounded-full bg-white/[0.06]" role="img" aria-label={`${m.nombre}: ${f(m.actual!)} frente a ${f(m.media!)} de media${rango ? `, rango de ${f(rango[0])} a ${f(rango[1])}` : ""}`}>
                {rango ? <span className="absolute inset-y-0 rounded-full bg-white/[0.12]" style={{ left: pos(rango[0]), width: `calc(${pos(rango[1])} - ${pos(rango[0])})` }} /> : null}
                <span className="absolute inset-y-[3px] left-0 rounded-full" style={{ width: pos(m.actual!), background: j.color }} />
                {/* 27/11/2026 (ronda 9): la raya de la media, en el color del texto
                    (la blanca no se veía en modo día), 2 px y más alta que la pista. */}
                <span className="absolute -inset-y-1.5 w-[2px] -translate-x-1/2 rounded" style={{ left: pos(m.media!), background: "rgb(var(--rmcf-ink-rgb) / .9)" }} />
              </span>
              <span className="flex items-baseline gap-2 whitespace-nowrap text-[12px] sm:justify-end">
                <span className="font-semibold tabular-nums text-white">{f(m.actual!)}</span>
                <span className="tabular-nums text-white/60">media {f(m.media!)}</span>
              </span>
              {/* 20/11/2026 (ronda 4, marketing): la palabra en su columna fija;
                  pegada al número rompía en tres líneas. */}
              <span className="min-w-0 text-[12px] font-semibold leading-tight" style={{ color: j.color === ORO ? "var(--rmcf-gold-ink)" : j.color }}>
                {palabra}
              </span>
              {/* 20/11/2026 (ronda 4, análisis): la regla junto a cada cifra, no
                  sólo al pie: dentro de la franja de los anteriores es lo normal. */}
              {rango || (fuerte && b != null) ? (
                <span className="text-[11px] leading-snug text-white/60 sm:col-start-2 sm:col-end-5">
                  {rango ? `${fuerte ? "Fuera de lo normal" : "Lo normal"}: de ${f(rango[0])} a ${f(rango[1])} en los ${anteriores} anteriores` : ""}
                  {rango && fuerte && b != null ? " · " : ""}
                  {fuerte && b != null ? `sobre ${b} acciones de este partido` : ""}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* 27/11/2026 (ronda 9, análisis): leyenda corta de tres piezas, con su
          muestra dibujada; el detalle (tendencia, fuentes) en una línea aparte. */}
      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-snug text-white/70">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-1.5 w-5 rounded-full" style={{ background: ORO }} />este partido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-[2px] rounded" style={{ background: "rgb(var(--rmcf-ink-rgb) / .9)" }} />
          raya: media de {anteriores === 1 ? "el partido anterior" : `los ${anteriores} anteriores`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-full bg-white/[0.12]" />franja: lo normal (mínimo a máximo)
        </span>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-white/55">
        {anteriores < 10 ? "Con menos de 10 partidos, tendencia. " : ""}Con menos de {UMBRAL_MUESTRA} acciones en el partido, también.
        {pie ? ` ${pie}` : ""}
      </p>
    </div>
  );
}
