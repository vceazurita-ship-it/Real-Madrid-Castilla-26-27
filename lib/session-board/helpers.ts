import type { Player } from "@/types/player";
import { BIB_ORDER } from "./bibs";
import {
  BibColor,
  BoardTask,
  BoardTeam,
  ESTADOS_ENTRENABLES,
  LineKey,
  SessionBoard,
} from "./types";

/** Identificador estable sin depender de `crypto.randomUUID`. */
let counter = 0;
export function newId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function todayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Línea del campo a la que pertenece la posición del CSV de plantilla. */
export function lineOf(posicion: string): LineKey {
  const pos = (posicion ?? "").toUpperCase().trim();

  if (["PORTERO", "POR", "GK", "PT"].includes(pos)) return "POR";

  if (
    pos === "CENTRAL" ||
    pos.startsWith("LATERAL") ||
    ["DFC", "LD", "LI", "DEF", "CARRILERO"].includes(pos)
  ) {
    return "DEF";
  }

  if (["6", "8", "MC", "MCD", "MCO", "MI", "MD", "MED", "PIVOTE"].includes(pos)) {
    return "MED";
  }

  if (
    ["7", "9", "10", "11", "DC", "SD", "EI", "ED", "DEL", "EXT"].includes(pos)
  ) {
    return "DEL";
  }

  return "MED";
}

export const LINE_LABEL: Record<LineKey, string> = {
  POR: "Porteros",
  DEF: "Defensas",
  MED: "Medios",
  DEL: "Delanteros",
};

export const LINE_ORDER: LineKey[] = ["POR", "DEF", "MED", "DEL"];

export function canTrain(player: Player) {
  return ESTADOS_ENTRENABLES.includes(player.estado);
}

export function createTeam(index: number): BoardTeam {
  const color = BIB_ORDER[index % BIB_ORDER.length];

  return {
    id: newId("team"),
    nombre: `Equipo ${index + 1}`,
    color,
    playerIds: [],
  };
}

export function createTask(index: number, teams = 2): BoardTask {
  return {
    id: newId("task"),
    nombre: `Tarea ${index + 1}`,
    descripcion: "",
    duracion: "",
    formato: "",
    teams: Array.from({ length: teams }, (_, i) => createTeam(i)),
  };
}

export function createBoard(fecha = todayKey()): SessionBoard {
  return {
    version: 1,
    fecha,
    titulo: "Sesión de entrenamiento",
    excluidos: [],
    tasks: [createTask(0)],
  };
}

/** Normaliza documentos antiguos o incompletos venidos de Supabase. */
export function normalizeBoard(raw: unknown): SessionBoard {
  const base = createBoard();

  if (!raw || typeof raw !== "object") return base;

  const value = raw as Partial<SessionBoard>;

  const tasks = Array.isArray(value.tasks)
    ? value.tasks.map((task, index) => ({
        id: task?.id ?? newId("task"),
        nombre: task?.nombre ?? `Tarea ${index + 1}`,
        descripcion: task?.descripcion ?? "",
        duracion: task?.duracion ?? "",
        formato: task?.formato ?? "",
        teams: Array.isArray(task?.teams) && task.teams.length
          ? task.teams.map((team, teamIndex) => ({
              id: team?.id ?? newId("team"),
              nombre: team?.nombre ?? `Equipo ${teamIndex + 1}`,
              color: (team?.color ?? BIB_ORDER[teamIndex % BIB_ORDER.length]) as BibColor,
              playerIds: Array.isArray(team?.playerIds)
                ? team.playerIds.filter(Boolean)
                : [],
            }))
          : [createTeam(0), createTeam(1)],
      }))
    : base.tasks;

  return {
    version: 1,
    fecha: value.fecha ?? base.fecha,
    titulo: value.titulo ?? base.titulo,
    excluidos: Array.isArray(value.excluidos) ? value.excluidos : [],
    tasks: tasks.length ? tasks : base.tasks,
  };
}

/**
 * Reparte a los jugadores entre los equipos de una tarea.
 *
 * Primero un portero por equipo y después el resto por líneas, en serpentina
 * (0,1,2 → 2,1,0), que es lo que mantiene equilibrado el nivel por puesto.
 */
export function balanceTeams(
  teams: BoardTeam[],
  players: Player[]
): BoardTeam[] {
  if (!teams.length) return teams;

  const buckets: BoardTeam[] = teams.map((team) => ({
    ...team,
    playerIds: [],
  }));

  const byLine: Record<LineKey, Player[]> = {
    POR: [],
    DEF: [],
    MED: [],
    DEL: [],
  };

  players.forEach((player) => byLine[lineOf(player.posicion)].push(player));

  let cursor = 0;
  let forward = true;

  const push = (player: Player) => {
    buckets[cursor].playerIds.push(player.id);

    if (forward) {
      if (cursor === buckets.length - 1) forward = false;
      else cursor += 1;
    } else {
      if (cursor === 0) forward = true;
      else cursor -= 1;
    }
  };

  // Un portero por equipo antes de repartir el resto.
  byLine.POR.slice(0, buckets.length).forEach((keeper, index) => {
    buckets[index].playerIds.push(keeper.id);
  });

  const rest = [
    ...byLine.POR.slice(buckets.length),
    ...byLine.DEF,
    ...byLine.MED,
    ...byLine.DEL,
  ];

  rest.forEach(push);

  return buckets;
}
