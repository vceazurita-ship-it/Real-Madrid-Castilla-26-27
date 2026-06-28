"use client";

import {
  DndContext,
  DragEndEvent,
} from "@dnd-kit/core";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";

import {
  LineupProvider,
  useLineup,
} from "@/context/LineupContext";

function PizarraContent() {
  const { assignPlayer } = useLineup();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    assignPlayer(
      String(over.id),
      String(active.id)
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <main className="min-h-screen bg-[#0B0F14] text-white">

        <div className="flex">

          <Sidebar />

          <section className="flex flex-1 flex-col">

            <Topbar />

            <div className="px-4 pb-8 pt-6 sm:px-8 sm:pb-10">

              {/* HEADER */}

              <div className="mb-8">

                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  RMCF CASTILLA · COMPETICIÓN
                </p>

                <div className="mt-4 flex items-center gap-5">

                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Pizarra táctica
                  </h1>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

                </div>

              </div>

              {/* ESTADÍSTICAS */}

              <TopStats />

              {/* TOOLBAR */}

              <div className="mt-6">
                <FormationToolbar />
              </div>

              {/* ÁREA DE TRABAJO */}

              <div
                className="
                mt-6
                flex
                overflow-hidden
                rounded-[28px]
                border
                border-white/10
                bg-[#11161D]
                shadow-[0_20px_60px_rgba(0,0,0,.35)]
                "
              >

                {/* PLANTILLA */}

                <aside
                  className="
                  hidden
                  w-[360px]
                  shrink-0
                  border-r
                  border-white/10
                  bg-[#11161D]
                  lg:block
                  "
                >
                  <PlayerSidebar />
                </aside>

                {/* CAMPO */}

                <section className="min-w-0 flex-1 bg-[#0F1720]">
                  <FootballPitch />
                </section>

              </div>

            </div>

          </section>

        </div>

      </main>
    </DndContext>
  );
}

export default function PizarraPage() {
  return (
    <LineupProvider>
      <PizarraContent />
    </LineupProvider>
  );
}