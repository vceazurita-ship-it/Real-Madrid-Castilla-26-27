"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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

  setLineup((current) => {
    const layout = layouts[value];

    const newLineup: MicroLineupSlot[] = [
      ...layout.blue,
      ...layout.red,
    ].map((position) => ({
      positionId: position.id,
      playerIds: [],
    }));

    const getCategory = (id: string) => {
      if (id.includes("_GK")) return "GK";
      if (id.includes("_DEF")) return "DEF";
      if (id.includes("_MID")) return "MID";
      if (id.includes("_ATT")) return "ATT";
      return "";
    };

    const getTeam = (id: string) =>
      id.startsWith("B_") ? "B_" : "R_";

    // 1. Mantener los jugadores cuya posición sigue existiendo
    const orphanPlayers: {
      playerIds: string[];
      team: string;
      category: string;
    }[] = [];

    current.forEach((slot) => {
      const target = newLineup.find(
        (s) => s.positionId === slot.positionId
      );

      if (target) {
        target.playerIds.push(...slot.playerIds);
      } else if (slot.playerIds.length) {
        orphanPlayers.push({
          playerIds: slot.playerIds,
          team: getTeam(slot.positionId),
          category: getCategory(slot.positionId),
        });
      }
    });

    // 2. Reubicar los jugadores de posiciones eliminadas
    orphanPlayers.forEach((group) => {
      group.playerIds.forEach((playerId) => {
        let candidates = newLineup.filter(
          (slot) =>
            getTeam(slot.positionId) === group.team &&
            getCategory(slot.positionId) === group.category
        );

        if (!candidates.length) {
          candidates = newLineup.filter(
            (slot) =>
              getTeam(slot.positionId) === group.team
          );
        }

        if (!candidates.length) {
          candidates = newLineup;
        }

        const target = candidates.reduce((a, b) =>
          a.playerIds.length <= b.playerIds.length ? a : b
        );

        target.playerIds.push(playerId);
      });
    });

    return newLineup;
  });

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
function getPlayerCategory(position: string) {
  const pos = position.toUpperCase().trim();

  // ---------- PORTERO ----------
  if (
    pos === "PORTERO" ||
    pos === "POR" ||
    pos === "GK"
  ) {
    return "GK";
  }

  // ---------- DEFENSAS ----------
  if (
    pos === "CENTRAL" ||
    pos.startsWith("LATERAL") ||
    pos === "DFC" ||
    pos === "LD" ||
    pos === "LI" ||
    pos === "DEF"
  ) {
    return "DEF";
  }

  // ---------- MEDIOS ----------
  if (
    [
      "6",
      "8",
      "MC",
      "MCD",
      "MCO",
      "MI",
      "MD",
      "MED"
    ].includes(pos)
  ) {
    return "MID";
  }

  // ---------- ATAQUE ----------
  if (
    [
      "7",
      "9",
      "10",
      "11",
      "DC",
      "SD",
      "EI",
      "ED",
      "DEL",
      "EXT"
    ].includes(pos)
  ) {
    return "ATT";
  }

  return "OTHER";
}
const initializeFromPlayers = useCallback(
  (players: Player[]) => {
  console.log("ENTRA initializeFromPlayers");
  console.log(players);
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

  const goalkeepers = availablePlayers.filter(
  (p) => getPlayerCategory(p.posicion) === "GK"
);

const defenders = availablePlayers.filter(
  (p) => getPlayerCategory(p.posicion) === "DEF"
);

const midfielders = availablePlayers.filter(
  (p) => getPlayerCategory(p.posicion) === "MID"
);

const forwards = availablePlayers.filter(
  (p) => getPlayerCategory(p.posicion) === "ATT"
);

  const remaining = availablePlayers.filter(
    (p) =>
      !goalkeepers.includes(p) &&
      !defenders.includes(p) &&
      !midfielders.includes(p) &&
      !forwards.includes(p)
  );
console.log("PORTEROS", goalkeepers.map(p => `${p.nombre} - ${p.posicion}`));
console.log("DEFENSAS", defenders.map(p => `${p.nombre} - ${p.posicion}`));
console.log("MEDIOS", midfielders.map(p => `${p.nombre} - ${p.posicion}`));
console.log("DELANTEROS", forwards.map(p => `${p.nombre} - ${p.posicion}`));
console.log("OTROS", remaining.map(p => `${p.nombre} - ${p.posicion}`));
 function assignGroup(
  positionIds: string[],
  players: Player[]
) {
  if (positionIds.length === 0 || players.length === 0) return;

  // Referencia rápida de cada slot
  const slots = positionIds.map((id) => ({
    id,
    players: [] as string[],
  }));

  for (const player of players) {

    // Elegimos SIEMPRE el slot con menos jugadores.
    // Si hay empate mantiene el orden original (izquierda → derecha).
    let target = slots[0];

    for (let i = 1; i < slots.length; i++) {
      if (slots[i].players.length < target.players.length) {
        target = slots[i];
      }
    }

    target.players.push(player.id);
  }

  // Volcamos el resultado al lineup
  slots.forEach((slot) => {
    const lineupSlot = newLineup.find(
      (s) => s.positionId === slot.id
    );

    if (lineupSlot) {
      lineupSlot.playerIds.push(...slot.players);
    }
  });
}

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
  
},
[playersPerTeam]);
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
    initializeFromPlayers,
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