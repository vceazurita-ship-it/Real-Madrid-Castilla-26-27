"use client";

import { useState } from "react";

export interface BoardPlayer {
  playerId: string;
  slotId: string;
}

export function useBoard() {
  const [board, setBoard] = useState<BoardPlayer[]>([]);

  function assignPlayer(playerId: string, slotId: string) {
    setBoard((current) => {
      const withoutPlayer = current.filter(
        (p) => p.playerId !== playerId
      );

      const withoutSlot = withoutPlayer.filter(
        (p) => p.slotId !== slotId
      );

      return [
        ...withoutSlot,
        {
          playerId,
          slotId,
        },
      ];
    });
  }

  function removePlayer(playerId: string) {
    setBoard((current) =>
      current.filter((p) => p.playerId !== playerId)
    );
  }

  function clearBoard() {
    setBoard([]);
  }

  function getPlayer(slotId: string) {
    return board.find((p) => p.slotId === slotId);
  }

  return {
    board,
    assignPlayer,
    removePlayer,
    clearBoard,
    getPlayer,
  };
}