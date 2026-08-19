"use client";

import { ReactNode, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  CalendarMonth,
  MONTHS,
  SEASON_LABEL,
  WEEK,
  WEEK_SHORT,
  buildCalendar,
  dateKey,
  isOutOfSeason,
  isToday as isTodayFn,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type CalendarDayContext = {
  date: Date;
  /** Clave local "YYYY-MM-DD" del día. */
  key: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  outOfSeason: boolean;
};

export type CalendarDayCell = {
  /** Marca el día como "con actividad": más alto, clicable y resaltado. */
  hasContent?: boolean;
  /** Clase de fondo cuando hay actividad (por defecto bg-[#141B24]). */
  accentClass?: string;
  onClick?: () => void;
  /** Píldoras junto al número del día. */
  badges?: ReactNode;
  /** Cuerpo scrollable de la celda. */
  children?: ReactNode;
};

export type CalendarLegendItem = {
  label: string;
  /** Clase de color del punto, p. ej. "bg-sky-400". */
  color: string;
};

type CalendarShellProps = {
  eyebrow: string;
  title: string;
  months: CalendarMonth[];
  monthIndex: number;
  onMonthChange: (index: number) => void;
  /** Resumen del mes (usa CalendarStat). */
  stats?: ReactNode;
  legend?: CalendarLegendItem[];
  /** Acciones extra a la derecha de la cabecera del mes. */
  toolbar?: ReactNode;
  loading?: boolean;
  /** Desactiva las flechas de mes (por ejemplo con un modal abierto). */
  keyboardEnabled?: boolean;
  renderDay: (ctx: CalendarDayContext) => CalendarDayCell;
  /** Modales y overlays de la página. */
  children?: ReactNode;
};

export function CalendarStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold text-white">{value}</p>

      {hint && <p className="text-[11px] text-white/45">{hint}</p>}
    </div>
  );
}

export function CalendarShell({
  eyebrow,
  title,
  months,
  monthIndex,
  onMonthChange,
  stats,
  legend,
  toolbar,
  loading = false,
  keyboardEnabled = true,
  renderDay,
  children,
}: CalendarShellProps) {
  const active = months[monthIndex] ?? months[0];
  const calendar = buildCalendar(active.month, active.year);

  const today = new Date();
  const todayIndex = months.findIndex(
    (m) => m.month === today.getMonth() && m.year === today.getFullYear()
  );
  const canGoToday = todayIndex !== -1 && todayIndex !== monthIndex;

  // Navegación de mes con el teclado (ignorada mientras se escribe).
  useEffect(() => {
    if (!keyboardEnabled) return;

    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && monthIndex > 0) {
        onMonthChange(monthIndex - 1);
      }

      if (e.key === "ArrowRight" && monthIndex < months.length - 1) {
        onMonthChange(monthIndex + 1);
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [keyboardEnabled, monthIndex, months.length, onMonthChange]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full min-w-0">
          <Topbar />

          <div className="px-4 md:px-8 py-6 md:py-8">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              {eyebrow}
            </p>

            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
              <h1 className="text-2xl md:text-4xl font-semibold">{title}</h1>

              <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
            </div>

            {stats && (
              <div className="mt-5 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
                {stats}
              </div>
            )}

            <div className="mt-6 md:mt-8 rounded-[20px] md:rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 md:p-8">
              {/* Cabecera del mes */}
              <div className="mb-6 flex items-center justify-between gap-3 md:mb-8">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  disabled={monthIndex === 0}
                  onClick={() => onMonthChange(monthIndex - 1)}
                  className="rounded-xl border border-white/10 bg-[#11161D] p-2 transition hover:border-[#C8A96B] disabled:opacity-30 md:p-3"
                >
                  <ChevronLeft />
                </button>

                <div className="min-w-0 text-center">
                  <h2 className="truncate text-xl font-semibold md:text-3xl">
                    {MONTHS[active.month]} {active.year}
                  </h2>

                  <p className="mt-1 text-xs text-white/50 md:text-base">
                    {SEASON_LABEL}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {toolbar}

                  <button
                    type="button"
                    disabled={!canGoToday}
                    onClick={() => onMonthChange(todayIndex)}
                    title="Ir al mes actual"
                    className="hidden items-center gap-2 rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm transition hover:border-[#C8A96B] disabled:opacity-30 sm:flex"
                  >
                    <CalendarDays size={16} className="text-[#C8A96B]" />
                    Hoy
                  </button>

                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    disabled={monthIndex === months.length - 1}
                    onClick={() => onMonthChange(monthIndex + 1)}
                    className="rounded-xl border border-white/10 bg-[#11161D] p-2 transition hover:border-[#C8A96B] disabled:opacity-30 md:p-3"
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[700px] md:min-w-[1100px]">
                  {/* Cabecera días */}
                  <div className="mb-2 grid grid-cols-7 gap-1 md:gap-2">
                    {WEEK.map((day, i) => (
                      <div
                        key={day}
                        className="rounded-lg border border-white/10 bg-[#11161D] py-2 text-center md:rounded-xl md:py-4"
                      >
                        <span className="text-sm font-semibold text-[#C8A96B]">
                          <span className="md:hidden">{WEEK_SHORT[i]}</span>
                          <span className="hidden md:inline">{day}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {loading ? (
                    <CalendarSkeleton weeks={calendar.length} />
                  ) : (
                    <div className="space-y-1 md:space-y-2">
                      {calendar.map((week, weekIndex) => (
                        <div
                          key={weekIndex}
                          className="grid grid-cols-7 gap-1 md:gap-2"
                        >
                          {week.map((date) => (
                            <DayCell
                              key={date.getTime()}
                              date={date}
                              activeMonth={active.month}
                              renderDay={renderDay}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {legend && legend.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4">
                  {legend.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full", item.color)}
                      />
                      <span className="text-xs text-white/60">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}

function DayCell({
  date,
  activeMonth,
  renderDay,
}: {
  date: Date;
  activeMonth: number;
  renderDay: (ctx: CalendarDayContext) => CalendarDayCell;
}) {
  const isCurrentMonth = date.getMonth() === activeMonth;
  const today = isTodayFn(date);
  const outOfSeason = isOutOfSeason(date);

  const cell = renderDay({
    date,
    key: dateKey(date),
    isCurrentMonth,
    isToday: today,
    outOfSeason,
  });

  const interactive = Boolean(cell.onClick) && !outOfSeason;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? cell.onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                cell.onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative flex flex-col rounded-xl border p-2 transition-all duration-200 md:p-3",
        cell.hasContent
          ? "min-h-[120px] md:min-h-[160px]"
          : "min-h-[70px] md:min-h-[90px]",
        outOfSeason
          ? "border-white/5 bg-[#090C10] opacity-30"
          : cn(
              "border-white/10",
              cell.hasContent
                ? cell.accentClass ?? "bg-[#141B24]"
                : "bg-[#10151C]",
              interactive &&
                "cursor-pointer hover:-translate-y-0.5 hover:border-[#C8A96B]/40 focus:outline-none focus-visible:border-[#C8A96B]"
            ),
        !isCurrentMonth && !outOfSeason && "opacity-60"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 md:mb-3">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold md:h-8 md:w-8 md:text-sm",
            today
              ? "bg-[#C8A96B] text-black"
              : isCurrentMonth
              ? "text-white"
              : "text-white/35"
          )}
        >
          {date.getDate()}
        </div>

        {cell.badges}
      </div>

      {cell.children && (
        <div className="max-h-[80px] space-y-1 overflow-y-auto pr-1 md:max-h-[120px] md:space-y-2">
          {cell.children}
        </div>
      )}

      {today && (
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-[#C8A96B]/50" />
      )}
    </div>
  );
}

function CalendarSkeleton({ weeks }: { weeks: number }) {
  return (
    <div className="space-y-1 md:space-y-2">
      {Array.from({ length: weeks }).map((_, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1 md:gap-2">
          {Array.from({ length: 7 }).map((_, dayIndex) => (
            <div
              key={dayIndex}
              className="min-h-[70px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03] md:min-h-[90px]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
