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
import { remapMicroFormation } from "@/lib/MicroFormationMapper";
import { microFormations } from "@/lib/microFormation";


const STORAGE_KEY = "rmcf-castilla-micro";

interface MicroLineupContextType {
  lineup: MicroLineupSlot[];

  formation: string;
loadedLineupName: string | null;

setLoadedLineupName: (
  name: string | null
) => void;
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
  id: number,
  formation: string,
  lineup: MicroLineupSlot[],
  name: string
) => void;

  getPlayerPosition: (
    positionId: string
  ) => MicroLineupSlot | undefined;
loadedLineupId: number | null;

setLoadedLineupId: (
  id: number | null
) => void;}

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
const [
  loadedLineupName,
  setLoadedLineupName,
] = useState<string | null>(null);
const [
  loadedLineupId,
  setLoadedLineupId,
] = useState<number | null>(null);

function setFormation(
  newFormation: string
) {
  _setFormation(newFormation);

  setLineup((current) => {
    const newLineup = createLineup(newFormation);

    return remapMicroFormation(
      current,
      newLineup
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
  setLineup((current) => {

    // Eliminar el jugador de cualquier posición
    const cleaned = current.map((slot) => ({
      ...slot,
      playerIds: slot.playerIds.filter(
        (id) => id !== playerId
      ),
    }));

    // Añadirlo únicamente a la nueva posición
    return cleaned.map((slot) => {

      if (slot.positionId !== positionId)
        return slot;

      return {
        ...slot,
        playerIds: [
          ...slot.playerIds,
          playerId,
        ],
      };

    });

  });

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
  setLineup(createLineup(formation));

  setLoadedLineupId(null);
  setLoadedLineupName(null);
}

  //--------------------------------------------------

  function loadLineup(
  id: number,
  newFormation: string,
  newLineup: MicroLineupSlot[],
  name: string
) {
  setLoadedLineupId(id);
  setLoadedLineupName(name);

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

    loadedLineupId,
    setLoadedLineupId,

    loadedLineupName,
    setLoadedLineupName,

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
  loadedLineupId,
  loadedLineupName,
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