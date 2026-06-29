"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";

import {
  LineupSlot,
  Player,
} from "@/types/player";

import { microFormation } from "@/lib/microFormation";
import { usePlayers } from "@/hooks/usePlayers";

const STORAGE_KEY = "rmcf-castilla-micro";

interface MicroLineupContextType {
  lineup: LineupSlot[];

  formation: string;

  selectedPlayer: Player | null;

  setSelectedPlayer: (
    player: Player | null
  ) => void;

  setFormation: (
    formation: string
  ) => void;

  assignPlayer: (
    positionId: string,
    playerId: string
  ) => void;

  removePlayer: (
    playerId: string
  ) => void;

  clearLineup: () => void;

  loadLineup: (
    formation: string,
    lineup: LineupSlot[]
  ) => void;

  getPlayerPosition: (
    positionId: string
  ) => LineupSlot | undefined;
}
function createLineup(): LineupSlot[] {
  return microFormation.map((position) => ({
    positionId: position.id,
    playerId: null,
  }));
}

const MicroLineupContext =
  createContext<MicroLineupContextType | null>(
    null
  );

export function MicroLineupProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { players } = usePlayers();

  const [
    selectedPlayer,
    _setSelectedPlayer,
  ] = useState<Player | null>(null);

  const setSelectedPlayer = (
    player: Player | null
  ) => {
    _setSelectedPlayer(player);
  };
const [formation, setFormation] =
  useState("Micro");
  const [lineup, setLineup] =
    useState<LineupSlot[]>(() => {
      if (typeof window === "undefined")
        return createLineup();

      try {
        const saved =
          localStorage.getItem(STORAGE_KEY);

        if (!saved)
          return createLineup();

        return JSON.parse(saved);
      } catch {
        return createLineup();
      }
    });

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(lineup)
    );
  }, [lineup]);
    function assignPlayer(
    positionId: string,
    playerId: string
  ) {
    const player = players.find(
      (p) => p.id === playerId
    );

    if (!player) return;

    setLineup((current) => {
      const origin = current.find(
        (slot) => slot.playerId === playerId
      );

      const destination = current.find(
        (slot) => slot.positionId === positionId
      );

      if (!destination) return current;

      const destinationPlayer = players.find(
        (p) => p.id === destination.playerId
      );

      // Desde el banquillo
      if (!origin) {
        return current.map((slot) => {
          if (slot.positionId === positionId) {
            return {
              ...slot,
              playerId,
            };
          }

          if (slot.playerId === playerId) {
            return {
              ...slot,
              playerId: null,
            };
          }

          return slot;
        });
      }

      // Intercambio
      return current.map((slot) => {
        if (slot.positionId === positionId) {
          return {
            ...slot,
            playerId,
          };
        }

        if (slot.positionId === origin.positionId) {
          return {
            ...slot,
            playerId:
              destinationPlayer?.id ?? null,
          };
        }

        return slot;
      });
    });

    setSelectedPlayer(null);
  }

  function removePlayer(
    playerId: string
  ) {
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
    setLineup(createLineup());
  }
function loadLineup(
  newFormation: string,
  newLineup: LineupSlot[]
) {
  setFormation(newFormation);
  setLineup(newLineup);
}
  function getPlayerPosition(
    positionId: string
  ) {
    return lineup.find(
      (slot) =>
        slot.positionId === positionId
    );
  }

const value = useMemo(
  () => ({
    lineup,

    formation,
    setFormation,

    selectedPlayer,
    setSelectedPlayer,

    assignPlayer,
    removePlayer,
    clearLineup,
    loadLineup,
    getPlayerPosition,
  }),
  [
    lineup,
    formation,
    selectedPlayer,
  ]
);

  return (
    <MicroLineupContext.Provider
      value={value}
    >
      {children}
    </MicroLineupContext.Provider>
  );
}

export function useMicroLineup() {
  const context =
    useContext(MicroLineupContext);

  if (!context) {
    throw new Error(
      "useMicroLineup debe utilizarse dentro de MicroLineupProvider"
    );
  }

  return context;
}