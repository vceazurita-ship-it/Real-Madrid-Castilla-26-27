"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, FileText, ImageIcon, ListFilter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { loadSeasonData, saveWeekChange } from "@/lib/season/api";
import {
  aplicaCambio,
  CambioSemana,
  inverso,
  poneSemana,
} from "@/lib/season/fusion";
import { FileKind, MonthData, SeasonArea, SeasonFile } from "@/lib/season/types";
import {
  collectFiles,
  findWeekForDate,
  flattenWeeks,
  humanFileName,
  rangoFechas,
  seasonStats,
  weekHasFiles,
  weekRangeLabel,
} from "@/lib/season/utils";
import SeasonFilesViewer from "./SeasonFilesViewer";
import SeasonHeader from "./SeasonHeader";
import WeekNavigator from "./WeekNavigator";
import WeekPanel from "./WeekPanel";
import { useCalendario } from "@/hooks/useCalendario";
import { partidoDeLaSemana, rotuloPartido } from "@/lib/season/partido-semana";

interface Props {
  area: SeasonArea;
}

export default function SeasonWorkspace({ area }: Props) {
  const [season, setSeason] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Un contador y no un sí/no: con una subida y un borrado a la vez, el primero
  // en terminar apagaba «Guardando» mientras el otro seguía en camino.
  const [savingCount, setSavingCount] = useState(0);
  const saving = savingCount > 0;
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [filesViewer, setFilesViewer] = useState<FileKind | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  const fetchSeason = useCallback(
    async (options: { keepSelection?: boolean } = {}) => {
      try {
        const data = await loadSeasonData(area);

        setSeason(data);
        setLoadError(false);

        if (!options.keepSelection) {
          const weeks = flattenWeeks(data);
          const current = findWeekForDate(data) ?? weeks[0] ?? null;

          /* Se abre la semana en curso aunque esté vacía (21/10/2026): abrir
             otra distinta escondía que a esta le falta el material. La cabecera
             dice qué subir y el panel ofrece la última semana con archivos. */
          setSelectedWeekId(current?.id ?? null);
        }
      } catch (error) {
        console.error(error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [area]
  );

  /** Recarga manual: muestra el esqueleto mientras llegan los datos. */
  const reloadSeason = useCallback(
    (options: { keepSelection?: boolean } = {}) => {
      setLoading(true);
      void fetchSeason(options);
    },
    [fetchSeason]
  );

  useEffect(() => {
    // Los `setState` de `fetchSeason` ocurren tras el `await`, nunca de forma
    // síncrona dentro del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSeason();
  }, [fetchSeason]);

  const currentWeek = useMemo(() => findWeekForDate(season), [season]);

  const selectedWeek = useMemo(
    () =>
      selectedWeekId === null
        ? null
        : flattenWeeks(season).find((week) => week.id === selectedWeekId) ??
          null,
    [season, selectedWeekId]
  );

  // Para el hueco vacío de una semana sin archivos: la más cercana anterior
  // que sí los tiene.
  const ultimaConArchivos = useMemo(() => {
    if (!selectedWeek) return null;

    const previas = flattenWeeks(season)
      .filter((week) => week.id < selectedWeek.id && weekHasFiles(week))
      .sort((a, b) => b.id - a.id);

    return previas[0] ?? null;
  }, [season, selectedWeek]);

  // Para la cabecera de la semana en curso: la última anterior con material.
  const ultimaConMaterial = useMemo(() => {
    if (!currentWeek) return null;

    return (
      flattenWeeks(season)
        .filter((week) => week.id < currentWeek.id && weekHasFiles(week))
        .sort((a, b) => b.id - a.id)[0] ?? null
    );
  }, [season, currentWeek]);

  const semanasCon = useMemo(() => {
    const semanas = flattenWeeks(season);

    return {
      images: semanas.filter((week) => (week.images?.length ?? 0) > 0).length,
      pdfs: semanas.filter((week) => (week.pdfs?.length ?? 0) > 0).length,
    };
  }, [season]);

  /* 17/11/2026 (fútbol): el calendario de BeSoccer, para decir el partido de cada semana. */
  const { partidos: calendario } = useCalendario();

  // Una casilla por semana ya transcurrida: con material o sin él.
  const tiraSemanas = useMemo(() => {
    if (!currentWeek) return [];

    return flattenWeeks(season)
      .filter((week) => week.id <= currentWeek.id)
      .map((week) => {
        const partido = partidoDeLaSemana(calendario, week);

        return {
          id: week.id,
          nombre: week.week,
          conMaterial: weekHasFiles(week),
          actual: week.id === currentWeek.id,
          fechas: week.start || week.end ? weekRangeLabel(week) : undefined,
          partido: partido ? rotuloPartido(partido) : undefined,
          imagenes: week.images?.length ?? 0,
          pdfs: week.pdfs?.length ?? 0,
        };
      });
  }, [season, currentWeek, calendario]);

  /* 20/11/2026 (ronda 4, los tres jueces): las semanas que sí tienen material,
     de la más reciente a la más antigua, para «Otras semanas». */
  const semanasConMaterial = useMemo(
    () => [...tiraSemanas].filter((s) => s.conMaterial).reverse(),
    [tiraSemanas]
  );

  const partidoSemanaAbierta = useMemo(
    () => partidoDeLaSemana(calendario, selectedWeek),
    [calendario, selectedWeek]
  );

  const stats = useMemo(
    () => seasonStats(season, currentWeek?.id ?? null),
    [season, currentWeek]
  );

  const allImages = useMemo(() => collectFiles(season, "images"), [season]);
  const allPdfs = useMemo(() => collectFiles(season, "pdfs"), [season]);

  const selectWeek = useCallback(
    (weekId: number, options: { scroll?: boolean } = {}) => {
      setSelectedWeekId(weekId);
      setNavOpen(false);

      if (options.scroll !== false) {
        // Esperamos al render del panel antes de desplazarnos.
        requestAnimationFrame(() => {
          if (window.matchMedia("(min-width: 1280px)").matches) return;

          panelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    },
    []
  );

  /*
  | Guarda UN cambio de semana de forma optimista (19/10/2026).
  |
  | Antes se mandaba la temporada entera tal como la veía esta pestaña, y se
  | revertía a una foto completa si fallaba: con dos personas a la vez la
  | segunda borraba lo de la primera, y una reversión se llevaba también
  | cualquier otro cambio hecho mientras tanto. Ahora viaja sólo el cambio, el
  | servidor lo aplica sobre lo último guardado y devuelve cómo ha quedado la
  | semana (con lo que otros hayan subido); si falla, se deshace sólo ese
  | cambio. Todo con actualizaciones funcionales: dos subidas seguidas no se
  | pisan por leer `season` de un render anterior.
  */
  const updateWeek = useCallback(
    async (cambio: CambioSemana) => {
      const aplica = (meses: MonthData[], c: CambioSemana) =>
        (aplicaCambio(meses, c)?.raw as MonthData[] | undefined) ?? meses;

      setSeason((meses) => aplica(meses, cambio));
      setSavingCount((n) => n + 1);

      try {
        const semana = await saveWeekChange(area, cambio);

        setSeason((meses) => poneSemana(meses, semana));
      } catch (error) {
        console.error(error);
        setSeason((meses) => aplica(meses, inverso(cambio)));

        toast.error("No se ha podido guardar y se ha deshecho el cambio.", {
          description:
            error instanceof Error && error.message ? error.message : undefined,
        });

        throw error;
      } finally {
        setSavingCount((n) => n - 1);
      }
    },
    [area]
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <Topbar />

          {/* Margen a la derecha para el botón flotante de herramientas (30/10/2026):
              tapaba la esquina de «PDFs de la temporada» y de «Lo último subido». */}
          <div className="py-8 pl-5 pr-12 sm:pl-6 sm:pr-[76px] lg:pl-10">

            {loading ? (
              <LoadingState />
            ) : loadError ? (
              <ErrorState onRetry={() => reloadSeason()} />
            ) : (
              <>
                <SeasonHeader
                  area={area}
                  stats={stats}
                  currentWeek={currentWeek}
                  ultimaConMaterial={ultimaConMaterial}
                  semanasCon={semanasCon}
                  tiraSemanas={tiraSemanas}
                  onSelectWeek={(id) => selectWeek(id)}
                  saving={saving}
                  onGoToCurrentWeek={() => {
                    if (!currentWeek) return;

                    /*
                    | «Subir a la semana 18» lleva a la zona de subida y deja
                    | el foco en «Seleccionar archivos» (30/10/2026): antes
                    | sólo elegía la semana y había tres maneras de subir sin
                    | que ninguna llevara a las otras.
                    */
                    if (!weekHasFiles(currentWeek)) {
                      selectWeek(currentWeek.id, { scroll: false });

                      setTimeout(() => {
                        const zona = document.getElementById("zona-subida");

                        zona?.scrollIntoView({ behavior: "smooth", block: "center" });
                        zona?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
                      }, 60);

                      return;
                    }

                    selectWeek(currentWeek.id);
                  }}
                  onOpenImages={() => setFilesViewer("images")}
                  onOpenPdfs={() => setFilesViewer("pdfs")}
                  onReload={() => reloadSeason({ keepSelection: true })}
                />

                {/*
                | LA LISTA DE SEMANAS, PLEGADA (10/11/2026, análisis y marketing):
                | la tira de arriba ya lleva a cada semana pasada y la semana
                | abierta va al lado; la lista por meses repetía lo mismo. Se
                | despliega para buscar una semana futura o por fecha.
                */}

                {/*
                | LO ÚLTIMO SUBIDO, A LA VISTA (20/11/2026, ronda 4, fútbol y
                | marketing): la pantalla abría con una fila de números; ahora
                | lo primero es el material —las últimas imágenes en miniatura y
                | los últimos PDF con su nombre—, y cada uno abre su semana.
                */}
                <UltimoSubido
                  imagenes={allImages}
                  pdfs={allPdfs}
                  onSelectWeek={(id) => selectWeek(id)}
                />

                {/*
                | OTRAS SEMANAS (20/11/2026, análisis): las que tienen material,
                | como tarjetas con su partido y lo que hay dentro; la lista
                | completa por meses sigue a un toque, para una semana sin nada.
                */}
                <div className="mb-4 rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium text-white/75">
                      Otras semanas
                    </span>

                    <button
                      type="button"
                      onClick={() => setNavOpen((value) => !value)}
                      aria-expanded={navOpen}
                      className="inline-flex min-h-9 shrink-0 items-center gap-2 text-sm text-[#C8A96B]"
                    >
                      <ListFilter size={16} />
                      {navOpen ? "Ocultar la lista" : "Todas, por meses"}
                    </button>
                  </div>

                  {semanasConMaterial.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {semanasConMaterial.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectWeek(s.id)}
                          aria-current={s.id === selectedWeekId ? "true" : undefined}
                          className={`min-w-0 rounded-xl border px-3 py-2 text-left transition hover:border-[#C8A96B]/60 hover:bg-white/[0.04] ${
                            s.id === selectedWeekId ? "border-[#C8A96B]/70 bg-[#C8A96B]/[0.08]" : "border-white/10"
                          }`}
                        >
                          <span className="block text-[13.5px] font-semibold text-white/90">
                            {s.nombre}
                            {s.fechas ? <span className="font-normal text-white/60"> · {s.fechas}</span> : null}
                          </span>
                          {s.partido ? (
                            <span className="block truncate text-[12px] text-white/70">{s.partido}</span>
                          ) : null}
                          <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-white/70">
                            {s.imagenes ? (
                              <span className="inline-flex items-center gap-1">
                                <ImageIcon size={12} className="text-[#C8A96B]" aria-hidden />
                                {s.imagenes === 1 ? "1 imagen" : `${s.imagenes} imágenes`}
                              </span>
                            ) : null}
                            {s.pdfs ? (
                              <span className="inline-flex items-center gap-1">
                                <FileText size={12} className="text-[#C8A96B]" aria-hidden />
                                {`${s.pdfs} PDF`}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={`grid items-start gap-6 ${navOpen ? "xl:grid-cols-[380px_1fr]" : ""}`}>
                  <div
                    className={`${
                      navOpen ? "block" : "hidden"
                    } xl:sticky xl:top-6`}
                  >
                    <WeekNavigator
                      season={season}
                      selectedWeekId={selectedWeekId}
                      currentWeekId={currentWeek?.id ?? null}
                      onSelectWeek={(week) => selectWeek(week.id)}
                    />
                  </div>

                  <div ref={panelRef} className="scroll-mt-6 min-w-0">
                    <WeekPanel
                      area={area}
                      week={selectedWeek}
                      isCurrentWeek={
                        selectedWeek !== null &&
                        selectedWeek.id === currentWeek?.id
                      }
                      ultimaConArchivos={ultimaConArchivos}
                      partido={partidoSemanaAbierta}
                      onSelectWeek={selectWeek}
                      onUpdateWeek={updateWeek}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {filesViewer && (
        <SeasonFilesViewer
          kind={filesViewer}
          files={filesViewer === "images" ? allImages : allPdfs}
          onClose={() => setFilesViewer(null)}
          onSelectWeek={(weekId) => selectWeek(weekId)}
        />
      )}
    </main>
  );
}

/** Las últimas imágenes y PDF de la temporada, cada uno abre su semana. */
function UltimoSubido({
  imagenes,
  pdfs,
  onSelectWeek,
}: {
  imagenes: SeasonFile[];
  pdfs: SeasonFile[];
  onSelectWeek: (weekId: number) => void;
}) {
  const ultimos = [...imagenes, ...pdfs]
    .sort((a, b) => b.weekId - a.weekId || (a.kind === b.kind ? 0 : a.kind === "images" ? -1 : 1))
    .slice(0, 6);

  if (!ultimos.length) return null;

  return (
    <section aria-label="Lo último subido" className="mb-6">
      <h2 className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
        Lo último subido
      </h2>

      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {ultimos.map((f, i) => {
          const nombre = humanFileName(f.url, f.kind === "images" ? `Imagen ${i + 1}` : "Documento");

          return (
            <button
              key={`${f.url}-${i}`}
              type="button"
              onClick={() => onSelectWeek(f.weekId)}
              title={`${nombre} · ${f.week}${rangoFechas(f.start, f.end) ? ` (${rangoFechas(f.start, f.end)})` : ""}`}
              className="group w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#11161D] text-left transition hover:border-[#C8A96B]/60 sm:w-[170px]"
            >
              <span className="relative block aspect-[4/3] bg-[#0B0F14]">
                {f.kind === "images" ? (
                  <Image
                    src={f.url}
                    alt={nombre}
                    fill
                    sizes="170px"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
                    <FileText size={30} className="text-[#C8A96B]" aria-hidden />
                    <span className="line-clamp-2 text-[12px] font-medium leading-tight text-white/80">{nombre}</span>
                  </span>
                )}
              </span>
              <span className="block px-2.5 py-1.5">
                <span className="block text-[12.5px] font-semibold text-white/90">{f.week}</span>
                {rangoFechas(f.start, f.end) ? <span className="block text-[11.5px] text-white/60">{rangoFechas(f.start, f.end)}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="h-8 w-64 animate-pulse rounded-xl bg-white/5" />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#11161D]"
          />
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-[#11161D]" />
        <div className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-[#11161D]" />
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/40">
        <Loader2 size={15} className="animate-spin" />
        Cargando temporada...
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-[#11161D] px-6 py-20 text-center">
      <AlertTriangle size={40} className="text-red-400" />

      <h2 className="mt-5 text-xl font-semibold">
        No se pudo cargar la temporada
      </h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">
        Revisa la conexión e inténtalo de nuevo. Si el problema continúa, avisa
        al equipo técnico.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
      >
        Reintentar
      </button>
    </div>
  );
}
