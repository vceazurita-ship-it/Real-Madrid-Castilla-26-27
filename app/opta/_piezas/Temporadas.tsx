"use client";

/**
 * TEMPORADA A TEMPORADA en la ficha del jugador (10/11/2026).
 *
 * Si el `playerId` está en `opta:hist:<temporada>:jugadores`, una tarjeta por
 * temporada (la actual sale de `opta:jugadores`) con su equipo, minutos,
 * partidos y lo principal, y con quién se compara cada una: las tablas
 * pasadas no traen lo mismo (25/26 sólo el grupo del Castilla, 24/25 el
 * grupo 1). Si no aparece en una temporada, esa no se pinta; si no aparece
 * en ninguna pasada, no sale nada.
 */

import { useMemo } from "react";

import { colorPercentil } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, PUESTO_OPTA, type TablaOpta } from "@/lib/opta";
import { COMPARADOS_MIN, tarjetaTemporada, type TarjetaTemporada } from "@/lib/opta-talento";

import { dec } from "./eventos";
import type { DatosOpta } from "./useOpta";

type Temporada = { clave: string; nombre?: string; actual?: boolean };

/** Si aún no hay índice, las que se sabe que existen. */
const CONOCIDAS: Temporada[] = [{ clave: "2025-2026" }, { clave: "2024-2025" }];

/** Con quién se compara cada temporada pasada (la tabla no lo dice). */
const POBLACION: Record<string, string> = { "2025-2026": "del grupo del Castilla", "2024-2025": "del grupo 1" };

/** «2025-2026» → «25/26». */
const corta = (clave: string) => {
  const [a, b] = clave.split("-");
  return a && b ? `${a.slice(2)}/${b.slice(2)}` : clave;
};

export function TemporadasJugador({ datos, playerId, minimo }: { datos: DatosOpta; playerId: string; minimo: number }) {
  const indice = useDocsOpta<[{ temporadas?: Temporada[] }]>("opta:temporadas");
  const lista = useMemo(() => indice.docs[0]?.temporadas ?? [], [indice.docs]);
  const pasadas = useMemo(() => {
    const xs = lista.filter((t) => !t.actual);
    return xs.length ? xs : CONOCIDAS;
  }, [lista]);
  const actual = lista.find((t) => t.actual);
  const hist = useDocsOpta<TablaOpta[]>(...pasadas.map((t) => `opta:hist:${t.clave}:jugadores`));

  const tarjetas = useMemo(() => {
    const salida: (TarjetaTemporada & { poblacion: string })[] = [];
    pasadas.forEach((t, i) => {
      const filas = aObjetos(hist.docs[i] as TablaOpta | null);
      const tj = filas.length ? tarjetaTemporada(t.clave, filas, playerId, minimo) : null;
      if (tj) salida.push({ ...tj, poblacion: POBLACION[t.clave] ?? "de esa temporada" });
    });
    const hoy = tarjetaTemporada(actual?.clave ?? "actual", datos.jugadores, playerId, minimo);
    if (hoy) salida.push({ ...hoy, poblacion: "de toda la categoría" });
    return salida.sort((a, b) => (a.clave === "actual" ? 1 : b.clave === "actual" ? -1 : a.clave.localeCompare(b.clave)));
  }, [pasadas, hist.docs, actual, datos.jugadores, playerId, minimo]);

  /* Sólo tiene sentido si sale en alguna temporada pasada. */
  if (indice.cargando || hist.cargando || tarjetas.length < 2) return null;

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-white">Temporada a temporada</h3>
      <p className="mt-0.5 text-xs text-white/55">Totales de cada temporada; debajo, por 90 y su percentil frente a los de su puesto con {minimo}′ o más de esa misma tabla.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((t) => (
          <div key={t.clave} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-semibold text-white">{t.clave === "actual" ? "Esta temporada" : corta(t.clave)}</p>
              <p className="truncate text-xs text-white/60">{t.equipo}</p>
            </div>
            <p className="mt-0.5 text-xs tabular-nums text-white/55">
              {[`${t.min}′`, t.partidos ? `${t.partidos} partidos` : "", PUESTO_OPTA[t.puesto] ?? ""].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {t.valores
                .filter((v) => v.total != null)
                .map((v) => (
                  <div key={v.a} className="min-w-0">
                    <p className="truncate text-[11px] text-white/50">{v.nombre}</p>
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {v.total}
                      {v.p90 != null && <span className="ml-1 text-[10px] font-normal text-white/45">{dec(v.p90)}/90</span>}
                      {v.p != null && (
                        <span className="ml-1 text-[10px] font-semibold" style={{ color: colorPercentil(v.p) }}>
                          P{v.p}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
            </div>
            <p className="mt-2 text-[11px] text-white/45">
              {!t.familia
                ? ""
                : t.min < minimo
                  ? `Con ${t.min}′ no llega al mínimo de ${minimo}′: sin percentil.`
                  : t.comparados < COMPARADOS_MIN
                    ? `En esa tabla sólo hay ${t.comparados} ${t.familia.toLowerCase()} ${t.poblacion} con ${minimo}′ o más: muy pocos para dar percentil.`
                    : `Frente a ${t.comparados} ${t.familia.toLowerCase()} ${t.poblacion}.`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
