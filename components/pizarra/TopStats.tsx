"use client";

import { usePlayers } from "@/hooks/usePlayers";

interface CardProps {
  title: string;
  value: number | string;
  color: string;
}

function Card({ title, value, color }: CardProps) {
  return (
    <div
      className={`
        ${color}
        min-w-[140px]
        rounded-xl
        px-4
        py-3
        shadow-md
      `}
    >
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">
        {title}
      </div>

      <div className="mt-1 text-3xl font-bold">
        {value}
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
    <div className="flex gap-4 overflow-x-auto border-b border-white/10 bg-zinc-950 p-4 text-white">

      <Card
        title="Disponibles"
        value={disponibles}
        color="bg-green-700"
      />

      <Card
        title="Lesionados"
        value={lesionados}
        color="bg-red-700"
      />

      <Card
        title="Primer Equipo"
        value={primerEquipo}
        color="bg-yellow-400 text-black"
      />

      <Card
        title="Selección"
        value={seleccion}
        color="bg-blue-700"
      />

      <Card
        title="No Castilla"
        value={`${noCastilla}/4`}
        color={
          noCastilla > 4
            ? "bg-red-700"
            : "bg-emerald-700"
        }
      />

    </div>
  );
}