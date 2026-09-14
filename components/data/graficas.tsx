"use client";

/**
 * Las piezas de dibujo del análisis de datos.
 *
 * Todo se dibuja a mano en SVG y HTML, sin librería de gráficas. No es
 * cabezonería: cada forma de aquí tiene una regla que ninguna librería aplica
 * sola —el percentil va orientado a «bien/mal» y no a «alto/bajo», la mediana
 * de la liga es una marca y no una serie, el Castilla se distingue por su color
 * de club y todos los demás son fondo— y pelearse con las opciones de una
 * librería para conseguir eso sale más caro que ponerlo.
 *
 * **La paleta está comprobada, no elegida a ojo.** Verde azulado `#1B9E77` y
 * naranja `#D95F02` son el par divergente: pasan las seis comprobaciones del
 * validador —banda de luminosidad, croma, separación para daltonismo (ΔE 11,6
 * en deuteranopía), contraste— sobre el fondo oscuro **y** sobre el blanco. El
 * verde y el rojo de manual no las pasan: para un deuteranope son el mismo
 * color. Aun así el signo va escrito además de pintado, que el color nunca sea
 * el único que lo dice.
 *
 * El oro del club marca al Castilla y el resto de equipos van en tinta al 28 %:
 * no es una paleta de dos series, es una cosa destacada sobre un fondo que debe
 * ser fondo. La identidad la lleva el rótulo de cada barra, no el color.
 */

import { useEffect, useId, useMemo, useState } from "react";

import { formatea, type Unidad } from "@/lib/data-analisis/metricas";
import {
  buscadorDeEscudos,
  traeEscudos,
  type Escudos,
} from "@/lib/data-analisis/escudos";

/* ------------------------------------------------------------------ */
/*  ESCUDOS                                                            */
/* ------------------------------------------------------------------ */

/**
 * El escudo de cada equipo, para quien lo quiera pintar.
 *
 * Lo piden los gráficos por su cuenta y no por una prop que atraviese media
 * pantalla: la lista se pide **una vez por pestaña** —`traeEscudos` guarda la
 * promesa— así que da igual cuántos gráficos la usen.
 *
 * Mientras no llega, y si no llega nunca, devuelve `null` para todos y los
 * gráficos pintan discos, que es como estaban antes.
 */
export function useEscudos() {
  const [lista, setLista] = useState<Escudos>([]);

  useEffect(() => {
    let vivo = true;

    void traeEscudos().then((escudos) => {
      if (vivo) setLista(escudos);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return useMemo(() => buscadorDeEscudos(lista), [lista]);
}

/* ------------------------------------------------------------------ */
/*  COLOR                                                              */
/* ------------------------------------------------------------------ */

export const MEJOR = "#1B9E77";
export const PEOR = "#D95F02";

/** Tinta del tema al tanto por uno que se pida. Vale en día y en noche. */
export const tinta = (alfa: number) => `rgb(var(--rmcf-ink-rgb) / ${alfa})`;

export const ORO = "var(--rmcf-gold-ink)";

/* ------------------------------------------------------------------ */
/*  BARRA DE PERCENTIL                                                 */
/* ------------------------------------------------------------------ */

export type FilaPercentil = {
  key: string;
  nombre: string;
  unidad: Unidad;
  /** `null` cuando la métrica es estilo y no rendimiento. */
  mejorAlto: boolean | null;
  valor: number | null;
  mediana: number | null;
  percentil: number | null;
  puesto: number | null;
  deCuantos: number;
  comoLeer: string;
};

/**
 * Una métrica del Castilla frente a la liga.
 *
 * La barra va de 0 a 100 y **siempre significa lo mismo**: a la derecha, mejor.
 * En PPDA o en pérdidas eso quiere decir que el número es bajo; el percentil ya
 * viene dado la vuelta desde `metricas.ts`, así que aquí no hay que pensar.
 *
 * La marca del 50 es la mediana de la liga, no el centro del dibujo: es la
 * referencia contra la que se lee todo.
 */
export function BarraPercentil({ fila }: { fila: FilaPercentil }) {
  const [abierta, setAbierta] = useState(false);

  const pct = fila.percentil;

  const esEstilo = fila.mejorAlto === null;

  const color = esEstilo
    ? tinta(0.45)
    : pct === null
      ? tinta(0.25)
      : pct >= 50
        ? MEJOR
        : PEOR;

  return (
    <div className="min-w-0 border-b border-white/[0.06] py-2 last:border-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          title="Ver cómo se lee"
          className="min-w-0 flex-1 truncate text-left text-[13px] text-white/80 transition hover:text-white"
        >
          {fila.nombre}
        </button>

        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
          {formatea(fila.valor, fila.unidad)}
        </span>

        <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-white/35">
          liga {formatea(fila.mediana, fila.unidad)}
        </span>

        <span
          className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums"
          style={{ color: esEstilo ? tinta(0.45) : color }}
        >
          {fila.puesto ? `${fila.puesto}º/${fila.deCuantos}` : "—"}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {/* La pista, con la mediana marcada en el centro. */}
        <div
          className="relative h-2 min-w-0 flex-1 rounded-full"
          style={{ background: tinta(0.08) }}
        >
          <span
            className="absolute inset-y-[-3px] w-px"
            style={{ left: "50%", background: tinta(0.3) }}
            aria-hidden
          />

          {pct !== null && (
            <span
              className="absolute inset-y-0 rounded-full"
              style={{
                /* Desde la mediana hacia el lado que toque: así el dibujo
                   dice de un vistazo cuánto se separa uno de la liga. */
                left: `${Math.min(50, pct)}%`,
                width: `${Math.abs(pct - 50)}%`,
                background: color,
              }}
            />
          )}
        </div>

        <span
          className="w-9 shrink-0 text-right text-[10px] tabular-nums"
          style={{ color: tinta(0.4) }}
        >
          {pct === null ? "—" : `p${Math.round(pct)}`}
        </span>
      </div>

      {abierta && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
          {fila.comoLeer}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BARRAS ORDENADAS                                                   */
/* ------------------------------------------------------------------ */

export type FilaEquipo = { equipo: string; valor: number | null };

/**
 * Todos los equipos en una métrica, de mejor a peor.
 *
 * El orden lo manda `mejorAlto`, no el número: en PPDA el primero es el que
 * menos tiene. El Castilla va en oro y los demás en tinta apagada, y cada barra
 * lleva su nombre escrito: el color destaca, pero quien identifica es el rótulo.
 */
export function BarrasEquipos({
  filas,
  unidad,
  mejorAlto,
  destacado,
  alPulsar,
}: {
  filas: FilaEquipo[];
  unidad: Unidad;
  mejorAlto: boolean | null;
  destacado: string;
  alPulsar?: (equipo: string) => void;
}) {
  const escudoDe = useEscudos();

  const orden = useMemo(() => {
    const conValor = filas.filter((f) => f.valor !== null) as {
      equipo: string;
      valor: number;
    }[];

    return [...conValor].sort((a, b) =>
      mejorAlto === false ? a.valor - b.valor : b.valor - a.valor,
    );
  }, [filas, mejorAlto]);

  const tope = Math.max(...orden.map((f) => Math.abs(f.valor)), 1);

  return (
    <div className="min-w-0 space-y-1">
      {orden.map((fila, indice) => {
        const esNuestro = fila.equipo === destacado;

        return (
          <button
            key={fila.equipo}
            type="button"
            onClick={() => alPulsar?.(fila.equipo)}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/[0.04]"
          >
            <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-white/25">
              {indice + 1}
            </span>

            {/* El escudo delante del nombre: se busca la fila por el escudo
                mucho antes que leyendo veinte rótulos. */}
            <span className="flex w-40 shrink-0 items-center gap-1.5">
              {escudoDe(fila.equipo) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={escudoDe(fila.equipo)!}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 shrink-0 object-contain"
                />
              ) : (
                <span className="h-4 w-4 shrink-0" aria-hidden />
              )}

              <span
                className={`min-w-0 truncate text-[12px] ${
                  esNuestro ? "font-semibold text-white" : "text-white/60"
                }`}
              >
                {fila.equipo}
              </span>
            </span>

            <span className="h-3 min-w-0 flex-1">
              <span
                className="block h-3 rounded-[3px]"
                style={{
                  width: `${Math.max(2, (Math.abs(fila.valor) / tope) * 100)}%`,
                  background: esNuestro ? ORO : tinta(0.28),
                }}
              />
            </span>

            <span
              className={`w-16 shrink-0 text-right text-[12px] tabular-nums ${
                esNuestro ? "font-semibold text-white" : "text-white/55"
              }`}
            >
              {formatea(fila.valor, unidad)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DISPERSIÓN                                                         */
/* ------------------------------------------------------------------ */

export type Punto = { equipo: string; x: number; y: number };

/**
 * Dos métricas a la vez, un punto por equipo.
 *
 * Es la forma de ver un estilo: cuánto se progresa contra cuánto se circula,
 * cuánto se presiona contra cuánto se concede. Las medianas parten el dibujo en
 * cuatro para poder decir «arriba a la derecha» y que signifique algo.
 */
export function Dispersion({
  puntos,
  etiquetaX,
  etiquetaY,
  unidadX,
  unidadY,
  destacado,
  alPulsar,
  rotulaTodos = false,
}: {
  puntos: Punto[];
  etiquetaX: string;
  etiquetaY: string;
  unidadX: Unidad;
  unidadY: Unidad;
  destacado: string;
  alPulsar?: (equipo: string) => void;
  /**
   * Escribe el rótulo de **todos** los puntos, no sólo el del destacado.
   *
   * Es lo que pide la nube de nuestra historia: ahí cada punto es una
   * temporada y sin el año no dice nada —«¿cuál de estos cinco es el 23/24?»—,
   * y son seis puntos, así que caben los seis rótulos. En la liga son veinte
   * equipos y ahí el nombre lo lleva el escudo.
   */
  rotulaTodos?: boolean;
}) {
  const id = useId();

  const [encima, setEncima] = useState<Punto | null>(null);

  const escudoDe = useEscudos();

  const W = 720;
  const H = 420;
  const M = { arriba: 16, derecha: 16, abajo: 38, izquierda: 52 };

  const dentroW = W - M.izquierda - M.derecha;
  const dentroH = H - M.arriba - M.abajo;

  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);

  const rango = (vals: number[]) => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const aire = (max - min) * 0.08 || 1;

    return { min: min - aire, max: max + aire };
  };

  const rx = rango(xs);
  const ry = rango(ys);

  const px = (v: number) => M.izquierda + ((v - rx.min) / (rx.max - rx.min)) * dentroW;
  const py = (v: number) => M.arriba + dentroH - ((v - ry.min) / (ry.max - ry.min)) * dentroH;

  const medX = [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const medY = [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)] ?? 0;

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-labelledby={`${id}-titulo`}
        >
          <title id={`${id}-titulo`}>
            {etiquetaY} frente a {etiquetaX}, un punto por equipo
          </title>

          {/* Las medianas: los cuatro cuadrantes son la lectura. */}
          <line
            x1={px(medX)}
            y1={M.arriba}
            x2={px(medX)}
            y2={M.arriba + dentroH}
            stroke={tinta(0.16)}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          <line
            x1={M.izquierda}
            y1={py(medY)}
            x2={M.izquierda + dentroW}
            y2={py(medY)}
            stroke={tinta(0.16)}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Ejes, recesivos. */}
          <line
            x1={M.izquierda}
            y1={M.arriba + dentroH}
            x2={M.izquierda + dentroW}
            y2={M.arriba + dentroH}
            stroke={tinta(0.2)}
            strokeWidth={1}
          />

          <line
            x1={M.izquierda}
            y1={M.arriba}
            x2={M.izquierda}
            y2={M.arriba + dentroH}
            stroke={tinta(0.2)}
            strokeWidth={1}
          />

          {[rx.min, rx.max].map((v, i) => (
            <text
              key={`x${i}`}
              x={px(v)}
              y={H - 20}
              textAnchor={i === 0 ? "start" : "end"}
              fontSize={10}
              fill={tinta(0.4)}
            >
              {formatea(v, unidadX)}
            </text>
          ))}

          {[ry.min, ry.max].map((v, i) => (
            <text
              key={`y${i}`}
              x={M.izquierda - 6}
              y={py(v) + (i === 0 ? -2 : 8)}
              textAnchor="end"
              fontSize={10}
              fill={tinta(0.4)}
            >
              {formatea(v, unidadY)}
            </text>
          ))}

          <text
            x={M.izquierda + dentroW / 2}
            y={H - 5}
            textAnchor="middle"
            fontSize={11}
            fill={tinta(0.55)}
          >
            {etiquetaX}
          </text>

          <text
            x={12}
            y={M.arriba + dentroH / 2}
            textAnchor="middle"
            fontSize={11}
            fill={tinta(0.55)}
            transform={`rotate(-90 12 ${M.arriba + dentroH / 2})`}
          >
            {etiquetaY}
          </text>

          {puntos.map((punto) => {
            const esNuestro = punto.equipo === destacado;

            const escudo = escudoDe(punto.equipo);

            const lado = esNuestro ? 30 : 22;

            const cx = px(punto.x);
            const cy = py(punto.y);

            return (
              <g key={punto.equipo}>
                {escudo ? (
                  <>
                    {/*
                      El escudo dice quién es sin tener que pasar el ratón. El
                      disco de debajo es el fondo de la pantalla: separa dos
                      escudos que se pisan y deja leer los que traen el fondo
                      transparente.
                    */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={lado / 2 + 2}
                      fill="var(--rmcf-surface, #11161C)"
                      stroke={esNuestro ? ORO : tinta(0.18)}
                      strokeWidth={esNuestro ? 2 : 1}
                    />

                    <image
                      href={escudo}
                      x={cx - lado / 2}
                      y={cy - lado / 2}
                      width={lado}
                      height={lado}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </>
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={esNuestro ? 7 : 5}
                    fill={esNuestro ? ORO : tinta(0.3)}
                    /* El anillo del color del fondo separa los puntos que se
                       pisan sin inventar otro color. */
                    stroke="var(--rmcf-surface, #11161C)"
                    strokeWidth={2}
                  />
                )}

                {/* El blanco del ratón, siempre encima y siempre del mismo
                    tamaño: con el escudo, el <image> se comería el hover. */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={lado / 2 + 3}
                  fill="transparent"
                  onMouseEnter={() => setEncima(punto)}
                  onMouseLeave={() => setEncima(null)}
                  onClick={() => alPulsar?.(punto.equipo)}
                  style={{ cursor: alPulsar ? "pointer" : "default" }}
                />

                {(esNuestro || rotulaTodos) && (
                  <text
                    x={cx}
                    y={cy - lado / 2 - 5}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={esNuestro ? 700 : 500}
                    fill={esNuestro ? tinta(0.9) : tinta(0.55)}
                  >
                    {punto.equipo}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-1 h-4 text-[11px] tabular-nums text-white/45">
        {encima
          ? `${encima.equipo} · ${etiquetaX} ${formatea(encima.x, unidadX)} · ${etiquetaY} ${formatea(encima.y, unidadY)}`
          : "Pasa el ratón por un punto para ver el equipo. Las rayas son las medianas de la liga."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EVOLUCIÓN                                                          */
/* ------------------------------------------------------------------ */

export type PuntoSerie = { etiqueta: string; valor: number | null; nota?: string };

/**
 * Una métrica a lo largo del tiempo: temporadas, o partido a partido.
 *
 * Una sola serie a propósito. Dos métricas de escalas distintas en el mismo
 * dibujo obligarían a dos ejes verticales, que es la forma más rápida de hacer
 * decir a una gráfica lo que uno quiera. Si hacen falta dos, van dos gráficas.
 */
export function Evolucion({
  serie,
  unidad,
  media,
}: {
  serie: PuntoSerie[];
  unidad: Unidad;
  /** La referencia con la que se compara: la media del propio equipo. */
  media?: number | null;
}) {
  const id = useId();

  const [encima, setEncima] = useState<number | null>(null);

  const W = 720;
  const H = 240;
  const M = { arriba: 14, derecha: 14, abajo: 34, izquierda: 48 };

  const dentroW = W - M.izquierda - M.derecha;
  const dentroH = H - M.arriba - M.abajo;

  const validos = serie
    .map((p, i) => ({ ...p, i }))
    .filter((p): p is PuntoSerie & { valor: number; i: number } => p.valor !== null);

  if (validos.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-white/35">
        No hay datos de esta métrica en el periodo elegido.
      </p>
    );
  }

  const vals = validos.map((p) => p.valor);

  const min = Math.min(...vals, media ?? Infinity);
  const max = Math.max(...vals, media ?? -Infinity);

  const aire = (max - min) * 0.12 || 1;

  const y = (v: number) =>
    M.arriba + dentroH - ((v - (min - aire)) / (max + aire - (min - aire))) * dentroH;

  const x = (i: number) =>
    M.izquierda + (serie.length === 1 ? dentroW / 2 : (i / (serie.length - 1)) * dentroW);

  const camino = validos
    .map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i)} ${y(p.valor)}`)
    .join(" ");

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-labelledby={`${id}-t`}
        >
          <title id={`${id}-t`}>Evolución de la métrica</title>

          {media !== null && media !== undefined && (
            <>
              <line
                x1={M.izquierda}
                y1={y(media)}
                x2={M.izquierda + dentroW}
                y2={y(media)}
                stroke={tinta(0.22)}
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              <text
                x={M.izquierda + dentroW}
                y={y(media) - 4}
                textAnchor="end"
                fontSize={10}
                fill={tinta(0.4)}
              >
                media {formatea(media, unidad)}
              </text>
            </>
          )}

          <line
            x1={M.izquierda}
            y1={M.arriba + dentroH}
            x2={M.izquierda + dentroW}
            y2={M.arriba + dentroH}
            stroke={tinta(0.2)}
            strokeWidth={1}
          />

          {[min, max].map((v, i) => (
            <text
              key={i}
              x={M.izquierda - 6}
              y={y(v) + (i === 0 ? 4 : 4)}
              textAnchor="end"
              fontSize={10}
              fill={tinta(0.4)}
            >
              {formatea(v, unidad)}
            </text>
          ))}

          <path d={camino} fill="none" stroke={ORO} strokeWidth={2} />

          {validos.map((p) => (
            <circle
              key={p.i}
              cx={x(p.i)}
              cy={y(p.valor)}
              r={encima === p.i ? 6 : 4}
              fill={ORO}
              stroke="var(--rmcf-surface, #11161C)"
              strokeWidth={2}
              onMouseEnter={() => setEncima(p.i)}
              onMouseLeave={() => setEncima(null)}
            />
          ))}

          {/* Sólo se rotulan los extremos: un número en cada punto es ruido. */}
          {serie.map((p, i) =>
            i === 0 || i === serie.length - 1 || serie.length <= 8 ? (
              <text
                key={p.etiqueta + i}
                x={x(i)}
                y={H - 12}
                textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
                fontSize={10}
                fill={tinta(0.4)}
              >
                {p.etiqueta}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <p className="mt-1 h-4 text-[11px] tabular-nums text-white/45">
        {encima !== null && serie[encima]
          ? `${serie[encima].etiqueta} · ${formatea(serie[encima].valor, unidad)}${
              serie[encima].nota ? ` · ${serie[encima].nota}` : ""
            }`
          : "Pasa el ratón por un punto para ver el detalle."}
      </p>
    </div>
  );
}
