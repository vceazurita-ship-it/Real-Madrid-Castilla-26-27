"use client";

import { useState } from "react";

export interface LineupSlot {
  positionId: string;
  playerId: string | null;
}

export function useLineup() {
  const [lineup, setLineup] = useState<LineupSlot[]>([
    { positionId: "POR", playerId: null },

    { positionId: "LI", playerId: null },
    { positionId: "DFC1", playerId: null },
    { positionId: "DFC2", playerId: null },
    { positionId: "LD", playerId: null },

    { positionId: "MI", playerId: null },
    { positionId: "MC1", playerId: null },
    { positionId: "MC2", playerId: null },
    { positionId: "MD", playerId: null },

    { positionId: "DC1", playerId: null },
    { positionId: "DC2", playerId: null },
  ]);

  function assignPlayer(positionId: string, playerId: string) {
    setLineup((current) => {
      // eliminar jugador de cualquier otra posición
      const cleaned = current.map((slot) =>
        slot.playerId === playerId
          ? { ...slot, playerId: null }
          : slot
      );

      // colocar jugador
      return cleaned.map((slot) =>
        slot.positionId === positionId
          ? { ...slot, playerId }
          : slot
      );
    });
  }

  function removePlayer(playerId: string) {
    setLineup((current) =>
      current.map((slot) =>
        slot.playerId === playerId
          ? { ...slot, playerId: null }
          : slot
      )
    );
  }

  function clearLineup() {
    setLineup((current) =>
      current.map((slot) => ({
        ...slot,
        playerId: null,
      }))
    );
  }

  return {
    lineup,
    assignPlayer,
    removePlayer,
    clearLineup,
  };
}