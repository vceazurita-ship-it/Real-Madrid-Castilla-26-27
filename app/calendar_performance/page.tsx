"use client";

import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";

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
  const { players } = usePlayers();

  const [events, setEvents] = useState<ConditionalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ConditionalEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ConditionalEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(0);

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

                        const dayEvents = events.filter((e) =>
                          e.FECHA.startsWith(key)
                        );

                        const hasEvents = dayEvents.length > 0;

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
                className="bg-[#141B24] rounded-2xl w-[95%] max-w-xl max-h-[85vh] overflow-y-auto p-6"
              >
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

{isCreating && (
  <EventForm
    players={players}
    date={selectedDate!}
    onCancel={() => setIsCreating(false)}
    onSave={async (form) => {
      const fecha = selectedDate!.toISOString().split("T")[0];

      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "crearEventoCondicional",
            FECHA: fecha,
            TIPO: form.TIPO,
            TITULO: form.TITULO,
            DESCRIPCION: form.DESCRIPCION,
            JUGADORES: form.JUGADORES,
            RESPONSABLE: form.RESPONSABLE,
            DURACION: form.DURACION,
            INTENSIDAD: form.INTENSIDAD,
          }),
        });

        const text = await res.text();
        console.log("Respuesta Apps Script:", text);

        // Recargamos desde el servidor
        const r = await fetch(`${APPS_SCRIPT_URL}?action=condicional`);
        const data: ConditionalEvent[] = await r.json();

        setEvents(data);
        setSelectedEvents(data.filter((e) => e.FECHA.startsWith(fecha)));
        setIsCreating(false);
      } catch (err) {
        console.error("Error guardando evento:", err);
        alert("No se pudo guardar el trabajo condicional");
      }
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
                          onClick={() => deleteEvent(event.ID_EVENTO)}
                          className="rounded-lg border border-red-500 px-3 py-2 text-sm text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
  onCancel,
  onSave,
}: {
  players: any[];
  date: Date;
  onCancel: () => void;
  onSave: (data: any) => void;
}) {
  const [TIPO, setTIPO] = useState<ConditionalEvent["TIPO"]>("FUERZA");
  const [TITULO, setTITULO] = useState("");
  const [DESCRIPCION, setDESCRIPCION] = useState("");
  const [JUGADORES, setJUGADORES] = useState("");
  const [RESPONSABLE, setRESPONSABLE] = useState("");
  const [DURACION, setDURACION] = useState("");
  const [INTENSIDAD, setINTENSIDAD] = useState("");

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-[#10151C] p-4 space-y-4">
      <h3 className="text-lg font-semibold">Nuevo trabajo condicional</h3>

      <select
        value={TIPO}
        onChange={(e) => setTIPO(e.target.value as any)}
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
          Guardar
        </button>
      </div>
    </div>
  );
}
}