"use client";

import Link from "next/link";
import {
  Bus,
  CalendarCheck,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { AREA_CONFIG, SEASON_LABEL } from "@/lib/season/config";
import { SeasonArea, WeekData } from "@/lib/season/types";
import { weekHasFiles } from "@/lib/season/utils";

interface Props {
  area: SeasonArea;
  stats: {
    totalWeeks: number;
    completed: number;
    pending: number;
    images: number;
    pdfs: number;
    progress: number;
    seasonWeek: number | null;
    seasonTotal: number;
    scopedToToday: boolean;
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

          {currentWeek && (
            <p className="mt-3 text-base font-medium text-white/85">
              {weekHasFiles(currentWeek)
                ? `${currentWeek.week} ya tiene material.`
                : `Esta semana no tiene archivos: sube el material de la ${currentWeek.week.toLowerCase()}.`}{" "}
              <span className="text-sm font-normal text-white/50">
                {stats.completed} de {stats.totalWeeks}{" "}
                {stats.totalWeeks === 1 ? "semana con material" : "semanas con material"}
              </span>
            </p>
          )}

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            {config.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentWeek && (
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20 ${
                weekHasFiles(currentWeek) ? "" : "w-full sm:w-auto"
              }`}
            >
              <CalendarCheck size={17} />
              {weekHasFiles(currentWeek)
                ? `Semana actual · ${currentWeek.week}`
                : `Subir a la ${currentWeek.week.toLowerCase()}`}
            </button>
          )}

          {/*
            El repositorio guarda los documentos que el cuerpo técnico monta
            por su cuenta; el desplazamiento de partido los monta la app. Se
            entra desde aquí porque es donde se venía a buscar el dossier del
            viaje y el horario de la jornada.
          */}
          {area === "general" && (
            <Link
              href="/desplazamiento"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/25 hover:text-white"
            >
              <Bus size={17} />
              Montar desplazamiento
            </Link>
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

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<ImageIcon size={18} />}
          value={stats.images}
          label="Imágenes de la temporada"
          action="Ver todas"
          onClick={onOpenImages}
        />

        <StatCard
          icon={<FileText size={18} />}
          value={stats.pdfs}
          label="PDFs de la temporada"
          action="Ver todos"
          onClick={onOpenPdfs}
        />

        <div className="rounded-2xl border border-white/10 bg-[#11161D] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Temporada</span>

            <span className="font-semibold tabular-nums text-[#C8A96B]">
              {stats.seasonWeek !== null
                ? `Semana ${stats.seasonWeek} de ${stats.seasonTotal}`
                : `${stats.progress}%`}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#C8A96B] transition-all duration-700"
              style={{
                width: `${
                  stats.seasonWeek !== null
                    ? Math.round((stats.seasonWeek / stats.seasonTotal) * 100)
                    : stats.progress
                }%`,
              }}
            />
          </div>

          {stats.seasonWeek !== null && (
            <p className="mt-3 text-xs text-white/30">
              Quedan {stats.seasonTotal - stats.seasonWeek} semanas
            </p>
          )}
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
