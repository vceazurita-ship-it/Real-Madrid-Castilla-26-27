/**
 * LOS CORTES DE OPTA QUE YA TENEMOS EN B2 (18/11/2026).
 *
 * «Que todos los eventos de Opta que recogemos por toda la app tengan su
 * enlace al clip de Opta.» Hay dos clips posibles para un evento:
 *
 * 1. Nuestro corte, bajado de ProVision a B2 por el ordenador del club
 *    (`scripts/opta-goles-video.mjs` → `opta:goles-video`, los goles;
 *    `scripts/opta-acciones-video.mjs` → `opta:acciones-video`, las acciones
 *    del Castilla). Se ve en cualquier aparato, sin sesión de Opta, por
 *    /api/video/<ruta>. Clave: `partido|parte|segundo` (el `gameClock` de
 *    Opta, reloj corrido, tal como lo trae `opta:remates`).
 * 2. Si no está, el Event Log de ProVision en ese segundo (`urlVideoOpta`),
 *    que pide la sesión de Opta del club.
 *
 * Aquí sólo se cargan los dos documentos (una vez por pestaña, ~600 cortes,
 * unos 80 KB) y se busca el corte de un evento. Sin reloj (segundo 0) no
 * hay corte ni enlace: no se inventa el segundo.
 */

import { urlVideoOpta, type EventoOpta, type TipoEventoOpta } from "@/lib/opta-video";

export const DOCS_CORTES_OPTA = ["opta:goles-video", "opta:acciones-video"] as const;

/** clave `partido|parte|segundo` → enlace del corte (…/api/video/opta/…). */
export type CortesOpta = Record<string, string>;

type DocCortes = { clips?: Record<string, { url?: string } | undefined> };

let cargando: Promise<CortesOpta> | null = null;

/** Los dos documentos de cortes, una sola vez por pestaña (si falla, se reintenta la próxima vez). */
export function cargaCortesOpta(): Promise<CortesOpta> {
  cargando ??= Promise.all(
    DOCS_CORTES_OPTA.map((clave) =>
      fetch(`/api/docs?key=${encodeURIComponent(clave)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ data?: DocCortes }>) : null))
        .then((j) => j?.data?.clips ?? {})
        .catch(() => null),
    ),
  ).then((docs) => {
    if (docs.some((d) => d === null)) cargando = null;
    const salida: CortesOpta = {};

    for (const clips of docs) for (const [k, v] of Object.entries(clips ?? {})) if (v?.url) salida[k] = v.url;

    return salida;
  });

  return cargando;
}

export const claveCorteOpta = (partido: string, parte: number, segundo: number) => `${partido}|${parte}|${Math.round(segundo)}`;

/**
 * El corte de un evento: la clave exacta y, si no, un segundo antes o después
 * (el remate y el gol pueden ir medio segundo cambiados entre descargas).
 */
export function corteOpta(evento: Pick<EventoOpta, "partido" | "parte" | "segundo">, cortes: CortesOpta | null | undefined): string | undefined {
  if (!cortes || !evento.partido || !Number.isFinite(evento.segundo) || evento.segundo <= 0) return undefined;
  const s = Math.round(evento.segundo);

  return cortes[claveCorteOpta(evento.partido, evento.parte, s)] ?? cortes[claveCorteOpta(evento.partido, evento.parte, s - 1)] ?? cortes[claveCorteOpta(evento.partido, evento.parte, s + 1)];
}

/** El mejor enlace de un evento: nuestro corte si está; si no, ProVision en ese segundo; sin reloj, nada. */
export function enlaceClipOpta(evento: EventoOpta, tipo: TipoEventoOpta, cortes: CortesOpta | null | undefined): string | undefined {
  return corteOpta(evento, cortes) ?? urlVideoOpta(evento, tipo) ?? undefined;
}
