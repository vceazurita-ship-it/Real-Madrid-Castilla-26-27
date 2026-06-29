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
        gap-3
        rounded-2xl
        border
        border-[#C8A96B]/15
        bg-[#121820]
        px-4
        py-3
        shadow-lg
        transition-all
        duration-300
        hover:border-[#C8A96B]/40
        hover:-translate-y-0.5
      "
    >
      <div
        className={`
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-xl
          ${color}
        `}
      >
        {icon}
      </div>

      <div className="leading-tight">

        <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">
          {label}
        </div>

        <div className="text-2xl font-bold text-white">
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
        grid-cols-2
        gap-3
        lg:grid-cols-5
      "
    >

      <StatCard
        icon={<Shield size={20} className="text-white" />}
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
        label="Primer Equipo"
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