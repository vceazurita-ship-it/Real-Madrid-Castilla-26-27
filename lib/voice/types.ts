/**
 * Contrato entre `/api/voice` y las pantallas que dictan.
 *
 * El modelo nunca escribe directamente sobre los datos: devuelve una
 * propuesta con estas formas y es la interfaz quien la revisa y la aplica.
 */

/* -------------------------------------------------------------------------
 | INFORME DE SCOUTING (plantilla rival)
 * ---------------------------------------------------------------------- */

/** Campos de la ficha del rival que se pueden dictar. */
export const RIVAL_VOICE_FIELDS = [
  "JUGADOR",
  "NOMBRE DEPORTIVO",
  "DORSAL",
  "POSICIÓN",
  "2º POSICIÓN",
  "PIE DOMINANTE",
  "EDAD",
  "ALTURA",
  "PESO",
  "LUGAR DE NACIMIENTO",
  "PROCEDENCIA",
  "ROL",
  "ESTADO",
  "CARACTERÍSTICAS",
  "FORTALEZAS",
  "DEBILIDADES",
  "OBSERVACIONES",
] as const;

export type RivalVoiceField = (typeof RIVAL_VOICE_FIELDS)[number];

/** Los campos largos se pueden ampliar sin borrar lo que ya había. */
export const RIVAL_LONG_FIELDS: RivalVoiceField[] = [
  "CARACTERÍSTICAS",
  "FORTALEZAS",
  "DEBILIDADES",
  "OBSERVACIONES",
];

export interface RivalVoiceChange {
  campo: RivalVoiceField;
  /** Texto propuesto (solo lo nuevo si el modo es `añadir`). */
  valor: string;
  modo: "reemplazar" | "añadir";
  /** Por qué lo propone, en una línea. */
  motivo?: string;
}

export interface RivalVoiceResult {
  /** Qué ha entendido, en una o dos frases. */
  resumen: string;
  /** Transcripción literal del dictado. */
  transcripcion: string;
  cambios: RivalVoiceChange[];
  /** Claves del catálogo de etiquetas que deberían quedar activas. */
  etiquetas: string[];
  /** Lo que se ha oído pero no encaja en ningún campo. */
  avisos: string[];
}

/* -------------------------------------------------------------------------
 | JUGADA DE PIZARRA
 * ---------------------------------------------------------------------- */

export type VoiceTokenTeam = "propio" | "rival" | "balon" | "cono";

export interface VoiceToken {
  /**
   * Identificador estable del jugador dentro del dictado ("rival-8",
   * "propio-lateral-izq"). La misma `ref` en varias escenas es la misma
   * ficha, y eso es lo que permite animar el desplazamiento.
   */
  ref: string;
  equipo: VoiceTokenTeam;
  /** Dorsal o abreviatura que se pinta dentro de la ficha. */
  etiqueta: string;
  nombre?: string;
  x: number;
  y: number;
}

export type VoiceShapeTool =
  | "arrow"
  | "dashed"
  | "line"
  | "free"
  | "zone"
  | "text";

export interface VoiceShape {
  tipo: VoiceShapeTool;
  puntos: { x: number; y: number }[];
  texto?: string;
  color?: string;
}

export interface VoiceScene {
  nombre: string;
  fichas: VoiceToken[];
  dibujos: VoiceShape[];
}

export interface TacticsVoiceResult {
  resumen: string;
  transcripcion: string;
  crop?: "full" | "own-half" | "final-third";
  escenas: VoiceScene[];
  avisos: string[];
}

export type VoiceMode = "rival" | "tactics";
