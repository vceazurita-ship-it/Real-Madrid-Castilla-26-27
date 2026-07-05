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

import { layouts } from "@/lib/training/layouts";

const STORAGE_KEY = "rmcf-castilla-session";

interface SessionLineupContextType {
  lineup: MicroLineupSlot[];

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
  
  assignPlayer: (
    positionId: string,
    playerId: string
  ) => void;

  removePlayer: (
    playerId: string
  ) => void;

  clearLineup: () => void;

playersPerTeam: 5 | 6 | 7 | 8 | 9 | 10 | 11;

changePlayersPerTeam: (
  value: 5 | 6 | 7 | 8 | 9 | 10 | 11
) => void;

loadLineup: (
  id: number,
  newPlayersPerTeam: 5 | 6 | 7 | 8 | 9 | 10 | 11,
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

function createLineup(players: 5 | 6 | 7 | 8 | 9 | 10 | 11 = 11): MicroLineupSlot[] {
  const layout = layouts[players];

  return [...layout.blue, ...layout.red].map((position) => ({
    positionId: position.id,
    playerIds: [],
  }));
}

const SessionLineupContext =
  createContext<SessionLineupContextType | null>(
    null
  );


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

  const [playersPerTeam, setPlayersPerTeam] =
  useState<5 | 6 | 7 | 8 | 9 | 10 | 11>(11);

 function changePlayersPerTeam(
  value: 5 | 6 | 7 | 8 | 9 | 10 | 11
) {
  if (value === playersPerTeam) return;

  setPlayersPerTeam(value);

  setInitialized(false);

  setLoadedLineupId(null);
  setLoadedLineupName(null);
  setSelectedPlayer(null);
}

  const [
    loadedLineupName,
    setLoadedLineupName,
  ] = useState<string | null>(null);

  const [
    loadedLineupId,
    setLoadedLineupId,
  ] = useState<number | null>(null);

const [initialized, setInitialized] =
  useState(false);
 const [lineup, setLineup] =
  useState<MicroLineupSlot[]>(() => {
    if (typeof window === "undefined") {
      return createLineup(playersPerTeam);
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return createLineup(playersPerTeam);
      }

      return JSON.parse(saved);
    } catch {
      return createLineup(playersPerTeam);
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

function initializeFromPlayers(players: Player[]) {
  if (initialized) return;

  const newLineup = createLineup(playersPerTeam);

  const goalkeepers = players.filter((p) =>
    ["POR", "GK", "PORTERO"].includes(
      p.posicion.toUpperCase()
    )
  );

  const defenders = players.filter((p) =>
    ["DFC", "LD", "LI", "DEF"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const midfielders = players.filter((p) =>
    ["MCD", "MC", "MCO", "MI", "MD", "MED"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const forwards = players.filter((p) =>
    ["DC", "EI", "ED", "SD", "EXT", "DEL"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const remaining = players.filter(
    (p) =>
      !goalkeepers.includes(p) &&
      !defenders.includes(p) &&
      !midfielders.includes(p) &&
      !forwards.includes(p)
  );

  const assignGroup = (
    ids: string[],
    list: Player[]
  ) => {
    list.forEach((player, index) => {
      const slot = ids[index % ids.length];

      newLineup
        .find((s) => s.positionId === slot)
        ?.playerIds.push(player.id);
    });
  };

  assignGroup(
    newLineup
      .filter((s) => s.positionId.includes("_GK"))
      .map((s) => s.positionId),
    goalkeepers
  );

  assignGroup(
    newLineup
      .filter((s) => s.positionId.includes("_DEF"))
      .map((s) => s.positionId),
    defenders
  );

  assignGroup(
    newLineup
      .filter((s) => s.positionId.includes("_MID"))
      .map((s) => s.positionId),
    midfielders
  );

  assignGroup(
    newLineup
      .filter((s) => s.positionId.includes("_ATT"))
      .map((s) => s.positionId),
    forwards
  );

  if (remaining.length) {
    const ids = newLineup.map((s) => s.positionId);

    remaining.forEach((player, index) => {
      const slot = ids[index % ids.length];

      newLineup
        .find((s) => s.positionId === slot)
        ?.playerIds.push(player.id);
    });
  }

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
      playerIds: (slot.playerIds ?? []).filter(
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
        playerIds: (slot.playerIds ?? []).filter(
  (id) => id !== playerId
),
      }))
    );

  }

  //--------------------------------------------------
  // Limpiar sesión
  //--------------------------------------------------

  function clearLineup() {

    setLineup(createLineup(playersPerTeam));

    setLoadedLineupId(null);
    setLoadedLineupName(null);
    setInitialized(false);
    setSelectedPlayer(null);

  }

  //--------------------------------------------------
  // Cargar sesión guardada
  //--------------------------------------------------

function loadLineup(
  id: number,
  newPlayersPerTeam: 5 | 6 | 7 | 8 | 9 | 10 | 11,
  newLineup: MicroLineupSlot[],
  name: string
) {
  const normalized = newLineup.map((slot) => ({
    positionId: slot.positionId,
    playerIds: slot.playerIds ?? [],
  }));

  setLoadedLineupId(id);
  setLoadedLineupName(name);
  setInitialized(true);

  setPlayersPerTeam(newPlayersPerTeam);
  setLineup(normalized);
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

    playersPerTeam,
    changePlayersPerTeam,

    loadedLineupId,
    setLoadedLineupId,

    loadedLineupName,
    setLoadedLineupName,

    selectedPlayer,
    setSelectedPlayer,

    assignPlayer,
    removePlayer,
    clearLineup,
    loadLineup,
    initializeFromPlayers,
    getPlayerPosition,
  }),
  [
    lineup,
    playersPerTeam,
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