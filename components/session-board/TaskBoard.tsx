"use client";

import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { Shuffle, UserPlus, Users, X } from "lucide-react";
import type { Player } from "@/types/player";
import { BIB_ORDER } from "@/lib/session-board/bibs";
import type { BibColor, BoardTask } from "@/lib/session-board/types";
import { cn } from "@/lib/utils";
import PlayerChip from "./PlayerChip";
import TeamZone from "./TeamZone";

const MAX_TEAMS = 4;
const MIN_TEAMS = 2;

interface Props {
  task: BoardTask;
  /** Jugadores disponibles para la sesión, ya filtrados. */
  players: Player[];
  onChange: (task: BoardTask) => void;
  onAutoBalance: () => void;
}

/** Rejilla de zonas según cuántos equipos tenga la tarea. */
function gridFor(teams: number) {
  if (teams <= 2) return "grid-cols-1";
  if (teams === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2";
}

export default function TaskBoard({
  task,
  players,
  onChange,
  onAutoBalance,
}: Props) {
  const byId = new Map(players.map((player) => [player.id, player]));

  const assigned = new Set(task.teams.flatMap((team) => team.playerIds));

  const pool = players.filter((player) => !assigned.has(player.id));

  const { setNodeRef: poolRef, isOver: poolOver } = useDroppable({
    id: "pool",
    data: { teamId: null },
  });

  const updateTeams = (teams: BoardTask["teams"]) =>
    onChange({ ...task, teams });

  const removePlayer = (playerId: string) =>
    updateTeams(
      task.teams.map((team) => ({
        ...team,
        playerIds: team.playerIds.filter((id) => id !== playerId),
      }))
    );

  const addTeam = () => {
    if (task.teams.length >= MAX_TEAMS) return;

    const used = new Set(task.teams.map((team) => team.color));

    const free: BibColor =
      BIB_ORDER.find((color) => !used.has(color)) ?? "sin-peto";

    updateTeams([
      ...task.teams,
      {
        id: `team-${task.id}-${task.teams.length}-${Date.now().toString(36)}`,
        nombre: `Equipo ${task.teams.length + 1}`,
        color: free,
        playerIds: [],
      },
    ]);
  };

  const removeTeam = (teamId: string) => {
    if (task.teams.length <= MIN_TEAMS) return;

    updateTeams(task.teams.filter((team) => team.id !== teamId));
  };

  return (
    <div className="space-y-4">
      {/* DATOS DE LA TAREA */}

      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
            Nombre de la tarea
          </span>

          <input
            value={task.nombre}
            onChange={(event) =>
              onChange({ ...task, nombre: event.target.value })
            }
            className="w-full rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
            Formato
          </span>

          <input
            value={task.formato}
            placeholder="7v7"
            onChange={(event) =>
              onChange({ ...task, formato: event.target.value })
            }
            className="w-full rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
            Duración
          </span>

          <input
            value={task.duracion}
            placeholder="15 min"
            onChange={(event) =>
              onChange({ ...task, duracion: event.target.value })
            }
            className="w-full rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/60"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
          Descripción / objetivo
        </span>

        <textarea
          value={task.descripcion}
          rows={2}
          placeholder="Objetivo de la tarea, reglas de provocación, condicionantes..."
          onChange={(event) =>
            onChange({ ...task, descripcion: event.target.value })
          }
          className="w-full resize-y rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/60"
        />
      </label>

      {/* ACCIONES */}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAutoBalance}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3.5 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
        >
          <Shuffle size={14} />
          Repartir equipos
        </button>

        <button
          type="button"
          onClick={addTeam}
          disabled={task.teams.length >= MAX_TEAMS}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <UserPlus size={14} />
          Añadir equipo
        </button>

        <button
          type="button"
          onClick={() =>
            updateTeams(task.teams.map((team) => ({ ...team, playerIds: [] })))
          }
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X size={14} />
          Vaciar tarea
        </button>

        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/40">
          <Users size={13} />
          {assigned.size} de {players.length} colocados
        </span>
      </div>

      {/* CAMPOGRAMA DE LA TAREA */}

      <div className="pitch-photo relative overflow-hidden rounded-[26px] border border-[#C8A96B]/20 shadow-[0_25px_80px_rgba(0,0,0,.45)]">
        <Image
          src="/field2.png"
          alt=""
          fill
          unoptimized
          /* Sólo hay un campograma de tarea a la vez y ocupa media pantalla:
             es el elemento grande de la vista, no algo que deba esperar. */
          priority
          draggable={false}
          className="pointer-events-none select-none object-cover"
        />

        <div className="pitch-photo-veil absolute inset-0 bg-[#050A10]/70" />

        {/* Modo día: aclara el césped hasta los tonos del tema claro (globals.css) */}
        <div className="pitch-photo-wash" />

        <div
          className={cn(
            "relative grid gap-2.5 p-3 sm:gap-3 sm:p-4",
            gridFor(task.teams.length)
          )}
        >
          {task.teams.map((team) => (
            <TeamZone
              key={team.id}
              team={team}
              canDelete={task.teams.length > MIN_TEAMS}
              players={team.playerIds
                .map((id) => byId.get(id))
                .filter((player): player is Player => Boolean(player))}
              onRename={(nombre) =>
                updateTeams(
                  task.teams.map((item) =>
                    item.id === team.id ? { ...item, nombre } : item
                  )
                )
              }
              onColor={(color) =>
                updateTeams(
                  task.teams.map((item) =>
                    item.id === team.id ? { ...item, color } : item
                  )
                )
              }
              onDelete={() => removeTeam(team.id)}
              onRemovePlayer={removePlayer}
            />
          ))}
        </div>
      </div>

      {/* BANQUILLO DE LA TAREA */}

      <div
        ref={poolRef}
        className={cn(
          "rounded-2xl border border-dashed border-white/15 bg-[#11161D] p-3 transition",
          poolOver && "border-[#C8A96B]/60 bg-[#C8A96B]/5"
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Sin asignar
          </p>

          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/55">
            {pool.length}
          </span>
        </div>

        {pool.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-white/30">
            Todos los jugadores están repartidos
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {pool.map((player) => (
              <PlayerChip
                key={player.id}
                player={player}
                from="pool"
                size="sm"
                hint="Arrastra a un equipo"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
