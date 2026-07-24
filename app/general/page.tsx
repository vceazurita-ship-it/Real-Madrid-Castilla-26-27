"use client";

import { useEffect, useState, useRef } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import Header from "./components/Header";
import SeasonTimeline from "./components/SeasonTimeLine";
import WeekViewer from "./components/WeekViewer";
import GlobalFilesViewer from "./components/GlobalFilesViewer";

import { WeekData, MonthData } from "./data";

import { loadSeason } from "@/lib/loadGeneral";
import { saveSeason } from "@/lib/saveGeneral";

export default function PerformancePage() {
  // Temporada cargada desde Supabase
  const [seasonData, setSeasonData] = useState<MonthData[]>([]);

  // Estado de carga
  const [loading, setLoading] = useState(true);

  // Semana seleccionada
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [globalViewer, setGlobalViewer] = useState<
  "images" | "pdfs" | null
>(null);

const viewerRef = useRef<HTMLDivElement>(null);

  // Cargar temporada al iniciar
  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const data = await loadSeason();

        if (Array.isArray(data)) {
          setSeasonData(data);

          const firstWeek = data
            .flatMap((month) => month.weeks)[0];

          if (firstWeek) {
            setSelectedWeekId(firstWeek.id);
          }
        } else {
          console.error("La temporada recibida no es válida:", data);
        }
      } catch (error) {
        console.error("Error cargando temporada:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeason();
  }, []);

  // Obtener siempre la semana desde seasonData
  const selectedWeek =
    seasonData.length > 0 && selectedWeekId !== null
      ? seasonData
          .flatMap((month) => month.weeks)
          .find((week) => week.id === selectedWeekId) ?? null
      : null;

const allImages = seasonData
  .flatMap((month) =>
    month.weeks.flatMap((week) =>
      week.images.map((image) => ({
        url: image,
        week: week.week,
        month: week.month,
        start: week.start,
        end: week.end,
        weekId: week.id,
      }))
    )
  )
  .sort((a, b) => b.weekId - a.weekId);


const allPdfs = seasonData
  .flatMap((month) =>
    month.weeks.flatMap((week) =>
      (week.pdfs ?? []).map((pdf) => ({
        url: pdf,
        week: week.week,
        month: month.name,
        start: week.start,
        end: week.end,
        weekId: week.id,
      }))
    )
  )
  .sort((a, b) => b.weekId - a.weekId);

  // Actualizar una semana
  const updateWeek = async (updatedWeek: WeekData) => {
    const updatedSeason = seasonData.map((month) => ({
      ...month,
      weeks: month.weeks.map((week) =>
        week.id === updatedWeek.id ? updatedWeek : week
      ),
    }));

    setSeasonData(updatedSeason);

    try {
      await saveSeason(updatedSeason);
    } catch (error) {
      console.error("Error guardando temporada:", error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center">
        <p className="text-lg text-white/60">
          Cargando temporada...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex-1">
          <Topbar />

          <div className="px-6 py-8 lg:px-10">
            <Header
  season={seasonData}
  selectedWeek={selectedWeek}
  onOpenImages={() => setGlobalViewer("images")}
  onOpenPdfs={() => setGlobalViewer("pdfs")}
/>

            <div className="grid gap-8 xl:grid-cols-[430px_1fr]">
              {/* TIMELINE */}

              <div className="h-fit xl:sticky xl:top-24">
                <SeasonTimeline
  season={seasonData}
  selectedWeek={selectedWeek}
  onSelectWeek={(week) => {
    setSelectedWeekId(week.id);

    setTimeout(() => {
      viewerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }}
/>
              </div>
 
              {/* VISOR */}
<div ref={viewerRef}>

              <WeekViewer
                week={selectedWeek}
                updateWeek={updateWeek}
              />
              </div>
            </div>
          </div>
        </section>
      </div>

      {globalViewer && (
        <GlobalFilesViewer
          type={globalViewer}
          files={
            globalViewer === "images"
              ? allImages
              : allPdfs
          }
          onClose={() => setGlobalViewer(null)}
        />
      )}

    </main>
  );
}   
