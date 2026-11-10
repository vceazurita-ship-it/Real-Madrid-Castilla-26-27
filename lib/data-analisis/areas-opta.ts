/**
 * Las áreas de «Análisis de datos» que eran pestañas de /opta (10/11/2026,
 * fase 4), y a cuál lleva cada `/opta?pestana=`. Sin "use client": lo lee
 * también la página de servidor que redirige (app/opta/page.tsx).
 */

export const AREAS_OPTA = [
  "colectivo",
  "fases",
  "evolucion",
  "remates",
  "plantilla",
  "buscador",
  "talento",
  "tablaLiga",
  "estilos",
  "evolucionLiga",
  "rematesLiga",
  "partidoCategoria",
  "penaltis",
  "directo",
] as const;
export type AreaOpta = (typeof AREAS_OPTA)[number];

export const esAreaOpta = (a: string): a is AreaOpta => (AREAS_OPTA as readonly string[]).includes(a);

/**
 * `/opta?pestana=<clave>` → `/data-analisis?area=<área>`. «Evolución» y
 * «Remates» elegían cualquier equipo y abrían en el Castilla: van a la de
 * cualquier equipo, que también lo tiene.
 */
export const AREA_DE_PESTANA: Record<string, AreaOpta> = {
  castilla: "colectivo",
  fases: "fases",
  liga: "tablaLiga",
  evolucion: "evolucionLiga",
  partidos: "partidoCategoria",
  remates: "rematesLiga",
  penaltis: "penaltis",
  estilos: "estilos",
  jugadores: "plantilla",
  buscador: "buscador",
  talento: "talento",
  directo: "directo",
};
