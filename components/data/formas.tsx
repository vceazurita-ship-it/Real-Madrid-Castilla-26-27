"use client";

/**
 * Más formas de mirar lo mismo, y la lectura escrita debajo de cada una.
 *
 * Un percentil contesta «¿estamos bien?». No contesta «¿de qué vivimos?», que
 * es una **composición**; ni «¿esto es siempre o fue un partido?», que es una
 * **distribución**; ni «¿damos más de lo que nos dan?», que es un **enfrentado**.
 * Cada pregunta tiene su dibujo, y aquí están los tres que faltaban.
 *
 * **Cada uno escribe lo que muestra.** No es un adorno: una barra apilada dice
 * que el 62 % de los remates nacen de ataque posicional, pero no dice si eso es
 * mucho —la liga está en 55— ni qué se hace con ello. La frase de debajo sale
 * de los mismos números que el dibujo, así que no puede contradecirlo, y evita
 * que cada uno lea lo que quiera en el mismo gráfico.
 *
 * La paleta es la de `graficas.tsx`, comprobada con el validador: verde azulado
 * y naranja como polos, oro para nosotros, tinta para el fondo.
 */

import { useId, useState } from "react";

import { formatea, type Unidad } from "@/lib/data-analisis/metricas";

import { MEJOR, ORO, PEOR, tinta } from "./graficas";

/* ------------------------------------------------------------------ */
/*  LA LECTURA                                                         */
/* ------------------------------------------------------------------ */

/** El pie de cada gráfico: qué está diciendo, en una frase. */
export function Lectura({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-[#C8A96B]/40 pl-3 text-[12px] leading-relaxed text-white/60">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPOSICIÓN                                                        */
/* ------------------------------------------------------------------ */

export type Trozo = { etiqueta: string; valor: number; explica?: string };

/**
 * De qué se compone algo: una barra al 100 % con sus trozos.
 *
 * Para «de dónde salen los remates» o «dónde se recupera», el total no dice
 * nada y los valores sueltos obligan a hacer la división mentalmente. La barra
 * apilada lo dice de un vistazo, y con la misma barra de la liga debajo se ve
 * si el reparto es una elección o lo normal.
 *
 * Los trozos llevan **2 px de separación** —el hueco es del color del fondo— y
 * los que pasan del 8 % llevan su cifra encima: rotularlos todos convierte la
 * barra en una fila de números.
 */
export function Composicion({
  titulo,
  trozos,
  trozosLiga,
  lectura,
  rotulo = "Nosotros",
  rotuloLiga = "Mediana de la liga",
}: {
  titulo?: string;
  trozos: Trozo[];
  /** El mismo reparto en la liga, para comparar. */
  trozosLiga?: Trozo[];
  lectura?: React.ReactNode;
  /**
   * Cómo se llama a cada barra.
   *
   * Por defecto la de arriba somos nosotros, que es el caso normal. Pero la
   * misma forma sirve para repartos que no son nuestros —de dónde salen los
   * goles de estrategia **en la categoría**, por ejemplo—, y ahí poner
   * «Nosotros» al lado sería mentir.
   */
  rotulo?: string;
  rotuloLiga?: string;
}) {
  const id = useId();

  const [encima, setEncima] = useState<string | null>(null);

  /* Una rampa de un solo tono: es una composición, no categorías sueltas. */
  const tonos = [ORO, tinta(0.5), tinta(0.34), tinta(0.22), tinta(0.14)];

  const dibuja = (lista: Trozo[], rotulo: string, esLiga: boolean) => {
    const total = lista.reduce((s, t) => s + t.valor, 0);

    if (total <= 0) return null;

    return (
      <div className="min-w-0">
        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
          {rotulo}
        </p>

        <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
          {lista.map((trozo, i) => {
            const parte = (trozo.valor / total) * 100;

            if (parte <= 0) return null;

            return (
              <div
                key={trozo.etiqueta}
                title={`${trozo.etiqueta}: ${trozo.valor.toFixed(1)} (${parte.toFixed(1)}%)`}
                onMouseEnter={() => setEncima(`${rotulo}|${trozo.etiqueta}`)}
                onMouseLeave={() => setEncima(null)}
                className="flex items-center justify-center"
                style={{
                  width: `${parte}%`,
                  background: esLiga ? tinta(0.18) : tonos[i % tonos.length],
                  opacity:
                    encima && encima !== `${rotulo}|${trozo.etiqueta}` ? 0.55 : 1,
                }}
              >
                {parte >= 8 && (
                  <span
                    className="text-[10px] font-semibold tabular-nums"
                    style={{
                      color: esLiga
                        ? tinta(0.7)
                        : i === 0
                          ? "#0B0F14"
                          : tinta(0.85),
                    }}
                  >
                    {Math.round(parte)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0" aria-labelledby={`${id}-t`}>
      {titulo && (
        <p id={`${id}-t`} className="mb-2 text-[13px] font-medium text-white/80">
          {titulo}
        </p>
      )}

      <div className="space-y-2.5">
        {dibuja(trozos, rotulo, false)}
        {trozosLiga && dibuja(trozosLiga, rotuloLiga, true)}
      </div>

      {/* La leyenda va siempre: el color solo no puede llevar la identidad. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {trozos.map((trozo, i) => (
          <span
            key={trozo.etiqueta}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/55"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: tonos[i % tonos.length] }}
              aria-hidden
            />

            {trozo.etiqueta}

            <span className="tabular-nums text-white/35">
              {trozo.valor.toFixed(1)}
            </span>
          </span>
        ))}
      </div>

      {lectura && <Lectura>{lectura}</Lectura>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ENFRENTADO                                                         */
/* ------------------------------------------------------------------ */

export type ParEnfrentado = {
  etiqueta: string;
  aFavor: number | null;
  enContra: number | null;
  unidad: Unidad;
  /** Si tener más que el rival es bueno. */
  masEsMejor: boolean;
};

/**
 * Lo nuestro contra lo suyo, en la misma escala.
 *
 * Es la forma natural del balón parado: sacamos nueve córners y concedemos
 * cinco. Dos barras desde el centro, una a cada lado, comparten escala para que
 * la comparación sea la longitud y no haya que leer los números.
 */
export function Enfrentado({
  pares,
  lectura,
}: {
  pares: ParEnfrentado[];
  lectura?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
        <span style={{ color: MEJOR }}>A favor</span>
        <span style={{ color: PEOR }}>En contra</span>
      </div>

      <div className="space-y-2">
        {pares.map((par) => {
          const tope = Math.max(par.aFavor ?? 0, par.enContra ?? 0, 0.0001);

          const gana =
            par.aFavor === null || par.enContra === null
              ? null
              : par.masEsMejor
                ? par.aFavor > par.enContra
                : par.aFavor < par.enContra;

          return (
            <div key={par.etiqueta} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums"
                  style={{ color: gana === true ? MEJOR : tinta(0.75) }}
                >
                  {formatea(par.aFavor, par.unidad)}
                </span>

                <span className="min-w-0 flex-1 truncate text-center text-[11px] text-white/50">
                  {par.etiqueta}
                </span>

                <span
                  className="w-14 shrink-0 text-left text-[12px] font-semibold tabular-nums"
                  style={{ color: gana === false ? PEOR : tinta(0.75) }}
                >
                  {formatea(par.enContra, par.unidad)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-[3px]">
                <span className="flex h-2.5 min-w-0 flex-1 justify-end">
                  <span
                    className="block h-2.5 rounded-l-[3px]"
                    style={{
                      width: `${((par.aFavor ?? 0) / tope) * 100}%`,
                      background: MEJOR,
                    }}
                  />
                </span>

                <span className="h-3 w-px shrink-0" style={{ background: tinta(0.3) }} />

                <span className="flex h-2.5 min-w-0 flex-1">
                  <span
                    className="block h-2.5 rounded-r-[3px]"
                    style={{
                      width: `${((par.enContra ?? 0) / tope) * 100}%`,
                      background: PEOR,
                    }}
                  />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {lectura && <Lectura>{lectura}</Lectura>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DISTRIBUCIÓN                                                       */
/* ------------------------------------------------------------------ */

export type PuntoPartido = {
  etiqueta: string;
  valor: number;
  /** Para el detalle al pasar por encima. */
  nota?: string;
};

/**
 * Cada partido, un punto en una línea.
 *
 * Una media de nueve córners puede ser «nueve todas las semanas» o «veinte un
 * día y cuatro el resto», y son dos equipos distintos. La media no lo dice; la
 * distribución sí. Con la mediana de la liga marcada se ve además cuántos
 * partidos se pasan de ella.
 */
export function Distribucion({
  puntos,
  unidad,
  referencia,
  etiquetaReferencia = "mediana de la liga",
  lectura,
}: {
  puntos: PuntoPartido[];
  unidad: Unidad;
  referencia?: number | null;
  etiquetaReferencia?: string;
  lectura?: React.ReactNode;
}) {
  const [encima, setEncima] = useState<PuntoPartido | null>(null);

  if (puntos.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-white/35">
        No hay partidos con este dato.
      </p>
    );
  }

  const valores = puntos.map((p) => p.valor);

  const min = Math.min(...valores, referencia ?? Infinity);
  const max = Math.max(...valores, referencia ?? -Infinity);

  const aire = (max - min) * 0.1 || 1;

  const izq = min - aire;
  const der = max + aire;

  const pos = (v: number) => ((v - izq) / (der - izq)) * 100;

  return (
    <div className="min-w-0">
      <div className="relative h-14">
        {/* El eje. */}
        <span
          className="absolute left-0 right-0 top-7 h-px"
          style={{ background: tinta(0.18) }}
          aria-hidden
        />

        {referencia !== null && referencia !== undefined && (
          <>
            <span
              className="absolute top-3 h-8 w-px"
              style={{ left: `${pos(referencia)}%`, background: tinta(0.4) }}
              aria-hidden
            />

            <span
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px]"
              style={{ left: `${pos(referencia)}%`, color: tinta(0.45) }}
            >
              {etiquetaReferencia}
            </span>
          </>
        )}

        {puntos.map((punto, i) => (
          <span
            key={`${punto.etiqueta}-${i}`}
            onMouseEnter={() => setEncima(punto)}
            onMouseLeave={() => setEncima(null)}
            title={`${punto.etiqueta}: ${formatea(punto.valor, unidad)}`}
            className="absolute top-7 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full"
            style={{
              left: `${pos(punto.valor)}%`,
              background: ORO,
              /* El anillo del color del fondo separa los partidos que caen
                 en el mismo sitio sin inventar otro color. */
              boxShadow: "0 0 0 2px var(--rmcf-surface, #11161C)",
            }}
          />
        ))}

        <span
          className="absolute bottom-0 left-0 text-[10px] tabular-nums"
          style={{ color: tinta(0.4) }}
        >
          {formatea(izq, unidad)}
        </span>

        <span
          className="absolute bottom-0 right-0 text-[10px] tabular-nums"
          style={{ color: tinta(0.4) }}
        >
          {formatea(der, unidad)}
        </span>
      </div>

      <p className="h-4 text-[11px] tabular-nums text-white/45">
        {encima
          ? `${encima.etiqueta} · ${formatea(encima.valor, unidad)}${encima.nota ? ` · ${encima.nota}` : ""}`
          : `${puntos.length} partidos. Cada punto es uno; pasa el ratón por encima.`}
      </p>

      {lectura && <Lectura>{lectura}</Lectura>}
    </div>
  );
}
