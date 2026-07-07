"use client";

import {
  Shield,
  HeartPulse,
  Trophy,
  Flag,
  Users,
} from "lucide-react";

import { useTrainingPlayers } from "@/hooks/useTrainingPlayers";

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
    </div>
  );
}

export default function TopStats() {
const { players, plantillaActiva } = useTrainingPlayers();
console.log(
  [...new Set(players.map((p) => p.estado))]
);
 const optimos = players.filter(
  (p) => p.estado === "ÓPTIMO"
).length;

const controlCarga = players.filter(
  (p) => p.estado === "CONTROL DE CARGA"
).length;

const reincorporacion = players.filter(
  (p) => p.estado === "REINCORPORACIÓN"
).length;

const tocados = players.filter(
  (p) => p.estado === "TOCADO"
).length;

const NOavailableStates = new Set([
  "LESIONADO",
  "PROMOCIÓN",
  "PRIMER EQUIPO",
  "1º EQUIPO",
  "OTROS",
  "SELECCIÓN",
]);

const noDisponibles = plantillaActiva.filter((p) =>
  NOavailableStates.has((p.estado ?? "").trim())
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
        label="Óptimos"
        value={optimos}
        color="bg-emerald-600"
      />

      <StatCard
        icon={
          <HeartPulse className="h-6 w-6 text-white" />
        }
        label="Control de Carga"
        value={controlCarga}
        color="bg-[#C8A96B]"
      />

      <StatCard
        icon={
          <Trophy className="h-6 w-6 text-[#111]" />
        }
        label="Reincorporación"
        value={reincorporacion}
        color="bg-blue-600"
      />

      <StatCard
        icon={
          <Flag className="h-6 w-6 text-white" />
        }
        label="Tocado"
        value={tocados}
        color="bg-red-600"
      />

      <StatCard
        icon={
          <Users className="h-6 w-6 text-white" />
        }
        label="No disponibles"
        value={noDisponibles}
        color="bg-slate-600"
      />
    </div>
  );
}