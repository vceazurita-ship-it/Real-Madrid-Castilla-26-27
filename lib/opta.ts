/**
 * DATOS DE OPTA (TruMedia ProVision) — 09/11/2026.
 *
 * Los baja `scripts/opta-liga.mjs` (encargo «opta» de Ajustes y cada lunes) y
 * viven en Supabase (`app_documents`, kind «opta»), NO en el repositorio: son
 * datos con licencia del club y el repo es público. Se leen con /api/docs.
 *
 * Todas las tablas tienen la misma forma: `{ cols, filas }`, una fila por
 * entidad, y cada métrica es una columna con su abreviatura de Opta (`Goal`,
 * `ExpG`, `Pass%`…). Lo que significa cada abreviatura está en
 * `opta:meta.catalogo` (nombre en inglés, contexto, formato). Los porcentajes
 * vienen en tanto por uno (0.82 = 82 %).
 *
 * Castilla en Opta = «Real Madrid II» (`CASTILLA_OPTA`).
 */

export const CASTILLA_OPTA = "3kibouup3gxwnnxp3vhz83af7";

export type Celda = string | number | null;
export type TablaOpta = { cols: string[]; filas: Celda[][] };

export type MetricaOpta = {
  /** Abreviatura: la columna. */
  a: string;
  /** Nombre en inglés. */
  n: string;
  /** inPossession / outOfPossession / goalkeeping. */
  c: string[];
  /** INTEGER, NUMBER, PERCENT… */
  f: string;
  d: string;
};

export type MetaOpta = {
  actualizado: string;
  temporada: { id: string; nombre: string; ultimoPartido: string };
  castilla: string;
  catalogo: MetricaOpta[];
};

export const DOCS_OPTA = {
  meta: "opta:meta",
  /** 40 equipos × todas las métricas de equipo (≈1.277). Claves: teamId, equipo, optaTeamId. */
  equipos: "opta:equipos",
  /** Equipo × partido. Claves: partido, fecha, teamId, equipo. */
  partidos: "opta:partidos",
  /** Todos los jugadores de la categoría (selección). Claves: playerId, jugador, teamId, equipo, puesto. */
  jugadores: "opta:jugadores",
  /** Jugadores del Castilla × todas las métricas de jugador. Mismas claves que jugadores. */
  castilla: "opta:castilla",
  /** Jugador del Castilla × partido. Claves: partido, fecha, playerId, jugador, rival. */
  castillaPartidos: "opta:castilla-partidos",
  /** Toda la categoría jugador × partido (ligero). Claves: partido, playerId, jugador, teamId; Min, GS (1 = titular), Goal, ShtIncBl, SOG, ExpG, Ast, xA, Chance, TouchOpBox. */
  jugadoresPartidos: "opta:jugadores-partidos",
  /*
   * EVENTO A EVENTO (toda la temporada). Coordenadas de Opta: x 0-100 hacia la
   * portería rival, y 0-100 (0 = banda derecha del que ataca). GoalmouthY/Z:
   * por dónde cruza la línea de gol (Y 45,2-54,8 entre palos; Z < 38 bajo el
   * larguero). `segundo` = segundos de partido; `secuencia` ata eventos de la
   * misma jugada (un saque de ABP con el remate que provoca).
   *
   * OJO: remates, penaltis y abp-eventos traen CADA EVENTO DOS VECES (una por
   * equipo del partido) y castilla-eventos trae los de los dos equipos. Se
   * leen siempre por `lib/opta-eventos.ts`, que los deja de uno en uno y con
   * su equipo.
   */
  /** Cada remate de la categoría (≈11.400): tirador, x/y, xG, xGOT, parte del cuerpo, situación, presión. */
  remates: "opta:remates",
  /** Cada penalti de la categoría: lanzador, portero, pie, dónde entra, posición del portero. */
  penaltis: "opta:penaltis",
  /** Castilla: pases, recuperaciones, duelos… con x/y, destino, receptor, xA, xPV. */
  castillaEventos: "opta:castilla-eventos",
  /** Cada saque de córner, falta y banda de la categoría (abp = corner|falta|banda). */
  abpEventos: "opta:abp-eventos",
  /** Cada equipo en cada partido por tramos de 5 minutos (tramo = minuto ÷ 5): xG, remates, toques en área, posesión… */
  momento: "opta:momento",
  /** Directo: `opta:directo:<partido>`, lo escribe el proceso de GitHub. */
  directo: (partido: string) => `opta:directo:${partido}`,
} as const;

/** Trae un documento de Opta por /api/docs (null si aún no existe). */
export async function traeOpta<T = TablaOpta>(clave: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(clave)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Filas como objetos: `{ jugador: "…", Goal: 3, … }`. */
export function aObjetos(t: TablaOpta | null | undefined): Record<string, Celda>[] {
  if (!t) return [];
  return t.filas.map((f) => Object.fromEntries(t.cols.map((c, i) => [c, f[i] ?? null])));
}

export const num = (v: Celda | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/** Por 90 minutos (null si no hay minutos suficientes). */
export function por90(valor: Celda | undefined, minutos: Celda | undefined, minimo = 90): number | null {
  const v = num(valor);
  const m = num(minutos);
  if (v == null || m == null || m < minimo) return null;
  return (v / m) * 90;
}

/** Percentil (0-100) de `valor` dentro de `muestra`; `inverso` cuando menos es mejor. */
export function percentil(valor: number | null, muestra: (number | null)[], inverso = false): number | null {
  if (valor == null) return null;
  const xs = muestra.filter((x): x is number => x != null && Number.isFinite(x));
  if (!xs.length) return null;
  const menores = xs.filter((x) => (inverso ? x > valor : x < valor)).length;
  const iguales = xs.filter((x) => x === valor).length;
  return Math.round(((menores + iguales / 2) / xs.length) * 100);
}

/** Opta → castellano, para el puesto (gameDetailedPosition). */
export const PUESTO_OPTA: Record<string, string> = {
  Goalkeeper: "Portero",
  "Right Back": "Lateral derecho",
  "Left Back": "Lateral izquierdo",
  "Right Wing Back": "Carrilero derecho",
  "Left Wing Back": "Carrilero izquierdo",
  "Central Defender": "Central",
  "Left Centre Back": "Central",
  "Right Centre Back": "Central",
  "Defensive Midfielder": "Pivote",
  "Central Midfielder": "Mediocentro",
  "Left Central Midfielder": "Mediocentro",
  "Right Central Midfielder": "Mediocentro",
  "Attacking Midfielder": "Mediapunta",
  "Centre Attacking Midfielder": "Mediapunta",
  "Left Attacking Midfielder": "Mediapunta izquierdo",
  "Right Attacking Midfielder": "Mediapunta derecho",
  "Left Midfielder": "Interior izquierdo",
  "Right Midfielder": "Interior derecho",
  "Left Winger": "Extremo izquierdo",
  "Right Winger": "Extremo derecho",
  "Second Striker": "Segundo punta",
  "Centre Forward": "Delantero",
  Striker: "Delantero",
};

/** Formatea según el formato de Opta (PERCENT viene en tanto por uno). */
export function formatea(v: number | null, formato?: string, decimales = 1): string {
  if (v == null) return "";
  if (formato === "PERCENT") return `${(v * 100).toFixed(decimales)} %`;
  if (formato === "INTEGER" && Number.isInteger(v)) return String(v);
  return v.toFixed(decimales === 1 && Math.abs(v) < 10 ? 2 : decimales);
}
