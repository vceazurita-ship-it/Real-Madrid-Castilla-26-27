"use client"

import Image from "next/image"
import StatusBadge from "./StatusBadge"

export type PlayerTokenProps = {
  nombre: string
  foto: string
  dorsal?: number
  estado: string
}

export default function PlayerToken({
  nombre,
  foto,
  dorsal,
  estado,
}: PlayerTokenProps) {

  return (

    <div
      className="
      absolute
      flex
      flex-col
      items-center
      cursor-pointer
      select-none
      transition
      hover:scale-105
      "
    >

      <div className="relative">

        <Image
          src={foto || "/jugador.png"}
          alt={nombre}
          width={56}
          height={56}
          className="
          rounded-full
          border-2
          border-white
          object-cover
          shadow-xl
          "
        />

        {dorsal && (
          <div
            className="
            absolute
            -bottom-1
            -right-1
            flex
            h-6
            w-6
            items-center
            justify-center
            rounded-full
            bg-black
            text-xs
            font-bold
            text-white
            "
          >
            {dorsal}
          </div>
        )}

      </div>

      <div className="mt-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
        {nombre}
      </div>

      <div className="mt-1">
        <StatusBadge estado={estado} />
      </div>

    </div>

  )

}