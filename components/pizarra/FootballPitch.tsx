"use client";


import Image from "next/image";
import {
  forwardRef,
  useEffect,
  useState,
} from "react";
import { usePlayers } from "@/hooks/usePlayers";
import { useLineup } from "@/context/LineupContext";
import PitchPosition from "./PitchPosition";
import { formations } from "@/lib/formations";

const FootballPitch = forwardRef<
  HTMLDivElement,
  Record<string, never>
>(function FootballPitch(_, ref) {
  const { players } = usePlayers();

  const { lineup, formation } = useLineup();

  const currentFormation =
    formations[
      formation as keyof typeof formations
    ] ?? [];
const [mobile, setMobile] = useState(false);

useEffect(() => {
  const resize = () => {
    setMobile(window.innerWidth < 1024);
  };

  resize();

  window.addEventListener("resize", resize);

  return () => window.removeEventListener("resize", resize);
}, []);
  return (
    <div
  id="football-pitch"
  ref={ref}
      className="
        relative
        h-full
        w-full
        overflow-hidden
        rounded-[28px]
        border
        border-[#C8A96B]/20
        shadow-[0_25px_80px_rgba(0,0,0,.45)]
        bg-cover
        bg-center
        bg-no-repeat
      "
    >
      <Image
  src="/emotional-field-bg.png"
  alt="Campo"
  fill
  priority
  unoptimized
  className={`
    absolute
    inset-0
    object-cover
    ${
      mobile
        ? "rotate-90 scale-[1.78]"
        : ""
    }
  `}
/>
      {/* Oscurecer */}
      <div className="absolute inset-0 bg-black/35" />

      {/* Viñeta */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.45))]" />

      {/* Campo */}
      

      {/* Jugadores */}
      {currentFormation.map((position) => {
        const slot = lineup.find(
          (s) =>
            s.positionId === position.id
        );

        const player = players.find(
          (p) =>
            p.id === slot?.playerId
        );

        return (
          <div
            key={position.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
  left: mobile ? position.top : position.left,
  top: mobile
    ? `${100 - parseFloat(position.left)}%`
    : position.top,
}}
          >
            <PitchPosition id={position.id}>
              {player ? (
                <div className="flex flex-col items-center">

                  <Image
                    src={player.foto}
                    alt={player.nombre}
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
                      transition
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
  ${mobile ? "text-[9px]" : "text-[11px]"}
  font-semibold
  text-white
  whitespace-nowrap
`}                  >
                    {player.nombre}
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center">

                  <div
  className={`
    flex
    ${mobile ? "h-12 w-12" : "h-16 w-16"}
    items-center
    justify-center
    rounded-full
    border-2
    border-dashed
    border-[#C8A96B]
    bg-black/45
    backdrop-blur-sm
    shadow-[0_0_18px_rgba(200,169,107,.25)]
    transition
    duration-300
    hover:scale-110
  `}
>
                    <span className="text-lg text-[#C8A96B]">
                      +
                    </span>
                  </div>

                  <div
                    className="
                      mt-2
                      rounded-full
                      bg-black/60
                      px-3
                      py-1
                      text-[10px]
                      font-semibold
                      tracking-wide
                      text-white/90
                    "
                  >
                    {position.nombre}
                  </div>

                </div>
              )}
            </PitchPosition>
          </div>
        );
      })}
    </div>
  );
});

FootballPitch.displayName =
  "FootballPitch";

export default FootballPitch;