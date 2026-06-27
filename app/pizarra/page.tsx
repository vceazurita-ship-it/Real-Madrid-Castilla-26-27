"use client";

import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";

export default function PizarraPage() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-950">

      {/* Estadísticas */}
      <TopStats />

      {/* Barra de herramientas */}
      <FormationToolbar />

      {/* Contenido */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel izquierdo */}
        <aside
          className="
            hidden
            w-[360px]
            shrink-0
            border-r
            border-white/10
            bg-zinc-900
            lg:block
          "
        >
          <PlayerSidebar />
        </aside>

        {/* Campo */}
        <section className="min-w-0 flex-1 bg-zinc-950">
          <FootballPitch />
        </section>

      </div>

    </main>
  );
}