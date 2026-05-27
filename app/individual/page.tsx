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

const sampleDetail = {
  strength:
    "Fortaleza principal: jugador con alta capacidad competitiva en escenarios de presión. Destaca por su interpretación del juego y su consistencia en situaciones exigentes.",

  improvement:
    "Aspecto de mejora: aumentar precisión y velocidad de ejecución en acciones de máxima exigencia para elevar impacto competitivo.",

  video1:
    "https://www.youtube.com/watch?v=1-yXp40eG2s",

  video2:
    "https://www.youtube.com/watch?v=EZGx9QR0mrA",
};

const players = [
  // PORTEROS
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

  // DEFENSAS
  {
    name: "A. Moya",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALEJANDRO_MOYA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Sotres",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/SOSTRES_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Calleja",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JAIME_CALLEJA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Álex Pérez",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALEX_PEREZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Óscar Mesa",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/OSCAR_MESA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Eric Gómez",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ERIC_GOMEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Álvaro Lezcano",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO%20LEZCANO_JT11325_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Ariel Ncoghe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ARIEL%20NKOGHE_JT11313_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Melvin Ukpeigbe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MELVIN_DB10242_380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // CENTROCAMPISTAS
  {
    name: "Carlos",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/CARLOS_RODRIGUEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Izan",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/IZAN_REGUEIRA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Joan",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JOAN_MASCARO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Mesonero",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DANIEL_MESONERO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "M. Rezola",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MANEX-REZOLA_AV17806_550x650?$Desktop$&fit=wrap&wid=420",
  },
  {
    name: "Diego Martínez",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/diego_martinez?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Diego Lacosta",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO%20LASCOSTA_JT11305_550X650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Á. Leiva",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_LEIVA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Aimar",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/AIMAR_SANTIAGO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Roberto",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ROBERTO_MARTIN_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // DELANTEROS
  {
    name: "Álvaro Ginés",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GINES_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Jacobo",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JACOBO_ORTEGA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    name: "Arnu",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ARNAU_550x650_FONDO_BLANCO?$Desktop$&fit=wrap&wid=420",
  },
  {
    name: "G. Castrelo",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/GABRIEL_CASTRELO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
];

function CarouselRow({
  title,
  items,
  onSelect,
}: any) {
  const [index, setIndex] = useState(0);

  if (!items.length) return null;

  const canSlide = items.length > VISIBLE_CARDS;

  const visible = canSlide
    ? Array.from({
        length: VISIBLE_CARDS,
      }).map(
        (_, i) =>
          items[(index + i) % items.length]
      )
    : items;

  return (
    <div className="mb-10 md:mb-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-base font-semibold md:text-lg">
          {title}
        </h2>

        <div className="h-px flex-1 bg-white/10" />

        {canSlide && (
          <div className="flex gap-2">
            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v - 1 + items.length) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v + 1) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {visible.map((player: any) => (
          <button
            key={player.name}
            onClick={() => onSelect(player)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center transition hover:bg-white/[0.06]"
          >
            <div className="flex justify-center">
              <img
                src={player.photo}
                alt={player.name}
                className="h-[120px] w-[95px] rounded-xl object-cover object-top"
              />
            </div>

            <div className="mt-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-[#C8A96B]">
                Real Madrid C
              </p>

              <h3 className="mt-2 text-sm font-semibold">
                {player.name}
              </h3>

              <p className="mt-1 text-xs text-gray-400">
                {player.position}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IndividualPage() {
  const [search, setSearch] =
    useState("");

  const [selectedPlayer, setSelectedPlayer] =
    useState<any>(null);

  const filtered = useMemo(() => {
    return players.filter((p) =>
      p.name
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search]);

  const grouped = {
    Porteros: filtered.filter(
      (p) => p.position === "Portero"
    ),
    Defensas: filtered.filter(
      (p) => p.position === "Defensa"
    ),
    Centrocampistas:
      filtered.filter(
        (p) =>
          p.position ===
          "Centrocampista"
      ),
    Delanteros: filtered.filter(
      (p) => p.position === "Delantero"
    ),
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">
      <div className="flex flex-col md:flex-row">
        <Sidebar />

        <section className="flex-1 min-w-0">
          <Topbar />

          <div className="px-4 pb-8 pt-6 md:p-10">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Individual Intelligence
              </p>

              <h1 className="mt-3 text-3xl font-semibold">
                Player Performance Ecosystem
              </h1>
            </div>

            <div className="mb-8 max-w-md">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <Search size={16} />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search player..."
                  className="w-full bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-8">
              <CarouselRow
                title="Porteros"
                items={grouped.Porteros}
                onSelect={
                  setSelectedPlayer
                }
              />

              <CarouselRow
                title="Defensas"
                items={grouped.Defensas}
                onSelect={
                  setSelectedPlayer
                }
              />

              <CarouselRow
                title="Centrocampistas"
                items={
                  grouped.Centrocampistas
                }
                onSelect={
                  setSelectedPlayer
                }
              />

              <CarouselRow
                title="Delanteros"
                items={
                  grouped.Delanteros
                }
                onSelect={
                  setSelectedPlayer
                }
              />
            </div>
          </div>
        </section>
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 overflow-y-auto">
          <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827] p-6 md:p-10">

            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                {selectedPlayer.name}
              </h2>

              <button
                onClick={() =>
                  setSelectedPlayer(null)
                }
              >
                <X />
              </button>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm uppercase tracking-[0.3em] text-[#C8A96B]">
                  Fortaleza principal
                </h3>

                <p className="mb-4 text-gray-300">
                  {
                    selectedPlayer.strength
                  }
                </p>

                <video
                  controls
                  className="w-full rounded-2xl"
                >
                  <source
                    src={
                      selectedPlayer.video1
                    }
                  />
                </video>
              </div>

              <div>
                <h3 className="mb-3 text-sm uppercase tracking-[0.3em] text-[#C8A96B]">
                  Aspecto de mejora
                </h3>

                <p className="mb-4 text-gray-300">
                  {
                    selectedPlayer.improvement
                  }
                </p>

                <video
                  controls
                  className="w-full rounded-2xl"
                >
                  <source
                    src={
                      selectedPlayer.video2
                    }
                  />
                </video>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}