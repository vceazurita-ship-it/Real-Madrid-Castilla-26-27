"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";

import { LineupSlot } from "@/types/player";
import { formations } from "@/lib/formations";

const STORAGE_KEY = "rmcf-castilla-lineup";

interface LineupContextType {
  lineup: LineupSlot[];

  formation: string;

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
  const [formation, setFormation] = useState(() => {
  if (typeof window === "undefined")
    return "4-4-2";

  try {
    function loadLineup(
  newFormation: string,
  newLineup: LineupSlot[]
) {
  setFormation(newFormation);
  setLineup(newLineup);
}
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
      const previousPlayers =
        new Map(
          current.map((slot) => [
            slot.positionId,
            slot.playerId,
          ])
        );

      return createLineup(
        formation
      ).map((slot) => ({
        ...slot,
        playerId:
          previousPlayers.get(
            slot.positionId
          ) ?? null,
      }));
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

  function assignPlayer(
    positionId: string,
    playerId: string
  ) {
    setLineup((current) => {
      const origin = current.find(
        (slot) =>
          slot.playerId === playerId
      );

      const destination = current.find(
        (slot) =>
          slot.positionId ===
          positionId
      );

      const destinationPlayer =
        destination?.playerId ?? null;

      return current.map((slot) => {
        if (
          slot.positionId === positionId
        ) {
          return {
            ...slot,
            playerId,
          };
        }

        if (
          origin &&
          slot.positionId ===
            origin.positionId
        ) {
          return {
            ...slot,
            playerId:
              destinationPlayer,
          };
        }

        return slot;
      });
    });
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
    setFormation,
    assignPlayer,
    removePlayer,
    clearLineup,
    loadLineup,
    getPlayerPosition,
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
  const context =
    useContext(LineupContext);

  if (!context) {
    throw new Error(
      "useLineup debe utilizarse dentro de LineupProvider"
    );
  }

  return context;
}