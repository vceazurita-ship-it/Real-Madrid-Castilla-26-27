"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Check,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
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
  tiraSemanas?: { id: number; nombre: string; conMaterial: boolean; actual: boolean; fechas?: string; partido?: string; imagenes?: number; pdfs?: number; completa?: boolean }[];
  onSelectWeek?: (id: number) => void;
  /** Lo que debería haber esta semana (sólo el repositorio general) y si ya está. */
  checklist?: { texto: string; hecho: boolean; href?: string }[];
  /** «J13 vs Real Murcia (en casa)», el partido de la semana en curso. */
  partidoActual?: string;
  /** Plan de partido y ABP del rival de esta semana, con el rival ya elegido. */
  enlacesRival?: { href: string; texto: string }[];
  /** Semanas con convocatoria, horario y plan (sólo el repositorio general). */
  cumplimiento?: { completas: number; total: number; ultima?: string };
  /** Subir a la semana en curso con el tipo ya elegido («Convocatoria», …; null = otro material). */
  onSubirTipo?: (tipo: string | null, archivos: File[]) => void;
  subiendo?: boolean;
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
  checklist,
  partidoActual,
  enlacesRival = [],
  cumplimiento,
  onSubirTipo,
  subiendo = false,
  saving,
  onGoToCurrentWeek,
  onOpenImages,
  onOpenPdfs,
  onReload,
}: Props) {
  const config = AREA_CONFIG[area];

  /* 20/11/2026 (ronda 7): una sola entrada de archivos; cada casilla dice qué tipo se sube. */
  const entradaRef = useRef<HTMLInputElement>(null);
  const tipoRef = useRef<string | null>(null);
  const pideArchivos = (tipo: string | null) => {
    tipoRef.current = tipo;
    entradaRef.current?.click();
  };
  const general = area === "general";

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

  /* 17/11/2026 (ronda 20): la semana en curso y cuántas llevan material, para la línea de estado. */
  const idxActual = tiraSemanas.findIndex((s) => s.actual);
  const conMaterial = tiraSemanas.filter((s) => s.conMaterial).length;
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

        {/* 20/11/2026 (ronda 5, análisis): en qué se diferencia de la portada y de «Mis tareas». */}
        {area === "general" ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-white/60">
            Aquí se guarda lo que se reparte al cuerpo técnico cada semana. Lo que hay que hacer hoy está en la{" "}
            <Link href="/" className="font-medium text-white/80 underline decoration-white/25 underline-offset-2 hover:text-[#C8A96B]">
              portada
            </Link>{" "}
            («Tu día» y «Mis tareas»).
          </p>
        ) : null}

        {/*
          ---------- El estado, en una línea neutra (17/11/2026, ronda 20) ----------
          Los tres jueces: el aviso ámbar «12 semanas sin subir nada» parecía
          un error, se deshacía en una columna en el móvil, su segunda línea
          no se leía en modo día y sus dos cifras (12 sin subir, 13 sin
          material) se contradecían. Ahora una sola frase con una sola base
          —la semana en curso, cuántas tienen material y la última subida, que
          abre esa semana— y la acción de subir se queda en la semana de abajo.
        */}
        {/*
          20/11/2026 (ronda 4, análisis y marketing): una sola línea con su
          base —«3 imágenes y 13 PDF en 7 de 21 semanas»—, con las dos cifras
          abriendo todo lo de la temporada (antes iban en una caja aparte,
          «De la temporada»). Debajo, si la semana en curso está vacía y hace
          dos o más que no se sube nada, el aviso con cuánto hace y el botón
          de subir: lo que se puede hacer, no sólo el dato.
        */}
        {tiraSemanas.length > 1 ? (
          <p className="mt-4 flex max-w-3xl flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] leading-snug text-white/75">
            {idxActual >= 0 ? (
              <span className="font-semibold text-white/90">{tiraSemanas[idxActual].nombre || `Semana ${idxActual + 1}`}</span>
            ) : null}
            {/* 20/11/2026 (ronda 5, fútbol): el «·» va con el recuento, para que no se quede colgando en 390 px. */}
            <span>
              {idxActual >= 0 ? <span aria-hidden className="mr-2 text-white/35">·</span> : null}
              {stats.images > 0 ? (
                <button
                  type="button"
                  onClick={onOpenImages}
                  title="Ver todas las imágenes de la temporada"
                  className="inline-flex items-baseline gap-1 font-semibold text-white/90 underline decoration-white/25 underline-offset-2 transition hover:text-[#C8A96B] hover:decoration-[#C8A96B]"
                >
                  <ImageIcon size={13} className="self-center text-[#C8A96B]" aria-hidden />
                  {stats.images === 1 ? "1 imagen" : `${stats.images} imágenes`}
                </button>
              ) : null}
              {stats.images > 0 && stats.pdfs > 0 ? " y " : null}
              {stats.pdfs > 0 ? (
                <button
                  type="button"
                  onClick={onOpenPdfs}
                  title="Ver todos los PDF de la temporada"
                  className="inline-flex items-baseline gap-1 font-semibold text-white/90 underline decoration-white/25 underline-offset-2 transition hover:text-[#C8A96B] hover:decoration-[#C8A96B]"
                >
                  <FileText size={13} className="self-center text-[#C8A96B]" aria-hidden />
                  {/* «PDF» invariable, como se escribe en español (07/11/2026). */}
                  {`${stats.pdfs} PDF`}
                </button>
              ) : null}
              {stats.images + stats.pdfs > 0 ? " en " : null}
              <span className="font-semibold tabular-nums text-white/90">{conMaterial}</span> de {tiraSemanas.length} semanas
              {stats.images + stats.pdfs > 0 ? "" : " con material"}
            </span>
            {/* 20/11/2026 (ronda 7, marketing): la última subida va en esta misma línea, no en la tarjeta. */}
            {general && actualVacia && ultimaConMaterial ? (
              <span>
                <span aria-hidden className="mr-2 text-white/35">·</span>
                último:{" "}
                <button
                  type="button"
                  onClick={() => onSelectWeek?.(ultimaConMaterial.id)}
                  title={weekRangeLabel(ultimaConMaterial) || undefined}
                  className="font-semibold text-white/90 underline decoration-white/25 underline-offset-2 hover:text-[#C8A96B] hover:decoration-[#C8A96B]"
                >
                  {ultimaConMaterial.week.toLowerCase()}
                </button>
              </span>
            ) : null}
          </p>
        ) : null}

        {/*
          CUMPLIMIENTO (20/11/2026, ronda 7, análisis): la lectura visual de la
          temporada —en cuántas semanas están las tres cosas de cada semana—,
          con su base dicha y la última semana completa.
        */}
        {cumplimiento ? (
          <div className="mt-3 max-w-3xl">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-white/75">
              <span>
                Semanas con convocatoria, horario y plan:{" "}
                <span className="font-semibold tabular-nums text-white/90">
                  {cumplimiento.completas} de {cumplimiento.total}
                </span>
              </span>
              {cumplimiento.ultima ? (
                <span className="text-[12px] text-white/65">{`La última completa: ${cumplimiento.ultima.toLowerCase()}`}</span>
              ) : null}
            </p>
            <div
              className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
              role="img"
              aria-label={`${cumplimiento.completas} de ${cumplimiento.total} semanas con convocatoria, horario y plan`}
            >
              <div
                className="h-full rounded-full bg-[#C8A96B]"
                style={{ width: `${cumplimiento.total ? Math.round((cumplimiento.completas / cumplimiento.total) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-white/60">
              El plan sólo cuenta en las semanas con partido; cada cosa se reconoce por el nombre del archivo.
            </p>
          </div>
        ) : null}

        {/*
          LO QUE FALTA ESTA SEMANA (20/11/2026, ronda 5, análisis y marketing):
          en el repositorio general, un titular con verbo y la lista de lo que
          debería haber cada semana, marcando lo que ya está; el botón de subir
          como acción principal y, si hay partido, el Plan y el ABP del rival
          con el rival ya elegido. La última semana con material, en pequeño.
        */}
        {checklist && currentWeek ? (
          <div className="mt-3 max-w-3xl rounded-xl border border-[#C8A96B]/35 bg-[#C8A96B]/[0.07] px-3.5 py-3">
            {(() => {
              const faltan = checklist.filter((c) => !c.hecho);
              const lista = faltan.map((c) => `${c.texto === "Convocatoria" ? "la" : "el"} ${c.texto.toLowerCase()}`);
              const unidas = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}` : lista[0];
              const titular = actualVacia
                ? `Esta semana no hay material: sube ${unidas}.`
                : faltan.length
                  ? `Esta semana falta subir ${unidas}.`
                  : "Esta semana ya está todo lo de cada semana.";

              return (
                <>
                  <p className="text-[15px] font-semibold leading-snug text-white/90">
                    {titular}
                    {partidoActual ? <span className="font-normal text-white/70"> {partidoActual}.</span> : null}
                  </p>

                  {/*
                    20/11/2026 (ronda 7, los tres jueces): la lista de comprobación
                    con casilla, y cada cosa que falta abre su propia subida con el
                    tipo ya elegido. Fuera el botón «Subir a la semana N»: con la
                    zona de abajo eran dos subidas iguales. El Plan de partido,
                    además, lleva al plan de este rival para hacerlo o bajarlo.
                  */}
                  <input
                    ref={entradaRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const archivos = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (archivos.length) onSubirTipo?.(tipoRef.current, archivos);
                    }}
                  />
                  <ul className="mt-2.5 space-y-1.5" aria-label="Lo que debería haber cada semana">
                    {checklist.map((c) => (
                      <li
                        key={c.texto}
                        className={`flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-1.5 ${
                          c.hecho ? "border-[#C8A96B]/50" : "border-white/20"
                        }`}
                      >
                        <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium text-white/85">
                          <span
                            aria-hidden
                            className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
                              c.hecho ? "border-[#C8A96B] bg-[#C8A96B] text-[#0B0F14]" : "border-white/45"
                            }`}
                          >
                            {c.hecho ? <Check size={13} strokeWidth={3} /> : null}
                          </span>
                          {c.texto}
                          <span className={`text-[12px] font-normal ${c.hecho ? "text-white/65" : "text-white/60"}`}>
                            {c.hecho ? "· subido" : "· falta"}
                          </span>
                        </span>
                        {c.texto === "Plan de partido" && c.href ? (
                          <Link
                            href={c.href}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <ClipboardCheck size={14} className="text-[#C8A96B]" aria-hidden />
                            {partidoActual ? `Abrir el de la ${partidoActual.split(" ")[0]}` : "Abrir el plan"}
                          </Link>
                        ) : null}
                        {onSubirTipo && !c.hecho ? (
                          <button
                            type="button"
                            disabled={subiendo}
                            onClick={() => pideArchivos(c.texto)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3 text-[13px] font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-50"
                          >
                            {subiendo ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <UploadCloud size={14} aria-hidden />}
                            {`Subir ${c.texto === "Convocatoria" ? "la" : "el"} ${c.texto.toLowerCase()}`}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {onSubirTipo ? (
                      <button
                        type="button"
                        disabled={subiendo}
                        onClick={() => pideArchivos(null)}
                        title="JPG · PNG · WEBP · PDF · hasta 20 archivos"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                      >
                        <UploadCloud size={15} className="text-[#C8A96B]" aria-hidden />
                        Otro material
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onGoToCurrentWeek}
                        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C8A96B] px-3.5 text-[13px] font-semibold text-[#0B0F14] transition hover:brightness-110 sm:w-auto"
                      >
                        <UploadCloud size={15} aria-hidden />
                        {`Subir a la ${currentWeek.week.toLowerCase()}`}
                      </button>
                    )}
                    {enlacesRival.map((e) => (
                      <Link
                        key={e.href}
                        href={e.href}
                        className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        {e.texto}
                      </Link>
                    ))}
                  </div>

                  {onSubirTipo ? (
                    <p className="mt-2 text-[12px] text-white/65">JPG · PNG · WEBP · PDF · hasta 20 archivos por subida.</p>
                  ) : null}

                  {!onSubirTipo && actualVacia && ultimaConMaterial ? (
                    <p className="mt-2 text-[12.5px] text-white/65">
                      Último material:{" "}
                      <button
                        type="button"
                        onClick={() => onSelectWeek?.(ultimaConMaterial.id)}
                        className="font-medium text-white/80 underline decoration-white/25 underline-offset-2 hover:text-[#C8A96B]"
                      >
                        {ultimaConMaterial.week.toLowerCase()}
                        {weekRangeLabel(ultimaConMaterial) ? ` (${weekRangeLabel(ultimaConMaterial)})` : ""}
                      </button>
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}

        {!checklist && tiraSemanas.length > 1 && ultimaConMaterial && sinSubir >= 2 && actualVacia ? (
          <div className="mt-3 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#C8A96B]/35 bg-[#C8A96B]/[0.07] px-3.5 py-2.5 text-[13.5px] leading-snug text-white/80">
            <span className="min-w-0 flex-1">
              Sin subidas desde la{" "}
              <button
                type="button"
                onClick={() => onSelectWeek?.(ultimaConMaterial.id)}
                className="font-semibold text-white/90 underline decoration-white/25 underline-offset-2 transition hover:text-[#C8A96B] hover:decoration-[#C8A96B]"
                title="Abre la última semana con material"
              >
                {ultimaConMaterial.week.toLowerCase()}
                {weekRangeLabel(ultimaConMaterial) ? ` (${weekRangeLabel(ultimaConMaterial)})` : ""}
              </button>
              : hace <span className="font-semibold tabular-nums text-white/90">{sinSubir}</span> semanas.
            </span>
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C8A96B] px-3.5 text-[13px] font-semibold text-[#0B0F14] transition hover:brightness-110 sm:w-auto"
            >
              <UploadCloud size={15} aria-hidden />
              {currentWeek ? `Subir a la ${currentWeek.week.toLowerCase()}` : "Subir"}
            </button>
          </div>
        ) : null}

        {tiraSemanas.length > 1 && (
          <>
            {/* 17/11/2026: en el móvil, cuántas semanas quedan a la izquierda (la tira abre en la actual). */}
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/65">
              <span className="font-semibold uppercase tracking-[0.14em] text-white/70">
                Semanas 1 a {tiraSemanas.length}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-[#C8A96B]" /> con material
              </span>
              {/* 20/11/2026 (ronda 5, fútbol y marketing): el circulito de cada casilla, en la leyenda: cuántos archivos tiene. */}
              {/* 20/11/2026 (ronda 7): en el repositorio general la cuenta va dentro de la casilla, debajo del número. */}
              <span className={`items-center gap-1.5 ${general ? "hidden" : "inline-flex"}`}>
                <span
                  aria-hidden
                  className="siempre-oscuro inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums"
                  style={{ background: "#0B0F14", color: "#C8A96B", border: "1px solid #C8A96B" }}
                >
                  3
                </span>
                archivos de la semana
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] border border-white/30" /> sin material
              </span>
              {general ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[3px] border-2 border-[#C8A96B] bg-[#C8A96B]/30" /> esta semana
                </span>
              ) : null}
              {general ? <span className="text-white/60">· debajo del número, cuántos archivos</span> : null}
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
                /* 20/11/2026 (análisis): qué hay dentro, no sólo si hay algo. */
                const contenido = semana.conMaterial
                  ? [
                      semana.imagenes ? (semana.imagenes === 1 ? "1 imagen" : `${semana.imagenes} imágenes`) : "",
                      semana.pdfs ? `${semana.pdfs} PDF` : "",
                    ].filter(Boolean).join(" y ") || "con material"
                  : "sin material";
                const detalle = [semana.nombre, semana.fechas, semana.partido, contenido].filter(Boolean);

                const archivos = (semana.imagenes ?? 0) + (semana.pdfs ?? 0);

                /*
                  CASILLA DEL REPOSITORIO GENERAL (20/11/2026, ronda 7, los tres
                  jueces): 44 px, el número arriba y la cuenta dentro, a 11 px,
                  debajo («3 arch.»; «vacía» si no hay nada), en vez del
                  circulito de 8 px montado encima. La semana en curso, rellena.
                */
                if (general) {
                  return (
                    <button
                      key={semana.id}
                      type="button"
                      data-actual={semana.actual ? "1" : undefined}
                      onClick={() => onSelectWeek?.(semana.id)}
                      title={detalle.join(" · ")}
                      aria-label={detalle.join(", ")}
                      aria-current={semana.actual ? "true" : undefined}
                      className={`relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[8px] leading-none tabular-nums transition hover:scale-105 ${
                        semana.actual
                          ? "border-2 border-[#C8A96B] bg-[#C8A96B]/30 text-white"
                          : semana.conMaterial
                            ? "bg-[#C8A96B] text-[#0B0F14]"
                            : "border border-white/20 bg-white/[0.04] text-white/70"
                      }`}
                    >
                      <span className="text-[14px] font-semibold">{i + 1}</span>
                      <span className={`mt-1 text-[11px] font-medium ${semana.conMaterial && !semana.actual ? "" : "text-white/65"}`}>
                        {semana.conMaterial ? `${archivos || ""} arch.`.trim() : "vacía"}
                      </span>
                      {semana.actual && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -bottom-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C8A96B]"
                        >
                          {partidoActual ? `ahora · ${partidoActual.split(" ")[0]}` : "ahora"}
                        </span>
                      )}
                    </button>
                  );
                }

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
                        {/* 20/11/2026 (ronda 5, marketing): con su jornada, si la hay. */}
                        {partidoActual ? `ahora · ${partidoActual.split(" ")[0]}` : "ahora"}
                      </span>
                    )}
                    {semana.conMaterial && (
                      <span
                        aria-hidden
                        className="siempre-oscuro absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums leading-none"
                        style={{ background: "#0B0F14", color: "#C8A96B", border: "1px solid #C8A96B" }}
                      >
                        {(semana.imagenes ?? 0) + (semana.pdfs ?? 0) || <Check size={9} strokeWidth={3} />}
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

          {/* 20/11/2026: las cifras de la temporada ya van en la línea de estado, de arriba. */}
          {tiraSemanas.length <= 1 && stats.images + stats.pdfs > 0 && (
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
                  {`${stats.pdfs} PDF`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
