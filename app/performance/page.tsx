"use client";

import { useEffect, useState } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import Header from "./components/Header";
import SeasonTimeline from "./components/SeasonTimeLine";
import WeekViewer from "./components/WeekViewer";

import { WeekData, MonthData } from "./data";

import { loadSeason } from "@/lib/loadSeason";
import { saveSeason } from "@/lib/saveSeason";

export default function PerformancePage() {
  // Temporada cargada desde Supabase
  const [seasonData, setSeasonData] = useState<MonthData[]>([]);

  // Estado de carga
  const [loading, setLoading] = useState(true);

  // Semana seleccionada
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);

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
            <Header />

            <div className="grid gap-8 xl:grid-cols-[430px_1fr]">
              {/* TIMELINE */}

              <div className="h-fit xl:sticky xl:top-24">
                <SeasonTimeline
                  season={seasonData}
                  selectedWeek={selectedWeek}
                  onSelectWeek={(week) =>
                    setSelectedWeekId(week.id)
                  }
                />
              </div>
 
              {/* VISOR */}

              <WeekViewer
                week={selectedWeek}
                updateWeek={updateWeek}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}