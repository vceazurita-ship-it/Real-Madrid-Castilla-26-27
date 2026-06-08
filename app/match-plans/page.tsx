"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import {
  Play,
  Trophy,
  Minus,
  XCircle,
  Video,
} from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=953333469&single=true&output=csv";

type MatchRow = {
  microciclo: string;
  fecha: string;
  resultado: string;
  partido: string;
  enlace: string;
};

function parseCSV(text: string): MatchRow[] {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data as MatchRow[];
}

function getMatchResult(
  partido: string,
  resultado: string
) {
  const [a, b] = resultado
    .split("-")
    .map((n) => Number(n));

  const isHome =
    partido.startsWith("Real Madrid C");

  const rmGoals = isHome ? a : b;
  const oppGoals = isHome ? b : a;

  if (rmGoals > oppGoals) return "W";
  if (rmGoals < oppGoals) return "L";

  return "D";
}

function driveEmbed(url: string) {
  return url;
}

export default function Page() {
  const [matches, setMatches] = useState<
    MatchRow[]
  >([]);

  const [selectedMicro, setSelectedMicro] =
    useState("ALL");

  const [selectedVideo, setSelectedVideo] =
    useState<MatchRow | null>(null);

  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((csv) =>
        setMatches(parseCSV(csv))
      )
      .catch(console.error);
  }, []);

  const micros = useMemo(
    () => [
      "ALL",
      ...new Set(
        matches.map(
          (m) => m.microciclo
        )
      ),
    ],
    [matches]
  );

  const filtered = useMemo(() => {
    if (selectedMicro === "ALL")
      return matches;

    return matches.filter(
      (m) =>
        m.microciclo === selectedMicro
    );
  }, [matches, selectedMicro]);

  const metrics = useMemo(() => {
  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  filtered.forEach((m) => {
    const [a, b] = m.resultado
      .split("-")
      .map((n) => Number(n));

    const isHome =
      m.partido.startsWith(
        "Real Madrid C"
      );

    const rmGoals = isHome ? a : b;
    const oppGoals = isHome ? b : a;

    goalsFor += rmGoals;
    goalsAgainst += oppGoals;

    if (rmGoals > oppGoals) wins++;
    else if (
      rmGoals < oppGoals
    )
      losses++;
    else draws++;
  });

  const lastFive = filtered
    .slice(0, 5)
    .map((m) =>
      getMatchResult(
        m.partido,
        m.resultado
      )
    );

  return {
    total: filtered.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    winPct:
      filtered.length > 0
        ? Math.round(
            (wins /
              filtered.length) *
              100
          )
        : 0,
    lastFive,
  };
}, [filtered]);

  return (
    <>
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex">
          <Sidebar />

          <div className="flex-1">
            <Topbar />

            <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">
              {/* HEADER */}

              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  RMC VIDEO ANÁLISIS
                </p>

                <div className="mt-4 flex items-center gap-5">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                    Biblioteca de Partidos
                  </h1>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
                </div>
              </div>

              {/* KPIs */}

              <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8">

                <select
                  value={selectedMicro}
                  onChange={(e) =>
                    setSelectedMicro(
                      e.target.value
                    )
                  }
                  className="w-full sm:w-auto rounded-2xl border border-white/10 bg-[#11161C] px-4 py-3"
                >
                  {micros.map((m) => (
                    <option
                      key={m}
                      value={m}
                    >
                      {m === "ALL"
                        ? "Todos los partidos"
                        : m}
                    </option>
                  ))}
                </select>

                <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
  <Card
    title="Partidos"
    value={metrics.total}
    icon={<Video />}
  />

  <Card
    title="Victorias"
    value={metrics.wins}
    icon={<Trophy />}
  />

  <Card
    title="Empates"
    value={metrics.draws}
    icon={<Minus />}
  />

  <Card
    title="Derrotas"
    value={metrics.losses}
    icon={<XCircle />}
  />
</div>

<div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
  <Card
    title="Goles a favor"
    value={metrics.goalsFor}
  />

  <Card
    title="Goles en contra"
    value={metrics.goalsAgainst}
  />

  <Card
    title="% Victorias"
    value={`${metrics.winPct}%`}
  />

  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
    <p className="text-sm text-zinc-400">
      Últimos 5
    </p>

    <div className="mt-4 flex flex-wrap gap-2">
      {metrics.lastFive.map(
        (r, i) => (
          <span
            key={i}
            className={`
              h-9 w-9
              rounded-full
              flex items-center justify-center
              text-sm font-semibold
              ${
                r === "W"
                  ? "bg-green-500/20 text-green-400"
                  : r === "L"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }
            `}
          >
            {r}
          </span>
        )
      )}
    </div>
  </div>
</div><div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
        RESUMEN
      </p>

      <h2 className="mt-2 text-xl sm:text-2xl font-semibold">
        Biblioteca de vídeo análisis
      </h2>
    </div>

    <div className="text-sm text-zinc-400">
      {filtered.length} partidos disponibles
    </div>
  </div>
</div>
              </div>

              {/* PARTIDOS */}

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">

                {filtered.map((match) => {
                  const result =
                    getMatchResult(
                      match.partido,
                      match.resultado
                    );

                  return (
                    <button
                      key={
                        match.partido +
                        match.fecha
                      }
                      onClick={() =>
                        setSelectedVideo(
                          match
                        )
                      }
                      className="
                        text-left
                        rounded-3xl
                        border border-white/10
                        bg-white/[0.03]
                        p-5
                        transition-all
                        hover:border-[#C8A96B]/40
                        hover:bg-white/[0.05]
                      "
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#C8A96B]/15 px-3 py-1 text-xs text-[#C8A96B]">
                          {match.microciclo}
                        </span>

                        <span
                          className={`
                            text-sm font-semibold
                            ${
                              result === "W"
                                ? "text-green-400"
                                : result === "L"
                                ? "text-red-400"
                                : "text-yellow-400"
                            }
                          `}
                        >
                          {result}
                        </span>
                      </div>

                      <h3 className="mt-5 text-lg font-semibold leading-snug">
                        {match.partido}
                      </h3>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-zinc-400 text-sm">
                          {match.fecha}
                        </p>

                        <p className="text-2xl font-bold text-[#C8A96B]">
                          {match.resultado}
                        </p>
                      </div>

                      <div className="mt-6 flex items-center gap-2 text-sm text-zinc-300">
                        <Play className="h-4 w-4" />
                        Ver análisis
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* MODAL */}

      {selectedVideo && (
        <div
          className="
            fixed inset-0 z-[99999]
            bg-black/80
            p-4 lg:p-10
          "
        >
          <div className="relative h-full rounded-3xl border border-white/10 bg-[#11161C] overflow-hidden">
            <button
              onClick={() =>
                setSelectedVideo(null)
              }
              className="absolute right-5 top-5 z-20 rounded-full border border-white/10 bg-black/50 px-3 py-2"
            >
              ✕
            </button>

            <div className="p-6 border-b border-white/10">
              <p className="text-[#C8A96B] text-sm">
                {
                  selectedVideo.microciclo
                }
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                {
                  selectedVideo.partido
                }
              </h2>

              <p className="mt-2 text-zinc-400">
                {
                  selectedVideo.resultado
                }{" "}
                ·{" "}
                {
                  selectedVideo.fecha
                }
              </p>
            </div>

            <div className="h-[calc(100%-120px)]">
              <iframe
                src={driveEmbed(
                  selectedVideo.enlace
                )}
                className="h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {title}
        </p>

        {icon && (
          <div className="text-[#C8A96B]">
            {icon}
          </div>
        )}
      </div>

      <h3 className="mt-4 text-2xl sm:text-4xl font-semibold">
        {value}
      </h3>
    </div>
  );
}