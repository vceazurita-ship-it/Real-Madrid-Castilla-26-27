"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useRouter } from "next/navigation";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type MicrocycleRecord = {
  Temporada: string;
  Micro: string;
  Rival: string;
  Día: string;
  MD: string;
  Fecha: string;

  Tarea: string;
  "Tipo Tarea": string;

  Formato: string;
  "Nº Jugadores": number;
  Grupo: string;
  Espacio: string;

  "Contenido Principal": string;
  "Contenido Secundario": string;

  Fase: string;

  Tiempo: number;

  "Intensidad (1-5)": number;
  "Carga Ponderada": number;

  "Exig.Cog.(1-5)": number;
  "Carga Cog.": number;

  Observaciones: string;
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

  const [currentMonth, setCurrentMonth] = useState(0);

const [selectedDate, setSelectedDate] = useState<Date | null>(null);

const [microcycleData, setMicrocycleData] =
useState<MicrocycleRecord[]>([]);

const [selectedTasks, setSelectedTasks] =
useState<MicrocycleRecord[]>([]);

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
  fetch(`${APPS_SCRIPT_URL}?action=microciclo`)
    .then((r) => r.json())
    .then((data) => {
      console.log("MICROCICLO:", data);
      console.log("Es array:", Array.isArray(data));

      if (Array.isArray(data)) {
        setMicrocycleData(data);
      } else {
        console.error(data);
        setMicrocycleData([]);
      }
      
    })
    .catch(console.error);
}, []);

  
  const active = months[currentMonth];

  const calendar = useMemo(() => {
    return buildCalendar(
      active.month,
      active.year
    );
  }, [active]);
const grouped =
selectedTasks.reduce((acc, task) => {

   const key =
      task["Contenido Principal"];

   if(!acc[key])
      acc[key]=[];

   acc[key].push(task);

   return acc;

}, {} as Record<string, MicrocycleRecord[]>);
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
    Calendario de Microciclo
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

const dayTasks = microcycleData.filter(
  (t) =>
    typeof t.Fecha === "string" &&
    t.Fecha.startsWith(key)
);
const bloques = [
  ...new Set(
    dayTasks.map(
      t => t["Contenido Principal"]
    )
  )
];
const hasTasks = dayTasks.length > 0;


        return (
          <div
    key={date.toISOString()}

    onClick={() => {
        if (!hasTasks) return;

setSelectedDate(date);
setSelectedTasks(dayTasks);

    }}

    className={`
relative
${hasTasks ? "cursor-pointer" : ""}
${
  hasTasks
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
        hasTasks
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
{bloques.map(bloque => (
   <div>
      {bloque}
   </div>
))}
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
    setSelectedTasks([]);
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

            {selectedTasks.length} tareas

        </p>

    </div>

    <button
        onClick={() => {
    setSelectedDate(null);
    setSelectedTasks([]);
}}
    >
        ✕
    </button>

</div>
<div className="space-y-3">
{Object.entries(grouped).map(([bloque, tareas]) => (

  <div
    key={bloque}
    className="rounded-xl border border-white/10 bg-[#10151C] p-4"
  >

    <h3 className="font-semibold text-[#C8A96B] mb-3">
      {bloque}
    </h3>

    <div className="space-y-2">

      {tareas.map((t) => (

        <div
          key={t.Tarea + t["Contenido Secundario"]}
          className="flex justify-between text-sm"
        >
          <span>{t["Contenido Secundario"]}</span>

          <span className="text-white/50">
            {t.Tiempo}'
          </span>

        </div>

      ))}

    </div>

  </div>

))}
 

</div>

        </div>

    </div>
)}
        </section>
      </div>
    </main>
  );
}