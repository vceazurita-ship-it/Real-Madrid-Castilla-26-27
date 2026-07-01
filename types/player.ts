export type EstadoJugador =
  | "DISPONIBLE"
  | "CONTROL DE CARGA"
  | "TOCADO"
  | "ÓPTIMO"
  | "REINCORPORACIÓN"
  | "LESIONADO"
  | "PRIMER EQUIPO"
  | "SELECCIÓN"
  | "SANCIONADO";

export interface Player {
  id: string;

  nombre: string;

  apodo?: string;

  posicion: string;

  dorsal?: number;

  foto: string;

  licencia: string;

  esCastilla: boolean;

  estado: EstadoJugador;

  activo: boolean;

  hudl?: string;
}

export interface LineupSlot {
  positionId: string;
  playerId: string | null;
}