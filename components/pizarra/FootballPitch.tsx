"use client"

import PlayerToken from "./PlayerToken"

const formation442 = [

  {
    nombre: "Portero",
    left: "50%",
    top: "92%",
  },

  {
    nombre: "LI",
    left: "15%",
    top: "72%",
  },

  {
    nombre: "DFC",
    left: "38%",
    top: "74%",
  },

  {
    nombre: "DFC",
    left: "62%",
    top: "74%",
  },

  {
    nombre: "LD",
    left: "85%",
    top: "72%",
  },

  {
    nombre: "MI",
    left: "15%",
    top: "47%",
  },

  {
    nombre: "MC",
    left: "40%",
    top: "50%",
  },

  {
    nombre: "MC",
    left: "60%",
    top: "50%",
  },

  {
    nombre: "MD",
    left: "85%",
    top: "47%",
  },

  {
    nombre: "DC",
    left: "38%",
    top: "18%",
  },

  {
    nombre: "DC",
    left: "62%",
    top: "18%",
  },

]

export default function FootballPitch() {

  return (

    <div className="relative h-full w-full overflow-hidden bg-[#166534]">

      <div className="absolute inset-0">

        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >

          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
            stroke="white"
            strokeWidth="0.4"
          />

          <circle
            cx="50"
            cy="50"
            r="8"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

          <circle
            cx="50"
            cy="50"
            r="0.8"
            fill="white"
          />

          <rect
            x="20"
            y="2"
            width="60"
            height="15"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

          <rect
            x="35"
            y="2"
            width="30"
            height="6"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

          <rect
            x="20"
            y="83"
            width="60"
            height="15"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

          <rect
            x="35"
            y="92"
            width="30"
            height="6"
            fill="none"
            stroke="white"
            strokeWidth="0.4"
          />

        </svg>

      </div>

      {formation442.map((player) => (

        <div
          key={player.nombre}
          className="-translate-x-1/2 -translate-y-1/2 absolute"
          style={{
            left: player.left,
            top: player.top,
          }}
        >

          <PlayerToken
            nombre={player.nombre}
            foto="/jugador.png"
            estado="DISPONIBLE"
          />

        </div>

      ))}

    </div>

  )

}