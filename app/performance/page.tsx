"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import Header from "./components/Header";
import SeasonTimeline from "./components/SeasonTimeLine";
import WeekViewer from "./components/WeekViewer";

import { season, WeekData } from "./data";

export default function PerformancePage() {
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(
    season[0].weeks[0]  
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
  
        <Sidebar />

        <section className="flex-1">

          <Topbar />  

          <div className="px-6 lg:px-10 py-8">     

            <Header />

            <div className="grid gap-8 xl:grid-cols-[430px_1fr]">

              {/* CALENDARIO */}

              <div className="xl:sticky xl:top-24 h-fit">

                <SeasonTimeline
                  selectedWeek={selectedWeek}
                  onSelectWeek={setSelectedWeek}
                />

              </div>

              {/* DETALLE */}

              <WeekViewer week={selectedWeek} />

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}