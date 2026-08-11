"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { useRouter } from "next/navigation";

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

export default function Calendar() {

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

const router = useRouter();

  const { players, loading } = usePlayers();
  const [currentMonth, setCurrentMonth] = useState(() => {
  const today = new Date();

  const index = months.findIndex(
    (m) =>
      m.month === today.getMonth() &&
      m.year === today.getFullYear()
  );

  return index !== -1 ? index : 0;
});
const [trackingData, setTrackingData] = useState<TrackingRecord[]>([]);
const [selectedDate, setSelectedDate] = useState<Date | null>(null);

const [selectedSessions, setSelectedSessions] =
useState<TrackingRecord[]>([]);
  
const playersMap = useMemo(() => {
  const map: Record<string, (typeof players)[number]> = {};

  players.forEach((p) => {
    map[p.id] = p;       // búsqueda por ID
    map[p.nombre] = p;   // búsqueda por nombre
  });

  return map;
}, [players]);

useEffect(() => {
  fetch(`${APPS_SCRIPT_URL}?action=seguimiento`)
    .then((r) => r.json())
    .then((data) => setTrackingData(data))
    .catch(console.error);
}, []);

  
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

          <div className="px-4 md:px-8 py-6 md:py-8">

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA INDIVIDUAL
            </p>

            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
  <h1 className="text-2xl md:text-4xl font-semibold">
    Calendario de Seguimiento 
  </h1>

  <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
</div>

            <div className="mt-8 md:mt-10 rounded-[20px] md:rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 md:p-8">

              <div className="flex items-center justify-between mb-6 md:mb-8">

                <button
                  disabled={currentMonth === 0}
                  onClick={() =>
                    setCurrentMonth((m) => m - 1)
                  }
                  className="rounded-xl border border-white/10 bg-[#11161D] p-2 md:p-3 hover:border-[#C8A96B] disabled:opacity-30"
                >
                  <ChevronLeft />
                </button>

                <div>

                  <h2 className="text-xl md:text-3xl font-semibold text-center">

                    {MONTHS[active.month]} {active.year}

                  </h2>

                  <p className="text-xs md:text-base text-center text-white/50 mt-1">

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
  <div className="min-w-[700px] md:min-w-[1100px]">

    {/* Cabecera días */}
    <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
      {WEEK.map((day) => (
        <div
          key={day}
          className="rounded-lg md:rounded-xl bg-[#11161D] border border-white/10 py-2 md:py-4 text-center"
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
      className="grid grid-cols-7 gap-1 md:gap-2"
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
const hasSessions = daySessions.length > 0;
        return (
          <div
    key={date.toISOString()}

    onClick={() => {
        if (!hasSessions) return;

        setSelectedDate(date);
        setSelectedSessions(daySessions);
    }}

    className={`
relative
${hasSessions ? "cursor-pointer" : ""}
${
  hasSessions
    ? "min-h-[120px] md:min-h-[160px]"
    : "min-h-[70px] md:min-h-[90px]"
}
rounded-xl
border
p-2 md:p-3
transition-all
${
  disabled
    ? "opacity-30 border-white/5 bg-[#090C10]"
    : `border-white/10 ${
        hasSessions
          ? "bg-[#141B24]"
          : "bg-[#10151C]"
      } hover:border-[#C8A96B]/40`
}
`}
>
            <div className="flex justify-between items-center mb-2 md:mb-3">
              <div
                className={`
                  h-6
w-6
md:h-8
md:w-8
text-[11px]
md:text-sm
                  rounded-full
                  flex
                  items-center
                  justify-center
                  
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

            <div className="space-y-1 md:space-y-2 max-h-[80px] md:max-h-[120px] overflow-y-auto pr-1">
              {daySessions.map((session) => {
                const jugador = playersMap[session.ID_JUGADOR];
                const stripe =
  session.ESTRATEGIA === "CAMPO"
    ? "border-l-sky-400"
    : session.ESTRATEGIA === "VÍDEO"
    ? "border-l-yellow-400"
    : "border-l-emerald-400";  
                const color =
                  session.ESTRATEGIA === "CAMPO"
                    ? "bg-sky-500/10 border-white/10"
                    : session.ESTRATEGIA === "VÍDEO"
                    ? "bg-yellow-500/10 border-white/10"
                    : "bg-emerald-400/10 border-white/10";

                return (
                  <div
    key={session.ID_REGISTRO}
    onClick={(e) => {
    e.stopPropagation();

    router.push(`/individual?player=${session.ID_JUGADOR}`);
}}
    className={`
rounded-md
border
border-[#C8A96B]/20
bg-[#C8A96B]/10
border-l-4
${stripe}
px-1.5
py-1
cursor-pointer
transition-all
hover:scale-[1.02]
hover:border-[#C8A96B]
`}
>
                    <p className="text-[9px] md:text-[11px] font-semibold truncate">
                      {jugador?.nombre ?? session.ID_JUGADOR}
                    </p>

                    <p className="text-[8px] md:text-[9px] text-white/60">
                      {session.ESTRATEGIA}
                    </p>

                    <p className="text-[8px] md:text-[8px] md:text-[10px] text-white/40">
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
          {selectedDate && (
    <div
    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    onClick={() => {
        setSelectedDate(null);
        setSelectedSessions([]);
    }}
>

        <div onClick={(e) => e.stopPropagation()} className="bg-[#141B24] rounded-2xl w-[95%] max-w-xl max-h-[85vh] overflow-y-auto p-6">

            <div className="flex justify-between items-center mb-6">

    <div>

        <h2 className="text-2xl font-semibold">

            {selectedDate?.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
            })}

        </h2>

        <p className="text-white/50">

            {selectedSessions.length} seguimientos

        </p>

    </div>

    <button
        onClick={() => {
            setSelectedDate(null);
            setSelectedSessions([]);
        }}
    >
        ✕
    </button>

</div>
<div className="space-y-3">

  {selectedSessions.map((session) => {

    const jugador = playersMap[session.ID_JUGADOR];

    return (

      <div
    key={session.ID_REGISTRO}

    onClick={() => {

        setSelectedDate(null);

        setSelectedSessions([]);

        router.push(`/individual?player=${session.ID_JUGADOR}`);

    }}

    className="rounded-xl border border-white/10 bg-[#10151C] p-4 cursor-pointer hover:border-[#C8A96B] transition-all"
>

    <p className="text-lg font-semibold">
        {jugador?.nombre}
    </p>

    <p className="text-sm text-[#C8A96B] mt-1">
        {session.ESTRATEGIA} · {session.QUIEN}
    </p>

    <div className="mt-4 space-y-3">

        <div>
            <p className="text-xs text-white/50">
                Objetivo ofensivo
            </p>

            <p>
                {session.OBJETIVO_OFENSIVO}
            </p>
        </div>

        <div>
            <p className="text-xs text-white/50">
                Objetivo defensivo
            </p>

            <p>
                {session.OBJETIVO_DEFENSIVO}
            </p>
        </div>

        <div>
            <p className="text-xs text-white/50">
                Objetivo mental
            </p>

            <p>
                {session.OBJETIVO_MENTAL}
            </p>
        </div>

        {session.FEEDBACK && (

            <div>

                <p className="text-xs text-white/50">
                    Feedback
                </p>

                <p>
                    {session.FEEDBACK}
                </p>

            </div>

        )}

    </div>

</div>

    );

  })}

</div>

        </div>

    </div>
)}
        </section>
      </div>
    </main>
  );
}