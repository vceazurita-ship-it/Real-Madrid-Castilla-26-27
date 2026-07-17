"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Brain,
} from "lucide-react";

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
            console.log("Claves:", Object.keys(data[0]));


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


const sessionDays = useMemo(() => {

  return [...new Set(
    microcycleData.map(t => t.Fecha)
  )].sort();

}, [microcycleData]);

const currentDayIndex =
  selectedDate
    ? sessionDays.findIndex(
        d =>
          d ===
          selectedDate.toISOString().slice(0, 10)
      )
    : -1;

 const openDay = (index: number) => {

  const key = sessionDays[index];

  if (!key) return;

  const tasks = microcycleData.filter(
    t => t.Fecha === key
  );

  setSelectedDate(new Date(key));
  setSelectedTasks(tasks);

};

useEffect(() => {

  if (!selectedDate) return;

  const handle = (e: KeyboardEvent) => {

    if (
      e.key === "ArrowLeft" &&
      currentDayIndex > 0
    ) {
      openDay(currentDayIndex - 1);
    }

    if (
      e.key === "ArrowRight" &&
      currentDayIndex < sessionDays.length - 1
    ) {
      openDay(currentDayIndex + 1);
    }

    if (e.key === "Escape") {
      setSelectedDate(null);
      setSelectedTasks([]);
    }

  };

  window.addEventListener("keydown", handle);

  return () =>
    window.removeEventListener("keydown", handle);

}, [
  selectedDate,
  currentDayIndex,
  sessionDays
]);

const MetricBar = ({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) => (
  <div className="w-full">
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-[#C8A96B]"
        style={{
          width: `${Math.min((value / max) * 100, 100)}%`,
        }}
      />
    </div>
  </div>
);

const getPhaseStyle = (fase: string) => {
  const value = (fase || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (value.includes("ofens"))
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";

  if (value.includes("defens"))
    return "bg-red-500/15 text-red-300 border border-red-500/30";

  if (value.includes("tr") && value.includes("ofens"))
    return "bg-sky-500/15 text-sky-300 border border-sky-500/30";

  if (value.includes("tr") && value.includes("defens"))
    return "bg-orange-500/15 text-orange-300 border border-orange-500/30";

  if (value.includes("abp"))
    return "bg-violet-500/15 text-violet-300 border border-violet-500/30";

  if (value.includes("global"))
    return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30";

  return "bg-white/10 text-white/70 border border-white/10";
};

const getDayPhaseStyle = (fase: string) => {
  const value = (fase || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (value.includes("ofens"))
    return {
      bg: "bg-emerald-500/10",
      bar: "from-emerald-400 to-emerald-600",
    };

  if (value.includes("defens"))
    return {
      bg: "bg-red-500/10",
      bar: "from-red-400 to-red-600",
    };

  if (value.includes("tr") && value.includes("ofens"))
    return {
      bg: "bg-sky-500/10",
      bar: "from-sky-400 to-sky-600",
    };

  if (value.includes("tr") && value.includes("defens"))
    return {
      bg: "bg-orange-500/10",
      bar: "from-orange-400 to-orange-600",
    };

  if (value.includes("abp"))
    return {
      bg: "bg-violet-500/10",
      bar: "from-violet-400 to-violet-600",
    };

  if (value.includes("global"))
    return {
      bg: "bg-yellow-500/10",
      bar: "from-yellow-300 to-yellow-500",
    };

  return {
    bg: "bg-[#141B24]",
    bar: "from-white/20 to-white/20",
  };
};

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
  (t) => t.Fecha === key
);
const totalMinutes = dayTasks.reduce(
  (sum, t) => sum + Number(t.Tiempo || 0),
  0
);
const bloques = [
  ...new Set(
    dayTasks.map(
      t => t["Contenido Principal"]
    )
  )
];
const hasTasks = dayTasks.length > 0;

const phaseTotals = dayTasks.reduce((acc, task) => {
  const fase = task.Fase || "Global";

  acc[fase] =
    (acc[fase] || 0) + Number(task.Tiempo || 0);

  return acc;
}, {} as Record<string, number>);

const dominantPhase =
  Object.entries(phaseTotals)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

const dayStyle =
  getDayPhaseStyle(dominantPhase);
        return (
          <div
    key={date.toISOString()}

    onClick={() => {
        console.log("CLICK", dayTasks);
        console.log(
  key,
  dayTasks.length,
  dayTasks.map(t => ({
    fecha: t.Fecha,
    principal: t["Contenido Principal"],
    secundario: t["Contenido Secundario"],
    tarea: t.Tarea,
  }))
);

        if (!hasTasks) return;

setSelectedDate(date);
setSelectedTasks(dayTasks);

    }}

    className={`
relative group
${hasTasks ? "cursor-pointer" : ""}
${
  hasTasks
    ? "min-h-[120px] md:min-h-[160px]"
    : "min-h-[70px] md:min-h-[90px]"
}
rounded-xl
border
p-2 md:p-3
transition-all duration-200 hover:scale-[1.015]
${
  disabled
    ? "opacity-30 border-white/5 bg-[#090C10]"
    : `border-white/10 ${
        hasTasks
  ? dayStyle.bg
  : "bg-[#10151C]"
      } hover:border-[#C8A96B]/40`
}


`}


>
  {hasTasks && (
  <div
    className={`
      absolute
      top-0
      left-0
      right-0
      h-1
      rounded-t-xl
      bg-gradient-to-r
      ${dayStyle.bar}
      transition-all
      duration-200
      group-hover:h-1.5
    `}
  />
)}
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
{bloques.map((bloque) => {

  const minutos = dayTasks
    .filter(
      t => t["Contenido Principal"] === bloque
    )
    .reduce(
      (s, t) => s + Number(t.Tiempo || 0),
      0
    );

  const porcentaje =
    totalMinutes > 0
      ? (minutos / totalMinutes) * 100
      : 0;

  return (

    <div key={bloque} className="mb-2">

      <div className="text-xs truncate">
        {bloque}
      </div>

      <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">

        <div
          className="h-full rounded-full bg-[#C8A96B]"
          style={{
            width: `${porcentaje}%`,
          }}
        />

      </div>

    </div>

  );

})}                </div>
              

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

            <div className="flex items-center justify-between mb-6">

    <div className="flex items-center gap-4">

  <button
    disabled={currentDayIndex <= 0}
    onClick={() => openDay(currentDayIndex - 1)}
    className="
      rounded-full
      border
      border-white/10
      p-2
      hover:border-[#C8A96B]
      disabled:opacity-30
    "
  >
    <ChevronLeft size={18} />
  </button>

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
    disabled={currentDayIndex >= sessionDays.length - 1}
    onClick={() => openDay(currentDayIndex + 1)}
    className="
      rounded-full
      border
      border-white/10
      p-2
      hover:border-[#C8A96B]
      disabled:opacity-30
    "
  >
    <ChevronRight size={18} />
  </button>

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
    key={`${t.Tarea}-${t["Contenido Secundario"]}-${t.Tiempo}`}
    className="rounded-2xl border border-white/10 bg-[#141B24] p-4 hover:border-[#C8A96B]/40 transition-all"
  >

    {/* Fase */}
    <div
  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] mb-3 ${getPhaseStyle(
    t.Fase
  )}`}
>
  {t.Fase}
</div>
    {/* Contenido */}
    <h4 className="text-base font-semibold text-white">
      {t["Contenido Principal"]}
    </h4>

    <p className="mb-5 text-sm text-white/60">
      {t["Contenido Secundario"]}
    </p>

    {/* Tiempo */}
    <div className="mb-5 flex">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#10151C] px-3 py-2">
        <Clock3 size={15} className="text-[#C8A96B]" />
        <span className="text-sm font-medium">
          {t.Tiempo}'
        </span>
      </div>
    </div>

    {/* Carga física */}
    <div className="mb-4">

      <div className="mb-2 flex items-center justify-between">

        <div className="flex items-center gap-2">
          <Dumbbell size={16} className="text-[#C8A96B]" />
          <span className="text-sm">
            Carga física
          </span>
        </div>

        <span className="text-sm font-semibold">
          {t["Carga Ponderada"]}
        </span>

      </div>

      <MetricBar value={Number(t["Carga Ponderada"])} />

    </div>

    {/* Carga cognitiva */}
    <div>

      <div className="mb-2 flex items-center justify-between">

        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[#C8A96B]" />
          <span className="text-sm">
            Carga cognitiva
          </span>
        </div>

        <span className="text-sm font-semibold">
          {t["Carga Cog."]}
        </span>

      </div>

      <MetricBar value={Number(t["Carga Cog."])} />

    </div>

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