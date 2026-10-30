"use client";

import {
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

          {/*
            30/10/2026: las cuatro líneas de estado («Semana 18 aún sin
            material…», «7 de 18…», «Vamos por la semana 18…», «Verde: …»)
            repetían la semana actual y la última tres veces. Ahora es una:
            «Semana 18 de 52 · 7 de 18 con material · lo último: semana 9
            (24 ago — 30 ago)». La leyenda va pegada a la tira.
          */}
          {/* 30/10/2026: «sin subidas desde la semana 9» y no «lo último: semana 9
              (24 ago – 30 ago)»: dice por qué las casillas de después están en
              blanco, y una sola vez (la leyenda y el panel ya no lo repiten). */}
          {(() => {
            const partes = [
              stats.seasonWeek !== null ? `Semana ${stats.seasonWeek} de ${stats.seasonTotal}` : currentWeek?.week ?? "",
              tiraSemanas.length > 1 ? `${stats.completed} de ${stats.totalWeeks} con material` : "",
              currentWeek && weekHasFiles(currentWeek)
                ? "esta semana ya tiene material"
                : ultimaConMaterial
                  ? `sin subidas desde la ${ultimaConMaterial.week.toLowerCase()}`
                  : "",
            ].filter(Boolean);

            return partes.length ? <p className="mt-3 text-base font-medium text-white/85">{partes.join(" · ")}</p> : null;
          })()}

          {tiraSemanas.length > 1 && (
            <>
            {/* Cada casilla con su número y 32 px de toque en el móvil (30/10/2026). */}
            <div
              className="mt-3 flex max-w-full flex-wrap items-center gap-1.5 sm:gap-1"
              role="group"
              aria-label="Semanas con y sin material"
            >
              {tiraSemanas.map((semana, i) => (
                <button
                  key={semana.id}
                  type="button"
                  onClick={() => onSelectWeek?.(semana.id)}
                  title={`${semana.nombre}${semana.fechas ? " · " + semana.fechas : ""}${semana.conMaterial ? " · con material" : " · sin material"}`}
                  aria-label={`${semana.nombre}${semana.fechas ? ", " + semana.fechas : ""}${semana.conMaterial ? ", con material" : ", sin material"}`}
                  /* 32 px de toque también en escritorio (30/10/2026). */
                  className={`flex h-8 w-8 items-center justify-center rounded-[6px] text-[12px] font-semibold tabular-nums transition hover:scale-110 ${
                    semana.conMaterial
                      ? "bg-emerald-400 text-[#0B0F14]"
                      : "border border-white/20 bg-white/[0.04] text-white/55"
                  } ${semana.actual ? "ring-2 ring-[#C8A96B] ring-offset-1 ring-offset-[#0B0F14]" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-emerald-400" /> con material
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] border border-white/30" /> sin material
              </span>
              <span>Pulsa una semana para abrirla.</span>
            </p>
            </>
          )}

        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/*
            30/10/2026: en la semana en curso la acción principal es subir a
            ella; abrir la última con material se queda sólo en la tarjeta
            «Lo último subido», de abajo (antes salía dos veces). Y fuera
            «Montar desplazamiento»: ya está en la barra de Operativa.
          */}
          {currentWeek && (
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className={
                weekHasFiles(currentWeek)
                  ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                  : "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110 sm:w-auto"
              }
            >
              <CalendarCheck size={17} />
              {weekHasFiles(currentWeek)
                ? `Esta semana · ${currentWeek.week}`
                : `Subir a la ${currentWeek.week.toLowerCase()}`}
            </button>
          )}

          <button
            type="button"
            onClick={onReload}
            title="Volver a leer las semanas"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-white/65 transition hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw size={16} />
            Actualizar
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

        {detalle && <span className="text-[13px] text-white/60">{detalle}</span>}
      </div>

      {/* Con más cuerpo y subrayado (30/10/2026): en modo día el dorado fino no llegaba al contraste. */}
      {action && (
        <div className="mt-2 text-[13px] font-semibold text-[#C8A96B] underline decoration-[#C8A96B]/40 underline-offset-4 transition group-hover:decoration-[#C8A96B]">
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
