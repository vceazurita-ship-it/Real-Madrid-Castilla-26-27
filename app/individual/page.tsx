"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

const VISIBLE_CARDS = 4;

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=787003064&single=true&output=csv";

const DEFAULT_STRENGTH =
  "Buen rendimiento general en acciones clave del juego. Destaca por su capacidad de interpretar situaciones y competir con intensidad.";

const DEFAULT_IMPROVEMENT =
  "Seguir evolucionando en aspectos técnicos y en toma de decisiones en escenarios de máxima presión.";

const DEFAULT_STRENGTH_VIDEO =
  "https://www.youtube.com/embed/ysz5S6PUM-U";

const DEFAULT_IMPROVEMENT_VIDEO =
  "https://www.youtube.com/embed/ysz5S6PU";

type Player = {
  name: string;
  position: string;
  photo: string;
  strengths?: string;
  improvements?: string;
  strengthVideo?: string;
  improvementVideo?: string;
};

const players: Player[] = [
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

function normalize(text = "") {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !inQuotes
    ) {
      if (value || row.length) {
        row.push(value.trim());
        rows.push(row);
        row = [];
        value = "";
      }

      if (char === "\r" && next === "\n") {
        i++;
      }
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  const headers = rows[0] || [];

  return rows.slice(1).map((r) =>
    headers.reduce(
      (obj: Record<string, string>, h, i) => {
        obj[h.trim()] = (r[i] || "").trim();
        return obj;
      },
      {}
    )
  );
}
function driveViewUrl(url = "") {
  return url.replace("/preview", "/view");
}
function driveVideoUrl(url = "") {
  return url;
}
function CarouselRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Player[];
  onSelect: (p: Player) => void;
}) {
  const [index, setIndex] = useState(0);

  if (!items.length) return null;

  const canSlide = items.length > VISIBLE_CARDS;

  const visible = canSlide
    ? Array.from({
        length: VISIBLE_CARDS,
      }).map(
        (_, i) =>
          items[
            (index + i) % items.length
          ]
      )
    : items;

  return (
    <div className="mb-12">
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-lg font-semibold">
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
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {visible.map((player) => (
          <button
            key={player.name}
            onClick={() =>
              onSelect(player)
            }
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:p-5 text-center"
          >
            <div className="flex justify-center">
              <img
                src={player.photo}
                alt={player.name}
                className="h-[120px] w-[90px] sm:h-[140px] sm:w-[110px] lg:h-[150px] lg:w-[120px] rounded-2xl object-cover object-top"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold">
              {player.name}
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              {player.position}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IndividualPage() {
  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState<Player | null>(null);

  const [sheetData, setSheetData] =
    useState<any[]>([]);

  useEffect(() => {
    fetch(SHEET_URL)
      .then((res) => res.text())
      .then((csv) =>
        setSheetData(parseCSV(csv))
      )
      .catch(console.error);
  }, []);

  const mergedPlayers =
    useMemo(() => {
      return players.map((p) => {
        const row =
          sheetData.find(
            (r) =>
              normalize(r.name) ===
              normalize(p.name)
          ) || {};

        return {
          ...p,
          strengths:
            row.strengths ||
            DEFAULT_STRENGTH,
          improvements:
            row.improvements ||
            DEFAULT_IMPROVEMENT,
          strengthVideo:
            row.strengthVideo ||
            DEFAULT_STRENGTH_VIDEO,
          improvementVideo:
            row.improvementVideo ||
            DEFAULT_IMPROVEMENT_VIDEO,
        };
      });
    }, [sheetData]);

  const filtered =
    mergedPlayers.filter((p) =>
      normalize(p.name).includes(
        normalize(search)
      )
    );

  const grouped = {
    Porteros: filtered.filter(
      (p) =>
        p.position === "Portero"
    ),
    Defensas: filtered.filter(
      (p) =>
        p.position === "Defensa"
    ),
    Centrocampistas:
      filtered.filter(
        (p) =>
          p.position ===
          "Centrocampista"
      ),
    Delanteros: filtered.filter(
      (p) =>
        p.position === "Delantero"
    ),
  };

  return (
    <>
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex flex-col lg:flex-row">
          <Sidebar />

          <section className="flex-1 min-w-0">
            <Topbar />

            <div className="p-4 sm:p-6 lg:p-10">
               <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                                RMC Intelligence
              </p>

              <div className="mt-4 flex flex-col items-start gap-4 lg:flex-row lg:items-center">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
                 Análisis Individual
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
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
                    className="w-full bg-transparent outline-none"
                  />
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-4 sm:p-6 lg:p-8">
                <CarouselRow
                  title="Porteros"
                  items={
                    grouped.Porteros
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Defensas"
                  items={
                    grouped.Defensas
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Centrocampistas"
                  items={
                    grouped.Centrocampistas
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Delanteros"
                  items={
                    grouped.Delanteros
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

      {selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-3 sm:p-6"
            onClick={() =>
              setSelected(null)
            }
          >
 <div
  className="
    relative
    w-full
    max-w-6xl
    h-[92vh]
    overflow-y-auto
    overflow-x-hidden
    rounded-3xl
    border border-white/10
    bg-[#11161C]
    p-4 sm:p-6 lg:p-8
  "
  style={{
    WebkitOverflowScrolling: "touch",
  }}
  onClick={(e) => e.stopPropagation()}
>
              <button
                onClick={() =>
                  setSelected(null)
                }
                className="absolute right-5 top-5"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid gap-6 lg:gap-8 md:grid-cols-[280px_1fr]">
                <div>
                  <img
                    src={
                      selected.photo
                    }
                    alt={
                      selected.name
                    }
                    className="h-[360px] w-full rounded-2xl object-cover object-top"
                  />

                  <h2 className="mt-5 text-3xl font-semibold">
                    {
                      selected.name
                    }
                  </h2>

                  <p className="mt-2 text-gray-400">
                    {
                      selected.position
                    }
                  </p>
                </div>

                <div className="space-y-10">
                  <div>
  <h3 className="mb-3 text-[#C8A96B]">
    Fortalezas
  </h3>

  <p className="mb-4 text-gray-300">
    {selected.strengths}
  </p>

  <div className="mb-3 flex justify-end">
  <a
    href={driveViewUrl(
      selected.strengthVideo || ""
    )}
    target="_blank"
    rel="noopener noreferrer"
    className="
      inline-flex items-center gap-2
      rounded-full
      border border-white/10
      bg-white/[0.03]
      px-3 py-1.5
      text-xs font-medium
      text-gray-300
      transition-all duration-200
      hover:border-white/20
      hover:bg-white/[0.06]
      hover:text-white
    "
  >
    Ver en alta calidad ↗
  </a>
</div>

  <div className="w-full rounded-2xl overflow-hidden bg-black">
  <div className="relative w-full pt-[56.25%]">
    <iframe
      key={selected.strengthVideo}
      src={driveVideoUrl(
        selected.strengthVideo || ""
      )}
      className="
        absolute inset-0
        h-full w-full
        border-0
        rounded-2xl
      "
      allow="autoplay; fullscreen"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  </div>
</div>
</div>

                  <div>
  <h3 className="mb-3 text-[#C8A96B]">
    Áreas de mejora
  </h3>

  <p className="mb-4 text-gray-300">
    {selected.improvements}
  </p>

  <div className="mb-3 flex justify-end">
  <a
    href={driveViewUrl(
      selected.improvementVideo || ""
    )}
    target="_blank"
    rel="noopener noreferrer"
    className="
      inline-flex items-center gap-2
      rounded-full
      border border-white/10
      bg-white/[0.03]
      px-3 py-1.5
      text-xs font-medium
      text-gray-300
      transition-all duration-200
      hover:border-white/20
      hover:bg-white/[0.06]
      hover:text-white
    "
  >
    Ver en alta calidad ↗
  </a>
</div>

  <div className="w-full rounded-2xl overflow-hidden bg-black">
  <div className="relative w-full pt-[56.25%]">
    <iframe
      key={selected.improvementVideo}
      src={driveVideoUrl(
        selected.improvementVideo || ""
      )}
      className="
        absolute inset-0
        h-full w-full
        border-0
        rounded-2xl
      "
      allow="autoplay; fullscreen"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  </div>
</div>
</div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}