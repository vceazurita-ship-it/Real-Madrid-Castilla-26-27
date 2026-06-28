"use client";

import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";
import { LineupProvider } from "@/context/LineupContext";

export default function PizarraPage() {
  return (
    <LineupProvider>

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

    </LineupProvider>
  );
}