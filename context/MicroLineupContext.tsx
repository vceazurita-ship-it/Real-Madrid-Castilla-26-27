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
  MicroLineupSlot,
  Player,
} from "@/types/MicroPlayer";

import { microFormations } from "@/lib/microFormation";
import { usePlayers } from "@/hooks/usePlayers";

const STORAGE_KEY = "rmcf-castilla-micro";

interface MicroLineupContextType {
  lineup: MicroLineupSlot[];

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
    lineup: MicroLineupSlot[]
  ) => void;

  getPlayerPosition: (
    positionId: string
  ) => MicroLineupSlot | undefined;
}

function createLineup(
  formation = "4-4-2"
): MicroLineupSlot[] {
  return (
    microFormations[formation] ??
    microFormations["4-4-2"]
  ).map((position) => ({
    positionId: position.id,
    playerIds: [],
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

  const [formation, _setFormation] =
  useState("4-4-2");

function setFormation(
  newFormation: string
) {
  _setFormation(newFormation);

  setLineup((current) => {
    const previous = new Map(
      current.map((slot) => [
        slot.positionId,
        slot.playerIds,
      ])
    );

    return createLineup(newFormation).map(
      (slot) => ({
        ...slot,
        playerIds:
          previous.get(slot.positionId) ?? [],
      })
    );
  });
}

  const [lineup, setLineup] =
    useState<MicroLineupSlot[]>(() => {

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

  //--------------------------------------------------
  // Añadir jugador al grupo
  //--------------------------------------------------

  function assignPlayer(
  positionId: string,
  playerId: string
) {
  setLineup((current) =>
    current.map((slot) => {

      if (slot.positionId !== positionId)
        return slot;

      // Si ya está en el grupo, no lo duplica
      if (slot.playerIds.includes(playerId))
        return slot;

      return {
        ...slot,
        playerIds: [...slot.playerIds, playerId],
      };
    })
  );

  setSelectedPlayer(null);
}

  //--------------------------------------------------
  // Eliminar jugador
  //--------------------------------------------------

  function removePlayer(
    playerId: string
  ) {

    setLineup((current) =>

      current.map((slot) => ({

        ...slot,

        playerIds: slot.playerIds.filter(
          (id) => id !== playerId
        ),

      }))

    );

  }

  //--------------------------------------------------

  function clearLineup() {

    setLineup(createLineup());

  }

  //--------------------------------------------------

  function loadLineup(
    newFormation: string,
    newLineup: MicroLineupSlot[]
  ) {

    setFormation(newFormation);

    setLineup(newLineup);

  }

  //--------------------------------------------------

  function getPlayerPosition(
    positionId: string
  ) {

    return lineup.find(
      (slot) =>
        slot.positionId === positionId
    );

  }

  //--------------------------------------------------

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