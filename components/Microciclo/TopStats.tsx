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
        flex-col
        items-center
        justify-center
        text-center

        rounded-2xl
        border

        ${
          danger
            ? "border-red-500/40 bg-red-500/10"
            : "border-[#C8A96B]/15 bg-[#121820]"
        }

        px-2
        py-4

        lg:px-3
        lg:py-5

        shadow-lg

        transition-all
        duration-300

        lg:hover:-translate-y-1
        lg:hover:border-[#C8A96B]/45
      `}
    >
      <div
        className={`
          flex
          items-center
          justify-center

          h-10
          w-10

          lg:h-12
          lg:w-12

          rounded-xl

          ${color}
        `}
      >
        {icon}
      </div>

      <div
        className="
          mt-3
          text-3xl
          lg:text-[34px]
          font-black
          leading-none
          text-white
        "
      >
        {value}
      </div>

      <div
        className="
          mt-2
          text-[10px]
          lg:text-[11px]

          uppercase
          tracking-[0.16em]

          text-white/55
        "
      >
        {label}
      </div>

      {label === "No Castilla" && (
        <div
          className="
            mt-1
            text-[9px]
            uppercase
            tracking-widest
            text-white/35
          "
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
        grid
        grid-cols-5
        gap-2

        lg:gap-4
      "
    >
      <StatCard
        icon={
          <Shield className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
        }
        label="Disponibles"
        value={disponibles}
        color="bg-emerald-600"
      />

      <StatCard
        icon={
          <HeartPulse className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
        }
        label="Lesionados"
        value={lesionados}
        color="bg-red-600"
      />

      <StatCard
        icon={
          <Trophy className="h-5 w-5 lg:h-6 lg:w-6 text-[#111]" />
        }
        label="1º Equipo"
        value={primerEquipo}
        color="bg-[#C8A96B]"
      />

      <StatCard
        icon={
          <Flag className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
        }
        label="Selección"
        value={seleccion}
        color="bg-blue-600"
      />

      <StatCard
        icon={
          <Users className="h-5 w-5 lg:h-6 lg:w-6 text-[#111]" />
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