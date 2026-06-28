
"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { LineupSlot } from "@/types/player";

interface LineupContextType {
  lineup: LineupSlot[];

  formation: string;

  setFormation: (formation: string) => void;

  assignPlayer: (positionId: string, playerId: string) => void;

  removePlayer: (playerId: string) => void;

  clearLineup: () => void;
}

const initialLineup: LineupSlot[] = [
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
];

const LineupContext = createContext<LineupContextType | null>(null);

export function LineupProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [formation, setFormation] = useState("4-4-2");

  const [lineup, setLineup] = useState(initialLineup);

  function assignPlayer(positionId: string, playerId: string) {
    setLineup((current) => {
      const cleaned = current.map((slot) =>
        slot.playerId === playerId
          ? { ...slot, playerId: null }
          : slot
      );

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
    setLineup(initialLineup);
  }

  const value = useMemo(
    () => ({
      lineup,
      formation,
      setFormation,
      assignPlayer,
      removePlayer,
      clearLineup,
    }),
    [lineup, formation]
  );

  return (
    <LineupContext.Provider value={value}>
      {children}
    </LineupContext.Provider>
  );
}

export function useLineup() {
  const context = useContext(LineupContext);

  if (!context) {
    throw new Error(
      "useLineup debe utilizarse dentro de LineupProvider"
    );
  }

  return context;
}