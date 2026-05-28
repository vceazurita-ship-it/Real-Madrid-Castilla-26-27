"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

const VISIBLE_CARDS = 4;

const DEFAULT_STRENGTH =
  "Buen rendimiento general en acciones clave del juego. Destaca por su capacidad de interpretar situaciones y competir con intensidad.";

const DEFAULT_IMPROVEMENT =
  "Seguir evolucionando en aspectos técnicos y en toma de decisiones en escenarios de máxima presión.";

const DEFAULT_STRENGTH_VIDEO =
  "https://www.youtube.com/embed/ysz5S6PUM-U";

const DEFAULT_IMPROVEMENT_VIDEO =
  "https://www.youtube.com/embed/dQw4w9WgXcQ";

const players = [
  {
    name: "F. Quetglas",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/FERRAN_QUETGLAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Buen juego aéreo y reflejos rápidos en acciones cercanas.",
    improvements:
      "Mejorar precisión en salida con el pie.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

function CarouselRow({
  title,
  items,
  onSelect,
}: any) {
  const [index, setIndex] =
    useState(0);

  if (!items.length) return null;

  const canSlide =
    items.length >
    VISIBLE_CARDS;

  const visible = canSlide
    ? Array.from({
        length: VISIBLE_CARDS,
      }).map(
        (_, i) =>
          items[
            (index + i) %
              items.length
          ]
      )
    : items;

  return (
    <div className="mb-12">
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-lg font-semibold tracking-wide">
          {title}
        </h2>

        <div className="h-px flex-1 bg-white/10" />

        {canSlide && (
          <div className="flex gap-2">
            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v -
                      1 +
                      items.length) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 hover:bg-white/[0.08]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v + 1) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 hover:bg-white/[0.08]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {visible.map(
          (player: any) => (
            <button
              key={player.name}
              onClick={() =>
                onSelect(player)
              }
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center transition hover:bg-white/[0.06]"
            >
              <div className="flex justify-center">
                <img
                  src={
                    player.photo
                  }
                  alt={
                    player.name
                  }
                  loading="lazy"
                  style={{
                    width:
                      "120px",
                    height:
                      "150px",
                    objectFit:
                      "cover",
                    objectPosition:
                      "top",
                    borderRadius:
                      "18px",
                  }}
                />
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#C8A96B]">
                  Real Madrid C
                </p>

                <h3 className="mt-2 text-base font-semibold">
                  {player.name}
                </h3>

                <p className="mt-1 text-sm text-gray-400">
                  {player.position}
                </p>
              </div>
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function IndividualPage() {
  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState<any>(null);

  const [showPopup, setShowPopup] =
    useState(false);

  const filtered =
    useMemo(() => {
      return players.filter(
        (p) =>
          p.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      );
    }, [search]);

  const grouped = {
    Porteros:
      filtered.filter(
        (p) =>
          p.position ===
          "Portero"
      ),
    Defensas:
      filtered.filter(
        (p) =>
          p.position ===
          "Defensa"
      ),
    Centrocampistas:
      filtered.filter(
        (p) =>
          p.position ===
          "Centrocampista"
      ),
    Delanteros:
      filtered.filter(
        (p) =>
          p.position ===
          "Delantero"
      ),
  };

  return (
    <>
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex">
          <Sidebar />

          <section className="flex-1">
            <Topbar />

            <div className="p-10">
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Individual Intelligence
                </p>

                <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                  Player Performance
                  Ecosystem
                </h1>
              </div>

              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="max-w-md flex-1">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <Search className="h-4 w-4 text-gray-400" />

                    <input
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search player..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <button
                  onClick={() =>
                    setShowPopup(true)
                  }
                  className="flex items-center gap-2 rounded-2xl bg-[#C8A96B] px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo popup
                </button>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8">
                <CarouselRow title="Porteros" items={grouped.Porteros} onSelect={setSelected} />
                <CarouselRow title="Defensas" items={grouped.Defensas} onSelect={setSelected} />
                <CarouselRow title="Centrocampistas" items={grouped.Centrocampistas} onSelect={setSelected} />
                <CarouselRow title="Delanteros" items={grouped.Delanteros} onSelect={setSelected} />
              </div>
            </div>
          </section>
        </div>
      </main>

      {selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-6"
            onClick={() =>
              setSelected(null)
            }
          >
            <div
              className="relative w-full max-h-[90vh] max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-[#11161C] p-8 shadow-2xl"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button
                onClick={() =>
                  setSelected(null)
                }
                className="absolute right-5 top-5 rounded-xl p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                <div>
                  <img
                    src={selected.photo}
                    alt={selected.name}
                    className="h-[360px] w-full rounded-2xl object-cover object-top"
                  />

                  <h2 className="mt-5 text-3xl font-semibold">
                    {selected.name}
                  </h2>

                  <p className="mt-2 text-gray-400">
                    {selected.position}
                  </p>
                </div>

                <div className="space-y-10">
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-[#C8A96B]">
                      Fortalezas
                    </h3>

                    <p className="mb-4 leading-relaxed text-gray-300">
                      {selected.strengths ||
                        DEFAULT_STRENGTH}
                    </p>

                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <iframe
                        src={
                          selected.strengthVideo ||
                          DEFAULT_STRENGTH_VIDEO
                        }
                        className="h-[260px] w-full"
                        allowFullScreen
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-[#C8A96B]">
                      Áreas de mejora
                    </h3>

                    <p className="mb-4 leading-relaxed text-gray-300">
                      {selected.improvements ||
                        DEFAULT_IMPROVEMENT}
                    </p>

                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <iframe
                        src={
                          selected.improvementVideo ||
                          DEFAULT_IMPROVEMENT_VIDEO
                        }
                        className="h-[260px] w-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showPopup &&
        createPortal(
          <div
            className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/70 p-6"
            onClick={() =>
              setShowPopup(false)
            }
          >
            <div
              className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#11161C] p-8 shadow-2xl"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button
                onClick={() =>
                  setShowPopup(false)
                }
                className="absolute right-5 top-5 rounded-xl p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>

              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Popup
              </p>

              <h2 className="mt-4 text-3xl font-semibold">
                Tu contenido aquí
              </h2>

              <p className="mt-4 text-gray-300">
                Este popup es independiente del modal del jugador.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}