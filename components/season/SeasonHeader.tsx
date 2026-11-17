"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { AREA_CONFIG, SEASON_LABEL } from "@/lib/season/config";
import { SeasonArea, WeekData } from "@/lib/season/types";
import { weekHasFiles, weekRangeLabel } from "@/lib/season/utils";

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
  tiraSemanas?: { id: number; nombre: string; conMaterial: boolean; actual: boolean; fechas?: string; partido?: string }[];
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

  /* 17/11/2026 (fútbol): si la tira se desliza, se dice qué queda a la izquierda. */
  const [quedanAntes, setQuedanAntes] = useState(0);

  useEffect(() => {
    const tira = tiraRef.current;
    if (!tira) return;

    const mide = () => {
      if (tira.scrollWidth <= tira.clientWidth) {
        setQuedanAntes(0);
        return;
      }
      const primera = tira.querySelector<HTMLElement>("button");
      const paso = primera ? primera.offsetWidth + 6 : 46;
      setQuedanAntes(Math.max(0, Math.round(tira.scrollLeft / paso)));
    };

    const casilla = tira.querySelector<HTMLElement>("[data-actual='1']");
    if (casilla && tira.scrollWidth > tira.clientWidth) {
      tira.scrollLeft = casilla.offsetLeft - tira.clientWidth / 2 + casilla.clientWidth / 2;
    }

    const id = setTimeout(mide, 0);
    tira.addEventListener("scroll", mide, { passive: true });
    window.addEventListener("resize", mide);

    return () => {
      clearTimeout(id);
      tira.removeEventListener("scroll", mide);
      window.removeEventListener("resize", mide);
    };
  }, [actualId]);

  /*
  | 17/11/2026 (los tres jueces): UNA frase de estado en vez de tres (la línea
  | de recuento, la leyenda y el aviso de huecos decían lo mismo). Arriba, la
  | antigüedad: cuántas semanas llevamos sin subir nada desde la última con
  | material, con el botón a la semana en curso; debajo, en pequeño, todos los
  | huecos de la temporada.
  */
  const idxActual = tiraSemanas.findIndex((s) => s.actual);
  const cerradas = idxActual >= 0 ? tiraSemanas.slice(0, idxActual) : tiraSemanas;
  const tramos: [number, number][] = [];
  cerradas.forEach((s, i) => {
    if (s.conMaterial) return;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo[1] === i - 1) ultimo[1] = i;
    else tramos.push([i, i]);
  });
  const vacias = tramos.reduce((n, [a, b]) => n + b - a + 1, 0);
  const trozos = tramos.map(([a, b]) => (a === b ? `la ${a + 1}` : `de la ${a + 1} a la ${b + 1}`));
  const huecos = trozos.length > 1 ? `${trozos.slice(0, -1).join(", ")} y ${trozos[trozos.length - 1]}` : trozos[0] ?? "";
  const ultimaVacia = tramos.length ? cerradas[tramos[tramos.length - 1][1]] : null;

  /* Semanas seguidas sin subir nada, contando la de ahora, desde la última con material. */
  const hasta = idxActual >= 0 ? idxActual : tiraSemanas.length - 1;
  let ultimaCon = -1;
  for (let i = hasta; i >= 0; i -= 1) {
    if (tiraSemanas[i]?.conMaterial) {
      ultimaCon = i;
      break;
    }
  }
  const sinSubir = hasta - ultimaCon;
  const actualVacia = Boolean(currentWeek && !weekHasFiles(currentWeek));

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

      <div className="mt-3 min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {config.title}
        </h1>

        {/* 29/10/2026: la descripción va pegada al título, antes del estado y la leyenda. */}
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          {config.description}
        </p>

        {/* ---------- La antigüedad, a la vista (17/11/2026) ---------- */}
        {sinSubir >= 2 && actualVacia ? (
          <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3">
            <TriangleAlert size={20} className="shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug text-amber-200">
                {sinSubir} semanas sin subir nada
                {ultimaConMaterial ? (
                  <span className="font-normal">
                    {" "}· lo último, la {ultimaConMaterial.week.toLowerCase()}
                    {weekRangeLabel(ultimaConMaterial) ? ` (${weekRangeLabel(ultimaConMaterial)})` : ""}
                  </span>
                ) : null}
              </p>
              {vacias >= 2 && ultimaVacia ? (
                <p className="mt-0.5 text-[13px] leading-snug text-amber-200/85">
                  En la temporada, {vacias} sin material: {huecos}.{" "}
                  <button
                    type="button"
                    onClick={() => onSelectWeek?.(ultimaVacia.id)}
                    className="font-semibold underline decoration-amber-300/50 underline-offset-2 hover:decoration-amber-300"
                  >
                    Abrir la {ultimaVacia.nombre.toLowerCase()}
                  </button>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#C8A96B] px-4 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110"
            >
              <UploadCloud size={17} aria-hidden />
              Subir a esta semana
            </button>
          </div>
        ) : vacias >= 2 && ultimaVacia ? (
          <button
            type="button"
            onClick={() => onSelectWeek?.(ultimaVacia.id)}
            className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-left text-[13px] font-semibold text-amber-200 transition hover:bg-amber-500/20"
            title="Abre la última semana sin material"
          >
            {vacias} semanas sin material: {huecos}
          </button>
        ) : null}

        {tiraSemanas.length > 1 && (
          <>
            {/* 17/11/2026: en el móvil, cuántas semanas quedan a la izquierda (la tira abre en la actual). */}
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/65">
              <span className="font-semibold uppercase tracking-[0.14em] text-white/70">
                Semanas 1 a {tiraSemanas.length}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-[#C8A96B]" />
                <Check size={11} strokeWidth={3} className="-ml-1 text-[#C8A96B]" aria-hidden /> con material
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] border border-white/30" /> sin material
              </span>
              {quedanAntes > 0 ? (
                <button
                  type="button"
                  onClick={() => tiraRef.current?.scrollTo({ left: 0, behavior: "smooth" })}
                  className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline sm:hidden"
                >
                  ← {quedanAntes} más a la izquierda
                </button>
              ) : null}
            </p>

            {/* Cada casilla con su número, 44 px en el móvil y 36 en escritorio, y con material lleva además
                una marca (30/10/2026): el color solo no vale en modo día ni con daltonismo. */}
            <div
              ref={tiraRef}
              className={`-mx-1 mt-2 flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-5 pt-1.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${
                quedanAntes > 0 ? "[mask-image:linear-gradient(90deg,transparent,#000_28px)] sm:[mask-image:none]" : ""
              }`}
              role="group"
              aria-label="Semanas con y sin material"
            >
              {tiraSemanas.map((semana, i) => {
                const detalle = [semana.nombre, semana.fechas, semana.partido, semana.conMaterial ? "con material" : "sin material"].filter(Boolean);

                return (
                  <button
                    key={semana.id}
                    type="button"
                    data-actual={semana.actual ? "1" : undefined}
                    onClick={() => onSelectWeek?.(semana.id)}
                    /* 17/11/2026 (fútbol): al pasar por encima y al leerla, sus fechas y su partido. */
                    title={detalle.join(" · ")}
                    aria-label={detalle.join(", ")}
                    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[14px] font-semibold tabular-nums transition hover:scale-110 sm:h-9 sm:w-9 sm:text-[13px] ${
                      /* 11/11/2026 (fútbol): el dorado del club, no un verde fuera de la paleta. */
                      semana.conMaterial
                        ? "bg-[#C8A96B] text-[#0B0F14]"
                        : "border border-white/20 bg-white/[0.04] text-white/60"
                    } ${semana.actual ? "ring-2 ring-white/70 ring-offset-1 ring-offset-[#0B0F14]" : ""}`}
                  >
                    {i + 1}
                    {/* La semana en curso, dicha y no sólo con el aro (07/11/2026). */}
                    {semana.actual && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -bottom-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C8A96B]"
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
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6">
          {/*
            30/10/2026: en la semana en curso la acción principal es subir a
            ella; abrir la última con material se queda sólo en la tarjeta
            «Lo último subido», de abajo (antes salía dos veces).
            17/11/2026 (fútbol): fuera «Actualizar» en el repositorio (la
            lectura ya se renueva sola) y lo de la temporada en un solo
            control con dos opciones, con sus recuentos.
          */}

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

          {area !== "general" && (
            <button
              type="button"
              onClick={onReload}
              title="Volver a leer las semanas"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          )}

          {stats.images + stats.pdfs > 0 && (
            <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-white/15 p-1" role="group" aria-label="Todo lo de la temporada">
              <span className="px-2 text-[12.5px] font-medium text-white/60">De la temporada</span>
              {stats.images > 0 && (
                <button
                  type="button"
                  onClick={onOpenImages}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ImageIcon size={15} className="text-[#C8A96B]" aria-hidden />
                  {stats.images === 1 ? "1 imagen" : `${stats.images} imágenes`}
                </button>
              )}
              {stats.pdfs > 0 && (
                <button
                  type="button"
                  onClick={onOpenPdfs}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <FileText size={15} className="text-[#C8A96B]" aria-hidden />
                  {/* «PDF» invariable, como se escribe en español (07/11/2026). */}
                  {`${stats.pdfs} PDF`}
                </button>
              )}
              <span className="px-2 text-[12.5px] text-white/55">
                en {stats.completed} de {stats.totalWeeks} semanas
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
