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

/** +2,5 / −1 / 0, con el signo que se lee. */
function diferencia(actual: number, media: number, formato: (n: number) => string): string {
  const d = actual - media;

  if (Math.abs(d) < 0.05) return "igual";

  return `${d > 0 ? "+" : "−"}${formato(Math.abs(d))}`;
}

export function ComparativaPartido({
  partido,
  anteriores,
  metricas,
  title = "Este partido frente a los anteriores",
  subtitle,
  nota,
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
            <span className="text-right">{anteriores.n === 1 ? "Anterior" : "Media anteriores"}</span>
            {/* La clave de colores va en la nota, que sólo sale con los textos
                explicativos: al pasar por encima se lee igual. */}
            <span className="text-right" title="Verde: mejor que de costumbre · naranja: peor · gris: no se juzga">
              Diferencia
            </span>
          </div>

          <ul className="divide-y divide-white/[0.06]">
            {metricas.map((m) => {
              const formato = m.formato ?? numeroCorto;
              const juzga = m.mejorAlto === true || m.mejorAlto === false;
              const d = m.actual !== null && m.media !== null ? m.actual - m.media : null;
              const mejor = d !== null && juzga && Math.abs(d) >= 0.05 ? (d > 0) === m.mejorAlto : null;
              /* Como texto y en `style`, que la tabla del modo día no alcanza
                 (19/10/2026): el gris de «igual» era blanco y no se veía, y
                 el verde y el naranja puros no llegaban a leerse sobre blanco. */
              const colorDiferencia = mejor === null ? "rgb(var(--rmcf-ink-rgb) / .55)" : chipInk(mejor ? MEJOR : PEOR);
              /* Las dos barras comparten escala: la más larga es el mayor de los dos. */
              const tope = Math.max(m.actual ?? 0, m.media ?? 0, 0.0001);

              return (
                <li
                  key={m.clave}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-x-3 px-4 py-2.5 sm:pl-5 sm:pr-16"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white/85">{m.nombre}</p>
                    {m.pie && <p className="truncate text-[11px] text-white/35">{m.pie}</p>}
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
                  </div>

                  <span className="text-right text-lg font-semibold tabular-nums" style={{ color: ORO_TINTA }}>
                    {m.actual === null ? "—" : formato(m.actual)}
                  </span>

                  <span className="text-right text-lg tabular-nums text-white/70">
                    {m.media === null ? "—" : formato(m.media)}
                  </span>

                  <span className="text-right text-sm font-semibold tabular-nums" style={{ color: colorDiferencia }}>
                    {d === null ? "—" : diferencia(m.actual!, m.media!, m.formatoDiferencia ?? formato)}
                  </span>
                </li>
              );
            })}
          </ul>

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
