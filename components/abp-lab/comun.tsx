"use client";

/**
 * Piezas compartidas del laboratorio de ABP: la plantilla, las iniciales y
 * la fecha de una fuente. La pizarra (grande y en miniatura) vive en
 * `PizarraRutina.tsx`.
 */

import { useMemo } from "react";

import { usePlayers } from "@/hooks/usePlayers";
import type { Player } from "@/types/player";

export type JugadorLab = { id: string; nombre: string; foto: string; posicion: string; dorsal?: number };

const corto = (p: Player) => (p.apodo?.trim() || p.nombre.trim().split(/\s+/).slice(0, 2).join(" "));

/** Los jugadores del Castilla, por dorsal. */
export function useJugadoresLab() {
  const { players, loading } = usePlayers();

  const jugadores = useMemo<JugadorLab[]>(
    () =>
      players
        .filter((p) => p.esCastilla)
        .map((p) => ({ id: p.id, nombre: corto(p), foto: p.foto, posicion: p.posicion, dorsal: p.dorsal }))
        .sort((a, b) => (a.dorsal ?? 99) - (b.dorsal ?? 99) || a.nombre.localeCompare(b.nombre)),
    [players],
  );

  /* Por id, todos (también los que ya no son del Castilla): una marca vieja sigue teniendo nombre. */
  const porId = useMemo(
    () => new Map(players.map((p) => [p.id, { id: p.id, nombre: corto(p), foto: p.foto, posicion: p.posicion, dorsal: p.dorsal } as JugadorLab])),
    [players],
  );

  return { jugadores, porId, cargando: loading };
}

export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** El rótulo de una fecha de fuente: «12/2024», «2024», o nada si no la da. */
/* Un solo formato en todas las fuentes, «dic 2024» (30/10/2026): convivían «10/2025» y «04/12/2024». */
const MESES_FUENTE = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaFuente(fecha: string) {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(fecha);

  if (m && MESES_FUENTE[Number(m[2]) - 1]) return `${MESES_FUENTE[Number(m[2]) - 1]} ${m[1]}`;

  return fecha;
}
