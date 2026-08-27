/**
 * Modelo de datos de la pizarra táctica.
 *
 * Todas las coordenadas viven en el espacio del campo (100 x 68), el mismo
 * que usa el `viewBox` del SVG. Así un recorte (media pista, último tercio)
 * es solo un cambio de encuadre y no obliga a recalcular nada.
 */

import type { CampoId } from "./campos";

export type ToolId =
  | "select"
  | "camera"
  | "arrow"
  | "dashed"
  | "line"
  | "free"
  | "zone"
  | "text"
  | "erase";

/** Herramientas que dejan una forma dibujada sobre el campo. */
export type DrawToolId = Exclude<ToolId, "select" | "erase" | "camera">;

/** Tipo de trazo del dibujo. */
export type LineDash = "solid" | "dashed" | "dotted";

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
  tool: DrawToolId;
  color: string;
  points: Point[];
  text?: string;
  /** Grosor del trazo en unidades de campo. Si falta, se usa `LINE_WIDTHS[1]`. */
  width?: number;
  /** Tipo de trazo. Si falta, lo decide la herramienta. */
  dash?: LineDash;
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
  /** Diseño del campo. Si falta, el de siempre (ver `lib/tactics/campos.ts`). */
  campo?: CampoId;
  /**
   * Si se levantan las vallas y el graderío alrededor del campo.
   *
   * Se guarda con la pizarra y no con la sesión: una jugada montada para
   * enseñar en la sala y la misma preparada para mandar por el grupo no se ven
   * igual, y esa decisión es parte del documento.
   */
  entorno?: boolean;
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

/** Grosores del trazo, en unidades del campo (el ancho es 100). */
export const LINE_WIDTHS = [0.3, 0.5, 0.85, 1.3] as const;

export const LINE_WIDTH_LABEL = ["Fino", "Normal", "Grueso", "Muy grueso"];

/** Patrón de guiones de cada tipo de trazo, en unidades de campo. */
export const LINE_DASH_ARRAY: Record<LineDash, string | undefined> = {
  solid: undefined,
  dashed: "1.6 1.2",
  dotted: "0.05 1.1",
};

export const LINE_DASH_LABEL: Record<LineDash, string> = {
  solid: "Continuo",
  dashed: "Discontinuo",
  dotted: "Punteado",
};
