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
  /** Última semana anterior a la actual con archivos. */
  ultimaConMaterial?: WeekData | null;
  /** En cuántas semanas hay imágenes y en cuántas PDFs. */
  semanasCon?: { images: number; pdfs: number };
  /** Una casilla por semana transcurrida, para ver de un vistazo cuáles tienen material. */
  tiraSemanas?: { id: number; nombre: string; conMaterial: boolean; actual: boolean; fechas?: string }[];
  onSelectWeek?: (id: number) => void;
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
  ultimaConMaterial = null,
  semanasCon,
  tiraSemanas = [],
  onSelectWeek,
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

          {/* 29/10/2026: la descripción va pegada al título, antes del estado y la leyenda. */}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            {config.description}
          </p>

          {currentWeek && (
            <p className="mt-3 text-base font-medium text-white/85">
              {weekHasFiles(currentWeek)
                ? `${currentWeek.week} ya tiene material.`
                : ultimaConMaterial
                  ? `Lo último subido, en la ${ultimaConMaterial.week.toLowerCase()}.`
                  : ""}
            </p>
          )}

          {tiraSemanas.length > 1 && (
            <p className="mt-3 text-[13px] text-white/55">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-emerald-400 align-[-1px]" />
              Verde: semana con material. Pulsa una para abrirla.
              {" "}
              <span className="font-medium text-white/75">
                {stats.completed} de {stats.totalWeeks} semanas transcurridas con material
                {stats.seasonWeek !== null && ` · semana ${stats.seasonWeek} de ${stats.seasonTotal} de la temporada`}
              </span>
            </p>
          )}

          {tiraSemanas.length > 1 && (
            <div
              className="mt-2 flex max-w-full flex-wrap items-center gap-1.5 sm:gap-1"
              role="group"
              aria-label="Semanas con y sin material"
            >
              <span className="mr-1 text-[11px] font-medium tabular-nums text-white/45" aria-hidden>
                S1
              </span>

              {tiraSemanas.map((semana) => (
                <button
                  key={semana.id}
                  type="button"
                  onClick={() => onSelectWeek?.(semana.id)}
                  title={`${semana.nombre}${semana.fechas ? " · " + semana.fechas : ""}${semana.conMaterial ? " · con material" : " · sin material"}`}
                  aria-label={`${semana.nombre}${semana.fechas ? ", " + semana.fechas : ""}${semana.conMaterial ? ", con material" : ", sin material"}`}
                  className={`h-6 w-6 rounded-[5px] transition hover:scale-125 sm:h-3.5 sm:w-3.5 sm:rounded-[4px] ${
                    semana.conMaterial
                      ? "bg-emerald-400"
                      : "border border-white/20 bg-white/[0.04]"
                  } ${semana.actual ? "ring-2 ring-[#C8A96B] ring-offset-1 ring-offset-[#0B0F14]" : ""}`}
                />
              ))}

              <span className="ml-1 text-[11px] font-medium tabular-nums text-white/45" aria-hidden>
                S{tiraSemanas.length}
              </span>
            </div>
          )}

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

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={<ImageIcon size={18} />}
          value={stats.images}
          label="Imágenes de la temporada"
          detalle={semanasCon ? enSemanas(semanasCon.images, stats.totalWeeks) : undefined}
          action="Ver todas"
          onClick={onOpenImages}
        />

        <StatCard
          icon={<FileText size={18} />}
          value={stats.pdfs}
          label="PDFs de la temporada"
          detalle={semanasCon ? enSemanas(semanasCon.pdfs, stats.totalWeeks) : undefined}
          action="Ver todos"
          onClick={onOpenPdfs}
        />

      </div>
    </header>
  );
}

function enSemanas(n: number, total: number) {
  return n === 0 ? undefined : `en ${n} de ${total} semanas`;
}

function StatCard({
  icon,
  value,
  label,
  detalle,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  detalle?: string;
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

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>

        {detalle && <span className="text-xs text-white/45">{detalle}</span>}
      </div>

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
