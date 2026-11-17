/**
 * EL RESPALDO DE OPTA (17/11/2026): los tipos.
 *
 * Petición del analista: «que ABP ofensivo y defensivo, saques de banda,
 * pérdidas, robos, transiciones y faltas usen también Opta, para que un
 * partido aún sin etiquetar en Hudl con Wyscout (el del Nàstic) tenga sus
 * datos». Lo etiquetado sigue mandando: Opta sólo rellena el partido que aún
 * no está en la hoja o en el timeline (ver `etiquetado.ts`).
 *
 * Cada fila que sale de aquí lleva `fuente: "opta"` (o la columna «Fuente» =
 * «Opta» en las filas con forma de hoja) para que la pantalla ponga el sello
 * «Desde Opta · aún sin etiquetar en Hudl».
 */

import type { Falta, PartidoFaltas } from "@/lib/faltas/datos";
import { urlVideoOpta, type EventoOpta, type TipoEventoOpta } from "@/lib/opta-video";
import type { PartidoTransiciones, Robo } from "@/lib/transiciones/datos";

export type FuenteOpta = "opta";

/** Un partido del Castilla en Opta. */
export type PartidoOpta = {
  /** `game.gameId` de Opta. */
  partido: string;
  /** AAAA-MM-DD. */
  fecha: string;
  /** Jornada de liga por orden de fecha (Opta sólo trae la liga). */
  jornada: number;
  rival: string;
  /** null si el directo no dice quién jugó en casa. */
  local: boolean | null;
  golesCastilla: number | null;
  golesRival: number | null;
};

/** Lo que hace falta para ver una acción: nuestro corte (si ya está bajado) y su sitio en ProVision. */
export type VideoAccionOpta = {
  /** El corte en el bucket (`opta:acciones-video` o `opta:goles-video`). */
  video?: string;
  /** El instante en Opta: con él se monta el enlace al Event Log de ProVision (`enlaceOptaDe`). */
  optaEvento?: EventoOpta;
};

/** Una fila con forma de hoja de ABP o de banda (cabeceras de la hoja + «Fuente» y «Opta_*»). */
export type FilaHojaOpta = Record<string, string>;

export type RoboOpta = Robo & VideoAccionOpta & { fuente: FuenteOpta };
export type PartidoTransicionesOpta = Omit<PartidoTransiciones, "robos" | "perdidas"> & {
  fuente: FuenteOpta;
  optaPartido: string;
  robos: RoboOpta[];
  perdidas: RoboOpta[];
};

export type FaltaOpta = Falta & VideoAccionOpta & { fuente: FuenteOpta };
export type PartidoFaltasOpta = Omit<PartidoFaltas, "faltas"> & { fuente: FuenteOpta; optaPartido: string; faltas: FaltaOpta[] };

/** Lo que pide cada pantalla a /api/opta/respaldo. */
export type QueRespaldo = "abp-favor" | "abp-contra" | "banda-favor" | "banda-contra" | "transiciones" | "faltas";

export const QUE_RESPALDO: QueRespaldo[] = ["abp-favor", "abp-contra", "banda-favor", "banda-contra", "transiciones", "faltas"];

export type RespaldoOpta = {
  generado: string;
  partidos: PartidoOpta[];
  abpFavor: FilaHojaOpta[];
  abpContra: FilaHojaOpta[];
  bandaFavor: FilaHojaOpta[];
  bandaContra: FilaHojaOpta[];
  transiciones: PartidoTransicionesOpta[];
  faltas: PartidoFaltasOpta[];
};

/** Una acción de esas pantallas con su instante de Opta: lo que baja `scripts/opta-acciones-video.mjs`. */
export type AccionVideoOpta = {
  partido: string;
  fecha: string;
  parte: number;
  segundo: number;
  /** Para el `playType` de /vod-url. */
  tipo: "Pass" | "BallRecovery" | "Foul" | "Shot";
  que: string;
};

/** ¿Viene de Opta? Vale para filas de hoja y para filas propias. */
export const esDeOpta = (fila: unknown): boolean => {
  if (!fila || typeof fila !== "object") return false;
  const f = fila as Record<string, unknown>;
  return f.fuente === "opta" || String(f.Fuente ?? "").toLowerCase() === "opta";
};

/** El instante de Opta de una fila: de `optaEvento` (filas propias) o de las columnas «Opta_*» (filas de hoja). */
export function eventoOptaDe(fila: unknown): EventoOpta | null {
  if (!fila || typeof fila !== "object") return null;
  const f = fila as Record<string, unknown>;
  const ev = f.optaEvento as EventoOpta | undefined;
  if (ev?.partido) return ev;
  if (typeof f.Opta_Partido === "string" && f.Opta_Partido)
    return { partido: f.Opta_Partido, fecha: String(f.Opta_Fecha ?? ""), parte: Number(f.Opta_Parte) || 1, segundo: Number(f.Opta_Segundo) || 0 };
  return null;
}

/** El enlace a ProVision de una fila (si lleva su instante de Opta). */
export function enlaceOptaDe(fila: unknown, tipo?: TipoEventoOpta): string | undefined {
  const ev = eventoOptaDe(fila);
  if (!ev) return undefined;
  const t = (tipo ?? (fila as Record<string, unknown>).Opta_Tipo ?? "touches") as TipoEventoOpta;
  return urlVideoOpta(ev, t) ?? undefined;
}

/** Nuestro corte de una fila de Opta (filas propias: `video`; de hoja: «Opta_Video»). */
export function videoOptaDe(fila: unknown): string | undefined {
  if (!fila || typeof fila !== "object") return undefined;
  const f = fila as Record<string, unknown>;
  const v = f.Opta_Video ?? (esDeOpta(fila) ? f.video : undefined);
  return typeof v === "string" && v ? v : undefined;
}
