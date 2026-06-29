"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  id: string;
  foto: string;
  nombre: string;
  mobile: boolean;
}

export default function FieldPlayer({
  id,
  foto,
  nombre,
  mobile,
}: Props) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="touch-none select-none cursor-grab active:cursor-grabbing"
    >
      <div className="flex flex-col items-center">

        <Image
          src={foto}
          alt={nombre}
          width={mobile ? 48 : 66}
          height={mobile ? 48 : 66}
          unoptimized
          draggable={false}
          className="
            rounded-full
            border-[3px]
            border-[#C8A96B]
            object-cover
            shadow-[0_0_22px_rgba(200,169,107,.45)]
            transition-all
            duration-300
            hover:scale-110
          "
        />

        <div
          className={`
            mt-2
            rounded-full
            border
            border-[#C8A96B]/40
            bg-black/70
            backdrop-blur-md
            px-3
            py-1
            font-semibold
            text-white
            whitespace-nowrap
            ${mobile ? "text-[9px]" : "text-[11px]"}
          `}
        >
          {nombre}
        </div>

      </div>
    </div>
  );
}