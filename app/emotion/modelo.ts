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
  /** La valoración se cambió en esta pantalla y manda sobre la de la hoja (31/10/2026). */
  editado?: boolean;
} & Record<MetricKey, number>;

/*
| LO EDITADO EN LA PANTALLA (31/10/2026)
|
| La hoja emocional es un CSV publicado: se lee, no se escribe. Lo que el
| analista cambia en «Editar valoraciones» se guarda como una capa encima, en
| el documento `emotion:valoraciones` de Supabase (useRemoteDoc), y esa capa
| manda sobre la hoja jugador a jugador. Quitar a uno de la capa lo devuelve a
| lo que diga la hoja.
*/
export type EdicionEmocional = Record<MetricKey, number> & {
  posicion?: string;
  /** Cuándo se editó (ISO). */
  editado: string;
};

export type DocEmocional = {
  v: 1;
  /** Por el nombre exacto con el que sale en la pantalla. */
  jugadores: Record<string, EdicionEmocional>;
};

export const DOC_EMOCIONAL_VACIO: DocEmocional = { v: 1, jugadores: {} };

export const CLAVE_DOC_EMOCIONAL = "emotion:valoraciones";

const notaValida = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 10;

/** Lo que llega del servidor, sin fiarse de la forma. */
export function normalizaDocEmocional(doc: unknown): DocEmocional {
  const crudo = (doc && typeof doc === "object" ? (doc as { jugadores?: unknown }).jugadores : null) ?? {};
  const jugadores: Record<string, EdicionEmocional> = {};

  if (crudo && typeof crudo === "object") {
    for (const [nombre, e] of Object.entries(crudo as Record<string, unknown>)) {
      if (!nombre.trim() || !e || typeof e !== "object") continue;

      const x = e as Partial<EdicionEmocional>;

      if (!AXES.every((a) => notaValida(x[a.key]))) continue;

      jugadores[nombre] = {
        ea: x.ea as number,
        ie: x.ie as number,
        ia: x.ia as number,
        ee: x.ee as number,
        posicion: typeof x.posicion === "string" ? x.posicion : undefined,
        editado: typeof x.editado === "string" ? x.editado : "",
      };
    }
  }

  return { v: 1, jugadores };
}

/** La hoja con lo editado encima: lo editado manda, y quien no está en la hoja entra con lo suyo. */
export function aplicaEdiciones(hoja: Player[], doc: DocEmocional): Player[] {
  const ediciones = doc.jugadores;
  const vistos = new Set<string>();

  const fusion = hoja.map((r) => {
    const e = ediciones[r.jugador];

    if (!e) return r;

    vistos.add(r.jugador);

    return { ...r, ea: e.ea, ie: e.ie, ia: e.ia, ee: e.ee, editado: true };
  });

  const nuevos = Object.entries(ediciones)
    .filter(([nombre]) => !vistos.has(nombre))
    .map(([nombre, e]) => ({ posicion: e.posicion ?? "", jugador: nombre, ea: e.ea, ie: e.ie, ia: e.ia, ee: e.ee, editado: true }));

  return [...fusion, ...nuevos];
}

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
