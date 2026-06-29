"use client";

import Image from "next/image";
import {
  forwardRef,
  useEffect,
  useState,
} from "react";

import { usePlayers } from "@/hooks/usePlayers";
import { useMicroLineup } from "@/context/MicroLineupContext";
import { microFormation } from "@/lib/microFormation";

import MicroSlot from "./MicroSlot";
import MicroFieldPlayer from "@/components/Microciclo/MicroFieldPlayer";

const MicroPitch = forwardRef<
  HTMLDivElement,
  Record<string, never>
>(function MicroPitch(_, ref) {
  const { players } = usePlayers();
  const { lineup } = useMicroLineup();

  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const resize = () => {
      setMobile(window.innerWidth < 1024);
    };

    resize();

    window.addEventListener("resize", resize);

    return () =>
      window.removeEventListener("resize", resize);
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
      "
    >
      {/* Fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/emotional-field-bg.png"
          alt="Campo"
          fill
          priority
          unoptimized
          draggable={false}
          className={`
            object-cover
            pointer-events-none
            select-none
            transition-all
            duration-500
            ${
              mobile
                ? "rotate-90 scale-[1.78]"
                : "rotate-0 scale-100"
            }
          `}
        />
      </div>

      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.45))]" />

      {/* Slots */}
      {microFormation.map((position) => {
        const slot = lineup.find(
          (s) => s.positionId === position.id
        );

        const player = players.find(
          (p) => p.id === slot?.playerId
        );

        return (
          <div
            key={position.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: mobile
                ? position.top
                : position.left,
              top: mobile
                ? `${100 - parseFloat(position.left)}%`
                : position.top,
            }}
          >
            <MicroSlot id={position.id}>
              {player ? (
                <MicroFieldPlayer
                  id={player.id}
                  positionId={position.id}
                  foto={player.foto}
                  nombre={player.nombre}
                  licencia={player.licencia}
                  estado={player.estado}
                  mobile={mobile}
                />
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
            </MicroSlot>
          </div>
        );
      })}
    </div>
  );
});

MicroPitch.displayName = "MicroPitch";

export default MicroPitch;