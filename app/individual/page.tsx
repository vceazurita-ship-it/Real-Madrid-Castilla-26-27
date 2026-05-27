"use client";

import {
  useMemo,
  useState,
  useEffect,
} from "react";

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

function normalizeName(
  value: string
) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function parseCSV(
  text: string
) {
  const rows: string[][] =
    [];

  let row: string[] = [];
  let value = "";
  let insideQuotes =
    false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];
    const next =
      text[i + 1];

    if (char === '"') {
      if (
        insideQuotes &&
        next === '"'
      ) {
        value += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }
    } else if (
      char === "," &&
      !insideQuotes
    ) {
      row.push(value);
      value = "";
    } else if (
      (char === "\n" ||
        char === "\r") &&
      !insideQuotes
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        i++;
      }

      row.push(value);

      if (
        row.some((v) =>
          v.trim()
        )
      ) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (
    value.length ||
    row.length
  ) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function getYoutubeEmbed(
  url: string
) {
  if (!url) return "";

  try {
    const parsed =
      new URL(url);

    if (
      parsed.hostname.includes(
        "youtu.be"
      )
    ) {
      const id =
        parsed.pathname.replace(
          "/",
          ""
        );

      return `https://www.youtube.com/embed/${id}`;
    }

    const id =
      parsed.searchParams.get(
        "v"
      );

    if (id) {
      return `https://www.youtube.com/embed/${id}`;
    }

    if (
      parsed.pathname.includes(
        "/embed/"
      )
    ) {
      return url;
    }

    return url;
  } catch {
    return url;
  }
}

const sampleDetail = {
  strength:
    "Fortaleza principal: jugador con alta capacidad competitiva en escenarios de presión.",

  improvement:
    "Aspecto de mejora pendiente.",

  video1:
    "https://www.youtube.com/watch?v=1-yXp40eG2s",

  video2:
    "https://www.youtube.com/watch?v=EZGx9QR0mrA",
};

const players = [
  // PEGA AQUÍ TU ARRAY COMPLETO
];

function CarouselRow({
  title,
  items,
  onSelect,
}: any) {
  const [index, setIndex] =
    useState(0);

  if (!items.length)
    return null;

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
    <div className="mb-10 md:mb-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-base font-semibold md:text-lg">
          {title}
        </h2>

        <div className="h-px flex-1 bg-white/10" />

        {canSlide && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setIndex(
                  (v) =>
                    (v -
                      1 +
                      items.length) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
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
        {visible.map(
          (player: any) => (
            <div
              key={
                player.name
              }
              onClick={() =>
                onSelect(
                  player
                )
              }
              className="relative z-10 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center transition hover:bg-white/[0.06]"
            >
              <div className="flex justify-center">
                <img
                  src={
                    player.photo
                  }
                  alt={
                    player.name
                  }
                  className="h-[120px] w-[95px] rounded-xl object-cover object-top"
                />
              </div>

              <div className="mt-3">
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#C8A96B]">
                  Real Madrid C
                </p>

                <h3 className="mt-2 text-sm font-semibold">
                  {
                    player.name
                  }
                </h3>

                <p className="mt-1 text-xs text-gray-400">
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

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState<any>(
    null
  );

  const [
    playerDetails,
    setPlayerDetails,
  ] = useState<
    Record<
      string,
      any
    >
  >({});

  useEffect(() => {
  const loadSheet =
    async () => {
      try {
        const res =
          await fetch(
            SHEET_URL,
            {
              cache:
                "no-store",
            }
          );

        const text =
          await res.text();

        console.log(
          "CSV RAW:",
          text
        );

        const rows =
          parseCSV(
            text
          );

        if (
          !rows.length
        ) {
          console.log(
            "Sin filas"
          );
          return;
        }

        const headers =
          rows[0].map(
            (h) =>
              normalizeName(
                h
              )
          );

        console.log(
          "HEADERS:",
          headers
        );

        const data: Record<
          string,
          {
            strength: string;
            improvement: string;
            video1: string;
            video2: string;
          }
        > = {};

        rows
          .slice(1)
          .forEach(
            (
              row
            ) => {
              const name =
                normalizeName(
                  row[0] ||
                    ""
                );

              if (
                !name
              )
                return;

              data[
                name
              ] = {
                strength:
                  row[1]?.trim() ||
                  "",

                improvement:
                  row[2]?.trim() ||
                  "",

                video1:
                  row[3]?.trim() ||
                  "",

                video2:
                  row[4]?.trim() ||
                  "",
              };
            }
          );

        console.log(
          "DATA:",
          data
        );

        setPlayerDetails(
          data
        );
      } catch (
        err
      ) {
        console.error(
          "Error cargando sheet:",
          err
        );
      }
    };

  loadSheet();
}, []);
  const playersWithData =
    useMemo(() => {
      return players.map(
        (
          player
        ) => {
          const key =
            normalizeName(
              player.name
            );

          const sheet =
            playerDetails[
              key
            ];

          return {
            ...player,

            strength:
              sheet?.strength ||
              sampleDetail.strength,

            improvement:
              sheet?.improvement ||
              sampleDetail.improvement,

            video1:
              sheet?.video1 ||
              sampleDetail.video1,

            video2:
              sheet?.video2 ||
              sampleDetail.video2,
          };
        }
      );
    }, [
      playerDetails,
    ]);

  const filtered =
    useMemo(() => {
      return playersWithData.filter(
        (p) =>
          p.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      );
    }, [
      playersWithData,
      search,
    ]);

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
                  onChange={(
                    e
                  ) =>
                    setSearch(
                      e.target
                        .value
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
                items={
                  grouped.Porteros
                }
                onSelect={
                  setSelectedPlayer
                }
              />

              <CarouselRow
                title="Defensas"
                items={
                  grouped.Defensas
                }
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
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 p-4"
          onClick={() =>
            setSelectedPlayer(
              null
            )
          }
        >
          <div
            className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827] p-6 md:p-10"
            onClick={(
              e
            ) =>
              e.stopPropagation()
            }
          >
            <div className="mb-8 flex items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <img
                  src={
                    selectedPlayer.photo
                  }
                  alt={
                    selectedPlayer.name
                  }
                  className="h-28 w-20 rounded-2xl object-cover object-top"
                />

                <div>
                  <h2 className="text-2xl font-semibold">
                    {
                      selectedPlayer.name
                    }
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    {
                      selectedPlayer.position
                    }
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setSelectedPlayer(
                    null
                  )
                }
                className="rounded-xl border border-white/10 p-2"
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

                {selectedPlayer.video1 && (
                  <iframe
                    src={getYoutubeEmbed(
                      selectedPlayer.video1
                    )}
                    className="h-[260px] w-full rounded-2xl"
                    allowFullScreen
                  />
                )}
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

                {selectedPlayer.video2 && (
                  <iframe
                    src={getYoutubeEmbed(
                      selectedPlayer.video2
                    )}
                    className="h-[260px] w-full rounded-2xl"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}