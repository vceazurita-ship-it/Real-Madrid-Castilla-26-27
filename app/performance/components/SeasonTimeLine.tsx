"use client";

import { CalendarDays, ImageIcon, FileText, ChevronRight } from "lucide-react";
import { season, WeekData } from "../data";

interface Props {
  selectedWeek: WeekData | null;
  onSelectWeek: (week: WeekData) => void;
}

export default function SeasonTimeline({
  selectedWeek,
  onSelectWeek,
}: Props) {
  return (
    <div className="space-y-10">

      {season.map((month) => (

        <section key={month.id}>

          {/* Mes */}

          <div className="flex items-center gap-4 mb-6">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#11161D] border border-white/10">

              <CalendarDays
                size={20}
                className="text-[#C8A96B]"
              />

            </div>

            <div>

              <h2 className="text-2xl font-semibold">
                {month.name}
              </h2>

              <p className="text-sm text-white/50">
                {month.weeks.length} semanas
              </p>

            </div>

            <div className="flex-1 h-px bg-white/10" />

          </div>

          {/* Semanas */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

            {month.weeks.map((week) => {

              const active =
                selectedWeek?.id === week.id;

              return (

                <button
                  key={week.id}
                  onClick={() => onSelectWeek(week)}
                  className={`
                    text-left
                    rounded-3xl
                    border
                    p-5
                    transition-all
                    duration-300
                    ${
                      active
                        ? "border-[#C8A96B] bg-[#161D26] shadow-[0_0_25px_rgba(200,169,107,.25)]"
                        : "border-white/10 bg-[#11161D] hover:border-[#C8A96B]/40 hover:-translate-y-1"
                    }
                  `}
                >

                  <div className="flex items-center justify-between">

                    <div>

                      <h3 className="font-semibold text-lg">
                        {week.week}
                      </h3>

                      <p className="text-xs text-white/50 mt-1">
                        {week.start} · {week.end}
                      </p>

                    </div>

                    <ChevronRight
                      size={18}
                      className="text-[#C8A96B]"
                    />

                  </div>

                  <div className="mt-6 flex gap-5">

                    <div className="flex items-center gap-2 text-sm text-white/60">

                      <ImageIcon size={16} />

                      {week.images.length}

                    </div>

                    <div className="flex items-center gap-2 text-sm text-white/60">

                      <FileText size={16} />

                      {week.pdf ? 1 : 0}

                    </div>

                  </div>

                  <div className="mt-6">

                    {week.images.length > 0 ? (

                      <span className="inline-flex rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400">
                        Disponible
                      </span>

                    ) : (

                      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/50">
                        Pendiente
                      </span>

                    )}

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