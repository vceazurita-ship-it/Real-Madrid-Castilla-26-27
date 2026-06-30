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
}

function StatCard({
  icon,
  label,
  value,
  color,
}: StatCardProps) {
  return (
    <div
      className="
  flex
  items-center
  gap-2

  rounded-xl
  lg:rounded-2xl

  border
  border-[#C8A96B]/15

  bg-[#121820]

  px-2
  py-2

  lg:px-4
  lg:py-3

  shadow-lg

  transition-all
  duration-300

  hover:border-[#C8A96B]/40
  lg:hover:-translate-y-0.5
"
    >
      <div
        className={`
          flex
          h-8
w-8

lg:h-10
lg:w-10

rounded-lg
lg:rounded-xl
          ${color}
        `}
      >
        {icon}
      </div>

      <div className="leading-tight flex flex-col justify-center">

        <div className="text-[9px]
lg:text-[11px] uppercase tracking-[0.18em] text-white/55">
          {label}
        </div>

        <div className="text-lg
lg:text-2xl font-bold text-white">
          {value}
        </div>

      </div>
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
    grid-cols-3
    gap-2

    lg:grid-cols-5
    lg:gap-3
  "
    >

      <StatCard
        icon={<Shield className="h-4 w-4 lg:h-5 lg:w-5 text-white" />}
        label="Disponibles"
        value={disponibles}
        color="bg-emerald-600"
      />

      <StatCard
        icon={<HeartPulse size={20} className="text-white" />}
        label="Lesionados"
        value={lesionados}
        color="bg-red-600"
      />

      <StatCard
        icon={<Trophy size={20} className="text-[#1A1A1A]" />}
        label="1º Equipo"
        value={primerEquipo}
        color="bg-[#C8A96B]"
      />

      <StatCard
        icon={<Flag size={20} className="text-white" />}
        label="Selección"
        value={seleccion}
        color="bg-blue-600"
      />

      <StatCard
        icon={<Users size={20} className="text-[#1A1A1A]" />}
        label="No Castilla"
        value={`${noCastilla}/4`}
        color={
          noCastilla > 4
            ? "bg-red-500"
            : "bg-[#C8A96B]"
        }
      />

    </div>

  );
}