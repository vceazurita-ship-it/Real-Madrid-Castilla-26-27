"use client";

import {
  Shield,
  HeartPulse,
  Trophy,
  Flag,
  Users,
} from "lucide-react";

import { usePlayers } from "@/hooks/usePlayers";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  danger?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  color,
  danger = false,
}: StatCardProps) {
  return (
    <div
      className={`
        flex
        min-w-[125px]
        sm:min-w-[140px]
        lg:min-w-0

        snap-start

        flex-col
        items-center
        justify-center
        text-center

        rounded-3xl
        border

        ${
          danger
            ? "border-red-500/60 bg-gradient-to-b from-red-500/15 to-red-900/20"
            : "border-[#C8A96B]/15 bg-gradient-to-b from-[#18212B] to-[#111820]"
        }

        px-3
        py-4

        lg:px-4
        lg:py-5

        shadow-lg
        ring-1
        ring-white/5

        transition-all
        duration-300

        hover:shadow-[0_0_30px_rgba(200,169,107,.18)]

        lg:hover:-translate-y-1
        lg:hover:border-[#C8A96B]/45
      `}
    >
      <div
        className={`
          flex
          items-center
          justify-center

          h-12
          w-12

          lg:h-14
          lg:w-14

          rounded-xl
          border
          border-white/10

          shadow-lg

          ${color}
        `}
      >
        {icon}
      </div>

      <div
        className="
          mt-3
          text-[30px]
          lg:text-[36px]
          font-black
          leading-none
          text-white
        "
      >
        {value}
      </div>

      <div
        className="
          mt-1.5

          text-[10px]
          lg:text-[11px]

          uppercase
          tracking-[0.08em]
          leading-tight

          text-white/65
        "
      >
        {label}
      </div>

      {label === "No Castilla" && (
        <div
          className={`
            mt-1
            text-[9px]
            uppercase
            tracking-widest
            ${
              danger
                ? "font-semibold text-red-300"
                : "text-white/35"
            }
          `}
        >
          Máx. 4
        </div>
      )}
    </div>
  );
}

export default function TopStats() {
  const { players } = usePlayers();

  const disponibles = players.filter(
    (p) => p.estado === "DISPONIBLE"
  ).length;

  const lesionados = players.filter(
    (p) => p.estado === "LESIONADO"
  ).length;

  const seleccion = players.filter(
    (p) => p.estado === "SELECCIÓN"
  ).length;

  const primerEquipo = players.filter(
    (p) => p.estado === "PRIMER EQUIPO"
  ).length;

  const noCastilla = players.filter(
    (p) => p.licencia !== "RMCF Castilla"
  ).length;

  return (
    <div
      className="
        flex
        gap-3

        overflow-x-auto
        scroll-smooth

        pb-2

        snap-x
        snap-mandatory

        scrollbar-none

        lg:grid
        lg:grid-cols-5
        lg:gap-4
        lg:overflow-visible
      "
    >
      <StatCard
        icon={
          <Shield className="h-6 w-6 text-white" />
        }
        label="Disponibles"
        value={disponibles}
        color="bg-emerald-600"
      />

      <StatCard
        icon={
          <HeartPulse className="h-6 w-6 text-white" />
        }
        label="Lesionados"
        value={lesionados}
        color="bg-red-600"
      />

      <StatCard
        icon={
          <Trophy className="h-6 w-6 text-[#111]" />
        }
        label="1º Equipo"
        value={primerEquipo}
        color="bg-[#C8A96B]"
      />

      <StatCard
        icon={
          <Flag className="h-6 w-6 text-white" />
        }
        label="Selección"
        value={seleccion}
        color="bg-blue-600"
      />

      <StatCard
        icon={
          <Users className="h-6 w-6 text-[#111]" />
        }
        label="No Castilla"
        value={`${noCastilla}/4`}
        color={
          noCastilla > 4
            ? "bg-red-600"
            : "bg-[#C8A96B]"
        }
        danger={noCastilla > 4}
      />
    </div>
  );
}