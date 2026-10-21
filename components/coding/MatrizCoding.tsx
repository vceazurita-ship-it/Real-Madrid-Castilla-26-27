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
| exportación se quedan con esos clips —la misma regla que los filtros de
| siempre, `pasaFiltro`—. Pulsar el nombre de una fila o de una columna
| filtra sólo por eso. El cruce elegido se pinta con borde dorado.
|
| La tabla se desliza dentro de su caja en un teléfono, con la primera columna
| quieta: lo que no puede pasar es que la página entera se vaya de lado.
*/

import { useMemo } from "react";

import {
  matrizDeClips,
  type CategoriaCoding,
  type ClipCoding,
} from "@/lib/coding/modelo";

export function MatrizCoding({
  clips,
  categorias,
  sujeto,
  categoria,
  onFiltra,
}: {
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  sujeto: string | null;
  categoria: string | null;
  /** `null` en un lado = sin filtro de ese lado. */
  onFiltra: (sujeto: string | null, categoria: string | null) => void;
}) {
  const matriz = useMemo(
    () => matrizDeClips(clips, categorias),
    [categorias, clips],
  );

  const mayor = useMemo(
    () => Math.max(1, ...matriz.celdas.values()),
    [matriz.celdas],
  );

  if (matriz.filas.length === 0) return null;

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-[12px]">
        <caption className="sr-only">
          Clips por sujeto y categoría. Pulsa un cruce para filtrar la lista.
        </caption>

        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[140px] bg-[#0F141B] px-3 py-2 text-left text-[10px] font-normal uppercase tracking-[0.14em] text-white/40"
            >
              {matriz.total} clips
            </th>

            {matriz.columnas.map((columna) => {
              const activa = categoria === columna.id && !sujeto;

              return (
                <th key={columna.id || "sin"} scope="col" className="px-1 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onFiltra(null, activa ? null : columna.id)
                    }
                    aria-pressed={activa}
                    title={`Filtrar por ${columna.nombre} (${columna.total})`}
                    className={`flex w-full min-w-[64px] flex-col items-center gap-1 rounded-lg px-1.5 py-1 transition hover:bg-white/[0.06] ${
                      activa ? "ring-1 ring-[#C8A96B]" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-1 w-6 rounded-full"
                      style={{ background: columna.color }}
                    />
                    <span className="max-w-[88px] truncate text-[11px] font-semibold text-white/75">
                      {columna.nombre}
                    </span>
                  </button>
                </th>
              );
            })}

            <th
              scope="col"
              className="px-3 py-2 text-right text-[10px] font-normal uppercase tracking-[0.14em] text-white/40"
            >
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {matriz.filas.map((fila, indice) => {
            const filaActiva = sujeto === fila.id && !categoria;

            /* La raya entre los jugadores y lo colectivo. */
            const empiezaColectivo =
              fila.colectivo && !matriz.filas[indice - 1]?.colectivo;

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
                    title={`Filtrar por ${fila.nombre} (${fila.total})`}
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
                  const n = matriz.celdas.get(`${fila.id}|${columna.id}`) ?? 0;
                  const activa = sujeto === fila.id && categoria === columna.id;

                  return (
                    <td key={columna.id || "sin"} className="px-1 py-1 text-center">
                      {n > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            activa
                              ? onFiltra(null, null)
                              : onFiltra(fila.id, columna.id)
                          }
                          aria-pressed={activa}
                          aria-label={`${fila.nombre} · ${columna.nombre}: ${n} ${n === 1 ? "clip" : "clips"}`}
                          className={`h-8 w-full min-w-[44px] rounded-md font-mono text-[12px] font-semibold tabular-nums text-white transition hover:brightness-125 ${
                            activa ? "ring-2 ring-[#C8A96B]" : ""
                          }`}
                          style={{
                            /* Más clips, más color; el mínimo se lee igual. */
                            background: `${columna.color}${Math.round(
                              (0.18 + 0.62 * (n / mayor)) * 255,
                            )
                              .toString(16)
                              .padStart(2, "0")}`,
                          }}
                        >
                          {n}
                        </button>
                      ) : (
                        <span aria-hidden className="text-white/15">
                          ·
                        </span>
                      )}
                    </td>
                  );
                })}

                <td className="px-3 py-1 text-right font-mono tabular-nums text-white/60">
                  {fila.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MatrizCoding;
