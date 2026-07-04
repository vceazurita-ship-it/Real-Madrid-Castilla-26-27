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
import { remapSessionFormation } from "@/lib/SesionFormationMapper";

const STORAGE_KEY = "rmcf-castilla-session";

interface SessionLineupContextType {
  lineup: MicroLineupSlot[];

  formation: string;

  loadedLineupId: number | null;
  setLoadedLineupId: (id: number | null) => void;

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

  initializeFromPlayers: (
    players: Player[]
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

const SessionLineupContext =
  createContext<SessionLineupContextType | null>(
    null
  );

/*
|--------------------------------------------------------------------------
| Relación POSICIÓN CSV -> ID DEL CAMPO
|--------------------------------------------------------------------------
|
| Aquí podremos adaptar cualquier nomenclatura del CSV
| sin tocar el resto de la aplicación.
|
*/

const POSITION_MAP: Record<string, string[]> = {
  PORTERO: ["POR"],

  "LATERAL D": ["LD"],
  "LATERAL I": ["LI"],

  CENTRAL: ["DFC1", "DFC2"],

  "6": ["MC6"],

  "8": ["MC8"],

  "10": ["MC10"],

  "7": ["ED"],

  "11": ["EI"],

  "9": ["DC1", "DC2"],
};

/*
|--------------------------------------------------------------------------
| Busca el primer hueco libre para una posición
|--------------------------------------------------------------------------
*/

function findBestPosition(
  lineup: MicroLineupSlot[],
  options: string[]
) {
  // Primero intenta una posición vacía
  const empty = lineup.find(
    slot =>
      options.includes(slot.positionId) &&
      slot.playerIds.length === 0
  );

  if (empty) return empty;

  // Si todas están ocupadas devuelve la primera
  return lineup.find(slot =>
    options.includes(slot.positionId)
  );
}
function normalizePosition(position: string) {
  return position
    .toUpperCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}
export function SessionLineupProvider({
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
      const newLineup =
        createLineup(newFormation);

      return remapSessionFormation(
        current,
        newLineup
      );
    });
  }
const [initialized, setInitialized] =
  useState(false);
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
  // Inicializar sesión automáticamente
  //--------------------------------------------------

  function initializeFromPlayers(
    players: Player[]
  ) {
    if (initialized) return;
    const newLineup =
      createLineup(formation);

    players.forEach((player) => {

      const position =
        normalizePosition(player.posicion);

      const options =
  POSITION_MAP[position];

if (!options) {
  console.warn(
    "Posición no mapeada:",
    position
  );
  return;
}
      const slot = findBestPosition(
  newLineup,
  options
);

      if (!slot) return;

      slot.playerIds.push(player.id);

    });

    setLineup(newLineup);

    setLoadedLineupId(null);
    setLoadedLineupName(null);
    setInitialized(true);
  }
    //--------------------------------------------------
  // Añadir jugador
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
  // Limpiar sesión
  //--------------------------------------------------

  function clearLineup() {

    setLineup(createLineup(formation));

    setLoadedLineupId(null);
    setLoadedLineupName(null);
    setInitialized(false);

  }

  //--------------------------------------------------
  // Cargar sesión guardada
  //--------------------------------------------------

  function loadLineup(
    id: number,
    newFormation: string,
    newLineup: MicroLineupSlot[],
    name: string
  ) {

    setLoadedLineupId(id);
setLoadedLineupName(name);
  setInitialized(true);

_setFormation(newFormation);
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

      selectedPlayer,
      setSelectedPlayer,

      setFormation,

      assignPlayer,
      removePlayer,
      clearLineup,
      loadLineup,
      initializeFromPlayers,
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
    <SessionLineupContext.Provider
      value={value}
    >
      {children}
    </SessionLineupContext.Provider>
  );
}

export function useSessionLineup() {

  const context =
    useContext(SessionLineupContext);

  if (!context) {

    throw new Error(
      "useSessionLineup debe utilizarse dentro de SessionLineupProvider"
    );

  }

  return context;

}