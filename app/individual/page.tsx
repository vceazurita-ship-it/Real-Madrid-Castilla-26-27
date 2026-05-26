"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

const VISIBLE_CARDS = 4;

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
}: any) {
  const [index, setIndex] =
    useState(0);

  if (!items.length) return null;

  const canSlide =
    items.length >
    VISIBLE_CARDS;

  const visible = canSlide
    ? Array.from({
        length:
          VISIBLE_CARDS,
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
            <div
              key={player.name}
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
                  {
                    player.name
                  }
                </h3>

                <p className="mt-1 text-sm text-gray-400">
                  {
                    player.position
                  }
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function IndividualPage() {
  const [search, setSearch] =
    useState("");

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

            <div className="mb-8 max-w-md">
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

            <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8">
              <CarouselRow
                title="Porteros"
                items={
                  grouped.Porteros
                }
              />

              <CarouselRow
                title="Defensas"
                items={
                  grouped.Defensas
                }
              />

              <CarouselRow
                title="Centrocampistas"
                items={
                  grouped.Centrocampistas
                }
              />

              <CarouselRow
                title="Delanteros"
                items={
                  grouped.Delanteros
                }
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}