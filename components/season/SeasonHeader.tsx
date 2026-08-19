"use client";

import {
  CalendarCheck,
  CalendarRange,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { AREA_CONFIG, SEASON_LABEL } from "@/lib/season/config";
import { SeasonArea, WeekData } from "@/lib/season/types";

interface Props {
  area: SeasonArea;
  stats: {
    totalWeeks: number;
    completed: number;
    images: number;
    pdfs: number;
    progress: number;
  };
  currentWeek: WeekData | null;
  saving: boolean;
  onGoToCurrentWeek: () => void;
  onOpenImages: () => void;
  onOpenPdfs: () => void;
  onReload: () => void;
}

export default function SeasonHeader({
  area,
  stats,
  currentWeek,
  saving,
  onGoToCurrentWeek,
  onOpenImages,
  onOpenPdfs,
  onReload,
}: Props) {
  const config = AREA_CONFIG[area];

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
          {config.eyebrow}
        </p>

        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
          {SEASON_LABEL}
        </span>

        {saving && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
            <Loader2 size={13} className="animate-spin" />
            Guardando...
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {config.title}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            {config.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentWeek && (
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
            >
              <CalendarCheck size={17} />
              Semana actual · {currentWeek.week}
            </button>
          )}

          <button
            type="button"
            onClick={onReload}
            title="Recargar datos"
            className="rounded-xl border border-white/10 p-2.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {/* MÉTRICAS */}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CalendarRange size={18} />}
          value={`${stats.completed}/${stats.totalWeeks}`}
          label="Semanas con archivos"
        />

        <StatCard
          icon={<ImageIcon size={18} />}
          value={stats.images}
          label="Imágenes"
          action="Ver todas"
          onClick={onOpenImages}
        />

        <StatCard
          icon={<FileText size={18} />}
          value={stats.pdfs}
          label="PDFs"
          action="Ver todos"
          onClick={onOpenPdfs}
        />

        <div className="rounded-2xl border border-white/10 bg-[#11161D] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Progreso de temporada</span>

            <span className="font-semibold tabular-nums text-[#C8A96B]">
              {stats.progress}%
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#C8A96B] transition-all duration-700"
              style={{ width: `${stats.progress}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-white/30">
            {stats.totalWeeks - stats.completed} semanas pendientes
          </p>
        </div>
      </div>
    </header>
  );
}

function StatCard({
  icon,
  value,
  label,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  action?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-[#C8A96B]">
        {icon}
        <span className="text-xs uppercase tracking-wider text-white/50">
          {label}
        </span>
      </div>

      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>

      {action && (
        <div className="mt-2 text-xs text-[#C8A96B] opacity-70 transition group-hover:opacity-100">
          {action} →
        </div>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#11161D] p-5">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/10 bg-[#11161D] p-5 text-left transition-all hover:border-[#C8A96B]/40 hover:bg-white/[0.03]"
    >
      {content}
    </button>
  );
}
