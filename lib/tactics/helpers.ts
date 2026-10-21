import {
  PITCH_HEIGHT,
  PITCH_WIDTH,
  Point,
  TacticScene,
  TacticShape,
  TacticToken,
  TacticsDoc,
} from "./types";

let counter = 0;

export function tacticId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function clampToPitch(point: Point): Point {
  return {
    x: Math.min(PITCH_WIDTH, Math.max(0, point.x)),
    y: Math.min(PITCH_HEIGHT, Math.max(0, point.y)),
  };
}

export function emptyScene(nombre = "Escena 1"): TacticScene {
  return { id: tacticId("scene"), nombre, tokens: [], shapes: [] };
}

export function emptyDoc(titulo = "Pizarra táctica"): TacticsDoc {
  return { version: 1, titulo, crop: "full", scenes: [emptyScene()] };
}

/** Rellena huecos de documentos guardados con versiones anteriores. */
export function normalizeDoc(raw: unknown, titulo?: string): TacticsDoc {
  const base = emptyDoc(titulo);

  if (!raw || typeof raw !== "object") return base;

  const value = raw as Partial<TacticsDoc>;

  const scenes = Array.isArray(value.scenes)
    ? value.scenes
        .filter(Boolean)
        .map((scene, index) => ({
          id: scene.id ?? tacticId("scene"),
          nombre: scene.nombre ?? `Escena ${index + 1}`,
          tokens: Array.isArray(scene.tokens) ? scene.tokens : [],
          shapes: Array.isArray(scene.shapes) ? scene.shapes : [],
          ...(typeof scene.nota === "string" && scene.nota ? { nota: scene.nota } : {}),
        }))
    : [];

  /*
  | Ojo al tocar esto: lo que no se copie aquí **se pierde en cada render**.
  | El documento guardado pasa siempre por esta función antes de llegar al
  | tablero, así que un campo nuevo que no se copie se escribe, vuelve, y
  | desaparece sin dar error: el botón se pulsa y no pasa nada.
  */
  return {
    version: 1,
    titulo: value.titulo ?? base.titulo,
    crop: value.crop ?? "full",
    scenes: scenes.length ? scenes : base.scenes,
    campo: value.campo,
    entorno: value.entorno,
    figuras: value.figuras,
    semanaOnces: value.semanaOnces,
    sinNombres: value.sinNombres,
  };
}

/** Copia una escena con identificadores nuevos. */
export function duplicateScene(scene: TacticScene, nombre: string): TacticScene {
  return {
    id: tacticId("scene"),
    nombre,
    // Las fichas conservan su id para que la animación entre escenas
    // pueda emparejarlas y desplazarlas.
    tokens: scene.tokens.map((token) => ({ ...token })),
    shapes: scene.shapes.map((shape) => ({
      ...shape,
      id: tacticId("shape"),
      points: shape.points.map((point) => ({ ...point })),
    })),
  };
}

/** Interpola las fichas de `from` hacia las de `to` (`t` entre 0 y 1). */
export function interpolateTokens(
  from: TacticToken[],
  to: TacticToken[],
  t: number
): TacticToken[] {
  const target = new Map(to.map((token) => [token.id, token]));

  const moved = from.map((token) => {
    const next = target.get(token.id);

    if (!next) return token;

    return {
      ...token,
      x: token.x + (next.x - token.x) * t,
      y: token.y + (next.y - token.y) * t,
    };
  });

  const known = new Set(from.map((token) => token.id));

  // Las fichas que solo existen en la escena destino aparecen al final.
  const appearing = to.filter((token) => !known.has(token.id));

  return t > 0.5 ? [...moved, ...appearing] : moved;
}

/**
 * El avance de un tramo tal y como se ve (21/10/2026).
 *
 * Con el avance tal cual las fichas salían disparadas y frenaban en seco
 * justo en la escena, y no había ni un instante para señalar dónde estaban:
 * el reproductor pasaba por las escenas sin pararse. Ahora cada escena se
 * sostiene un momento a la entrada y a la salida, y entre medias el
 * movimiento acelera y frena como un jugador de verdad.
 */
export function tramoSuave(t: number) {
  const PAUSA = 0.14;

  const u = Math.min(1, Math.max(0, (t - PAUSA) / (1 - 2 * PAUSA)));

  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/** Cómo se ordenan las fichas elegidas. */
export type Alineacion = "linea" | "fila" | "reparte-alto" | "reparte-ancho";

/**
 * Alinea o reparte las fichas elegidas (21/10/2026).
 *
 * - `linea`: todas a la misma altura del campo —la línea defensiva, la de
 *   presión—, en la media de donde estaban.
 * - `fila`: todas en el mismo carril, de portería a portería.
 * - `reparte-alto` / `reparte-ancho`: a la misma distancia unas de otras
 *   entre la primera y la última, sin moverlas del otro eje.
 */
export function alineaFichas(
  tokens: TacticToken[],
  ids: Set<string>,
  modo: Alineacion,
): TacticToken[] {
  const elegidas = tokens.filter((token) => ids.has(token.id));

  if (elegidas.length < 2) return tokens;

  const nuevo = new Map<string, Point>();

  if (modo === "linea" || modo === "fila") {
    const eje = modo === "linea" ? "x" : "y";
    const media = elegidas.reduce((suma, token) => suma + token[eje], 0) / elegidas.length;

    elegidas.forEach((token) => nuevo.set(token.id, { ...token, [eje]: media }));
  } else {
    const eje = modo === "reparte-alto" ? "y" : "x";
    const orden = [...elegidas].sort((a, b) => a[eje] - b[eje]);
    const desde = orden[0][eje];
    const paso = (orden[orden.length - 1][eje] - desde) / (orden.length - 1);

    orden.forEach((token, indice) => nuevo.set(token.id, { ...token, [eje]: desde + paso * indice }));
  }

  return tokens.map((token) => {
    const punto = nuevo.get(token.id);

    return punto ? { ...token, x: punto.x, y: punto.y } : token;
  });
}

/** Trazado SVG de una forma dibujada a mano o de una línea recta. */
export function pathFrom(shape: TacticShape): string {
  if (shape.points.length === 0) return "";

  const [head, ...rest] = shape.points;

  if (shape.tool === "free") {
    return `M ${head.x} ${head.y} ${rest
      .map((point) => `L ${point.x} ${point.y}`)
      .join(" ")}`;
  }

  const tail = shape.points[shape.points.length - 1];

  return `M ${head.x} ${head.y} L ${tail.x} ${tail.y}`;
}

/** Rectángulo normalizado de una zona, a partir de sus dos esquinas. */
export function rectFrom(shape: TacticShape) {
  const [a, b] = [shape.points[0], shape.points[shape.points.length - 1]];

  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}
