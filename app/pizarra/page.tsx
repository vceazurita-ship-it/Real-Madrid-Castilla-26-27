"use client";

import {
  DndContext,
  DragEndEvent,
} from "@dnd-kit/core";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import SavedLineups from "@/components/pizarra/SavedLineups";

import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";

import {
  LineupProvider,
  useLineup,
} from "@/context/LineupContext";

function PizarraContent() {
  const {
  assignPlayer,
  loadLineup,
} = useLineup();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    assignPlayer(
      String(over.id),
      String(active.id)
    );
  }
async function handleLoadLineup(id: number) {
  try {
    const res = await fetch(
      `https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=getAlineacion&id=${id}`
    );

    const data = await res.json();

    console.log(data);

    if (!data.success) {
      alert("No se pudo cargar la alineación");
      return;
    }

    loadLineup(
      data.Sistema,
      JSON.parse(data.Alineacion)
    );

  } catch (e) {
    console.error(e);
    alert("Error al cargar la alineación");
  }
}

  return (
    <DndContext onDragEnd={handleDragEnd}>

      <main className="min-h-screen bg-[#0B0F14] text-white">

        <div className="flex">

          <Sidebar />

          <section className="flex min-w-0 flex-1 flex-col">

            <Topbar />

            <div className="px-3 py-3 lg:px-5 xl:px-6">

              {/* CABECERA */}

<div className="mb-3">

  <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
    RMCF CASTILLA · COMPETICIÓN
  </p>

  <div className="mt-1 flex items-center gap-3">

    <h1 className="text-xl font-semibold xl:text-2xl">
      Pizarra táctica
    </h1>

    <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />

  </div>

</div>

              {/* ESTADÍSTICAS */}

              <div className="mb-3">
                <TopStats />
              </div>

              {/* BARRA SUPERIOR */}

              <div className="mb-3">
                <FormationToolbar />
              </div>

              {/* CONTENEDOR */}

              <div
                className="
                  rounded-[30px]
                  border
                  border-[#C8A96B]/20
                  bg-gradient-to-b
                  from-[#151B23]
                  to-[#0E131A]
                  p-2 xl:p-3
                  shadow-[0_35px_90px_rgba(0,0,0,.55)]
                "
              >

                <div className="flex flex-col gap-3 lg:flex-row">

                  {/* SIDEBAR */}

                  <aside
                    className="
                      lg:w-[260px]
                      xl:w-[280px]
                      shrink-0
                      rounded-2xl
                      border
                      border-[#C8A96B]/15
                      bg-[#11161D]/80
                      backdrop-blur-xl
                      overflow-hidden
                    "
                  >
                    <div className="flex h-full flex-col gap-3 p-3">

  <PlayerSidebar />

  <SavedLineups
    onLoad={handleLoadLineup}
  />

</div>
                  </aside>

                  {/* CAMPO */}

                  <section className="flex-1">

                    <div
  className="
    mx-auto
    w-full
    aspect-[16/9]
    h-[calc(100vh-235px)]
    max-h-[820px]
    min-h-[520px]
    overflow-hidden
    rounded-[26px]
  "
>
                      <FootballPitch />
                    </div>

                  </section>

                </div>

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