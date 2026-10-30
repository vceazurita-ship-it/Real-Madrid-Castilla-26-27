"use client";

import {
  CalendarCheck,
  Check,
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
  /** En cuántas semanas hay imágenes y en cuántas PDFs (ya no se pinta: la línea de resumen da el total de semanas con material). */
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
          {/*
            30/10/2026: una sola línea de resumen. «7 de 18 con material» y las
            tarjetas de imágenes (3) y PDFs (13) eran tres sitios con la misma
            cifra: ahora «3 imágenes y 13 PDFs en 7 de 18 semanas», y «sin
            subidas desde la semana 9» lleva a esa semana.
          */}
          {(() => {
            const material = [
              stats.images > 0 ? `${stats.images} ${stats.images === 1 ? "imagen" : "imágenes"}` : "",
              stats.pdfs > 0 ? `${stats.pdfs} ${stats.pdfs === 1 ? "PDF" : "PDFs"}` : "",
            ]
              .filter(Boolean)
              .join(" y ");
            const partes = [
              stats.seasonWeek !== null ? `Semana ${stats.seasonWeek} de ${stats.seasonTotal}` : currentWeek?.week ?? "",
              material ? `${material} en ${stats.completed} de ${stats.totalWeeks} semanas` : "",
              currentWeek && weekHasFiles(currentWeek) ? "esta semana ya tiene material" : "",
            ].filter(Boolean);
            const desde = !(currentWeek && weekHasFiles(currentWeek)) && ultimaConMaterial ? ultimaConMaterial : null;

            return partes.length || desde ? (
              <p className="mt-3 text-base font-medium text-white/85">
                {partes.join(" · ")}
                {desde ? (
                  <>
                    {partes.length ? " · " : ""}
                    <button
                      type="button"
                      onClick={() => onSelectWeek?.(desde.id)}
                      className="font-medium underline decoration-white/30 underline-offset-4 hover:decoration-[#C8A96B]"
                      title={`Abrir la ${desde.week.toLowerCase()}`}
                    >
                      sin subidas desde la {desde.week.toLowerCase()}
                    </button>
                  </>
                ) : null}
              </p>
            ) : null;
          })()}

          {tiraSemanas.length > 1 && (
            <>
            {/* Cada casilla con su número, 40 px en el móvil, y con material lleva además
                una marca (30/10/2026): el color solo no vale en modo día ni con daltonismo. */}
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
                  className={`relative flex h-10 w-10 items-center justify-center rounded-[6px] text-[13px] font-semibold tabular-nums transition hover:scale-110 sm:h-8 sm:w-8 sm:text-[12px] ${
                    semana.conMaterial
                      ? "bg-emerald-400 text-[#0B0F14]"
                      : "border border-white/20 bg-white/[0.04] text-white/55"
                  } ${semana.actual ? "ring-2 ring-[#C8A96B] ring-offset-1 ring-offset-[#0B0F14]" : ""}`}
                >
                  {i + 1}
                  {semana.conMaterial && (
                    <span
                      aria-hidden
                      className="siempre-oscuro absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ background: "#0B0F14", color: "#34D399", border: "1px solid #34D399" }}
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-emerald-400" />
                <Check size={11} strokeWidth={3} className="-ml-1 text-emerald-400" aria-hidden /> con material
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
          {/* Con la semana vacía el único «Subir» es el de la tarjeta de la semana (30/10/2026). */}
          {currentWeek && weekHasFiles(currentWeek) && (
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
            >
              <CalendarCheck size={17} />
              {`Esta semana · ${currentWeek.week}`}
            </button>
          )}

          <button
            type="button"
            onClick={onReload}
            title="Volver a leer las semanas"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>

          {stats.images > 0 && (
            <button type="button" onClick={onOpenImages} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white">
              <ImageIcon size={16} className="text-[#C8A96B]" />
              Ver las imágenes
            </button>
          )}

          {stats.pdfs > 0 && (
            <button type="button" onClick={onOpenPdfs} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white">
              <FileText size={16} className="text-[#C8A96B]" />
              Ver los PDFs
            </button>
          )}
        </div>
      </div>

    </header>
  );
}
