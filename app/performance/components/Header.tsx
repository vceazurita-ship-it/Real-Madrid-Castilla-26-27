"use client";

import { CalendarRange, ImageIcon, FileText, Trophy } from "lucide-react";
import { season } from "../data";

export default function Header() {
  const totalWeeks = season.reduce(
    (acc, month) => acc + month.weeks.length,
    0
  );

  const completedWeeks = season.reduce(
    (acc, month) =>
      acc +
      month.weeks.filter(
        (week) => week.images.length > 0 || week.pdf
      ).length,
    0
  );

  const totalImages = season.reduce(
    (acc, month) =>
      acc +
      month.weeks.reduce(
        (sum, week) => sum + week.images.length,
        0
      ),
    0
  );

  const totalPdfs = season.reduce(
    (acc, month) =>
      acc +
      month.weeks.filter((week) => week.pdf).length,
    0
  );

  const progress = Math.round(
    (completedWeeks / totalWeeks) * 100
  );

  return (
    <div className="mb-10">

      <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
        RMCF CASTILLA · PERFORMANCE
      </p>

      <div className="mt-4 flex items-center gap-5">

        <h1 className="text-4xl font-semibold tracking-tight">
          Área Condicional
        </h1>

        <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

      </div>

      <p className="mt-4 max-w-3xl text-white/60 leading-7">
        Calendario de planificación de la temporada 2026 / 2027.
        Accede rápidamente a cada semana, consulta las imágenes,
        documentos y toda la información del área de rendimiento.
      </p>

      <div className="grid gap-5 mt-8 md:grid-cols-4">

        <StatCard
          icon={<CalendarRange size={22} />}
          value={`${completedWeeks}/${totalWeeks}`}
          label="Semanas"
        />

        <StatCard
          icon={<ImageIcon size={22} />}
          value={totalImages}
          label="Imágenes"
        />

        <StatCard
          icon={<FileText size={22} />}
          value={totalPdfs}
          label="PDFs"
        />

        <StatCard
          icon={<Trophy size={22} />}
          value={`${progress}%`}
          label="Progreso"
        />

      </div>

      <div className="mt-8">

        <div className="flex justify-between text-sm text-white/60 mb-2">

          <span>Progreso de temporada</span>

          <span>{progress}%</span>

        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">

          <div
            className="h-full rounded-full bg-[#C8A96B] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />

        </div>

      </div>

    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-white/10
        bg-[#11161D]
        p-6
        transition-all
        hover:border-[#C8A96B]/40
      "
    >
      <div className="text-[#C8A96B] mb-5">
        {icon}
      </div>

      <div className="text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-white/50 text-sm">
        {label}
      </div>
    </div>
  );
}