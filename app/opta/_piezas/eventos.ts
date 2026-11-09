"use client";

/**
 * Los documentos evento a evento del área Opta, cada uno pedido sólo por la
 * pieza que lo enseña (`hooks/useDocsOpta.ts`) y ya limpio (sin la fila
 * repetida de cada evento: `lib/opta-eventos.ts`).
 */

import { useMemo } from "react";

import { useDocsOpta } from "@/hooks/useDocsOpta";
import { CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { accionesCastilla, momentoDe, penaltisDe, pistaDe, rematesDe } from "@/lib/opta-eventos";
import { NOMBRE_CASTILLA } from "@/lib/opta-analisis";

import type { DatosOpta } from "./useOpta";

export function usePista(datos: DatosOpta) {
  return useMemo(() => pistaDe(datos.jugadores, datos.castilla), [datos.jugadores, datos.castilla]);
}

export function useRemates(datos: DatosOpta) {
  const pista = usePista(datos);
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.remates);
  const remates = useMemo(() => rematesDe(docs[0], pista), [docs, pista]);
  return { remates, cargando, hay: !!docs[0] };
}

export function usePenaltis(datos: DatosOpta) {
  const pista = usePista(datos);
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.penaltis);
  const penaltis = useMemo(() => penaltisDe(docs[0], pista), [docs, pista]);
  return { penaltis, cargando };
}

export function useMomento() {
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.momento);
  const momento = useMemo(() => momentoDe(docs[0]), [docs]);
  return { momento, cargando };
}

export function useAcciones(datos: DatosOpta) {
  const nuestros = useMemo(
    () => new Set([...datos.castilla, ...datos.castillaPartidos].map((f) => String(f.playerId ?? "")).filter(Boolean)),
    [datos.castilla, datos.castillaPartidos],
  );
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.castillaEventos);
  const acciones = useMemo(() => accionesCastilla(docs[0], nuestros), [docs, nuestros]);
  return { acciones, cargando };
}

/** Los equipos de la categoría por nombre, con el Castilla primero. */
export function equiposDe(datos: DatosOpta): { teamId: string; equipo: string }[] {
  const lista = datos.equipos
    .map((f) => ({ teamId: String(f.teamId ?? ""), equipo: f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : String(f.equipo ?? "") }))
    .filter((e) => e.teamId);
  lista.sort((a, b) => (a.teamId === CASTILLA_OPTA ? -1 : b.teamId === CASTILLA_OPTA ? 1 : a.equipo.localeCompare(b.equipo, "es")));
  return lista;
}

/** El nombre que se enseña (el Castilla, con su nombre). */
export const nombreDe = (teamId: string, equipo: string) => (teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : equipo);

export const pct = (v: number | null | undefined) => (v == null ? "" : `${Math.round(v * 100)} %`);
export const dec = (v: number | null | undefined, d = 2) => (v == null ? "" : v.toFixed(d).replace(".", ","));
export const conSigno = (v: number | null | undefined, d = 2) => (v == null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d).replace(".", ",")}`);
