"use client";

import PlayerToken from "./PlayerToken";

const formation442 = [
  {
    id: "POR",
    nombre: "Portero",
    left: "50%",
    top: "92%",
  },
  {
    id: "LI",
    nombre: "LI",
    left: "15%",
    top: "72%",
  },
  {
    id: "DFC1",
    nombre: "DFC",
    left: "38%",
    top: "74%",
  },
  {
    id: "DFC2",
    nombre: "DFC",
    left: "62%",
    top: "74%",
  },
  {
    id: "LD",
    nombre: "LD",
    left: "85%",
    top: "72%",
  },
  {
    id: "MI",
    nombre: "MI",
    left: "15%",
    top: "47%",
  },
  {
    id: "MC1",
    nombre: "MC",
    left: "40%",
    top: "50%",
  },
  {
    id: "MC2",
    nombre: "MC",
    left: "60%",
    top: "50%",
  },
  {
    id: "MD",
    nombre: "MD",
    left: "85%",
    top: "47%",
  },
  {
    id: "DC1",
    nombre: "DC",
    left: "38%",
    top: "18%",
  },
  {
    id: "DC2",
    nombre: "DC",
    left: "62%",
    top: "18%",
  },
];

export default function FootballPitch() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#166534]">
      {/* CAMPO */}
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

          {/* Área superior */}
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

          {/* Área inferior */}
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

      {/* POSICIONES */}
      {formation442.map((position) => (
        <div
          key={position.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: position.left,
            top: position.top,
          }}
        >
          <div
  className="
    flex
    h-16
    w-16
    items-center
    justify-center
    rounded-full
    border-2
    border-white/30
    bg-white/10
    text-xs
    font-bold
    text-white
  "
>
  {position.nombre}
</div>
        </div>
      ))}
    </div>
  );
}