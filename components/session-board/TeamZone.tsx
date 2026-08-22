"use client";

import { useDroppable } from "@dnd-kit/core";
import { Check, Trash2 } from "lucide-react";
import type { Player } from "@/types/player";
import { BIB_ORDER, bibTheme } from "@/lib/session-board/bibs";
import type { BibColor, BoardTeam } from "@/lib/session-board/types";
import { cn } from "@/lib/utils";
import PlayerChip from "./PlayerChip";

interface Props {
  team: BoardTeam;
  players: Player[];
  canDelete: boolean;
  onRename: (nombre: string) => void;
  onColor: (color: BibColor) => void;
  onDelete: () => void;
  onRemovePlayer: (playerId: string) => void;
}

/** Zona del campograma que ocupa un equipo dentro de una tarea. */
export default function TeamZone({
  team,
  players,
  canDelete,
  onRename,
  onColor,
  onDelete,
  onRemovePlayer,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team:${team.id}`,
    data: { teamId: team.id },
  });

  const theme = bibTheme(team.color);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[150px] flex-col rounded-2xl border-2 border-dashed p-2.5 transition sm:p-3",
        theme.zone,
        theme.zoneBorder,
        isOver && "scale-[1.01] border-solid shadow-[0_0_35px_rgba(200,169,107,.35)]"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("h-3 w-3 shrink-0 rounded-full", theme.dot)} />

        <input
          value={team.nombre}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Nombre del equipo"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-white outline-none transition hover:border-white/15 focus:border-[#C8A96B]/60 focus:bg-black/30"
        />

        <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/70">
          {team.playerIds.length}
        </span>

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar equipo"
            className="shrink-0 rounded-lg p-1 text-white/40 transition hover:bg-red-500/15 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1">
        {BIB_ORDER.map((color) => {
          const option = bibTheme(color);
          const active = color === team.color;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onColor(color)}
              title={option.label}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition",
                active
                  ? "border-white/50 bg-black/45 text-white"
                  : "border-white/10 bg-black/25 text-white/45 hover:text-white/80"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", option.dot)} />
              {option.short}
              {active && <Check size={9} />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-wrap content-start gap-1.5">
        {players.length === 0 ? (
          <p className="m-auto text-[11px] text-white/35">
            Arrastra jugadores aquí
          </p>
        ) : (
          players.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              color={team.color}
              from={team.id}
              size="sm"
              hint="Clic para devolver al banquillo"
              onClick={() => onRemovePlayer(player.id)}
            />
          ))
        )}
      </div>

      {players.length > 0 && (
        <button
          type="button"
          onClick={() => players.forEach((p) => onRemovePlayer(p.id))}
          className="mt-2 self-start text-[10px] font-medium text-white/35 transition hover:text-white/70"
        >
          Vaciar equipo
        </button>
      )}
    </div>
  );
}
