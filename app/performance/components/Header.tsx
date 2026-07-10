"use client";

import {
  CalendarRange,
  ImageIcon,
  FileText,
  Trophy,
} from "lucide-react";
import { MonthData, WeekData } from "../data";

interface HeaderProps {
  season: MonthData[];
  selectedWeek: WeekData | null;
}

export default function Header({
  season,
  selectedWeek,
}: HeaderProps) {
  const totalWeeks = season.reduce(
    (acc, month) => acc + month.weeks.length,
    0
  );

  const completedWeeks = season.reduce(
    (acc, month) =>
      acc +
      month.weeks.filter(
        (week) =>
          week.images.length > 0 ||
          Boolean(week.pdf)
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
      month.weeks.filter(
        (week) => Boolean(week.pdf)
      ).length,
    0
  );

  const progress =
    totalWeeks > 0
      ? Math.round(
          (completedWeeks / totalWeeks) * 100
        )
      : 0;

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

      <div className="mt-8 grid gap-5 md:grid-cols-4">

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

        <div className="mb-2 flex justify-between text-sm text-white/60">

          <span>Progreso de temporada</span>

          <span>{progress}%</span>

        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">

          <div
            className="h-full rounded-full bg-[#C8A96B] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />

        </div>

      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-[#11161D] p-6">

        <p className="text-sm uppercase tracking-[0.2em] text-[#C8A96B]">
          Semana seleccionada
        </p>

        {selectedWeek ? (
          <>
            <h2 className="mt-2 text-2xl font-semibold">
              {selectedWeek.week}
            </h2>

            <p className="mt-2 text-white/60">
              {selectedWeek.start} — {selectedWeek.end}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-semibold">
              Selecciona una semana
            </h2>

            <p className="mt-2 text-white/50">
              Pulsa sobre cualquier semana del calendario
              para visualizar como si estuviera puesta fija.
            </p>
          </>
        )}

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
      <div className="mb-5 text-[#C8A96B]">
        {icon}
      </div>

      <div className="text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-sm text-white/50">
        {label}
      </div>
    </div>
  );
}