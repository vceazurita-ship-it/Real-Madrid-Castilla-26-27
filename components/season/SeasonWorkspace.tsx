"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ListFilter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { loadSeasonData, saveSeasonData } from "@/lib/season/api";
import { FileKind, MonthData, SeasonArea, WeekData } from "@/lib/season/types";
import {
  collectFiles,
  findWeekForDate,
  flattenWeeks,
  seasonStats,
} from "@/lib/season/utils";
import SeasonFilesViewer from "./SeasonFilesViewer";
import SeasonHeader from "./SeasonHeader";
import WeekNavigator from "./WeekNavigator";
import WeekPanel from "./WeekPanel";

interface Props {
  area: SeasonArea;
}

export default function SeasonWorkspace({ area }: Props) {
  const [season, setSeason] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const stats = useMemo(() => seasonStats(season), [season]);

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

  /** Guarda la semana de forma optimista y revierte si el servidor falla. */
  const updateWeek = useCallback(
    async (updatedWeek: WeekData) => {
      const previous = season;

      const next = season.map((month) => ({
        ...month,
        weeks: month.weeks.map((week) =>
          week.id === updatedWeek.id ? updatedWeek : week
        ),
      }));

      setSeason(next);
      setSaving(true);

      try {
        await saveSeasonData(area, next);
      } catch (error) {
        console.error(error);
        setSeason(previous);

        toast.error(
          "No se pudieron guardar los cambios. Se ha restaurado el estado anterior."
        );

        throw error;
      } finally {
        setSaving(false);
      }
    },
    [area, season]
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <Topbar />

          <div className="px-5 py-8 sm:px-6 lg:px-10">
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
                  saving={saving}
                  onGoToCurrentWeek={() =>
                    currentWeek && selectWeek(currentWeek.id)
                  }
                  onOpenImages={() => setFilesViewer("images")}
                  onOpenPdfs={() => setFilesViewer("pdfs")}
                  onReload={() => reloadSeason({ keepSelection: true })}
                />

                {/* SELECTOR EN MÓVIL */}

                <button
                  type="button"
                  onClick={() => setNavOpen((value) => !value)}
                  aria-expanded={navOpen}
                  className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3 text-left xl:hidden"
                >
                  <span className="min-w-0">
                    <span className="block text-xs uppercase tracking-wider text-white/40">
                      Semana
                    </span>

                    <span className="block truncate font-medium">
                      {selectedWeek?.week ?? "Selecciona una semana"}
                    </span>
                  </span>

                  <span className="inline-flex shrink-0 items-center gap-2 text-sm text-[#C8A96B]">
                    <ListFilter size={16} />
                    {navOpen ? "Ocultar" : "Cambiar"}
                  </span>
                </button>

                <div className="grid items-start gap-6 xl:grid-cols-[380px_1fr]">
                  <div
                    className={`${
                      navOpen ? "block" : "hidden"
                    } xl:sticky xl:top-6 xl:block`}
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
