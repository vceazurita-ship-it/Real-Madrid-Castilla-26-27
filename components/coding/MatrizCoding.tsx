"use client";

/*
|--------------------------------------------------------------------------
| LA MATRIZ: QUIÉN POR QUÉ
|--------------------------------------------------------------------------
|
| La pantalla que más se usa en SportsCode después del vídeo. Las tablas de
| la derecha contestan «cuántos de Mestre» y «cuántas recuperaciones», pero
| no «cuántas recuperaciones de Mestre», que es la pregunta de la charla.
|
| Cada cruce es un filtro: se pulsa y la lista, la línea de tiempo y la
| exportación se quedan con esos cortes —la misma regla que los filtros de
| siempre, `pasaFiltro`—. Pulsar el nombre de una fila o de una columna
| filtra sólo por eso. El cruce elegido se pinta con borde dorado.
|
| Lo que se lee además del recuento:
|
| - **Las fases.** Las columnas van agrupadas por fase del juego
|   (`FASES_CODING`), con la fase encima: es como se prepara la charla.
| - **El acierto.** Si los cortes llevan «Bien» o «Mal», cada cruce dice
|   cuántos están bien hechos de los valorados. Con menos de cinco va en gris
|   y como «3 de 4»: es una tendencia, no un porcentaje.
| - **Lo que más pesa.** La celda con más cortes lleva borde oro, y el
|   titular de arriba lo dice con un verbo.
|
| No hay «por 90′»: la sesión no sabe cuántos minutos jugó cada uno, y un
| recuento dividido por un minutaje inventado sería peor que el recuento.
|
| La tabla se desliza dentro de su caja en un teléfono, con la primera columna
| quieta: lo que no puede pasar es que la página entera se vaya de lado.
*/

import { useMemo } from "react";

import {
  FASES_CODING,
  matrizDeClips,
  tasaDeAcierto,
  type CategoriaCoding,
  type ClipCoding,
  type DescriptorCoding,
  type MatrizCoding as Matriz,
} from "@/lib/coding/modelo";

const cortes = (n: number) => `${n} ${n === 1 ? "corte" : "cortes"}`;

/**
 * El titular: quién acumula más y en qué.
 *
 * «Mestre acumula 10 cortes: 3 de Recuperación y 3 de Pérdida». Sale del
 * mismo recuento que la tabla, así que no puede contradecirla.
 */
function titularDe(matriz: Matriz) {
  const primero = matriz.filas[0];

  if (!primero || primero.total < 2) return null;

  const suyas = matriz.columnas
    .map((columna) => ({
      nombre: columna.nombre,
      n: matriz.celdas.get(`${primero.id}|${columna.id}`) ?? 0,
    }))
    .filter((una) => una.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 2);

  const reparto = suyas
    .map((una) => `${una.n} de ${una.nombre.toLowerCase()}`)
    .join(" y ");

  /* La referencia: sin ella, «10 cortes» no dice si es mucho o poco. */
  const media =
    !primero.colectivo && matriz.mediaJugador !== null
      ? ` (media del equipo: ${matriz.mediaJugador.toLocaleString("es-ES", {
          maximumFractionDigits: 1,
        })} por jugador)`
      : "";

  return `${primero.nombre} acumula ${cortes(primero.total)}${media}${reparto ? `: ${reparto}` : ""}.`;
}

/**
 * La cabecera de la tabla. Si algún corte no entra («Vídeo completo», que no
 * es de nadie), lo dice: así cuadra con el «65 de 65» de la lista.
 */
function cuentaDe(matriz: Matriz) {
  if (matriz.fuera === 0) return cortes(matriz.total);

  return `${matriz.total} de ${cortes(matriz.total + matriz.fuera)}`;
}

export function MatrizCoding({
  clips,
  categorias,
  descriptores = [],
  sujeto,
  categoria,
  onFiltra,
}: {
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  /** Para leer «Bien» y «Mal» de cada corte. */
  descriptores?: DescriptorCoding[];
  sujeto: string | null;
  categoria: string | null;
  /** `null` en un lado = sin filtro de ese lado. */
  onFiltra: (sujeto: string | null, categoria: string | null) => void;
}) {
  const matriz = useMemo(
    () => matrizDeClips(clips, categorias, descriptores),
    [categorias, clips, descriptores],
  );

  const mayor = useMemo(
    () => Math.max(1, ...matriz.celdas.values()),
    [matriz.celdas],
  );

  /* La celda que más pesa; si hay empate, la primera en el orden de la tabla. */
  const cima = useMemo(() => {
    for (const fila of matriz.filas) {
      for (const columna of matriz.columnas) {
        if ((matriz.celdas.get(`${fila.id}|${columna.id}`) ?? 0) === mayor) {
          return `${fila.id}|${columna.id}`;
        }
      }
    }

    return "";
  }, [matriz, mayor]);

  /* Los grupos de la fila de fases, sólo si alguna categoría tiene fase. */
  const grupos = useMemo(() => {
    if (!matriz.columnas.some((columna) => columna.fase)) return [];

    const lista: { fase: string; nombre: string; ancho: number }[] = [];

    for (const columna of matriz.columnas) {
      const ultimo = lista[lista.length - 1];

      if (ultimo && ultimo.fase === columna.fase) ultimo.ancho += 1;
      else {
        lista.push({
          fase: columna.fase,
          nombre:
            FASES_CODING.find((fase) => fase.id === columna.fase)?.corto ?? "",
          ancho: 1,
        });
      }
    }

    return lista;
  }, [matriz.columnas]);

  const hayValoracion = matriz.filas.some(
    (fila) => fila.valorados.bien + fila.valorados.mal > 0,
  );

  if (matriz.filas.length === 0) return null;

  const titular = titularDe(matriz);

  return (
    <div className="min-w-0">
      {titular && (
        <p className="mb-2 text-[13px] font-semibold text-white/85">{titular}</p>
      )}

      {matriz.fuera > 0 && (
        <p className="mb-2 text-[11px] text-white/45">
          {matriz.fuera === 1
            ? "1 corte es de «Vídeo completo»: no es de nadie y no entra en la tabla."
            : `${matriz.fuera} cortes son de «Vídeo completo»: no son de nadie y no entran en la tabla.`}
        </p>
      )}

      {/* En un teléfono no caben todas las columnas: que se sepa que hay más. */}
      {matriz.columnas.length > 3 && (
        <p className="mb-1.5 text-[11px] text-white/35 sm:hidden">
          Desliza la tabla para ver las {matriz.columnas.length} categorías →
        </p>
      )}

    <div className="min-w-0 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-[12px]">
        <caption className="sr-only">
          Cortes por sujeto y categoría. Pulsa un cruce para filtrar la lista.
        </caption>

        <thead>
          {grupos.length > 0 && (
            <tr>
              <th aria-hidden className="sticky left-0 z-10 bg-[#0F141B]" />

              {grupos.map((grupo, indice) => (
                <th
                  key={`${grupo.fase}-${indice}`}
                  colSpan={grupo.ancho}
                  scope="colgroup"
                  className="border-l border-white/[0.08] px-1 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C8A96B]/80 first:border-l-0"
                >
                  {grupo.nombre}
                </th>
              ))}

              <th aria-hidden colSpan={hayValoracion ? 2 : 1} />
            </tr>
          )}

          <tr className="border-b border-white/10">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[120px] bg-[#0F141B] px-3 py-2 text-left text-[10px] font-normal uppercase tracking-[0.14em] text-white/40"
            >
              {cuentaDe(matriz)}
            </th>

            {matriz.columnas.map((columna) => {
              const activa = categoria === columna.id && !sujeto;

              return (
                <th key={columna.id || "sin"} scope="col" className="px-0.5 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onFiltra(null, activa ? null : columna.id)
                    }
                    aria-pressed={activa}
                    title={`Filtrar por ${columna.nombre} (${cortes(columna.total)})`}
                    className={`flex w-full min-w-[44px] flex-col items-center gap-1 rounded-lg px-1 py-1 transition hover:bg-white/[0.06] ${
                      activa ? "ring-1 ring-[#C8A96B]" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-1 w-6 rounded-full"
                      style={{ background: columna.color }}
                    />
                    <span className="max-w-[76px] truncate text-[11px] font-semibold text-white/75">
                      {columna.nombre}
                    </span>
                  </button>
                </th>
              );
            })}

            <th
              scope="col"
              className="px-2 py-2 text-right text-[10px] font-normal uppercase tracking-[0.14em] text-white/40"
            >
              Total
            </th>

            {hayValoracion && (
              <th
                scope="col"
                title="Bien hecho sobre los cortes valorados con «Bien» o «Mal»"
                className="px-2 py-2 text-right text-[10px] font-normal uppercase tracking-[0.14em] text-white/40"
              >
                Acierto
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {matriz.filas.map((fila, indice) => {
            const filaActiva = sujeto === fila.id && !categoria;

            /* La raya entre los jugadores y lo colectivo. */
            const empiezaColectivo =
              fila.colectivo && !matriz.filas[indice - 1]?.colectivo;

            const tasaFila = tasaDeAcierto(fila.valorados);

            return (
              <tr
                key={fila.id}
                className={`border-b border-white/[0.06] last:border-0 ${
                  empiezaColectivo ? "border-t border-t-white/15" : ""
                }`}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[#0F141B] px-1.5 py-1 text-left font-normal"
                >
                  <button
                    type="button"
                    onClick={() => onFiltra(filaActiva ? null : fila.id, null)}
                    aria-pressed={filaActiva}
                    title={`Filtrar por ${fila.nombre} (${cortes(fila.total)})`}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.06] ${
                      filaActiva ? "ring-1 ring-[#C8A96B]" : ""
                    }`}
                  >
                    {fila.colectivo && (
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-white/35">
                        Equipo
                      </span>
                    )}
                    <span className="max-w-[160px] truncate text-white/85">
                      {fila.nombre}
                    </span>
                  </button>
                </th>

                {matriz.columnas.map((columna) => {
                  const clave = `${fila.id}|${columna.id}`;
                  const n = matriz.celdas.get(clave) ?? 0;
                  const activa = sujeto === fila.id && categoria === columna.id;
                  const tasa = tasaDeAcierto(matriz.valorados.get(clave));
                  const esCima = clave === cima && mayor > 1;

                  return (
                    <td key={columna.id || "sin"} className="px-0.5 py-1 text-center">
                      {n > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            activa
                              ? onFiltra(null, null)
                              : onFiltra(fila.id, columna.id)
                          }
                          aria-pressed={activa}
                          aria-label={`${fila.nombre} · ${columna.nombre}: ${cortes(n)}${tasa ? ` · ${tasa.largo}` : ""}`}
                          title={tasa ? tasa.largo : undefined}
                          className={`flex w-full min-w-[40px] flex-col items-center justify-center rounded-md py-1 font-mono text-[12px] font-semibold tabular-nums text-white transition hover:brightness-125 ${
                            tasa ? "h-10" : "h-8"
                          } ${
                            activa
                              ? "ring-2 ring-[#C8A96B]"
                              : esCima
                                ? "ring-2 ring-[#C8A96B]/80"
                                : ""
                          }`}
                          style={{
                            /* Más cortes, más color; el mínimo se lee igual. */
                            background: `${columna.color}${Math.round(
                              (0.18 + 0.62 * (n / mayor)) * 255,
                            )
                              .toString(16)
                              .padStart(2, "0")}`,
                          }}
                        >
                          {n}
                          {tasa && (
                            <span
                              className={`font-sans text-[9px] font-medium leading-none ${
                                tasa.suficiente ? "text-white/85" : "text-white/50"
                              }`}
                            >
                              {tasa.texto}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span aria-hidden className="text-white/15">
                          ·
                        </span>
                      )}
                    </td>
                  );
                })}

                <td className="px-2 py-1 text-right font-mono tabular-nums text-white/60">
                  {fila.total}
                </td>

                {hayValoracion && (
                  <td
                    title={tasaFila?.largo}
                    className={`px-2 py-1 text-right text-[11px] tabular-nums ${
                      tasaFila?.suficiente ? "text-white/75" : "text-white/35"
                    }`}
                  >
                    {tasaFila?.texto ?? ""}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      {/* La leyenda: qué es el color, qué es el borde y qué es el porcentaje. */}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex h-2.5 w-10 overflow-hidden rounded-sm">
            <span className="flex-1 bg-[#60A5FA]/25" />
            <span className="flex-1 bg-[#60A5FA]/55" />
            <span className="flex-1 bg-[#60A5FA]/90" />
          </span>
          Más color, más cortes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm ring-2 ring-[#C8A96B]/80" />
          El cruce que más acumula
        </span>
        {hayValoracion && (
          <span>
            Debajo, bien hecho sobre lo valorado; con menos de 5 cortes, en gris
            y en «3 de 4»: es tendencia
          </span>
        )}
      </p>
    </div>
  );
}

export default MatrizCoding;
