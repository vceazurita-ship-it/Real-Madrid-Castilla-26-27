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
import { formations } from "@/lib/formations";
import { usePlayers } from "@/hooks/usePlayers";
import { toast } from "sonner";
import { remapFormation } from "@/lib/formationMapper";
const STORAGE_KEY = "rmcf-castilla-lineup";

interface LineupContextType {

  lineup: LineupSlot[];

  formation: string;

  selectedPlayer: Player | null;

  setSelectedPlayer: (
  player: Player | null
) => void;

  setFormation: (formation: string) => void;

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

function createLineup(
  formation: string
): LineupSlot[] {
  const positions =
    formations[
      formation as keyof typeof formations
    ] ?? [];

  return positions.map((position) => ({
    positionId: position.id,
    playerId: null,
  }));
}

const LineupContext =
  createContext<LineupContextType | null>(
    null
  );

export function LineupProvider({
  
  children,
}: {
  children: ReactNode;
}) {
  const [selectedPlayer, _setSelectedPlayer] =
  useState<Player | null>(null);
const { players } = usePlayers();
const setSelectedPlayer = (player: Player | null) => {
  console.log("SET SELECTED:", player);
  _setSelectedPlayer(player);
};
  const [formation, setFormation] = useState(() => {
  if (typeof window === "undefined")
    return "4-4-2";

  try {
    
    const saved = localStorage.getItem(
      STORAGE_KEY
    );

    if (!saved) return "4-4-2";

    return (
      JSON.parse(saved).formation ??
      "4-4-2"
    );
  } catch {
    return "4-4-2";
  }
});

const [lineup, setLineup] =
  useState<LineupSlot[]>(() => {
    if (typeof window === "undefined")
      return createLineup("4-4-2");

    try {
      const saved = localStorage.getItem(
        STORAGE_KEY
      );

      if (!saved)
        return createLineup("4-4-2");

      return (
        JSON.parse(saved).lineup ??
        createLineup("4-4-2")
      );
    } catch {
      return createLineup("4-4-2");
    }
  });

  

  /* =======================================
     CAMBIO DE FORMACIÓN
  ======================================= */

 useEffect(() => {
  setLineup((current) => {
    const newLineup = createLineup(formation);

    return remapFormation(
      current,
      newLineup
    );
  });
}, [formation]);

  /* =======================================
     GUARDADO AUTOMÁTICO
  ======================================= */

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        formation,
        lineup,
      })
    );
  }, [formation, lineup]);

  /* =======================================
     MOVER / INTERCAMBIAR JUGADORES
  ======================================= */
  function countNoCastilla(lineup: LineupSlot[]) {
  return lineup.filter((slot) => {
    if (!slot.playerId) return false;

    const player = players.find(
      (p) => p.id === slot.playerId
    );

    return player && !player.esCastilla;
  }).length;
}
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
    // ===========================
// LÍMITE DE 4 NO CASTILLA
// ===========================

if (!player.esCastilla) {

  let totalNoCastilla =
    countNoCastilla(current);

  // Si viene del banquillo aumenta uno
  if (!origin) {
    totalNoCastilla++;
  }

  // Si sustituye a otro no Castilla,
  // realmente el total no aumenta.
  if (
    destinationPlayer &&
    !destinationPlayer.esCastilla
  ) {
    totalNoCastilla--;
  }

  if (totalNoCastilla > 4) {

   toast.error(
  `No puedes añadir a ${player.nombre}`,
  {
    description:
      "Ya hay cuatro jugadores sin licencia RMCF Castilla en la alineación."
  }
);

return current;
  }
}

    // El jugador viene del banquillo
    if (!origin) {
      return current.map(slot => {

        if (slot.positionId === positionId) {
          return {
            ...slot,
            playerId,
          };
        }

        // Si ese jugador ya estaba colocado
        if (slot.playerId === playerId) {
          return {
            ...slot,
            playerId: null,
          };
        }

        return slot;
      });
    }

    return current.map(slot => {

      // Posición destino
      if (slot.positionId === positionId) {
        return {
          ...slot,
          playerId,
        };
      }

      // Posición origen
      if (slot.positionId === origin.positionId) {
  return {
    ...slot,
    playerId: destinationPlayer?.id ?? null,
  };
}

      return slot;
    });
  });

  setSelectedPlayer(null);
}

  /* =======================================
     ELIMINAR JUGADOR
  ======================================= */

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

  /* =======================================
     LIMPIAR PIZARRA
  ======================================= */

  function clearLineup() {
    setLineup(
      createLineup(formation)
    );
  }


function loadLineup(
  newFormation: string,
  newLineup: LineupSlot[]
) {
  setFormation(newFormation);

  setTimeout(() => {
    setLineup(newLineup);
  }, 0);
}

  /* =======================================
     BUSCAR POSICIÓN
  ======================================= */

  function getPlayerPosition(
    positionId: string
  ) {
    return lineup.find(
      (slot) =>
        slot.positionId ===
        positionId
    );
  }

const value = useMemo(
  () => ({
    lineup,
    formation,

    selectedPlayer,
    setSelectedPlayer,

    setFormation,
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
    <LineupContext.Provider value={value}>
      {children}
    </LineupContext.Provider>
  );
}

export function useLineup() {
  const context =
    useContext(LineupContext);

  if (!context) {
    throw new Error(
      "useLineup debe utilizarse dentro de LineupProvider"
    );
  }

  return context;
}