"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { LayoutGrid, Shield, Swords } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import SavedLineups from "@/components/pizarra/SavedLineups";
import BenchStrip from "@/components/pizarra/BenchStrip";
import PhaseBoard from "@/components/pizarra/PhaseBoard";
import FootballPitch from "@/components/pizarra/FootballPitch";
import FormationToolbar from "@/components/pizarra/FormationToolbar";
import PlayerSidebar from "@/components/pizarra/PlayerSidebar";
import TopStats from "@/components/pizarra/TopStats";
import { usePlayers } from "@/hooks/usePlayers";
import { LineupProvider, useLineup } from "@/context/LineupContext";
import {
  AvailabilityProvider,
  useAvailability,
} from "@/context/AvailabilityContext";
import { cn } from "@/lib/utils";

type Tab = "alineacion" | "defensiva" | "ofensiva";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "alineacion", label: "Alineación y banquillo", icon: <LayoutGrid size={15} /> },
  { id: "defensiva", label: "Fase defensiva", icon: <Shield size={15} /> },
  { id: "ofensiva", label: "Fase ofensiva", icon: <Swords size={15} /> },
];

function PizarraContent() {
  const {
    lineup,
    bench,
    assignPlayer,
    removePlayer,
    addToBench,
    removeFromBench,
    loadLineup,
    loadedLineupName,
  } = useLineup();

  const { players } = usePlayers();
  const { bajas, isAvailable, status, localOnly } = useAvailability();

  const [tab, setTab] = useState<Tab>("alineacion");

  // Una baja saca al jugador de la convocatoria, aunque la marque otro
  // miembro del staff desde otro dispositivo.
  useEffect(() => {
    for (const id of Object.keys(bajas)) {
      if (lineup.some((slot) => slot.playerId === id)) removePlayer(id);
      if (bench.includes(id)) removeFromBench(id);
    }
  }, [bajas, lineup, bench, removePlayer, removeFromBench]);

  const [dragPlayer, setDragPlayer] = useState<
    (typeof players)[number] | null
  >(null);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
      .replace("bench-", "")
      .replace("field-", "");

    setDragPlayer(players.find((p) => p.id === id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setDragPlayer(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const playerId = activeId.replace("bench-", "").replace("field-", "");

    // De vuelta a la plantilla: siempre permitido, también para una baja.
    if (overId === "bench") {
      removePlayer(playerId);
      removeFromBench(playerId);
      return;
    }

    // Una baja no entra en la convocatoria por mucho que se arrastre.
    if (!isAvailable(playerId)) return;

    // Al banquillo de la convocatoria
    if (overId === "bench-list") {
      removePlayer(playerId);
      addToBench(playerId);
      return;
    }

    const player = players.find((p) => p.id === playerId);

    if (!player) return;

    assignPlayer(overId, player);
  }

  async function handleLoadLineup(id: number) {
    try {
      /* Por `/api/rivals`, que guarda la respuesta del Apps Script en el
         servidor y ahorra su arranque en frío. Guardar tira esa copia. */
      const res = await fetch(`/api/rivals?action=getAlineacion&id=${id}`);

      const data = await res.json();

      if (!data.success) {
        alert("No se pudo cargar la alineación");
        return;
      }

      loadLineup(
        data.id,
        data.formacion,
        JSON.parse(data.alineacion),
        data.nombre
      );
    } catch (e) {
      console.error(e);
      alert("Error al cargar la alineación");
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragPlayer(null)}
    >
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex">
          <Sidebar />

          <section className="flex min-w-0 flex-1 flex-col">
            <Topbar />

            <div className="px-3 py-4 lg:px-5 xl:px-6">
              {/* CABECERA */}

              <header className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                  RMCF Castilla · Competición
                </p>

                <div className="mt-1 flex items-center gap-3">
                  <h1 className="text-xl font-semibold xl:text-2xl">
                    Pizarra de Competición
                  </h1>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />
                </div>

                <p className="mt-2 max-w-3xl text-sm text-white/50">
                  Alineación y banquillo del partido, más un campograma para la
                  fase defensiva y otro para la ofensiva.
                </p>
              </header>

              {/* PESTAÑAS */}

              <div
                data-export-hide
                className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-[#11161D] p-1.5"
              >
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                      tab === item.id
                        ? "bg-[#C8A96B] text-[#0B0F14]"
                        : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === "alineacion" ? (
                <>
                  {/* AYUDA Y ESTADO DE GUARDADO */}

                  <div
                    data-export-hide
                    className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#11161D] px-3 py-2"
                  >
                    <p className="text-[11px] text-white/45">
                      Arrastra la foto al campo, o pulsa{" "}
                      <span className="font-semibold text-[#C8A96B]">+</span> y
                      luego una posición. Doble clic sobre un jugador lo saca
                      del campo.
                    </p>

                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        localOnly ? "text-amber-300" : "text-white/40"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          localOnly
                            ? "bg-amber-400"
                            : status === "saving"
                            ? "bg-[#C8A96B] animate-pulse"
                            : "bg-emerald-400"
                        )}
                      />

                      {localOnly
                        ? "Disponibilidad sólo en este dispositivo"
                        : status === "saving"
                        ? "Guardando disponibilidad..."
                        : "Disponibilidad compartida con el staff"}
                    </p>
                  </div>

                  <div className="mb-3">
                    <TopStats />
                  </div>

                  <div className="mb-3">
                    <FormationToolbar />
                  </div>

                  <div className="rounded-[30px] border border-[#C8A96B]/20 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-2 shadow-[0_35px_90px_rgba(0,0,0,.55)] xl:p-3">
                    <div className="flex flex-col gap-3 lg:flex-row">
                      {/* SOLO MÓVIL */}
                      <div className="block p-3 lg:hidden">
                        <SavedLineups onLoad={handleLoadLineup} />
                      </div>

                      {/* PLANTILLA */}
                      <aside className="order-3 flex shrink-0 flex-col overflow-hidden lg:order-none lg:h-[calc(100vh-300px)] lg:max-h-[820px] lg:min-h-[520px] lg:w-[260px] xl:w-[280px]">
                        <div className="min-h-0 flex-1 overflow-hidden p-3">
                          <PlayerSidebar />
                        </div>
                      </aside>

                      {/*
                        CAMPO

                        `min-w-0` no es decorativo: un hijo de flex mide por
                        defecto `min-width: auto`, así que el campo —que pide
                        16:9 sobre una altura fija— empujaba la columna hasta
                        139 px fuera de la pantalla y la página entera se
                        arrastraba en horizontal. Con esto el campo se encoge
                        con la columna y comparte alto con la plantilla.
                      */}
                      <section className="order-2 min-w-0 flex-1 lg:order-none">
                        {loadedLineupName && (
                          <div className="mb-3 text-center">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]/70">
                              Alineación cargada
                            </p>

                            <h2 className="text-lg font-semibold text-white">
                              {loadedLineupName}
                            </h2>
                          </div>
                        )}

                        <div className="mx-auto aspect-[9/16] h-auto w-full max-w-[430px] overflow-hidden rounded-[26px] lg:h-[calc(100vh-300px)] lg:max-h-[820px] lg:min-h-[520px] lg:aspect-[16/9] lg:w-full lg:max-w-none">
                          <FootballPitch />
                        </div>
                      </section>
                    </div>

                    {/* BANQUILLO */}
                    <div className="mt-3 px-1">
                      <BenchStrip />
                    </div>
                  </div>

                  {/* SOLO ESCRITORIO */}
                  <div className="mt-4 hidden lg:block">
                    <SavedLineups onLoad={handleLoadLineup} />
                  </div>
                </>
              ) : (
                <div className="rounded-[30px] border border-[#C8A96B]/20 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-2 shadow-[0_35px_90px_rgba(0,0,0,.55)] sm:p-3 xl:p-5">
                  <PhaseBoard
                    key={tab}
                    phase={tab === "defensiva" ? "defensiva" : "ofensiva"}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <DragOverlay>
        {dragPlayer && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dragPlayer.foto}
            alt={dragPlayer.nombre}
            className="h-16 w-16 rounded-full border-4 border-[#C8A96B] shadow-2xl"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default function PizarraPage() {
  return (
    <AvailabilityProvider>
      <LineupProvider>
        <PizarraContent />
      </LineupProvider>
    </AvailabilityProvider>
  );
}
