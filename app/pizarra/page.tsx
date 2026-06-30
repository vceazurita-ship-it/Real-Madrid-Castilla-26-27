"use client";

import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import SavedLineups from "@/components/pizarra/SavedLineups";

import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";
import { useState } from "react";
import { usePlayers } from "@/hooks/usePlayers";
import {
  LineupProvider,
  useLineup,
} from "@/context/LineupContext";

function PizarraContent() {
  const {
  assignPlayer,
  loadLineup,
} = useLineup();

const { players } = usePlayers();

const [dragPlayer, setDragPlayer] = useState<
  (typeof players)[number] | null
>(null);
function handleDragStart(event: DragStartEvent) {
  const id = String(event.active.id)
    .replace("bench-", "")
    .replace("field-", "");

  const player = players.find(
    (p) => p.id === id
  );

  setDragPlayer(player ?? null);
}
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over) return;

  const activeId = String(active.id);
  const positionId = String(over.id);

  // Desde el banquillo
  if (activeId.startsWith("bench-")) {
    assignPlayer(
      positionId,
      activeId.replace("bench-", "")
    );
  }

  // Desde el campo
  else {
    assignPlayer(
      positionId,
      activeId
    );
  }
}
async function handleLoadLineup(id: number) {
  try {
    const res = await fetch(
      `https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=getAlineacion&id=${id}`
    );

    const data = await res.json();

    console.log(data);
console.log(data.formacion);
console.log(data.alineacion);

    if (!data.success) {
      alert("No se pudo cargar la alineación");
      return;
    }

    loadLineup(
      data.formacion,
      JSON.parse(data.alineacion)
    );

  } catch (e) {
    console.error(e);
    alert("Error al cargar la alineación");
  }
}
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  })
);
  return (
    
    <DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragEnd={(event) => {
    handleDragEnd(event);
    setDragPlayer(null);
  }}
>

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

                <div className="flex flex-col lg:flex-row gap-3">

    {/* SOLO MÓVIL */}
    <div className="block lg:hidden p-3">
        <SavedLineups onLoad={handleLoadLineup}/>
    </div>

  {/* IZQUIERDA EN PC */}
<aside
  className="
    order-3
    lg:order-none

    lg:w-[260px]
    xl:w-[280px]
    shrink-0

    flex
    flex-col

    lg:h-[calc(100vh-235px)]
    lg:max-h-[820px]
    lg:min-h-[520px]

    overflow-hidden
  "
>
    {/* JUGADORES */}
    <div className="flex-1 min-h-0 overflow-hidden p-3">
    <PlayerSidebar />
</div>

</aside>

  {/* CAMPO */}
  <section
className="
order-2
lg:order-none
flex-1">

    <div
      className="
        mx-auto
        overflow-hidden
        rounded-[26px]

        w-full
        aspect-[9/16]
        max-w-[430px]
        h-auto

        lg:max-w-none
        lg:w-full
        lg:aspect-[16/9]
        lg:h-[calc(100vh-235px)]
        lg:max-h-[820px]
        lg:min-h-[520px]
      "
    >
      <FootballPitch />
    </div>

  </section>
</div>

  {/* SOLO ESCRITORIO jugadores */}
{/* SOLO ESCRITORIO */}
<div className="hidden lg:block mt-4">
    <SavedLineups onLoad={handleLoadLineup} />
</div>
              </div>

            </div>

          </section>

        </div>

      </main>
<DragOverlay>

  {dragPlayer && (

    <img
      src={dragPlayer.foto}
      alt={dragPlayer.nombre}
      className="
        h-16
        w-16
        rounded-full
        border-4
        border-[#C8A96B]
        shadow-2xl
      "
    />

  )}

</DragOverlay>
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