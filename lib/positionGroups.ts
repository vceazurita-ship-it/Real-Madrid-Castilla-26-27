import { Player } from "@/types/player";

export type MicroLine =
  | "goalkeepers"
  | "defenders"
  | "midfielders"
  | "forwards";

export interface MicroGroups {
  goalkeepers: Player[];
  defenders: Player[];
  midfielders: Player[];
  forwards: Player[];
}

export function groupPlayers(players: Player[]): MicroGroups {
  return {
    goalkeepers: players.filter(
      (p) => p.posicion === "Portero"
    ),

    defenders: players.filter((p) =>
      [
        "LATERAL D.",
        "LATERAL I.",
        "CENTRAL",
      ].includes(p.posicion)
    ),

    midfielders: players.filter((p) =>
      [
        "6",
        "8",
        "10",
      ].includes(p.posicion)
    ),

    forwards: players.filter((p) =>
      [
        "7",
        "9",
        "11",
      ].includes(p.posicion)
    ),
  };
}