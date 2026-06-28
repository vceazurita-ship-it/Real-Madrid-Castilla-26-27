"use client";

import { useDroppable } from "@dnd-kit/core";

interface Props {
  id: string;
  children: React.ReactNode;
}

export default function PitchPosition({
  id,
  children,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute
        -translate-x-1/2
        -translate-y-1/2
        transition-all
        duration-200
        ${
          isOver
            ? "scale-110 drop-shadow-[0_0_20px_rgba(250,204,21,.8)]"
            : ""
        }
      `}
    >
      {children}
    </div>
  );
}