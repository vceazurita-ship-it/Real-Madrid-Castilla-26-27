"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  CalendarDays,
  Check,
  CloudOff,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import PlayerChip from "@/components/session-board/PlayerChip";
import SessionPitch from "@/components/session-board/SessionPitch";
import TaskBoard from "@/components/session-board/TaskBoard";
import { useTrainingPlayers } from "@/hooks/useTrainingPlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { BIB_ORDER, bibTheme } from "@/lib/session-board/bibs";
import {
  balanceTeams,
  canTrain,
  createBoard,
  createTask,
  normalizeBoard,
  todayKey,
} from "@/lib/session-board/helpers";
import { statusTheme } from "@/lib/session-board/status";
import type { BoardTask, SessionBoard } from "@/lib/session-board/types";
import type { Player } from "@/types/player";
import { cn } from "@/lib/utils";

const STATUS_LEGEND = [
  "ÓPTIMO",
  "CONTROL DE CARGA",
  "TOCADO",
  "REINCORPORACIÓN",
  "SANCIONADO",
] as const;

export default function PizarraSesionPage() {
  const { players, loading } = useTrainingPlayers();

  const [fecha, setFecha] = useState(todayKey);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Player | null>(null);

  const fallback = useMemo(() => createBoard(fecha), [fecha]);

  const { value, setValue, status, localOnly, reload } =
    useRemoteDoc<SessionBoard>({
      key: `session-board:${fecha}`,
      kind: "session-board",
      fallback,
    });

  const board = useMemo(() => normalizeBoard(value), [value]);

  const update = useCallback(
    (updater: (current: SessionBoard) => SessionBoard) => {
      setValue((current) => updater(normalizeBoard(current)));
    },
    [setValue]
  );

  /** Jugadores que pueden entrenar hoy, según el estado de la última sesión. */
  const convocados = useMemo(
    () => players.filter(canTrain),
    [players]
  );

  const excluidos = useMemo(
    () => new Set(board.excluidos),
    [board.excluidos]
  );

  const enSesion = useMemo(
    () => convocados.filter((player) => !excluidos.has(player.id)),
    [convocados, excluidos]
  );

  const activeTask =
    board.tasks.find((task) => task.id === activeTaskId) ?? board.tasks[0];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  );

  const toggleExcluido = (playerId: string) =>
    update((current) => {
      const off = current.excluidos.includes(playerId);

      return {
        ...current,
        excluidos: off
          ? current.excluidos.filter((id) => id !== playerId)
          : [...current.excluidos, playerId],
        // Al apartar a un jugador desaparece también de todas las tareas.
        tasks: off
          ? current.tasks
          : current.tasks.map((task) => ({
              ...task,
              teams: task.teams.map((team) => ({
                ...team,
                playerIds: team.playerIds.filter((id) => id !== playerId),
              })),
            })),
      };
    });

  const replaceTask = (next: BoardTask) =>
    update((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === next.id ? next : task)),
    }));

  const addTask = () => {
    const task = createTask(board.tasks.length);

    update((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setActiveTaskId(task.id);
  };

  const removeTask = (taskId: string) => {
    if (board.tasks.length <= 1) return;

    const remaining = board.tasks.filter((task) => task.id !== taskId);

    update((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));

    if (taskId === activeTask?.id) setActiveTaskId(remaining[0]?.id ?? null);
  };

  const autoBalance = (taskId: string) =>
    update((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? { ...task, teams: balanceTeams(task.teams, enSesion) }
          : task
      ),
    }));

  function handleDragStart(event: DragStartEvent) {
    const playerId = event.active.data.current?.playerId as string | undefined;

    setDragging(enSesion.find((player) => player.id === playerId) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);

    const { active, over } = event;

    if (!over || !activeTask) return;

    const playerId = active.data.current?.playerId as string | undefined;
    if (!playerId) return;

    const overId = String(over.id);

    const targetTeamId = overId.startsWith("team:")
      ? overId.slice("team:".length)
      : null;

    replaceTask({
      ...activeTask,
      teams: activeTask.teams.map((team) => {
        const without = team.playerIds.filter((id) => id !== playerId);

        return team.id === targetTeamId
          ? { ...team, playerIds: [...without, playerId] }
          : { ...team, playerIds: without };
      }),
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex">
          <Sidebar />

          <section className="flex min-w-0 flex-1 flex-col">
            <Topbar />

            <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-10">
              {/* CABECERA */}

              <header>
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                  RMCF Castilla · Sesión
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Pizarra de Sesión
                  </h1>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />

                  <SaveBadge status={status} localOnly={localOnly} />
                </div>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
                  Un campograma con todos los jugadores que pueden entrenar y un
                  campograma por tarea para repartir equipos con peto amarillo,
                  naranja, verde o sin peto.
                </p>
              </header>

              {/* CONTROLES */}

              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/40">
                    <CalendarDays size={12} />
                    Fecha de la sesión
                  </span>

                  <input
                    type="date"
                    value={fecha}
                    onChange={(event) =>
                      setFecha(event.target.value || todayKey())
                    }
                    className="rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
                  />
                </label>

                <label className="block min-w-[220px] flex-1">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
                    Título de la sesión
                  </span>

                  <input
                    value={board.titulo}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        titulo: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
                  />
                </label>

                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <RefreshCw size={14} />
                  Recargar
                </button>
              </div>

              {localOnly && (
                <p className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  <span>
                    La pizarra se está guardando solo en este dispositivo. Para
                    sincronizarla, ejecuta{" "}
                    <code className="rounded bg-black/40 px-1">
                      supabase/app_documents.sql
                    </code>{" "}
                    en Supabase.
                  </span>
                </p>
              )}

              {/* MÉTRICAS */}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Convocados" value={convocados.length} />
                <Stat label="En sesión" value={enSesion.length} accent />
                <Stat label="Apartados" value={board.excluidos.length} />
                <Stat label="Tareas" value={board.tasks.length} />
              </div>

              {/* CAMPOGRAMA DE SESIÓN */}

              <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-3 shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Campograma de sesión
                    </h2>

                    <p className="mt-0.5 text-xs text-white/45">
                      Todos los que pueden entrenar hoy. Haz clic en un jugador
                      para apartarlo de la sesión.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_LEGEND.map((estado) => {
                      const theme = statusTheme(estado);

                      return (
                        <span
                          key={estado}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
                            theme.chip
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", theme.dot)}
                          />
                          {theme.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {loading ? (
                  <div className="h-[420px] animate-pulse rounded-[26px] border border-white/10 bg-[#11161D]" />
                ) : convocados.length === 0 ? (
                  <p className="rounded-[26px] border border-dashed border-white/15 px-6 py-16 text-center text-sm text-white/45">
                    No hay jugadores disponibles. Importa la disponibilidad en
                    Jugadores Sesión.
                  </p>
                ) : (
                  <SessionPitch
                    players={convocados}
                    excluidos={board.excluidos}
                    onToggle={toggleExcluido}
                  />
                )}
              </section>

              {/* TAREAS */}

              <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-3 shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Campogramas por tarea</h2>

                  <p className="mt-0.5 text-xs text-white/45">
                    Un campograma por tarea para formar los equipos de la sesión.
                  </p>
                </div>

                {/* PESTAÑAS */}

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {board.tasks.map((task, index) => {
                    const isActive = task.id === activeTask?.id;

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-xl border px-1 transition",
                          isActive
                            ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(task.id)}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-2 text-xs font-semibold",
                            isActive ? "text-[#C8A96B]" : "text-white/65"
                          )}
                        >
                          <span className="tabular-nums opacity-60">
                            {index + 1}
                          </span>

                          <span className="max-w-[160px] truncate">
                            {task.nombre}
                          </span>

                          <span className="flex gap-0.5">
                            {task.teams.map((team) => (
                              <span
                                key={team.id}
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  bibTheme(team.color).dot
                                )}
                              />
                            ))}
                          </span>
                        </button>

                        {board.tasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            title="Eliminar tarea"
                            className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/15 hover:text-red-300"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addTask}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
                  >
                    <Plus size={14} />
                    Nueva tarea
                  </button>
                </div>

                {activeTask && (
                  <TaskBoard
                    key={activeTask.id}
                    task={activeTask}
                    players={enSesion}
                    onChange={replaceTask}
                    onAutoBalance={() => autoBalance(activeTask.id)}
                  />
                )}

                {/* LEYENDA DE PETOS */}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                    Petos
                  </span>

                  {BIB_ORDER.map((color) => {
                    const theme = bibTheme(color);

                    return (
                      <span
                        key={color}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/70"
                      >
                        <span
                          className={cn("h-2 w-2 rounded-full", theme.dot)}
                        />
                        {theme.label}
                      </span>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <PlayerChip player={dragging} from="overlay" size="sm" />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3">
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          accent ? "text-[#C8A96B]" : "text-white"
        )}
      >
        {value}
      </p>

      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
    </div>
  );
}

function SaveBadge({
  status,
  localOnly,
}: {
  status: string;
  localOnly: boolean;
}) {
  if (localOnly) {
    return (
      <Badge tone="amber" icon={<CloudOff size={13} />}>
        Solo en este dispositivo
      </Badge>
    );
  }

  if (status === "loading" || status === "saving") {
    return (
      <Badge tone="neutral" icon={<Loader2 size={13} className="animate-spin" />}>
        {status === "loading" ? "Cargando" : "Guardando"}
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <Badge tone="red" icon={<TriangleAlert size={13} />}>
        Error al guardar
      </Badge>
    );
  }

  return (
    <Badge tone="green" icon={<Check size={13} />}>
      Guardado
    </Badge>
  );
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: "green" | "amber" | "red" | "neutral";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    neutral: "border-white/15 bg-white/5 text-white/60",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
        tones[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}
