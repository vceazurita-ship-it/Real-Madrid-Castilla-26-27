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
 
  // Estados que SÍ pueden aparecer en el campo
  const availablePlayers = players.filter((player) =>
    [
      "ÓPTIMO",
      "CONTROL DE CARGA",
      "TOCADO",
      "REINCORPORACIÓN",
      "SANCIONADO",
    ].includes(player.estado)
  );

  const newLineup = createLineup(playersPerTeam);

  const goalkeepers = availablePlayers.filter((p) =>
    ["POR", "GK", "PORTERO"].includes(
      p.posicion.toUpperCase()
    )
  );

  const defenders = availablePlayers.filter((p) =>
    ["DFC", "LD", "LI", "DEF"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const midfielders = availablePlayers.filter((p) =>
    ["MCD", "MC", "MCO", "MI", "MD", "MED"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const forwards = availablePlayers.filter((p) =>
    ["DC", "SD", "EI", "ED", "DEL", "EXT"].some((x) =>
      p.posicion.toUpperCase().includes(x)
    )
  );

  const remaining = availablePlayers.filter(
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
    if (!ids.length) return;

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
  setLoadedLineupId(null);
  setLoadedLineupName(null);
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