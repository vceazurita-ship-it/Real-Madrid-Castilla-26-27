"use client";

import { useDroppable } from "@dnd-kit/core";

interface Props {
  id: string;
  children?: React.ReactNode;
}

export default function MicroSlot({
  id,
  children,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className="
        flex
        items-center
        justify-center
        transition-all
        duration-200
      "
    >
      {children ? (
        children
      ) : (
        <div
          className={`
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-full
            border-2
            border-dashed
            backdrop-blur-sm
            transition-all
            duration-200

            ${
              isOver
                ? "border-[#C8A96B] bg-[#C8A96B]/25 scale-110"
                : "border-[#C8A96B]/60 bg-black/35"
            }
          `}
        >
          <span className="text-2xl text-[#C8A96B]">
            +
          </span>
        </div>
      )}
    </div>
  );
}