import { formations } from "@/lib/formations";
import type { LineupSlot, Player } from "@/types/player";
import { PITCH_HEIGHT, TacticToken } from "./types";

/**
 * Convierte la alineación de la pizarra de competición en fichas tácticas.
 *
 * El identificador de cada ficha se deriva de la posición, no del jugador, para
 * que al pasar de una escena a otra la animación empareje las mismas piezas.
 */
export function tokensFromLineup(
  lineup: LineupSlot[],
  formation: string,
  players: Player[]
): TacticToken[] {
  const positions = formations[formation] ?? [];

  return lineup.flatMap((slot) => {
    const position = positions.find((item) => item.id === slot.positionId);

    if (!position) return [];

    const player = players.find((item) => item.id === slot.playerId);

    return [
      {
        id: `lineup-${slot.positionId}`,
        kind: "home" as const,
        label: player?.dorsal ? String(player.dorsal) : position.nombre,
        nombre: player ? player.apodo || player.nombre : position.nombre,
        x: Number.parseFloat(position.left),
        y: (Number.parseFloat(position.top) / 100) * PITCH_HEIGHT,
      },
    ];
  });
}
