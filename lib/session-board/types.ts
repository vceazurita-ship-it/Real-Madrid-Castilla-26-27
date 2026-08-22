import type { EstadoJugador } from "@/types/player";

/** Peto disponible en la sesión. */
export type BibColor = "amarillo" | "naranja" | "verde" | "sin-peto";

export interface BoardTeam {
  id: string;
  nombre: string;
  color: BibColor;
  playerIds: string[];
}

export interface BoardTask {
  id: string;
  nombre: string;
  descripcion: string;
  /** Duración en minutos, como texto libre para no forzar el formato. */
  duracion: string;
  /** Formato del enfrentamiento, p. ej. "7v7". Solo informativo. */
  formato: string;
  teams: BoardTeam[];
}

export interface SessionBoard {
  version: 1;
  fecha: string;
  titulo: string;
  /** Jugadores retirados a mano de la sesión pese a estar disponibles. */
  excluidos: string[];
  tasks: BoardTask[];
}

/** Estados con los que un jugador puede pisar el campo en la sesión. */
export const ESTADOS_ENTRENABLES: EstadoJugador[] = [
  "ÓPTIMO",
  "DISPONIBLE",
  "CONTROL DE CARGA",
  "TOCADO",
  "REINCORPORACIÓN",
  "SANCIONADO",
];

export type LineKey = "POR" | "DEF" | "MED" | "DEL";
