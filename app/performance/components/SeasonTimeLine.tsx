"use client";

import {
  CalendarDays,
  ImageIcon,
  FileText,
  Upload,
} from "lucide-react";
import { MonthData, WeekData } from "../data";

interface Props {
  season: MonthData[];
  selectedWeek: WeekData | null;
  onSelectWeek: (week: WeekData) => void;
}
export default function SeasonTimeline({
  season,
  selectedWeek,
  onSelectWeek,
}: Props) {
  return (
    <div className="space-y-10 max-h-[calc(100vh-170px)] overflow-y-auto pr-2">

      {season.map((month) => (

        <section key={month.id}>

          {/* CABECERA MES */}

          <div className="sticky top-0 z-10 mb-6 bg-[#0B0F14] pb-4">

            <div className="flex items-center gap-4">

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#11161D]">

                <CalendarDays
                  size={18}
                  className="text-[#C8A96B]"
                />

              </div>

              <div>

                <h2 className="text-xl font-semibold">
                  {month.name}
                </h2>

                <p className="text-sm text-white/50">
                  {month.weeks.length} semanas
                </p>

              </div>

              <div className="h-px flex-1 bg-white/10" />

            </div>

          </div>

          {/* TIMELINE */}

          <div className="relative ml-5 border-l border-white/10 pl-8 space-y-5">

            {month.weeks.map((week) => {

              const active = selectedWeek?.id === week.id;

              return (

                <button
                  key={week.id}
                  onClick={() => onSelectWeek(week)}
                  className={`group relative w-full rounded-3xl border p-6 text-left transition-all duration-300 ${
                    active
                      ? "border-[#C8A96B] bg-[#161D26] shadow-[0_0_30px_rgba(200,169,107,.20)]"
                      : "border-white/10 bg-[#11161D] hover:border-[#C8A96B]/40 hover:bg-[#141A22]"
                  }`}
                >

                  {/* PUNTO TIMELINE */}

                  <div
                    className={`absolute -left-[43px] top-8 h-5 w-5 rounded-full border-4 ${
                      active
                        ? "border-[#C8A96B] bg-[#C8A96B]"
                        : "border-white/20 bg-[#0B0F14]"
                    }`}
                  />

                  {/* CABECERA */}

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <h3 className="text-lg font-semibold">
                        {week.week}
                      </h3>

                      <p className="mt-1 text-sm text-white/50">
                        {week.start} · {week.end}
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        week.images.length
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      {week.images.length ? "Disponible" : "Pendiente"}
                    </span>

                  </div>

                  {/* ESTADÍSTICAS */}

                  <div className="mt-6 flex flex-wrap gap-6">

                    <div className="flex items-center gap-2 text-sm text-white/60">

                      <ImageIcon
                        size={17}
                        className="text-[#C8A96B]"
                      />

                      <span>
                        {week.images.length} imágenes
                      </span>

                    </div>

                    <div className="flex items-center gap-2 text-sm text-white/60">

                      <FileText
                        size={17}
                        className="text-[#C8A96B]"
                      />

                      <span>
                        {week.pdf ? "PDF disponible" : "Sin PDF"}
                      </span>

                    </div>

                  </div>

                  {/* BOTÓN SUBIR */}

                  <div className="mt-6 border-t border-white/10 pt-5">

                    <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#C8A96B]/40 bg-[#0B0F14] px-4 py-2 text-sm text-[#C8A96B] transition group-hover:border-[#C8A96B]">

                      <Upload size={16} />

                      <span>Subir archivos</span>

                    </div>

                  </div>

                </button>

              );

            })}

          </div>

        </section>

      ))}

    </div>
  );
}