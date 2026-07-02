"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};
 
const START_MONTH = new Date(2026, 6, 1); // Julio 2026
const END_MONTH = new Date(2027, 5, 1);   // Junio 2027

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEK = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildCalendar(month: number, year: number) {
  const firstDay = new Date(year, month, 1);

  const current = getMonday(firstDay);

  const weeks: Date[][] = [];

  while (true) {
    const week: Date[] = [];

    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    weeks.push(week);

    if (
      current.getMonth() !== month &&
      current.getDay() === 1
    ) {
      break;
    }
  }

  return weeks;
}

export default function IndividualPage() {
  const { players, loading } = usePlayers();
  const [currentMonth, setCurrentMonth] = useState(0);
const [trackingData, setTrackingData] = useState<TrackingRecord[]>([]);
  const playersMap = useMemo(() => {
  return Object.fromEntries(
    players.map((p) => [p.id, p])
  ) as Record<string, (typeof players)[number]>;
}, [players]);
 const months = useMemo(() => {
  const result = [];

  let current = new Date(START_MONTH);

  while (current <= END_MONTH) {
    result.push({
      month: current.getMonth(),
      year: current.getFullYear(),
    });

    current = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      1
    );
  }

  return result;
}, []);
useEffect(() => {
  fetch(`${APPS_SCRIPT_URL}?action=seguimiento`)
    .then((r) => r.json())
    .then((data) => setTrackingData(data))
    .catch(console.error);
}, []);
if (loading) {
  return (
    <main className="min-h-screen bg-[#0B0F14] flex items-center justify-center text-white">
      Cargando jugadores...
    </main>
  );
}
  
  const active = months[currentMonth];

  const calendar = useMemo(() => {
    return buildCalendar(
      active.month,
      active.year
    );
  }, [active]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

        <Sidebar />

        <section className="w-full">

          <Topbar />

          <div className="px-8 py-8">

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA INDIVIDUAL
            </p>

            <div className="mt-4 flex items-center gap-5">

              <h1 className="text-4xl font-semibold">
                Calendario de Seguimiento Individual
              </h1>

              <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

            </div>

            <div className="mt-10 rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-8">

              <div className="flex items-center justify-between mb-8">

                <button
                  disabled={currentMonth === 0}
                  onClick={() =>
                    setCurrentMonth((m) => m - 1)
                  }
                  className="rounded-xl border border-white/10 bg-[#11161D] p-3 hover:border-[#C8A96B] disabled:opacity-30"
                >
                  <ChevronLeft />
                </button>

                <div>

                  <h2 className="text-3xl font-semibold text-center">

                    {MONTHS[active.month]} {active.year}

                  </h2>

                  <p className="text-center text-white/50 mt-1">

                    Temporada 2026 / 2027

                  </p>

                </div>

                <button
                  disabled={currentMonth === months.length - 1}
                  onClick={() =>
                    setCurrentMonth((m) => m + 1)
                  }
                  className="rounded-xl border border-white/10 bg-[#11161D] p-3 hover:border-[#C8A96B] disabled:opacity-30"
                >
                  <ChevronRight />
                </button>

              </div>

<div className="overflow-x-auto">
  <div className="min-w-[1100px]">

    {/* Cabecera días */}
    <div className="grid grid-cols-7 gap-2 mb-2">
      {WEEK.map((day) => (
        <div
          key={day}
          className="rounded-xl bg-[#11161D] border border-white/10 py-4 text-center"
        >
          <span className="text-sm font-semibold text-[#C8A96B]">
            {day}
          </span>
        </div>
      ))}
    </div>

    {/* Semanas */}
<div className="space-y-2">
  {calendar.map((week, weekIndex) => (
    <div
      key={weekIndex}
      className="grid grid-cols-7 gap-2"
    >
      {week.map((date) => {
        const isCurrentMonth =
          date.getMonth() === active.month;

        const isToday =
          date.toDateString() ===
          new Date().toDateString();

        const disabled =
          (active.month === 6 &&
            date < new Date(2026, 6, 13)) ||
          (active.month === 5 &&
            active.year === 2027 &&
            date > new Date(2027, 5, 30));

        const key =
  date.getFullYear() +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");

const daySessions = trackingData.filter((s) =>
  s.FECHA.startsWith(key)
);

        return (
          <div
            key={date.toISOString()}
            className={`
              relative
              rounded-2xl
              border
              min-h-[140px]
              p-3
              transition-all
              ${
                disabled
                  ? "opacity-30 border-white/5 bg-[#090C10]"
                  : "border-white/10 bg-[#11161D] hover:border-[#C8A96B]/40 hover:bg-[#141B24]"
              }
            `}
          >
            <div className="flex justify-between items-center mb-3">
              <div
                className={`
                  h-8
                  w-8
                  rounded-full
                  flex
                  items-center
                  justify-center
                  text-sm
                  font-semibold
                  ${
                    isToday
                      ? "bg-[#C8A96B] text-black"
                      : isCurrentMonth
                      ? "text-white"
                      : "text-white/35"
                  }
                `}
              >
                {date.getDate()}
              </div>
            </div>

            <div className="space-y-2">
              {daySessions.map((session) => {
                const jugador = playersMap[session.ID_JUGADOR];

                const color =
                  session.ESTRATEGIA === "CAMPO"
                    ? "bg-blue-500/20 border-blue-400/40"
                    : session.ESTRATEGIA === "VÍDEO"
                    ? "bg-amber-500/20 border-amber-400/40"
                    : "bg-emerald-500/20 border-emerald-400/40";

                return (
                  <div
                    key={session.ID_REGISTRO}
                    className={`rounded-lg border px-2 py-1 ${color}`}
                  >
                    <p className="text-xs font-semibold truncate">
                      {jugador?.nombre ?? session.ID_JUGADOR}
                    </p>

                    <p className="text-[10px] text-white/60">
                      {session.ESTRATEGIA}
                    </p>

                    <p className="text-[10px] text-white/40">
                      {session.QUIEN}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
      ))}
    </div>
  </div>
</div>

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}