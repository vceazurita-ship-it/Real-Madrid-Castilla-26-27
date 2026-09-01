"use client";

/**
 * El pie de lectura que lleva cada sección de balón parado.
 *
 * Un gráfico filtrado enseña un número sin escala: «28 % de peligro» no se
 * puede juzgar sin saber cuánto es el global ni si viene de más o de menos.
 * Esto pone las tres cosas debajo de cada panel —muestra, comparación con el
 * global y tendencia por jornadas— con las mismas palabras en las cinco
 * páginas.
 *
 * Las cuentas están en `lib/abp/analisis.ts`. Aquí sólo se pintan, y se
 * traducen las filas de cada página al evento común con un `lector`: es lo
 * único que cambia entre córners, saques de banda y scouting rival.
 */

import { useMemo } from "react";

import {
  analizaSeccion,
  type ClaveMetrica,
  type Comparativa,
  type Etiquetas,
  type EventoAnalisis,
  type PuntoSerie,
  type Sentido,
  type Tendencia,
  type Tono,
} from "@/lib/abp/analisis";
import type { JornadaAbp } from "@/lib/abp/partido";

/* ------------------------------------------------------------------ */
/*  LECTOR                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cómo se lee una fila de la página.
 *
 * Se declara **una vez por página** y se pasa a todas sus secciones: si cada
 * panel decidiera por su cuenta qué es peligro, dos gráficos de la misma
 * pantalla dirían cosas distintas del mismo partido.
 */
export type LectorAnalisis<T> = {
  jornada: (fila: T) => JornadaAbp;
  /** Acabó en gol u ocasión para el sujeto de la página. */
  peligro: (fila: T) => boolean;
  gol: (fila: T) => boolean;
  remate: (fila: T) => boolean;
  xg: (fila: T) => number;
  /** Sólo el saque de banda las registra; en córner se quedan en falso. */
  progresion?: (fila: T) => boolean;
  retencion?: (fila: T) => boolean;
};

const TONO_COLOR: Record<Tono, string> = {
  bueno: "var(--rmcf-rate-good)",
  malo: "var(--rmcf-rate-low)",
  neutro: "var(--rmcf-gold-ink)",
};

const FLECHA: Record<Tono, string> = { bueno: "▲", malo: "▼", neutro: "→" };

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function Chapa({
  label,
  valor,
  detalle,
  color,
}: {
  label: string;
  valor: string;
  detalle?: string;
  color?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>

      <span
        className="text-[12px] font-semibold tabular-nums"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {valor}
      </span>

      {detalle && (
        <span className="truncate text-[11px] tabular-nums text-white/40">{detalle}</span>
      )}
    </span>
  );
}

function ChapaComparativa({
  dato,
  sinFiltro,
}: {
  dato: Comparativa;
  /** Sin filtro, lo filtrado y el global son lo mismo: la comparación sobra. */
  sinFiltro: boolean;
}) {
  if (dato.filtro == null) return null;

  return (
    <Chapa
      label={dato.label}
      valor={dato.valorTexto}
      detalle={
        sinFiltro
          ? undefined
          : dato.delta == null || Math.abs(dato.delta) < 0.005
            ? `= ${dato.globalTexto}`
            : `${dato.deltaTexto} vs ${dato.globalTexto}`
      }
      color={dato.tono === "neutro" ? undefined : TONO_COLOR[dato.tono]}
    />
  );
}

/**
 * La métrica jornada a jornada, del tamaño de un sello.
 *
 * Las jornadas se dibujan **equiespaciadas**, no por su número: entre la 3 y
 * la 7 puede no haber ninguna acción de esta sección, y estirar el hueco daría
 * una caída que no ha pasado. Lo que se lee es el orden, no el calendario.
 */
function Sparkline({ tendencia }: { tendencia: Tendencia }) {
  const puntos = tendencia.serie.filter(
    (punto): punto is PuntoSerie & { valor: number } => punto.valor != null,
  );

  if (puntos.length < 2) return null;

  const ancho = 220;
  const alto = 54;
  const margen = 6;

  const valores = puntos.map((punto) => punto.valor);

  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const rango = max - min || Math.max(1, max || 1);

  const x = (i: number) =>
    margen + (i * (ancho - margen * 2)) / Math.max(1, puntos.length - 1);

  const y = (valor: number) =>
    alto - margen - ((valor - min) / rango) * (alto - margen * 2);

  const linea = puntos.map((punto, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(punto.valor)}`).join(" ");

  const area = `${linea} L${x(puntos.length - 1)},${alto} L${x(0)},${alto} Z`;

  const color = TONO_COLOR[tendencia.tono];

  /* La mitad reciente va sombreada: es la que manda en el veredicto. */
  const desdeReciente = puntos.length - tendencia.jornadasReciente;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-[54px] w-full"
      role="img"
      aria-label={tendencia.texto}
    >
      {tendencia.jornadasReciente > 0 && desdeReciente > 0 && (
        <rect
          x={(x(desdeReciente - 1) + x(desdeReciente)) / 2}
          y={0}
          width={ancho - (x(desdeReciente - 1) + x(desdeReciente)) / 2}
          height={alto}
          fill="currentColor"
          className="text-white/[0.05]"
        />
      )}

      <path d={area} fill={color} opacity={0.12} />

      <path
        d={linea}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {puntos.map((punto, i) => (
        <circle
          key={punto.clave}
          cx={x(i)}
          cy={y(punto.valor)}
          r={i === puntos.length - 1 ? 3 : 2}
          fill={i === puntos.length - 1 ? color : "var(--rmcf-page, #0B0F14)"}
          stroke={color}
          strokeWidth={1.4}
        >
          <title>{`${punto.etiqueta}: ${punto.valor.toFixed(2).replace(".", ",")} · ${punto.n} ${punto.n === 1 ? "acción" : "acciones"}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  EL PIE COMPLETO                                                    */
/* ------------------------------------------------------------------ */

export function AnalisisSeccion<T>({
  filas,
  todas,
  lector,
  metrica = "peligro",
  sentido = "ofensivo",
  dimension,
  categoria,
  unidad = "acciones",
  etiquetas,
  acompanan,
  destacado = false,
}: {
  /** Las filas que el filtro deja pasar. */
  filas: T[];
  /** Todas las filas de la página, sin filtrar: el global contra el que se compara. */
  todas: T[];
  lector: LectorAnalisis<T>;
  metrica?: ClaveMetrica;
  sentido?: Sentido;
  /** Cómo se llama la dimensión del panel: "tipo de acción", "zona de caída"… */
  dimension?: string;
  /** De dónde sale el valor de esa dimensión en cada fila. */
  categoria?: (fila: T) => string;
  unidad?: string;
  /** Cómo se llama cada métrica en esta página. */
  etiquetas?: Etiquetas;
  /** Las métricas de apoyo, cuando la página tiene otras que las de córner. */
  acompanan?: ClaveMetrica[];
  /** Más aire y letra, para la lectura de cabecera de la página. */
  destacado?: boolean;
}) {
  const analisis = useMemo(() => {
    const traduce = (fila: T): EventoAnalisis => ({
      jornada: lector.jornada(fila),
      xg: lector.xg(fila),
      remate: lector.remate(fila),
      gol: lector.gol(fila),
      peligro: lector.peligro(fila),
      progresion: lector.progresion?.(fila) ?? false,
      retencion: lector.retencion?.(fila) ?? false,
      categoria: categoria ? (categoria(fila) ?? "") : "",
    });

    return analizaSeccion({
      filtradas: filas.map(traduce),
      globales: todas.map(traduce),
      metrica,
      sentido,
      dimension: categoria ? dimension : undefined,
      unidad,
      etiquetas,
      acompanan,
    });
  }, [
    filas,
    todas,
    lector,
    metrica,
    sentido,
    dimension,
    categoria,
    unidad,
    etiquetas,
    acompanan,
  ]);

  const { muestra, principal, secundarias, tendencia } = analisis;

  if (muestra.total === 0) return null;

  const colorVeredicto = TONO_COLOR[tendencia.tono];

  return (
    <section
      className={`min-w-0 border-t border-white/10 bg-white/[0.02] ${
        destacado ? "rounded-2xl border border-white/10 p-4 sm:p-5" : "px-4 py-3.5 sm:px-5"
      }`}
      aria-label="Análisis de la sección"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#C8A96B]">
          {muestra.sinFiltro ? "Lectura · global" : "Lectura · según el filtro"}
        </p>

        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            color: colorVeredicto,
            borderColor: `color-mix(in srgb, ${colorVeredicto} 35%, transparent)`,
            background: `color-mix(in srgb, ${colorVeredicto} 10%, transparent)`,
          }}
        >
          {FLECHA[tendencia.tono]} {tendencia.etiqueta}
        </span>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Chapa
              label="Muestra"
              valor={`${muestra.filtradas}/${muestra.total}`}
              detalle={
                muestra.sinFiltro
                  ? `${muestra.jornadasTotal} ${muestra.jornadasTotal === 1 ? "jornada" : "jornadas"}`
                  : `${Math.round(muestra.cuota)} % · ${muestra.jornadas} ${muestra.jornadas === 1 ? "jorn." : "jorn."}`
              }
            />

            <ChapaComparativa dato={principal} sinFiltro={muestra.sinFiltro} />

            {secundarias.map((dato) => (
              <ChapaComparativa
                key={dato.clave}
                dato={dato}
                sinFiltro={muestra.sinFiltro}
              />
            ))}
          </div>

          <p
            className={`mt-3 leading-relaxed text-white/60 ${
              destacado ? "text-[13px]" : "text-[12px]"
            }`}
          >
            {analisis.titular}
          </p>
        </div>

        <div className="min-w-0">
          <Sparkline tendencia={tendencia} />

          {tendencia.serie.length > 1 ? (
            <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-white/30">
              <span>{tendencia.serie[0].corto}</span>
              <span className="text-white/25">
                {principal.label} · {tendencia.serie.length} jorn.
              </span>
              <span>{tendencia.serie[tendencia.serie.length - 1].corto}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default AnalisisSeccion;
