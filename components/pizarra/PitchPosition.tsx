"use client";

import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useLineup } from "@/context/LineupContext";

interface Props {
  id: string;
  children: ReactNode;
}

export default function PitchPosition({
  id,
  children,
}: Props) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id,
  });

  const {
    selectedPlayer,
    assignPlayer,
    setSelectedPlayer,
  } = useLineup();

  const handleClick = () => {
    /* Sin `console.log` de depuración (19/10/2026): cada clic en el campo
       escribía «CLICK» y el jugador entero en la consola. */
    if (!selectedPlayer) return;

    assignPlayer(id, selectedPlayer);

    setSelectedPlayer(null);
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`
        transition-all
        duration-200
        cursor-pointer

        ${
          selectedPlayer
            ? `
              ring-2
              ring-[#C8A96B]/40
              rounded-full
            `
            : ""
        }

        ${
          isOver
            ? `
              scale-110
              drop-shadow-[0_0_20px_rgba(250,204,21,.8)]
            `
            : ""
        }
      `}
    >
      {children}
    </div>
  );
}