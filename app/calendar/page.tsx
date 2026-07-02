"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

interface TrackingSession {
  id: string;
  jugador: string;
  rival: string;
  tipo: string;
  fecha: string;
}

const START_DATE = new Date(2026, 6, 13); //13 julio
const END_DATE = new Date(2027, 5, 30);   //30 junio

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

const WEEK_DAYS = [
  "L",
  "M",
  "X",
  "J",
  "V",
  "S",
  "D",
];

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function isInsideSeason(date: Date) {
  return date >= START_DATE && date <= END_DATE;
}

function getMonday(date: Date) {
  const d = new Date(date);

  const day = d.getDay();

  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);

  return d;
}

function buildMonth(month: number, year: number) {
  const first = new Date(year, month, 1);

  const start = getMonday(first);

  const weeks: Date[][] = [];

  let current = new Date(start);

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

export default function TrackingCalendarPage() {
  const [tracking, setTracking] = useState<TrackingSession[]>([]);

  const [playerFilter, setPlayerFilter] = useState("");

  const [rivalFilter, setRivalFilter] = useState("");

  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    // Aquí cargaremos posteriormente los seguimientos
    // setTracking(...)
  }, []);

  const months = useMemo(() => {
    const result = [];

    let current = new Date(START_DATE);

    while (current <= END_DATE) {
      result.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        name:
          MONTHS[current.getMonth()] +
          " " +
          current.getFullYear(),
        weeks: buildMonth(
          current.getMonth(),
          current.getFullYear()
        ),
      });

      current = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        1
      );
    }

    return result;
  }, []);

  const filteredTracking = useMemo(() => {
    return tracking.filter((t) => {
      if (
        playerFilter &&
        t.jugador !== playerFilter
      )
        return false;

      if (
        rivalFilter &&
        t.rival !== rivalFilter
      )
        return false;

      if (
        typeFilter &&
        t.tipo !== typeFilter
      )
        return false;

      return true;
    });
  }, [
    tracking,
    playerFilter,
    rivalFilter,
    typeFilter,
  ]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full">
          <Topbar />

          <div className="px-8 pt-8 pb-14">

            <div className="mb-10">

              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF CASTILLA
              </p>

              <div className="mt-4 flex items-center gap-5">

                <h1 className="text-4xl font-semibold">
                  Calendario de Seguimiento
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

              </div>

              <p className="mt-4 text-white/60">
                Temporada 2026 / 2027
              </p>

            </div>

            <div className="mb-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">

              <div className="grid gap-5 lg:grid-cols-3">

                <div>

                  <label className="mb-2 block text-sm text-white/70">
                    Jugador
                  </label>

                  <select
                    value={playerFilter}
                    onChange={(e) =>
                      setPlayerFilter(e.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#11161D] px-4 py-3"
                  >
                    <option value="">
                      Todos
                    </option>
                  </select>

                </div>

                <div>

                  <label className="mb-2 block text-sm text-white/70">
                    Rival
                  </label>

                  <select
                    value={rivalFilter}
                    onChange={(e) =>
                      setRivalFilter(e.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#11161D] px-4 py-3"
                  >
                    <option value="">
                      Todos
                    </option>
                  </select>

                </div>

                <div>

                  <label className="mb-2 block text-sm text-white/70">
                    Tipo
                  </label>

                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#11161D] px-4 py-3"
                  >
                    <option value="">
                      Todos
                    </option>
                  </select>

                </div>

              </div>

            </div>

            {/* ======================
                 ENTREGA 2
                 Aquí irá el calendario
            ====================== */}

          </div>

        </section>

      </div>
    </main>
  );
}