/**
 * Modelo de datos de la pizarra táctica.
 *
 * Todas las coordenadas viven en el espacio del campo (100 x 68), el mismo
 * que usa el `viewBox` del SVG. Así un recorte (media pista, último tercio)
 * es solo un cambio de encuadre y no obliga a recalcular nada.
 */

export type ToolId =
  | "select"
  | "arrow"
  | "dashed"
  | "line"
  | "free"
  | "zone"
  | "text"
  | "erase";

export type TokenKind = "home" | "away" | "ball" | "cone";

export type PitchCrop = "full" | "own-half" | "final-third";

export interface Point {
  x: number;
  y: number;
}

export interface TacticToken extends Point {
  id: string;
  kind: TokenKind;
  /** Dorsal o abreviatura pintada dentro de la ficha. */
  label: string;
  /** Nombre completo, solo para el tooltip. */
  nombre?: string;
}

export interface TacticShape {
  id: string;
  tool: Exclude<ToolId, "select" | "erase">;
  color: string;
  points: Point[];
  text?: string;
}

export interface TacticScene {
  id: string;
  nombre: string;
  tokens: TacticToken[];
  shapes: TacticShape[];
}

export interface TacticsDoc {
  version: 1;
  titulo: string;
  crop: PitchCrop;
  scenes: TacticScene[];
}

export const PITCH_WIDTH = 100;
export const PITCH_HEIGHT = 68;

export const CROP_VIEWBOX: Record<PitchCrop, string> = {
  full: "0 0 100 68",
  "own-half": "0 0 52 68",
  "final-third": "62 0 38 68",
};

export const CROP_LABEL: Record<PitchCrop, string> = {
  full: "Campo completo",
  "own-half": "Campo propio",
  "final-third": "Último tercio",
};

export const DRAW_COLORS = [
  "#C8A96B",
  "#FFFFFF",
  "#38BDF8",
  "#34D399",
  "#F87171",
  "#FBBF24",
];
