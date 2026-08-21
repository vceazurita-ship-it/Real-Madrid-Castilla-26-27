"use client";

import { useMemo, useState } from "react";
import { ChevronDown, History, MessageSquareText, Pencil } from "lucide-react";

import { MatchSummary, formatRating } from "@/lib/ratings/compute";
import { formatMatchDate, matchLabel, matchOutcome } from "@/lib/ratings/matches";
import { RatingsSeason } from "@/lib/ratings/types";
import { Player } from "@/types/player";

import { EmptyState, GhostButton, Panel, RatingBadge } from "./ui";

const OUTCOME_TONE = {
  W: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  D: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  L: "border-rose-400/25 bg-rose-400/10 text-rose-300",
} as const;

const OUTCOME_LABEL = { W: "Victoria", D: "Empate", L: "Derrota" } as const;

/** Histórico completo: cada partido con todas sus notas, de lo más reciente atrás. */
export function HistoryPanel({
  season,
  matchSummaries,
  players,
  onEditMatch,
  onSelectPlayer,
}: {
  season: RatingsSeason;
  matchSummaries: MatchSummary[];
  players: Player[];
  onEditMatch: (matchId: string) => void;
  onSelectPlayer: (playerId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, Player>();

    players.forEach((player) => map.set(player.id, player));

    return map;
  }, [players]);

  const ordered = useMemo(
    () => [...matchSummaries].reverse(),
    [matchSummaries]
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="El histórico está vacío"
        description="Cada partido que valores quedará guardado aquí para siempre."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {ordered.map((item) => {
        const record = season.matches[item.match.id];
        const outcome = matchOutcome(item.match);
        const expanded = open === item.match.id;

        const entries = Object.values(record?.players ?? {}).sort(
          (a, b) => b.rating - a.rating
        );

        return (
          <Panel key={item.match.id} bodyClassName="p-0">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : item.match.id)}
              className="flex w-full min-w-0 flex-wrap items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02] sm:px-5"
            >
              <RatingBadge value={item.avg} size="lg" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {matchLabel(item.match)}
                </p>

                <p className="truncate text-[11px] text-white/35">
                  {formatMatchDate(item.match)} · {item.match.competition} ·{" "}
                  {item.rated} valorados
                </p>
              </div>

              {outcome && (
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${OUTCOME_TONE[outcome]}`}
                >
                  {OUTCOME_LABEL[outcome]} {item.match.result}
                </span>
              )}

              {item.top && (
                <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-white/40 sm:flex">
                  MVP
                  <span className="font-medium text-white/70">
                    {byId.get(item.top.playerId)?.apodo ??
                      byId.get(item.top.playerId)?.nombre ??
                      item.top.playerId}
                  </span>
                  <RatingBadge value={item.top.rating} size="sm" />
                </span>
              )}

              <ChevronDown
                size={16}
                className={`shrink-0 text-white/35 transition ${
                  expanded ? "rotate-180 text-[#C8A96B]" : ""
                }`}
              />
            </button>

            {expanded && (
              <div className="border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <p className="text-[11px] text-white/30">
                    {item.goals} goles · {item.assists} asistencias del equipo
                  </p>

                  <GhostButton
                    icon={Pencil}
                    onClick={() => onEditMatch(item.match.id)}
                  >
                    Editar valoraciones
                  </GhostButton>
                </div>

                <ul className="min-w-0 divide-y divide-white/5 border-t border-white/5">
                  {entries.map((entry) => {
                    const player = byId.get(entry.playerId);

                    return (
                      <li key={entry.playerId}>
                        <button
                          type="button"
                          onClick={() => onSelectPlayer(entry.playerId)}
                          className="flex w-full min-w-0 flex-wrap items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03] sm:px-5"
                        >
                          <RatingBadge value={entry.rating} size="sm" />

                          {player && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={player.foto}
                              alt={player.nombre}
                              className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover object-top"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white">
                              {player?.apodo || player?.nombre || entry.playerId}
                            </p>

                            <p className="truncate text-[10px] text-white/30">
                              {entry.minutes}′
                              {entry.starter ? " · titular" : ""}
                              {entry.goals ? ` · ${entry.goals}G` : ""}
                              {entry.assists ? ` · ${entry.assists}A` : ""}
                            </p>
                          </div>

                          {entry.note.trim() && (
                            <span className="flex min-w-0 max-w-[46%] items-start gap-1.5 text-[11px] text-white/45">
                              <MessageSquareText
                                size={12}
                                className="mt-0.5 shrink-0 text-[#C8A96B]"
                              />

                              <span className="line-clamp-2 min-w-0">
                                {entry.note}
                              </span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}

                  {entries.length === 0 && (
                    <li className="px-4 py-8 text-center text-xs text-white/35">
                      Este partido no tiene valoraciones guardadas
                    </li>
                  )}
                </ul>
              </div>
            )}
          </Panel>
        );
      })}

      <p className="px-1 text-[11px] text-white/25">
        Media global del histórico:{" "}
        {formatRating(
          ordered.length
            ? ordered.reduce((total, item) => total + item.avg, 0) /
                ordered.length
            : 0
        )}
      </p>
    </div>
  );
}
