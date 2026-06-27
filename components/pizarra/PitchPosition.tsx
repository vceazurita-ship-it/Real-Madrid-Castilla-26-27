"use client";

import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

interface PitchPositionProps {
  id: string;
  left: string;
  top: string;
  children?: ReactNode;
}

export default function PitchPosition({
  id,
  left,
  top,
  children,
}: PitchPositionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left,
        top,
      }}
    >
      <div
        className={`
          flex
          h-20
          w-20
          items-center
          justify-center
          rounded-full
          border-2
          transition-all
          duration-200
          ${
            isOver
              ? "border-yellow-400 bg-yellow-400/20 scale-110"
              : "border-white/40 bg-white/5"
          }
        `}
      >
        {children}
      </div>
    </div>
  );
}