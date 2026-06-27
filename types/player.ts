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

  estado: EstadoJugador;

  activo: boolean;

  hudl?: string;

}