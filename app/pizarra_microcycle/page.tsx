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

import { useState } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import { usePlayers } from "@/hooks/usePlayers";

import {
  MicroLineupProvider,
  useMicroLineup,
} from "@/context/MicroLineupContext";

import MicroPitch from "@/components/Microciclo/MicroPitch";
import MicroPlayerSidebar from "@/components/Microciclo/MicroPlayerSidebar";

function MicrocycleContent() {
  const { players } = usePlayers();

  const { assignPlayer } = useMicroLineup();

  const [dragPlayer, setDragPlayer] =
    useState<(typeof players)[number] | null>(
      null
    );

  function handleDragStart(
    event: DragStartEvent
  ) {
    const id = String(event.active.id);

    const player = players.find(
      (p) => p.id === id
    );

    setDragPlayer(player ?? null);
  }

  function handleDragEnd(
    event: DragEndEvent
  ) {
    const { active, over } = event;

    setDragPlayer(null);

    if (!over) return;

    assignPlayer(
      String(over.id),
      String(active.id)
    );
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
      onDragEnd={handleDragEnd}
    >
      <main className="min-h-screen bg-[#0B0F14] text-white">

        <div className="flex">

          <Sidebar />

          <section className="flex flex-1 flex-col min-w-0">

            <Topbar />

            <div className="px-4 py-4 lg:px-6">

              {/* Cabecera */}

              <div className="mb-5">

                <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                  RMCF CASTILLA · MICROCICLO
                </p>

                <div className="mt-1 flex items-center gap-3">

                  <h1 className="text-2xl font-semibold">
                    MicroPitch
                  </h1>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />

                </div>

              </div>

              <div
                className="
                  rounded-[30px]
                  border
                  border-[#C8A96B]/20
                  bg-gradient-to-b
                  from-[#151B23]
                  to-[#0E131A]
                  p-3
                  shadow-[0_35px_90px_rgba(0,0,0,.55)]
                "
              >

                <div className="flex flex-col lg:flex-row gap-4">

                  {/* Sidebar */}

                  <aside
                    className="
                      lg:w-[290px]
                      shrink-0
                    "
                  >
                    <MicroPlayerSidebar />
                  </aside>

                  {/* Campo */}

                  <section className="flex-1">

                    <div
                      className="
                        mx-auto
                        aspect-[9/16]
                        w-full
                        max-w-[520px]

                        lg:max-w-none
                        lg:h-[calc(100vh-190px)]
                        lg:aspect-auto
                      "
                    >
                      <MicroPitch />
                    </div>

                  </section>

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

export default function Page() {
  return (
    <MicroLineupProvider>
      <MicrocycleContent />
    </MicroLineupProvider>
  );
}