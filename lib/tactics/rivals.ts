/**
 * Plantillas rivales dentro de la pizarra táctica.
 *
 * La hoja de scouting es la fuente: de cada jugador solo interesan el dorsal
 * (lo que se pinta dentro de la ficha), el nombre y la posición, que sirve
 * para soltar la ficha en un sitio con sentido en lugar de en fila.
 */

import { PITCH_HEIGHT, Point, TacticToken } from "./types";

export interface RivalPick {
  id: string;
  dorsal: string;
  nombre: string;
  posicion?: string;
}

export interface RivalSquad {
  equipo: string;
  players: RivalPick[];
}

/** El identificador se deriva del jugador: la misma ficha en todas las escenas. */
export function rivalTokenId(playerId: string) {
  return `rival-${playerId}`;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePosition(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Ordena por dorsal numérico; los que no lo tienen van al final. */
function byDorsal(a: RivalPick, b: RivalPick) {
  const left = Number.parseInt(a.dorsal, 10);
  const right = Number.parseInt(b.dorsal, 10);

  if (Number.isNaN(left) && Number.isNaN(right)) {
    return a.nombre.localeCompare(b.nombre);
  }

  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;

  return left - right;
}

/** Agrupa por equipo las filas que devuelve `/api/rivals`. */
export function buildRivalSquads(rows: unknown): RivalSquad[] {
  if (!Array.isArray(rows)) return [];

  const squads = new Map<string, RivalPick[]>();

  rows.forEach((raw) => {
    if (!raw || typeof raw !== "object") return;

    const row = raw as Record<string, unknown>;

    const equipo = clean(row.NOMBRE_EQUIPO);
    if (!equipo) return;

    const nombre =
      clean(row["NOMBRE DEPORTIVO"]) || clean(row.JUGADOR) || "Sin nombre";

    const player: RivalPick = {
      id: clean(row.ID_JUGADOR) || `${equipo}-${nombre}`,
      dorsal: clean(row.DORSAL),
      nombre,
      posicion: clean(row["POSICIÓN"]) || clean(row["2º POSICIÓN"]),
    };

    const current = squads.get(equipo);

    if (current) current.push(player);
    else squads.set(equipo, [player]);
  });

  return [...squads.entries()]
    .map(([equipo, players]) => ({ equipo, players: players.sort(byDorsal) }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo));
}

/*
|--------------------------------------------------------------------------
| COLOCACIÓN POR POSICIÓN
|--------------------------------------------------------------------------
| El rival defiende la portería derecha, así que su portero vive pegado a la
| banda derecha del `viewBox` y sus delanteros miran hacia el centro.
*/

type RowKey = "por" | "def" | "piv" | "med" | "band" | "del";

const ROW_X: Record<RowKey, number> = {
  por: 94,
  def: 81,
  piv: 71,
  med: 64,
  band: 58,
  del: 51,
};

const LEFT_PATTERN =
  /(^|[\s\-/(.])(izquierd[oa]|izq(da|do)?|izd[oa]?|zurd[oa]|i)([\s\-/).]|$)/;

const RIGHT_PATTERN =
  /(^|[\s\-/(.])(derech[oa]|dch[oa]|dcha|der|dr|d)([\s\-/).]|$)/;

function detectRow(position: string): RowKey {
  if (/portero|arquero|guardameta|cancerbero/.test(position)) return "por";

  /* Antes que "punta": si no, "media punta" caería entre los delanteros. */
  if (/media ?-?punta|enganche|medio ofensivo|mediocentro ofensivo/.test(position)) {
    return "band";
  }

  if (/extremo|ext |banda|winger/.test(position)) return "band";

  if (/delanter|punta|ariete/.test(position)) return "del";

  if (/lateral|lat |carrilero|central|defensa|zaguero|libero|dfc/.test(position)) {
    return "def";
  }

  if (/pivote|ancla|medio centro def|mediocentro def|medio defensivo|mcd/.test(position)) {
    return "piv";
  }

  return "med";
}

function detectSide(position: string) {
  if (LEFT_PATTERN.test(position)) return -1;
  if (RIGHT_PATTERN.test(position)) return 1;

  return 0;
}

/** Cuánto abre: lateral y extremo pegados a la banda, interior al eje. */
function widthRank(position: string) {
  if (/lateral|lat |carrilero|extremo|ext /.test(position)) return 2;
  if (/interior|volante/.test(position)) return 1;

  return 0;
}

/** Punto de partida de la ficha según su posición en la hoja. */
export function rivalSpot(posicion?: string): Point {
  const position = normalizePosition(posicion);

  if (!position) return { x: 68, y: PITCH_HEIGHT / 2 };

  const side = detectSide(position);
  const spread = (0.55 + 0.22 * widthRank(position)) * 24;

  return {
    x: ROW_X[detectRow(position)],
    /* El rival ataca hacia la izquierda: su costado derecho queda arriba. */
    y: PITCH_HEIGHT / 2 - side * spread,
  };
}

/** Aparta el punto si ya hay una ficha encima. */
export function freeSpot(spot: Point, tokens: TacticToken[]): Point {
  const busy = (point: Point) =>
    tokens.some(
      (token) => Math.hypot(token.x - point.x, token.y - point.y) < 4.4
    );

  let candidate = spot;

  for (let step = 1; busy(candidate) && step <= 8; step += 1) {
    const offset = Math.ceil(step / 2) * 5 * (step % 2 === 0 ? -1 : 1);
    const y = spot.y + offset;

    candidate =
      y > 3 && y < PITCH_HEIGHT - 3
        ? { x: spot.x, y }
        : { x: spot.x - step * 3, y: spot.y };
  }

  return candidate;
}
