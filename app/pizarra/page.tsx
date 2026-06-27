"use client";

import FootballPitch from "@/components/pizarra/FootballPitch";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar"; 
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import TopStats from "@/components/pizarra/TopStats";

export default function PizarraPage() {
  return (
    <main className="flex h-screen flex-col bg-zinc-950">

      <TopStats />

      <FormationToolbar />

      <div className="flex flex-1 overflow-hidden">

        <aside className="w-[360px] border-r border-white/10 bg-zinc-900">
          <PlayerSidebar />
        </aside>

        <section className="flex-1 overflow-hidden bg-zinc-950">
          <FootballPitch />
        </section>

      </div>

    </main>
  );
}