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
