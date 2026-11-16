"use client";

import { useEffect, useRef } from "react";
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

  /* En el móvil la tira va en una fila que se desliza (10/11/2026): se abre centrada en la semana en curso, moviendo sólo la tira. */
  const tiraRef = useRef<HTMLDivElement>(null);
  const actualId = tiraSemanas.find((s) => s.actual)?.id ?? null;

  useEffect(() => {
    const tira = tiraRef.current;
    const casilla = tira?.querySelector<HTMLElement>("[data-actual='1']");
    if (!tira || !casilla || tira.scrollWidth <= tira.clientWidth) return;
    tira.scrollLeft = casilla.offsetLeft - tira.clientWidth / 2 + casilla.clientWidth / 2;
  }, [actualId]);

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
              /* «PDF» invariable, como se escribe en español (07/11/2026). */
              stats.pdfs > 0 ? `${stats.pdfs} PDF` : "",
            ]
              .filter(Boolean)
              .join(" y ");
            /* 10/11/2026 (marketing): fuera «sin subidas desde la semana 9»; lo último
               subido va como texto secundario en la semana vacía, con su enlace. */
            const partes = [
              /* La semana en curso ya la dice la tarjeta de la semana: aquí sólo la temporada. */
              /* 16/11/2026 (los tres jueces): una sola base, las semanas hasta hoy; fuera «Temporada: 52 semanas», que mezclaba dos cuentas. */
              material ? `${material} en ${stats.completed} de las ${stats.totalWeeks} semanas hasta hoy` : "",
              currentWeek && weekHasFiles(currentWeek) ? "esta semana ya tiene material" : "",
            ].filter(Boolean);
            void ultimaConMaterial;

            return partes.length ? (
              <p className="mt-3 text-base font-medium text-white/85">{partes.join(" · ")}</p>
            ) : null;
          })()}

          {tiraSemanas.length > 1 && (
            <>
            {/* Cada casilla con su número, 40 px en el móvil, y con material lleva además
                una marca (30/10/2026): el color solo no vale en modo día ni con daltonismo. */}
            <div
              ref={tiraRef}
              className="-mx-1 mt-3 flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-5 pt-1 sm:mx-0 sm:flex-wrap sm:gap-1 sm:overflow-visible sm:px-0 sm:pb-0"
              role="group"
              aria-label="Semanas con y sin material"
            >
              {tiraSemanas.map((semana, i) => (
                <button
                  key={semana.id}
                  type="button"
                  data-actual={semana.actual ? "1" : undefined}
                  onClick={() => onSelectWeek?.(semana.id)}
                  title={`${semana.nombre}${semana.fechas ? " · " + semana.fechas : ""}${semana.conMaterial ? " · con material" : " · sin material"}`}
                  aria-label={`${semana.nombre}${semana.fechas ? ", " + semana.fechas : ""}${semana.conMaterial ? ", con material" : ", sin material"}`}
                  /* 32 px de toque también en escritorio (30/10/2026). */
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-[13px] font-semibold tabular-nums transition hover:scale-110 sm:h-8 sm:w-8 sm:text-[12px] ${
                    /* 11/11/2026 (fútbol): el dorado del club, no un verde fuera de la paleta. */
                    semana.conMaterial
                      ? "bg-[#C8A96B] text-[#0B0F14]"
                      : "border border-white/20 bg-white/[0.04] text-white/55"
                  } ${semana.actual ? "ring-2 ring-white/70 ring-offset-1 ring-offset-[#0B0F14]" : ""}`}
                >
                  {i + 1}
                  {/* La semana en curso, dicha y no sólo con el aro (07/11/2026). */}
                  {semana.actual && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C8A96B]"
                    >
                      ahora
                    </span>
                  )}
                  {semana.conMaterial && (
                    <span
                      aria-hidden
                      className="siempre-oscuro absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ background: "#0B0F14", color: "#C8A96B", border: "1px solid #C8A96B" }}
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1 flex flex-wrap sm:mt-5 items-center gap-x-3 gap-y-1 text-[12px] text-white/65">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-[#C8A96B]" />
                <Check size={11} strokeWidth={3} className="-ml-1 text-[#C8A96B]" aria-hidden /> con material
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] border border-white/30" /> sin material
              </span>
              {/* 11/11/2026 (fútbol): en el móvil la tira abre en las últimas, todas en blanco; la racha dicha
                  explica por qué y sale de las mismas casillas. */}
              {(() => {
                /*
                | 16/11/2026 (fútbol y análisis): todos los huecos, no sólo la racha
                | final, y sin la semana en curso (aún no ha acabado): así la cifra
                | cuadra con las casillas. «11 semanas sin material: la 5, la 7 y
                | de la 10 a la 20». En ámbar de aviso; pulsar abre la última vacía.
                */
                const hasta = tiraSemanas.findIndex((s) => s.actual);
                const cerradas = hasta >= 0 ? tiraSemanas.slice(0, hasta) : tiraSemanas;
                const tramos: [number, number][] = [];
                cerradas.forEach((s, i) => {
                  if (s.conMaterial) return;
                  const ultimo = tramos[tramos.length - 1];
                  if (ultimo && ultimo[1] === i - 1) ultimo[1] = i;
                  else tramos.push([i, i]);
                });
                const vacias = tramos.reduce((n, [a, b]) => n + b - a + 1, 0);
                if (vacias < 2) return null;
                const trozos = tramos.map(([a, b]) => (a === b ? `la ${a + 1}` : `de la ${a + 1} a la ${b + 1}`));
                const texto = trozos.length > 1 ? `${trozos.slice(0, -1).join(", ")} y ${trozos[trozos.length - 1]}` : trozos[0];
                const ultimaVacia = cerradas[tramos[tramos.length - 1][1]];
                return (
                  <button
                    type="button"
                    onClick={() => onSelectWeek?.(ultimaVacia.id)}
                    className="basis-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-left text-[13px] font-semibold text-amber-200 transition hover:bg-amber-500/20 sm:basis-auto"
                    title="Abre la última semana sin material"
                  >
                    {vacias} semanas sin material: {texto}
                  </button>
                );
              })()}
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
          {/* La acción principal arriba también en el móvil (10/11/2026): allí la zona de subida quedaba a dos pantallas. En escritorio ya está a la vista, al lado. */}
          {/* 11/11/2026 (fútbol y análisis): fuera el «Subir el material de la semana N» de aquí arriba en el móvil;
              repetía el botón de la tarjeta de la semana. Queda uno solo. */}

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
              {/* Con su recuento (10/11/2026): dice qué hay antes de abrirlo. */}
              {/* 11/11/2026 (fútbol): dice qué hace el botón, no sólo cuántas hay. */}
              {stats.images === 1 ? "Ver la imagen de la temporada" : `Ver las ${stats.images} imágenes de la temporada`}
            </button>
          )}

          {stats.pdfs > 0 && (
            <button type="button" onClick={onOpenPdfs} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white">
              <FileText size={16} className="text-[#C8A96B]" />
              {stats.pdfs === 1 ? "Ver el PDF de la temporada" : `Ver los ${stats.pdfs} PDF`}
            </button>
          )}
        </div>
      </div>

    </header>
  );
}
