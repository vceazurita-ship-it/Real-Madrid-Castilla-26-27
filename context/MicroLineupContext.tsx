"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

interface Slot {
  positionId: string;
  playerId: string | null;
}

interface ContextType {
  lineup: Slot[];

  assignPlayer: (
    positionId: string,
    playerId: string
  ) => void;

  removePlayer: (
    playerId: string
  ) => void;

  clearLineup: () => void;
}

const initialLineup: Slot[] = [
  { positionId: "POR", playerId: null },

  { positionId: "LD", playerId: null },
  { positionId: "DFC1", playerId: null },
  { positionId: "DFC2", playerId: null },
  { positionId: "LI", playerId: null },

  { positionId: "MCD", playerId: null },
  { positionId: "MCI", playerId: null },
  { positionId: "MCO", playerId: null },
  { positionId: "EI", playerId: null },

  { positionId: "DC1", playerId: null },
  { positionId: "DC2", playerId: null },
];

const MicroLineupContext =
  createContext<ContextType | null>(null);

export function MicroLineupProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [lineup, setLineup] =
    useState(initialLineup);

  function assignPlayer(
    positionId: string,
    playerId: string
  ) {
    setLineup((current) => {
      const origin = current.find(
        (s) => s.playerId === playerId
      );

      return current.map((slot) => {
        if (slot.positionId === positionId) {
          return {
            ...slot,
            playerId,
          };
        }

        if (
          origin &&
          slot.positionId === origin.positionId
        ) {
          return {
            ...slot,
            playerId: null,
          };
        }

        return slot;
      });
    });
  }

  function removePlayer(playerId: string) {
    setLineup((current) =>
      current.map((slot) =>
        slot.playerId === playerId
          ? {
              ...slot,
              playerId: null,
            }
          : slot
      )
    );
  }

  function clearLineup() {
    setLineup(initialLineup);
  }

  const value = useMemo(
    () => ({
      lineup,
      assignPlayer,
      removePlayer,
      clearLineup,
    }),
    [lineup]
  );

  return (
    <MicroLineupContext.Provider value={value}>
      {children}
    </MicroLineupContext.Provider>
  );
}

export function useMicroLineup() {
  const ctx = useContext(MicroLineupContext);

  if (!ctx) {
    throw new Error(
      "useMicroLineup debe utilizarse dentro de MicroLineupProvider"
    );
  }

  return ctx;
}