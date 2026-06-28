"use client";

import {
  DndContext,
  DragEndEvent,
} from "@dnd-kit/core";

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

      <main className="flex h-screen flex-col overflow-hidden bg-zinc-950">

        <TopStats />

        <FormationToolbar />

        <div className="flex flex-1 overflow-hidden">

          <aside className="hidden w-[360px] shrink-0 border-r border-white/10 bg-zinc-900 lg:block">
            <PlayerSidebar />
          </aside>

          <section className="min-w-0 flex-1 bg-zinc-950">
            <FootballPitch />
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