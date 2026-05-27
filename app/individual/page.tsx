"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

const VISIBLE_CARDS = 4;

const players = [
  {
    name: "F. Quetglas",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/FERRAN_QUETGLAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "D. Arroyo",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO_ARROYO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Á. González",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GONZALEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Javi Navarro",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JAVI_NAVARRO_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
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
                  src={player.photo}
                  alt={player.name}
                  loading="lazy"
                  style={{
                    width: "120px",
                    height: "150px",
                    objectFit: "cover",
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

  const [showTest, setShowTest] =
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
                  Individual
                  Intelligence
                </p>

                <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                  Player
                  Performance
                  Ecosystem
                </h1>
              </div>

              <div className="mb-6">
                <button
                  onClick={() =>
                    setShowTest(true)
                  }
                  className="rounded-2xl bg-[#C8A96B] px-6 py-3 font-semibold text-black"
                >
                  Abrir popup
                  test
                </button>
              </div>

              <div className="mb-8 max-w-md">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Search className="h-4 w-4 text-gray-400" />

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target
                          .value
                      )
                    }
                    placeholder="Search player..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8">
                <CarouselRow
                  title="Porteros"
                  items={
                    grouped.Porteros
                  }
                  onSelect={
                    setSelected
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {showTest && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-6"
          onClick={() =>
            setShowTest(false)
          }
        >
          <div
            className="relative w-full max-w-[500px] rounded-3xl border border-white/10 bg-[#11161C] p-8 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              onClick={() =>
                setShowTest(false)
              }
              className="absolute right-5 top-5 rounded-xl p-2 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-2xl font-semibold">
              Popup funcionando
            </h2>

            <p className="mt-4 text-gray-300">
              Si ves esto
              centrado encima
              de toda la
              página, ya está
              funcionando
              perfecto.
            </p>
          </div>
        </div>
      )}
    </>
  );
}