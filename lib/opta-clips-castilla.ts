/**
 * LOS CLIPS DE NUESTROS JUGADORES, PARTIDO A PARTIDO (26/11/2026).
 *
 * La forma del documento `opta:clips-castilla`, que escribe
 * scripts/opta-clips-castilla.mjs tras cada partido: todos los clips de
 * Cestero, Sergio Martínez, Roberto Martín y el que juegue de 10, la carátula
 * del club con sus números del partido y el vídeo completo. Sólo el
 * administrador: vetado en /api/docs, se lee por /api/opta/clips-castilla y
 * los vídeos viven en `privado/` de B2.
 *
 * Sin datos aquí (el repo es público): sólo tipos y una limpieza.
 */

export const CLAVE_CLIPS_CASTILLA = "opta:clips-castilla";

/** Con balón · sin balón · con balón y sin balón · pérdida (para filtrar). */
export type CategoriaClip = "balon" | "sinBalon" | "mixta" | "perdida";

export type ClipPropio = {
  n: number;
  url: string;
  ruta: string;
  parte: number;
  /** Segundo del reloj de Opta de la primera acción (la segunda parte empieza en el 2700). */
  segundo: number;
  /** Lo que hace, lo más importante primero («Pase que avanza · Recuperación»). */
  que: string;
  acciones: number;
  cat: CategoriaClip;
  dura: number;
};

export type MetricaPartido = { label: string; valor: string };

export type JugadorClipsPropios = {
  playerId: string;
  nombre: string;
  /** Su puesto en ese partido («Mediapunta (10)» si hizo de 10). */
  rol: string;
  diez?: boolean;
  minutos: number;
  metricas: MetricaPartido[];
  caratula: { url: string; ruta: string } | null;
  completo: { url: string; ruta: string; bytes: number; segundos: number } | null;
  clips: ClipPropio[];
  bytes?: number;
  en?: string;
};

export type PartidoClipsPropios = { partido: string; fecha: string; rival: string; marcador: string; jugadores: JugadorClipsPropios[] };

export type DocClipsCastilla = { actualizado?: string; partidos: PartidoClipsPropios[] };

/** Los partidos del más reciente al más antiguo, con lo que falte rellenado. */
export function normalizaClipsCastilla(crudo: unknown): DocClipsCastilla {
  const d = (crudo && typeof crudo === "object" ? crudo : {}) as { actualizado?: unknown; partidos?: Record<string, PartidoClipsPropios> };
  const partidos = Object.values(d.partidos && typeof d.partidos === "object" ? d.partidos : {})
    .filter((p): p is PartidoClipsPropios => Boolean(p && typeof p === "object" && p.partido))
    .map((p) => ({
      ...p,
      jugadores: (Array.isArray(p.jugadores) ? p.jugadores : [])
        .filter((j) => j && Array.isArray(j.clips))
        .map((j) => ({ ...j, metricas: Array.isArray(j.metricas) ? j.metricas : [], caratula: j.caratula ?? null, completo: j.completo ?? null })),
    }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { actualizado: typeof d.actualizado === "string" ? d.actualizado : undefined, partidos };
}

/** El minuto que se ve en el marcador. */
export const minutoClip = (segundo: number) => `${Math.floor(segundo / 60) + 1}'`;

/** La dirección de la app para un fichero de B2 (por /api/video, con el candado de `privado/`). */
export const enApp = (ruta: string, descarga?: string) =>
  `/api/video/${ruta.split("/").map(encodeURIComponent).join("/")}${descarga ? `?descarga=${encodeURIComponent(descarga)}` : ""}`;
