/*
| El modelo emocional, compartido por la página y el campograma (29/10/2026):
| antes vivía dentro de page.tsx, y un page.tsx no puede exportar nada más que
| la página.
*/

export type MetricKey = "ea" | "ie" | "ia" | "ee";

export type Player = {
  posicion: string;
  jugador: string;
  /**
   * Titular de la pizarra sin valoración en la hoja (30/10/2026): lleva la
   * media de la plantilla en cada eje hasta que el cuerpo técnico lo evalúe.
   * No cuenta para las medias de la plantilla.
   */
  estimado?: boolean;
} & Record<MetricKey, number>;

/* Las cuatro dimensiones atencionales del modelo emocional.
   El orden define el recorrido del radar y se reutiliza en la leyenda. */
export const AXES: {
  key: MetricKey;
  code: string;
  /** Nombre corto en español: es el que se rotula en el radar y en los cuadros (las siglas sólo quedan para quien las conozca). */
  corto: string;
  label: string;
  detail: string;
  moment: string;
}[] = [
  {
    key: "ea",
    code: "EA",
    corto: "Observar",
    label: "Externo · Amplio",
    detail: "Observación / lectura (qué ocurre)",
    moment: "Antes de intervenir",
  },
  {
    key: "ie",
    code: "IE",
    corto: "Controlar",
    label: "Interno · Estrecho",
    detail: "Control emocional (qué siento)",
    moment: "Adversidad",
  },
  {
    key: "ia",
    code: "IA",
    corto: "Analizar",
    label: "Interno · Amplio",
    detail: "Análisis / reflexión (qué hacer)",
    moment: "Juego parado",
  },
  {
    key: "ee",
    code: "EE",
    corto: "Ejecutar",
    label: "Externo · Estrecho",
    detail: "Ejecución de acción (1v1)",
    moment: "Participación",
  },
];

/** «Control emocional (qué siento)» -> «Control emocional»: el nombre que se entiende sin la sigla. */
export const nombreLargo = (axis: { detail: string }) => axis.detail.replace(/\s*\(.*\)\s*$/, "");

/* Escala cromática compartida: el mismo valor se lee siempre con el mismo
   color, tanto en los paneles como en la cabecera y en el campo. */
export const SCALE = [
  { min: 8.5, tone: "#3BEA9A", label: "ÉLITE" },
  { min: 7.5, tone: "#36DAFF", label: "ALTA" },
  { min: 6.5, tone: "#8D7CFF", label: "MEDIA" },
  { min: 0, tone: "#FFB84D", label: "MEJORABLE" },
];

export function average(player: Player) {
  return AXES.reduce((acc, axis) => acc + player[axis.key], 0) / AXES.length;
}

export function bandFor(score: number) {
  return SCALE.find((band) => score >= band.min) ?? SCALE[SCALE.length - 1];
}

export function toneFor(score: number) {
  return bandFor(score).tone;
}

export function labelFor(score: number) {
  return bandFor(score).label;
}

/**
 * Las seis líneas de los radares (30/10/2026): portero y defensa (los 5),
 * defensa (los 4), perfil izquierdo (lateral y extremo), perfil derecho,
 * medios (6, 8 y 10) y puntas (9, 10 y extremos). Un jugador puede estar en
 * varias.
 */
export type GroupKey = "keeper" | "leftSide" | "defense" | "rightSide" | "midfield" | "strikers";

/* Colores de cada jugador dentro de un radar de línea. */
export const SERIES_COLORS = ["#36DAFF", "#B66BFF", "#62E8FF", "#D17DFF"];
