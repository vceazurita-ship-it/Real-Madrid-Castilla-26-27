export type EstadoJugador =
  | "DISPONIBLE"
  | "LESIONADO"
  | "PRIMER EQUIPO"
  | "SELECCIÓN"
  | "SANCIONADO";

export interface Player {
  id: string;

  nombre: string;

  posicion: string;

  dorsal?: number;

  foto: string;

  licencia: string;

  esCastilla: boolean;

  estado: EstadoJugador;

  activo: boolean;

  hudl?: string;
}

/**
 * Una posición puede contener varios jugadores.
 */
export interface MicroLineupSlot {
  positionId: string;
  playerIds: string[];
} 