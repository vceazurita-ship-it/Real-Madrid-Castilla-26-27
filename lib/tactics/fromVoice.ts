import type {
  TacticsVoiceResult,
  VoiceScene,
  VoiceShape,
  VoiceToken,
  VoiceTokenTeam,
} from "@/lib/voice/types";

import { clampToPitch, tacticId } from "./helpers";
import type {
  Point,
  TacticScene,
  TacticShape,
  TacticToken,
  TokenKind,
} from "./types";
import { DRAW_COLORS } from "./types";

/**
 * Traduce lo que ha entendido el modelo a escenas de la pizarra.
 *
 * La clave está en la `ref`: el modelo repite la misma en cada escena para el
 * mismo jugador y aquí se convierte en un identificador de ficha estable, que
 * es lo que permite que la animación mueva la pieza en lugar de hacerla
 * desaparecer y reaparecer en otro sitio.
 */

const KIND_BY_TEAM: Record<VoiceTokenTeam, TokenKind> = {
  propio: "home",
  rival: "away",
  balon: "ball",
  cono: "cone",
};

const SHAPE_TOOLS = new Set<TacticShape["tool"]>([
  "arrow",
  "dashed",
  "line",
  "free",
  "zone",
  "text",
]);

/** Solo se aceptan los colores de la paleta; cualquier otro cae en el primero. */
function safeColor(value: unknown) {
  const color = String(value ?? "").toUpperCase();

  return (DRAW_COLORS as readonly string[]).includes(color)
    ? color
    : DRAW_COLORS[0];
}

function safePoint(raw: unknown): Point | null {
  if (!raw || typeof raw !== "object") return null;

  const point = raw as Partial<Point>;

  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  return clampToPitch({ x: Number(point.x), y: Number(point.y) });
}

function convertToken(
  raw: VoiceToken,
  ids: Map<string, string>
): TacticToken | null {
  const spot = safePoint(raw);

  if (!spot) return null;

  const kind = KIND_BY_TEAM[raw.equipo];

  if (!kind) return null;

  const ref = String(raw.ref ?? "").trim() || `${raw.equipo}-${raw.etiqueta}`;

  let id = ids.get(ref);

  if (!id) {
    id = tacticId("token");
    ids.set(ref, id);
  }

  const label = String(raw.etiqueta ?? "").trim().slice(0, 3);
  const nombre = String(raw.nombre ?? "").trim();

  return {
    id,
    kind,
    label: kind === "ball" ? "" : label,
    ...(nombre ? { nombre } : {}),
    x: spot.x,
    y: spot.y,
  };
}

function convertShape(raw: VoiceShape): TacticShape | null {
  const tool = raw?.tipo as TacticShape["tool"];

  if (!SHAPE_TOOLS.has(tool)) return null;

  const points = (Array.isArray(raw.puntos) ? raw.puntos : [])
    .map(safePoint)
    .filter((point): point is Point => point !== null);

  if (points.length === 0) return null;

  /* Texto: un solo punto y contenido. Las demás formas necesitan dos. */
  if (tool === "text") {
    const text = String(raw.texto ?? "").trim();

    if (!text) return null;

    return {
      id: tacticId("shape"),
      tool,
      color: safeColor(raw.color),
      points: [points[0]],
      text,
    };
  }

  if (points.length < 2) return null;

  return {
    id: tacticId("shape"),
    tool,
    color: safeColor(raw.color),
    points: tool === "free" ? points : [points[0], points[points.length - 1]],
  };
}

function convertScene(
  raw: VoiceScene,
  index: number,
  ids: Map<string, string>
): TacticScene {
  const tokens = (Array.isArray(raw.fichas) ? raw.fichas : [])
    .map((token) => convertToken(token, ids))
    .filter((token): token is TacticToken => token !== null);

  const shapes = (Array.isArray(raw.dibujos) ? raw.dibujos : [])
    .map(convertShape)
    .filter((shape): shape is TacticShape => shape !== null);

  /* Una `ref` repetida dentro de la misma escena sería la misma ficha dos
     veces: nos quedamos con la última posición dictada. */
  const unique = new Map(tokens.map((token) => [token.id, token]));

  return {
    id: tacticId("scene"),
    nombre: String(raw.nombre ?? "").trim() || `Escena ${index + 1}`,
    tokens: [...unique.values()],
    shapes,
  };
}

/** Escenas listas para insertar en el documento de la pizarra. */
export function scenesFromVoice(result: TacticsVoiceResult): TacticScene[] {
  const ids = new Map<string, string>();

  return (Array.isArray(result?.escenas) ? result.escenas : [])
    .map((scene, index) => convertScene(scene, index, ids))
    .filter((scene) => scene.tokens.length > 0 || scene.shapes.length > 0);
}
