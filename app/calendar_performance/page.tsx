"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { loadSeason } from "@/lib/loadSeason";
import { MonthData } from "@/app/performance/data";


const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type ConditionalEvent = {
  ID_EVENTO: string;
  FECHA: string;
  TIPO:
    | "FUERZA"
    | "PREVENTIVO"
    | "READAPTACION"
    | "MOVILIDAD"
    | "RECUPERACION";
  TITULO: string;
  DESCRIPCION: string;
  JUGADORES: string;
  RESPONSABLE: string;
  DURACION: string;
  INTENSIDAD: string;
};

type DayFile = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
};

type FilesByDay = Record<
  string,
  {
    images: DayFile[];
    pdfs: DayFile[];
  }
>
;

const START_MONTH = new Date(2026, 6, 1);
const END_MONTH = new Date(2027, 5, 1);

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

    if (current.getMonth() !== month && current.getDay() === 1) {
      break;
    }
  }

  return weeks;
}
export default function Calendar() {
  const months = useMemo(() => {
    const result: { month: number; year: number }[] = [];

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

  const { players } = usePlayers();

  const [events, setEvents] = useState<ConditionalEvent[]>([]);
  const [seasonData, setSeasonData] = useState<MonthData[]>([]);
  const [filesByDay, setFilesByDay] = useState<FilesByDay>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ConditionalEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ConditionalEvent | null>(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => {
  const today = new Date();

  const index = months.findIndex(
    (m) =>
      m.month === today.getMonth() &&
      m.year === today.getFullYear()
  );

  return index !== -1 ? index : 0;
});


  const active = months[currentMonth];

  const calendar = useMemo(() => {
    return buildCalendar(active.month, active.year);
  }, [active]);

  const reloadEvents = async () => {
    try {
      const r = await fetch(`${APPS_SCRIPT_URL}?action=condicional`);
      const data = await r.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    reloadEvents();
  }, []);

  useEffect(() => {
  const fetchSeason = async () => {
    try {
      const data = await loadSeason();
      if (Array.isArray(data)) {
        setSeasonData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  fetchSeason();
}, []);

useEffect(() => {
  const loadFiles = async () => {
    try {
      const response = await fetch("/api/performance-files");
      const files: DayFile[] = await response.json();

      const grouped: FilesByDay = {};

      for (const file of files) {
        const day = new Date(file.created_at)
          .toISOString()
          .slice(0, 10);

        if (!grouped[day]) {
          grouped[day] = {
            images: [],
            pdfs: [],
          };
        }

        if (file.type === "image") {
          grouped[day].images.push(file);
        } else {
          grouped[day].pdfs.push(file);
        }
      }

      setFilesByDay(grouped);
    } catch (err) {
      console.error(err);
    }
  };

  loadFiles();
}, []);

useEffect(() => {
    if (!selectedDate || fullscreenImageIndex !== null) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      changeSelectedDay(-1);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      changeSelectedDay(1);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () =>
    window.removeEventListener("keydown", handleKeyDown);
}, [selectedDate, events, fullscreenImageIndex]);

useEffect(() => {
  if (fullscreenImageIndex === null || !selectedDate) return;

  const dayKey = [
    selectedDate.getFullYear(),
    String(selectedDate.getMonth() + 1).padStart(2, "0"),
    String(selectedDate.getDate()).padStart(2, "0"),
  ].join("-");

  const images = filesByDay[dayKey]?.images ?? [];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setFullscreenImageIndex(null);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFullscreenImageIndex((prev) =>
        prev === null ? null : (prev + 1) % images.length
      );
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFullscreenImageIndex((prev) =>
        prev === null
          ? null
          : (prev - 1 + images.length) % images.length
      );
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () =>
    window.removeEventListener("keydown", handleKeyDown);
}, [fullscreenImageIndex, selectedDate, filesByDay]);


  async function createEvent(data: Partial<ConditionalEvent>) {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "crearEventoCondicional",
        ...data,
      }),
    });

    await reloadEvents();
  }

  async function updateEvent(data: ConditionalEvent) {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "editarEventoCondicional",
        ...data,
      }),
    });

    await reloadEvents();
  }

  async function deleteEvent(id: string) {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "eliminarEventoCondicional",
        ID_EVENTO: id,
      }),
    });

    await reloadEvents();
  }

  const changeSelectedDay = (offset: number) => {
  if (!selectedDate) return;

  const d = new Date(selectedDate);
  d.setDate(d.getDate() + offset);

  const key = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");

  const dayEvents = events.filter((e) => {
    const eventDate = new Date(e.FECHA);
    const eventKey = [
      eventDate.getUTCFullYear(),
      String(eventDate.getUTCMonth() + 1).padStart(2, "0"),
      String(eventDate.getUTCDate()).padStart(2, "0"),
    ].join("-");

    return eventKey === key;
  });

  setSelectedDate(d);
  setSelectedEvents(dayEvents);
};

  return (
  <main className="min-h-screen bg-[#0B0F14] text-white">
    <div className="flex">
      <Sidebar />

      <section className="w-full">
        <Topbar />

        <div className="px-4 md:px-8 py-6 md:py-8">
          <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
            RMCF CASTILLA CONDICIONAL
          </p>

          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
            <h1 className="text-2xl md:text-4xl font-semibold">
              Calendario Condicional
            </h1>

            <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
          </div>

          <div className="mt-8 md:mt-10 rounded-[20px] md:rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 md:p-8">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <button
                disabled={currentMonth === 0}
                onClick={() => setCurrentMonth((m) => m - 1)}
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
                onClick={() => setCurrentMonth((m) => m + 1)}
                className="rounded-xl border border-white/10 bg-[#11161D] p-2 md:p-3 hover:border-[#C8A96B] disabled:opacity-30"
              >
                <ChevronRight />
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[700px] md:min-w-[1100px]">
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

                        const dayEvents = events.filter((e) => {
  const eventDate = new Date(e.FECHA);

  const eventKey = [
    eventDate.getUTCFullYear(),
    String(eventDate.getUTCMonth() + 1).padStart(2, "0"),
    String(eventDate.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return eventKey === key;
});
                        const hasEvents = dayEvents.length > 0;

                       const dayFiles = filesByDay[key] ?? {
  images: [],
  pdfs: [],
};

const imageCount = dayFiles.images.length;
const pdfCount = dayFiles.pdfs.length;
const hasFiles = imageCount > 0 || pdfCount > 0;

                        return (
                          <div
                            key={date.toISOString()}
                            onClick={() => {
                              setSelectedDate(date);
                              setSelectedEvents(dayEvents);
                              setIsCreating(false);
                              setEditingEvent(null);
                            }}
                            className={`
                              relative
                              cursor-pointer
                              ${hasEvents ? "min-h-[120px] md:min-h-[160px]" : "min-h-[70px] md:min-h-[90px]"}
                              rounded-xl
                              border
                              p-2 md:p-3
                              transition-all
                              ${
                                disabled
                                  ? "opacity-30 border-white/5 bg-[#090C10]"
                                  : `border-white/10 ${
                                      hasEvents ? "bg-[#141B24]" : "bg-[#10151C]"
                                    } hover:border-[#C8A96B]/40`
                              }
                            `}
                          >
                            <div className="flex justify-between items-center mb-2 md:mb-3">
                              <div
                                className={`
                                  h-6 w-6 md:h-8 md:w-8 text-[11px] md:text-sm
                                  rounded-full flex items-center justify-center
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
                            {hasFiles && (
  <div className="flex gap-2 mb-2">
    {imageCount > 0 && (
      <div className="flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2 py-0.5">
        <ImageIcon className="h-3 w-3 text-sky-300" />
        <span className="text-[10px] text-sky-200 font-medium">
          {imageCount}
        </span>
      </div>
    )}

    {pdfCount > 0 && (
      <div className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5">
        <FileText className="h-3 w-3 text-amber-300" />
        <span className="text-[10px] text-amber-200 font-medium">
          {pdfCount}
        </span>
      </div>
    )}
  </div>
)}

                            <div className="space-y-1 md:space-y-2 max-h-[80px] md:max-h-[120px] overflow-y-auto pr-1">
                              {dayEvents.map((event) => {
                                const stripe =
                                  event.TIPO === "FUERZA"
                                    ? "border-l-red-400"
                                    : event.TIPO === "PREVENTIVO"
                                    ? "border-l-emerald-400"
                                    : event.TIPO === "READAPTACION"
                                    ? "border-l-sky-400"
                                    : event.TIPO === "MOVILIDAD"
                                    ? "border-l-purple-400"
                                    : "border-l-yellow-400";

                                return (
                                  <div
                                    key={event.ID_EVENTO}
                                    className={`rounded-md border border-[#C8A96B]/20 bg-[#C8A96B]/10 border-l-4 ${stripe} px-1.5 py-1`}
                                  >
                                    <p className="text-[9px] md:text-[11px] font-semibold truncate">
                                      {event.TITULO}
                                    </p>

                                    <p className="text-[8px] md:text-[9px] text-white/60">
                                      {event.TIPO}
                                    </p>

                                    <p className="text-[8px] md:text-[10px] text-white/40">
                                      {event.RESPONSABLE}
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

          {selectedDate && (
            <div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
              onClick={() => {
                setSelectedDate(null);
                setSelectedEvents([]);
              }}
            >
              <div
  onClick={(e) => e.stopPropagation()}
  className="relative bg-[#141B24] rounded-2xl w-[95%] max-w-xl max-h-[85vh] overflow-y-auto p-6"
>

  <button
    type="button"
    onClick={() => changeSelectedDay(-1)}
    className="absolute left-3 top-1/2 -translate-y-1/2 text-4xl text-white/60 hover:text-white transition"
  >
    ‹
  </button>

  <button
    type="button"
    onClick={() => changeSelectedDay(1)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-4xl text-white/60 hover:text-white transition"
  >
    ›
  </button>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {selectedDate.toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>

                    <p className="text-white/50">
                      {selectedEvents.length} trabajos programados
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDate(null);
                      setSelectedEvents([]);
                    }}
                  >
                    ✕
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsCreating(true);
                    setEditingEvent(null);
                  }}
                  className="mb-4 rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 text-sm font-medium hover:bg-[#C8A96B]/20"
                >
                  + Nuevo trabajo
                </button>
                {selectedDate && (() => {
  const dayKey = [
    selectedDate.getFullYear(),
    String(selectedDate.getMonth() + 1).padStart(2, "0"),
    String(selectedDate.getDate()).padStart(2, "0"),
  ].join("-");

  const files = filesByDay[dayKey];

  if (!files || (files.images.length === 0 && files.pdfs.length === 0)) {
    return null;
  }

  return (
    <div className="mb-6 space-y-5">
      {files.images.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon size={18} className="text-[#C8A96B]" />
            Imágenes del día
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {files.images.map((img, i) => (
  <button
    key={i}
    type="button"
    onClick={() => setFullscreenImageIndex(i)}
    className="overflow-hidden rounded-xl border border-white/10 bg-[#10151C] cursor-zoom-in"
  >
    <img
      src={img.url}
      alt={img.name}
      className="h-32 w-full object-cover transition hover:scale-[1.02]"
    />
  </button>
))}
          </div>
        </div>
      )}

      {files.pdfs.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-[#C8A96B]" />
            PDFs del día
          </h3>

          <div className="space-y-2">
            {files.pdfs.map((pdf, i) => (
              <a
                key={i}
                href={pdf.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-white/10 bg-[#10151C] p-3 transition hover:border-[#C8A96B]/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-[#C8A96B]" />
                  <span className="truncate">{pdf.name}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

})()}

{(isCreating || editingEvent) && (
  <EventForm
    players={players}
    date={selectedDate!}
    initialData={editingEvent}
    onCancel={() => {
      setIsCreating(false);
      setEditingEvent(null);
    }}
    onSave={async (form) => {
      const localDate = new Date(selectedDate!);
      localDate.setHours(12, 0, 0, 0);

      const fecha = [
        localDate.getFullYear(),
        String(localDate.getMonth() + 1).padStart(2, '0'),
        String(localDate.getDate()).padStart(2, '0'),
      ].join('-');

      if (editingEvent) {
        await updateEvent({
          ...editingEvent,
          FECHA: fecha,
          ...form,
        });
      } else {
        await createEvent({
          FECHA: fecha,
          ...form,
        });
      }

      const r = await fetch(`${APPS_SCRIPT_URL}?action=condicional`);
      const data: ConditionalEvent[] = await r.json();

      setEvents(data);
      setSelectedEvents(data.filter((e) => e.FECHA === fecha));

      setIsCreating(false);
      setEditingEvent(null);

      // Cierra el popup completo
      setSelectedDate(null);
      setSelectedEvents([]);
    }}
  />
)}

                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.ID_EVENTO}
                      className="rounded-xl border border-white/10 bg-[#10151C] p-4"
                    >
                      <p className="text-lg font-semibold">
                        {event.TITULO}
                      </p>

                      <p className="text-sm text-[#C8A96B] mt-1">
                        {event.TIPO} · {event.RESPONSABLE}
                      </p>

                      <div className="mt-3 space-y-2">
                        <p className="text-white/80">
                          {event.DESCRIPCION}
                        </p>

                        <p className="text-xs text-white/50">
                          Duración: {event.DURACION}
                        </p>

                        <p className="text-xs text-white/50">
                          Intensidad: {event.INTENSIDAD}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="rounded-lg border border-[#C8A96B] px-3 py-2 text-sm"
                        >
                          Editar
                        </button>

                        <button
                          onClick={async () => {
  await deleteEvent(event.ID_EVENTO);
  setSelectedDate(null);
  setSelectedEvents([]);
}}
                          className="rounded-lg border border-red-500 px-3 py-2 text-sm text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  
                </div>
                {fullscreenImageIndex !== null && selectedDate && (() => {
  const dayKey = [
    selectedDate.getFullYear(),
    String(selectedDate.getMonth() + 1).padStart(2, "0"),
    String(selectedDate.getDate()).padStart(2, "0"),
  ].join("-");

  const images = filesByDay[dayKey]?.images ?? [];
  const image = images[fullscreenImageIndex];

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-6"
      onClick={() => setFullscreenImageIndex(null)}
    >
      <button
        type="button"
        onClick={() => setFullscreenImageIndex(null)}
        className="absolute right-6 top-6 text-3xl text-white/80 hover:text-white"
      >
        ✕
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setFullscreenImageIndex(
            (fullscreenImageIndex - 1 + images.length) % images.length
          );
        }}
        className="absolute left-6 top-1/2 -translate-y-1/2 text-6xl text-white/70 hover:text-white transition"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setFullscreenImageIndex(
            (fullscreenImageIndex + 1) % images.length
          );
        }}
        className="absolute right-6 top-1/2 -translate-y-1/2 text-6xl text-white/70 hover:text-white transition"
      >
        ›
      </button>

      <img
        src={image.url}
        alt={image.name}
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2 text-sm text-white/70">
        {fullscreenImageIndex + 1} / {images.length}
      </div>
    </div>
  );
})()}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  </main>
);
function EventForm({
  players,
  date,
  initialData,
  onCancel,
  onSave,
}: {
  players: any[];
  date: Date;
  initialData?: ConditionalEvent | null;
  onCancel: () => void;
  onSave: (data: any) => void;
}) {
  const [TIPO, setTIPO] = useState<ConditionalEvent["TIPO"]>(
    initialData?.TIPO ?? "FUERZA"
  );
  const [TITULO, setTITULO] = useState(initialData?.TITULO ?? "");
  const [DESCRIPCION, setDESCRIPCION] = useState(initialData?.DESCRIPCION ?? "");
  const [JUGADORES, setJUGADORES] = useState(initialData?.JUGADORES ?? "");
  const [RESPONSABLE, setRESPONSABLE] = useState(initialData?.RESPONSABLE ?? "");
  const [DURACION, setDURACION] = useState(initialData?.DURACION ?? "");
  const [INTENSIDAD, setINTENSIDAD] = useState(initialData?.INTENSIDAD ?? "");

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-[#10151C] p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {initialData ? "Editar trabajo condicional" : "Nuevo trabajo condicional"}
      </h3>

      <select
        value={TIPO}
        onChange={(e) =>
          setTIPO(e.target.value as ConditionalEvent["TIPO"])
        }
        className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
      >
        <option value="FUERZA">Fuerza</option>
        <option value="PREVENTIVO">Preventivo</option>
        <option value="READAPTACION">Readaptación</option>
        <option value="MOVILIDAD">Movilidad</option>
        <option value="RECUPERACION">Recuperación</option>
      </select>

      <input
        value={TITULO}
        onChange={(e) => setTITULO(e.target.value)}
        placeholder="Título"
        className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
      />

      <textarea
        value={DESCRIPCION}
        onChange={(e) => setDESCRIPCION(e.target.value)}
        placeholder="Descripción"
        className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
      />

      <input
        value={JUGADORES}
        onChange={(e) => setJUGADORES(e.target.value)}
        placeholder="Jugadores (IDs o nombres separados por comas)"
        className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
      />

      <input
        value={RESPONSABLE}
        onChange={(e) => setRESPONSABLE(e.target.value)}
        placeholder="Responsable"
        className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          value={DURACION}
          onChange={(e) => setDURACION(e.target.value)}
          placeholder="Duración"
          className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
        />

        <input
          value={INTENSIDAD}
          onChange={(e) => setINTENSIDAD(e.target.value)}
          placeholder="Intensidad"
          className="w-full rounded-xl bg-[#0B0F14] border border-white/10 px-3 py-2"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2"
        >
          Cancelar
        </button>

        <button
          onClick={() =>
            onSave({
              TIPO,
              TITULO,
              DESCRIPCION,
              JUGADORES,
              RESPONSABLE,
              DURACION,
              INTENSIDAD,
            })
          }
          className="rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2"
        >
          {initialData ? "Guardar cambios" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
}