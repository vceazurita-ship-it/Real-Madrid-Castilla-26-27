"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Clock3, Dumbbell } from "lucide-react";
import {
  CalendarShell,
  CalendarStat,
  type CalendarLegendItem,
} from "@/components/ui/calendar-shell";
import {
  CalendarDayModal,
  CalendarEmptyState,
} from "@/components/ui/calendar-day-modal";
import {
  buildSeasonMonths,
  currentMonthIndex,
  formatMinutes,
  normalizeText,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";


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

  "Intensidad (1-10)": number;
  "Carga Ponderada": number;

  "Demanda Cognitiva(1-10)": number;
  "Carga cognitiva": number;

  Observaciones: string;
};

type PhaseTheme = {
  label: string;
  dot: string;
  chip: string;
  cell: string;
  bar: string;
};

const PHASE_THEMES: Record<string, PhaseTheme> = {
  OFENSIVA: {
    label: "Ofensiva",
    dot: "bg-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    cell: "bg-emerald-500/10",
    bar: "bg-emerald-400",
  },
  DEFENSIVA: {
    label: "Defensiva",
    dot: "bg-red-400",
    chip: "bg-red-500/15 text-red-300 border border-red-500/30",
    cell: "bg-red-500/10",
    bar: "bg-red-400",
  },
  TR_OFENSIVA: {
    label: "Transición ofensiva",
    dot: "bg-sky-400",
    chip: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    cell: "bg-sky-500/10",
    bar: "bg-sky-400",
  },
  TR_DEFENSIVA: {
    label: "Transición defensiva",
    dot: "bg-orange-400",
    chip: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    cell: "bg-orange-500/10",
    bar: "bg-orange-400",
  },
  ABP: {
    label: "ABP",
    dot: "bg-violet-400",
    chip: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
    cell: "bg-violet-500/10",
    bar: "bg-violet-400",
  },
  GLOBAL: {
    label: "Global",
    dot: "bg-yellow-400",
    chip: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    cell: "bg-yellow-500/10",
    bar: "bg-yellow-400",
  },
};

const NEUTRAL_THEME: PhaseTheme = {
  label: "Sin fase",
  dot: "bg-white/40",
  chip: "bg-white/10 text-white/70 border border-white/10",
  cell: "bg-[#141B24]",
  bar: "bg-white/30",
};

const LEGEND: CalendarLegendItem[] = Object.values(PHASE_THEMES).map((t) => ({
  label: t.label,
  color: t.dot,
}));

/**
 * Resuelve el tema de una fase. Las transiciones se comprueban antes que
 * ofensiva/defensiva porque "TR OFENSIVA" contiene ambas palabras.
 */
function phaseTheme(fase: string): PhaseTheme {
  const value = normalizeText(fase);

  if (!value) return NEUTRAL_THEME;

  const isTransition = /\bTR\b|TRANSICION/.test(value);

  if (isTransition && value.includes("OFENS")) return PHASE_THEMES.TR_OFENSIVA;
  if (isTransition && value.includes("DEFENS")) return PHASE_THEMES.TR_DEFENSIVA;
  if (value.includes("ABP")) return PHASE_THEMES.ABP;
  if (value.includes("GLOBAL")) return PHASE_THEMES.GLOBAL;
  if (value.includes("OFENS")) return PHASE_THEMES.OFENSIVA;
  if (value.includes("DEFENS")) return PHASE_THEMES.DEFENSIVA;

  return NEUTRAL_THEME;
}

const minutesOf = (task: MicrocycleRecord) => Number(task.Tiempo) || 0;

function MetricBar({
  value,
  max = 100,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full rounded-full bg-[#C8A96B]", className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MicroCalendar() {
  const months = useMemo(() => buildSeasonMonths(), []);

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [microcycleData, setMicrocycleData] = useState<MicrocycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    traeJson<unknown>("/api/rivals?action=microciclo")
      .then((data) => {
        if (cancelled) return;

        if (Array.isArray(data)) {
          setMicrocycleData(data);
          setError(null);
        } else {
          console.error("Microciclo: respuesta inesperada", data);
          setMicrocycleData([]);
          setError("Respuesta inesperada del servidor");
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("No se pudo cargar el microciclo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Tareas agrupadas por día. */
  const tasksByDay = useMemo(() => {
    const map = new Map<string, MicrocycleRecord[]>();

    microcycleData.forEach((task) => {
      const key = recordDateKey(task.Fecha);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    });

    return map;
  }, [microcycleData]);

  const sessionDays = useMemo(() => [...tasksByDay.keys()].sort(), [tasksByDay]);

  const active = months[currentMonth];

  const monthStats = useMemo(() => {
    let sesiones = 0;
    let minutos = 0;
    let carga = 0;
    let cognitiva = 0;
    let tareas = 0;

    sessionDays.forEach((key) => {
      const date = parseDateKey(key);
      if (date.getMonth() !== active.month || date.getFullYear() !== active.year)
        return;

      const dayTasks = tasksByDay.get(key) ?? [];

      sesiones += 1;
      tareas += dayTasks.length;

      dayTasks.forEach((t) => {
        minutos += minutesOf(t);
        carga += Number(t["Carga Ponderada"]) || 0;
        cognitiva += Number(t["Carga cognitiva"]) || 0;
      });
    });

    return {
      sesiones,
      tareas,
      minutos,
      cargaMedia: sesiones > 0 ? Math.round(carga / sesiones) : 0,
      cognitivaMedia: sesiones > 0 ? Math.round(cognitiva / sesiones) : 0,
    };
  }, [sessionDays, tasksByDay, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedIndex = selectedKey ? sessionDays.indexOf(selectedKey) : -1;

  const selectedTasks = useMemo(
    () => (selectedKey ? tasksByDay.get(selectedKey) ?? [] : []),
    [selectedKey, tasksByDay]
  );

  /** Tareas del día agrupadas por contenido principal. */
  const grouped = useMemo(() => {
    return selectedTasks.reduce((acc, task) => {
      const key = task["Contenido Principal"] || "Sin contenido";

      if (!acc[key]) acc[key] = [];
      acc[key].push(task);

      return acc;
    }, {} as Record<string, MicrocycleRecord[]>);
  }, [selectedTasks]);

  const selectedSummary = useMemo(() => {
    const minutos = selectedTasks.reduce((s, t) => s + minutesOf(t), 0);
    const head = selectedTasks[0];

    return {
      minutos,
      micro: head?.Micro ?? "",
      md: head?.MD ?? "",
      rival: head?.Rival ?? "",
    };
  }, [selectedTasks]);

  /** Salta a la sesión anterior/siguiente y sincroniza el mes visible. */
  const goToDay = useCallback(
    (index: number) => {
      const key = sessionDays[index];
      if (!key) return;

      const date = parseDateKey(key);
      const monthIdx = months.findIndex(
        (m) => m.month === date.getMonth() && m.year === date.getFullYear()
      );

      if (monthIdx !== -1) setCurrentMonth(monthIdx);
      setSelectedKey(key);
    },
    [sessionDays, months]
  );

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA INDIVIDUAL"
      title="Calendario de Microciclo"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={LEGEND}
      stats={
        <>
          <CalendarStat
            label="Sesiones"
            value={monthStats.sesiones}
            hint={`${monthStats.tareas} tareas`}
          />
          <CalendarStat
            label="Volumen"
            value={formatMinutes(monthStats.minutos)}
          />
          <CalendarStat label="Carga media / sesión" value={monthStats.cargaMedia} />
          <CalendarStat
            label="Carga cognitiva media"
            value={monthStats.cognitivaMedia}
          />
        </>
      }
      renderDay={({ key }) => {
        const dayTasks = tasksByDay.get(key) ?? [];
        if (dayTasks.length === 0) return {};

        const totalMinutes = dayTasks.reduce((s, t) => s + minutesOf(t), 0);

        // Minutos por contenido principal, ordenados de mayor a menor.
        const blocks = new Map<string, number>();
        dayTasks.forEach((t) => {
          const name = t["Contenido Principal"] || "Sin contenido";
          blocks.set(name, (blocks.get(name) ?? 0) + minutesOf(t));
        });

        const orderedBlocks = [...blocks.entries()].sort((a, b) => b[1] - a[1]);

        // Fase dominante = la que más minutos acumula.
        const phases = new Map<string, number>();
        dayTasks.forEach((t) => {
          const name = t.Fase || "Global";
          phases.set(name, (phases.get(name) ?? 0) + minutesOf(t));
        });

        const dominantPhase =
          [...phases.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

        const theme = phaseTheme(dominantPhase);
        const md = dayTasks[0]?.MD;

        return {
          hasContent: true,
          accentClass: theme.cell,
          onClick: () => setSelectedKey(key),
          badges: (
            <div className="flex items-center gap-1">
              {md && (
                <span className="rounded-full border border-white/15 bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/70">
                  {md}
                </span>
              )}

              <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                {formatMinutes(totalMinutes)}
              </span>
            </div>
          ),
          children: (
            <>
              {orderedBlocks.map(([name, minutes]) => (
                <div key={name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[10px] md:text-xs">{name}</span>

                    <span className="shrink-0 text-[9px] text-white/45">
                      {minutes}&apos;
                    </span>
                  </div>

                  <div className="mt-1">
                    <MetricBar
                      value={minutes}
                      max={totalMinutes}
                      className={theme.bar}
                    />
                  </div>
                </div>
              ))}
            </>
          ),
        };
      }}
    >
      {error && !loading && (
        <div className="px-4 pb-6 md:px-8">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        </div>
      )}

      {selectedDate && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          subtitle={
            [
              `${selectedTasks.length} ${
                selectedTasks.length === 1 ? "tarea" : "tareas"
              }`,
              formatMinutes(selectedSummary.minutos),
              selectedSummary.md,
              selectedSummary.micro && `Micro ${selectedSummary.micro}`,
              selectedSummary.rival && `vs ${selectedSummary.rival}`,
            ]
              .filter(Boolean)
              .join(" · ")
          }
          onClose={() => setSelectedKey(null)}
          onPrev={() => goToDay(selectedIndex - 1)}
          onNext={() => goToDay(selectedIndex + 1)}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < sessionDays.length - 1}
        >
          <div className="space-y-4">
            {selectedTasks.length === 0 && (
              <CalendarEmptyState>
                No hay tareas registradas este día.
              </CalendarEmptyState>
            )}

            {Object.entries(grouped).map(([bloque, tareas]) => {
              const bloqueMinutos = tareas.reduce((s, t) => s + minutesOf(t), 0);

              return (
                <div
                  key={bloque}
                  className="rounded-xl border border-white/10 bg-[#10151C] p-4"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-[#C8A96B]">{bloque}</h3>

                    <span className="shrink-0 text-xs text-white/45">
                      {formatMinutes(bloqueMinutos)} · {tareas.length}{" "}
                      {tareas.length === 1 ? "tarea" : "tareas"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {tareas.map((t, i) => {
                      const theme = phaseTheme(t.Fase);

                      return (
                        <div
                          key={`${t.Tarea}-${t["Contenido Secundario"]}-${t.Tiempo}-${i}`}
                          className="rounded-2xl border border-white/10 bg-[#141B24] p-4 transition-all hover:border-[#C8A96B]/40"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {t.Fase && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                                  theme.chip
                                )}
                              >
                                {t.Fase}
                              </span>
                            )}

                            {t.Formato && (
                              <span className="rounded-full border border-white/10 bg-[#10151C] px-3 py-1 text-[11px] text-white/60">
                                {t.Formato}
                              </span>
                            )}

                            {t.Espacio && (
                              <span className="rounded-full border border-white/10 bg-[#10151C] px-3 py-1 text-[11px] text-white/60">
                                {t.Espacio}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-semibold text-white">
                            {t["Contenido Principal"]}
                          </h4>

                          {t["Contenido Secundario"] && (
                            <p className="mt-1 text-sm text-white/60">
                              {t["Contenido Secundario"]}
                            </p>
                          )}

                          {t.Tarea && (
                            <p className="mt-2 text-sm text-white/75">{t.Tarea}</p>
                          )}

                          <div className="mt-4 mb-5 flex flex-wrap gap-2">
                            <Pill icon={<Clock3 size={15} />}>
                              {t.Tiempo}&apos;
                            </Pill>

                            {t.Grupo && <Pill>{t.Grupo}</Pill>}

                            {Number(t["Nº Jugadores"]) > 0 && (
                              <Pill>{t["Nº Jugadores"]} jug.</Pill>
                            )}
                          </div>

                          <Metric
                            icon={<Dumbbell size={16} className="text-[#C8A96B]" />}
                            label="Carga física"
                            value={Math.round(Number(t["Carga Ponderada"]) || 0)}
                          />

                          <div className="mt-4">
                            <Metric
                              icon={<Brain size={16} className="text-[#C8A96B]" />}
                              label="Carga cognitiva"
                              value={Math.round(Number(t["Carga cognitiva"]) || 0)}
                            />
                          </div>

                          {t.Observaciones && (
                            <p className="mt-4 rounded-xl border border-white/5 bg-[#10151C] px-3 py-2 text-xs text-white/55">
                              {t.Observaciones}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CalendarDayModal>
      )}
    </CalendarShell>
  );
}

function Pill({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#10151C] px-3 py-2 text-sm font-medium">
      {icon && <span className="text-[#C8A96B]">{icon}</span>}
      {children}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>

        <span className="text-sm font-semibold">{value}</span>
      </div>

      <MetricBar value={value} />
    </div>
  );
}
