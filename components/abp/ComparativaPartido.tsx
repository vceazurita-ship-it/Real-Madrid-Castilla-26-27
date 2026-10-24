"use client";

/**
 * ESTE PARTIDO FRENTE A LA MEDIA DE LOS ANTERIORES.
 *
 * Lo primero que quiere saber el cuerpo técnico al abrir un análisis es si
 * lo del último partido es lo de siempre o una excepción: ocho faltas en
 * contra son muchas o pocas según cuántas se conceden normalmente. Por eso
 * este panel va el primero en faltas, robos, pérdidas, balón parado y saques
 * de banda: cada cifra del partido elegido, al lado de la media por partido
 * de los que se jugaron antes, y la diferencia con su color.
 *
 * El color sólo juzga cuando la métrica sabe hacia dónde es mejor
 * (`mejorAlto`): más remates a favor es bueno, más faltas en contra es malo,
 * y de la duración media de una posesión no se puede decir nada a secas.
 * Con un solo partido no hay media: se dice, en vez de enseñar un cero.
 */

import { GitCompareArrows } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { Explicativo } from "@/components/ui/textos-analisis";
import { chipInk } from "@/lib/theme";

const ORO = "#C8A96B";
/** El oro como texto: en modo día baja de luz para leerse sobre blanco. */
const ORO_TINTA = "var(--rmcf-gold-ink)";
/** Los dos de las gráficas de datos: separan bien también para daltonismo. */
const MEJOR = "#1B9E77";
const PEOR = "#D95F02";

export type MetricaComparada = {
  clave: string;
  nombre: string;
  /** Lo de este partido. `null` si no se puede calcular (sin filas, sin dato). */
  actual: number | null;
  /** La media por partido de los anteriores. `null` sin anteriores. */
  media: number | null;
  /** Cómo se escribe el número: por defecto, entero o con un decimal. */
  formato?: (n: number) => string;
  /** Cómo se escribe la diferencia: en un porcentaje es «puntos», no «%». */
  formatoDiferencia?: (n: number) => string;
  /** `true`: más es mejor; `false`: menos es mejor; `null`/sin poner: no se juzga. */
  mejorAlto?: boolean | null;
  /** Una línea de contexto: «de 23 saques», «remates y goles». */
  pie?: string;
  /** `true`: base pequeña; se escribe «tendencia» y no se dibujan las barras de comparación. */
  tendencia?: boolean;
  /** Lo que se lee en la diferencia cuando coinciden y la base es pequeña: «de 7 faltas». */
  igualEn?: string;
  /** Sobre cuántas acciones sale la cifra de este partido: «de 4 acciones». */
  de?: number;
  /** Del porcentaje, cuántas de esas acciones cumplen: «0 de 4». */
  n?: number;
  /** Cómo se llaman esas acciones: por defecto «acciones». */
  unidad?: string;
};

/** Con menos acciones que éstas, una diferencia es un indicio y no un dato. */
export const MUESTRA_MINIMA_FILA = 5;

export type TiraJornadas = {
  /** Cabecera de cada columna: «J3», «J4»… */
  jornadas: string[];
  filas: { clave: string; nombre: string; valores: (number | null)[]; formato?: (n: number) => string }[];
};

export type ComparativaPartidoProps = {
  /** «J7 · UD Ibiza», o lo que lea el usuario como el partido elegido. */
  partido: string;
  /** Cuántos partidos entran en la media, y cómo se llaman: «las 3 jornadas anteriores». */
  anteriores: { n: number; rotulo?: string };
  metricas: MetricaComparada[];
  title?: string;
  subtitle?: string;
  /** Una nota al pie: con qué filtros está hecha la media, o de dónde sale. */
  nota?: string;
  /** Las últimas jornadas una tras otra, para ver tendencia y no un solo punto. */
  tira?: TiraJornadas;
  className?: string;
};

/** 8.43 → «8,4»; 8 → «8». */
export function numeroCorto(n: number): string {
  const entero = Math.abs(n - Math.round(n)) < 0.05;

  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: entero ? 0 : 1,
  });
}

/**
 * Lo que se lee en pantalla: un porcentaje sin decimales, el resto con uno.
 * La diferencia se resta de estas cifras vistas y no de las sin redondear,
 * para que 17 % frente a 14 % no ponga «+2 puntos» (22/10/2026).
 */
function visto(n: number, porcentaje: boolean, formato?: (n: number) => string): number {
  /* Si la fila se escribe con dos decimales (xG: 0,08 y 0,22), la diferencia
     sale de esas mismas cifras y no de un redondeo a uno (−0,14, no −0,10). */
  if (formato && !porcentaje) {
    const leido = parseFloat(formato(n).replace(/\./g, "").replace(",", "."));

    if (Number.isFinite(leido)) return leido;
  }

  return porcentaje ? Math.round(n) : Math.round(n * 10) / 10;
}

/** +2,5 / −1 / 0, con el signo que se lee. */
function diferencia(d: number, formato: (n: number) => string, entrePorcentajes: boolean): string {
  if (Math.abs(d) < 0.05) return "igual";

  /* Entre dos porcentajes la diferencia son puntos, no un «% más». */
  if (entrePorcentajes) return `${d > 0 ? "+" : "−"}${Math.round(Math.abs(d))} pts`;

  return `${d > 0 ? "+" : "−"}${formato(Math.abs(d))}`;
}

export function ComparativaPartido({
  partido,
  anteriores,
  metricas,
  title = "Este partido frente a los anteriores",
  subtitle,
  nota,
  tira,
  className = "",
}: ComparativaPartidoProps) {
  const hayMedia = anteriores.n > 0 && metricas.some((m) => m.media !== null);
  const rotuloMedia =
    anteriores.rotulo ??
    (anteriores.n === 1 ? "el partido anterior" : `media de los ${anteriores.n} anteriores`);

  return (
    <Panel
      title={title}
      subtitle={subtitle ?? `${partido} · frente a ${rotuloMedia}`}
      icon={GitCompareArrows}
      className={className}
      bodyClassName="p-0"
    >
      {metricas.length === 0 ? (
        <p className="p-4 text-sm text-white/45 sm:p-5">No hay nada que comparar todavía.</p>
      ) : (
        <>
          {/* La cabecera de las columnas, para que las dos cifras se lean sin leyenda. */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-x-3 border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 sm:pl-5 sm:pr-16">
            <span>Métrica</span>
            <span className="text-right" style={{ color: ORO_TINTA }}>
              Este partido
            </span>
            <span className="text-right">{anteriores.n === 1 ? "Anterior" : `Media de las ${anteriores.n} anteriores`}</span>
            {/* La clave de colores va en la nota, que sólo sale con los textos
                explicativos: al pasar por encima se lee igual. */}
            <span className="text-right" title="Verde: mejor que de costumbre · naranja: peor · gris: no se juzga">
              <span className="sm:hidden">Dif.</span>
              <span className="hidden sm:inline">Diferencia</span>
            </span>
          </div>

          {/* Con pocos partidos detrás, la media es una tendencia y no una regla. */}
          {anteriores.n > 0 && anteriores.n <= 6 && (
            <p className="border-b border-white/10 px-4 py-2 text-[11px] italic text-white/50 sm:px-5">
              Tendencia: la media sale de {anteriores.n === 1 ? "un solo partido" : `${anteriores.n} partidos`}.
            </p>
          )}

          <ul className="divide-y divide-white/[0.06]">
            {metricas.map((m) => {
              const formato = m.formato ?? numeroCorto;
              const juzga = m.mejorAlto === true || m.mejorAlto === false;
              const porcentaje = formato === formatoPorcentaje;
              const d =
                m.actual !== null && m.media !== null
                  ? Math.round((visto(m.actual, porcentaje, formato) - visto(m.media, porcentaje, formato)) * 1000) / 1000
                  : null;
              /* Con menos de cinco acciones detrás, la fila se enseña pero no se juzga. */
              const indicio = m.de !== undefined && m.de < MUESTRA_MINIMA_FILA;
              const mejor = !indicio && d !== null && juzga && Math.abs(d) >= 0.05 ? (d > 0) === m.mejorAlto : null;
              const baseTexto =
                m.de === undefined
                  ? null
                  : m.n !== undefined
                    ? `${m.n} de ${m.de}`
                    : `de ${m.de} ${m.unidad ?? "acciones"}`;
              /* Como texto y en `style`, que la tabla del modo día no alcanza
                 (19/10/2026): el gris de «igual» era blanco y no se veía, y
                 el verde y el naranja puros no llegaban a leerse sobre blanco. */
              const colorDiferencia = mejor === null ? "rgb(var(--rmcf-ink-rgb) / .55)" : chipInk(mejor ? MEJOR : PEOR);
              /* Las dos barras comparten escala: la más larga es el mayor de los dos. */
              const tope = Math.max(m.actual ?? 0, m.media ?? 0, 0.0001);

              return (
                <li
                  key={m.clave}
                  style={indicio ? { opacity: 0.7 } : undefined}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-x-3 px-4 py-2.5 sm:pl-5 sm:pr-16"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white/85 sm:truncate">{m.nombre}</p>
                    {(m.pie || baseTexto || juzga) && (
                      <p className="text-[11px] text-white/35 sm:truncate">
                        {[baseTexto, m.pie && !/^(más|menos) es mejor$/.test(m.pie) ? m.pie : null].filter(Boolean).join(" · ")}
                        {indicio ? " · indicio" : ""}
                        {/* El sentido, siempre y con su color, para no mezclar filas de «más» y de «menos». */}
                        {juzga && (
                          <span
                            className="font-medium"
                            style={{ color: ORO_TINTA }}
                          >
                            {baseTexto || (m.pie && !/^(más|menos) es mejor$/.test(m.pie)) || indicio ? " · " : ""}
                            {m.mejorAlto ? "▲ más es mejor" : "▼ menos es mejor"}
                          </span>
                        )}
                      </p>
                    )}
                    {m.tendencia ? (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: "rgb(var(--rmcf-ink-rgb) / .55)" }}>tendencia, pocos casos</p>
                    ) : (
                    <div className="mt-1.5 space-y-1">
                      <span className="block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${m.actual === null ? 0 : (Math.max(0, m.actual) / tope) * 100}%`, background: ORO }}
                        />
                      </span>
                      <span className="block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full bg-white/35"
                          style={{ width: `${m.media === null ? 0 : (Math.max(0, m.media) / tope) * 100}%` }}
                        />
                      </span>
                    </div>
                    )}
                  </div>

                  <span className="text-right text-lg font-semibold tabular-nums" style={{ color: ORO_TINTA }}>
                    {m.actual === null ? "—" : formato(m.actual)}
                  </span>

                  <span className="text-right text-lg tabular-nums text-white/70">
                    {m.media === null ? "—" : formato(m.media)}
                  </span>

                  <span className="text-right text-sm font-semibold tabular-nums" style={{ color: colorDiferencia }}>
                    {d === null
                      ? "—"
                      : m.igualEn && Math.abs(d) < 0.05
                        ? m.igualEn
                        : diferencia(d, m.formatoDiferencia ?? formato, porcentaje)}
                  </span>
                </li>
              );
            })}
          </ul>

          {tira && tira.jornadas.length > 1 && (
            <div className="overflow-x-auto border-t border-white/10 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Últimas {tira.jornadas.length} jornadas
              </p>
              <table className="w-full min-w-[260px] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-white/40">
                    <th className="pb-1 text-left font-normal" />
                    {tira.jornadas.map((j, i) => (
                      <th
                        key={j}
                        className="pb-1 text-right font-medium"
                        style={i === tira.jornadas.length - 1 ? { color: ORO_TINTA } : undefined}
                      >
                        {j}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tira.filas.map((fila) => (
                    <tr key={fila.clave} className="border-t border-white/[0.06]">
                      <th className="py-1 pr-2 text-left font-normal text-white/70">{fila.nombre}</th>
                      {fila.valores.map((v, i) => (
                        <td
                          key={i}
                          className="py-1 text-right text-white/70"
                          style={i === fila.valores.length - 1 ? { color: ORO_TINTA, fontWeight: 600 } : undefined}
                        >
                          {v === null ? "" : (fila.formato ?? numeroCorto)(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cómo se calcula la media: método, sólo con los textos explicativos encendidos (14/10/2026). */}
          {hayMedia ? (
            <Explicativo>
              <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/35 sm:px-5">
                {nota ?? "La media es por partido, con los mismos filtros que lo que se está viendo. Verde: mejor que la media; naranja: peor; gris: no se juzga."}
              </p>
            </Explicativo>
          ) : (
            <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/35 sm:px-5">Es el primer partido: en cuanto haya otro saldrá aquí la media de los anteriores.</p>
          )}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Para calcular las medias sin repetir el bucle en cada pantalla     */
/* ------------------------------------------------------------------ */

/**
 * La media por partido de una cifra: se calcula sobre cada partido anterior
 * y se promedia. Un cociente (porcentaje) se calcula sumando los dos lados
 * de todos los partidos, nunca promediando porcentajes.
 */
export function mediaPorPartido<T>(partidos: T[][], cuenta: (filas: T[]) => number): number | null {
  if (partidos.length === 0) return null;

  return partidos.reduce((a, filas) => a + cuenta(filas), 0) / partidos.length;
}

/** Un porcentaje sumando numerador y denominador de todos los partidos. */
export function porcentajeAgregado<T>(
  partidos: T[][],
  numerador: (filas: T[]) => number,
  denominador: (filas: T[]) => number,
): number | null {
  if (partidos.length === 0) return null;

  const den = partidos.reduce((a, filas) => a + denominador(filas), 0);

  if (den === 0) return null;

  return (partidos.reduce((a, filas) => a + numerador(filas), 0) / den) * 100;
}

/** Un porcentaje de un solo partido, o `null` sin denominador. */
export function porcentajeDe<T>(filas: T[], numerador: (filas: T[]) => number, denominador: (filas: T[]) => number): number | null {
  const den = denominador(filas);

  return den === 0 ? null : (numerador(filas) / den) * 100;
}

/** «37 %», para las métricas en porcentaje. */
export const formatoPorcentaje = (n: number) => `${Math.round(n)} %`;

/** «5 puntos»: la diferencia entre dos porcentajes. */
export const formatoPuntos = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "punto" : "puntos"}`;
