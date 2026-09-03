"use client";

import Image from "next/image";
import type { Player } from "@/types/player";
import { LINE_LABEL, LINE_ORDER, lineOf } from "@/lib/session-board/helpers";
import { statusTheme } from "@/lib/session-board/status";
import type { LineKey } from "@/lib/session-board/types";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { cn } from "@/lib/utils";

interface Props {
  /** Jugadores que hoy pueden entrenar. */
  players: Player[];
  /** Ids apartados a mano de la sesión. */
  excluidos: string[];
  onToggle: (playerId: string) => void;
}

/**
 * Campograma de la sesión: todos los jugadores convocados, colocados por línea.
 *
 * Un clic aparta a un jugador de la sesión (y lo saca de todas las tareas);
 * otro clic lo devuelve.
 */
export default function SessionPitch({ players, excluidos, onToggle }: Props) {
  const excluded = new Set(excluidos);

  const byLine = LINE_ORDER.reduce((acc, line) => {
    acc[line] = players.filter((player) => lineOf(player.posicion) === line);
    return acc;
  }, {} as Record<LineKey, Player[]>);

  return (
    <div className="pitch-photo relative w-full overflow-hidden rounded-[26px] border border-[#C8A96B]/20 shadow-[0_25px_80px_rgba(0,0,0,.45)]">
      <Image
        src="/field2.webp"
        alt=""
        fill
        unoptimized
        priority
        draggable={false}
        className="pointer-events-none select-none object-cover"
      />

      <div className="pitch-photo-veil absolute inset-0 bg-gradient-to-b from-[#050A10]/75 via-[#050A10]/55 to-[#050A10]/80" />

      {/* Modo día: aclara el césped hasta los tonos del tema claro (globals.css) */}
      <div className="pitch-photo-wash" />

      <div className="relative grid gap-2 p-3 sm:gap-3 sm:p-5">
        {LINE_ORDER.map((line) => (
          <div
            key={line}
            className="rounded-2xl border border-white/10 bg-black/25 p-2.5 backdrop-blur-sm sm:p-3"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#C8A96B]">
                {LINE_LABEL[line]}
              </p>

              <p className="text-[11px] tabular-nums text-white/45">
                {byLine[line].filter((p) => !excluded.has(p.id)).length}
                <span className="text-white/25"> / {byLine[line].length}</span>
              </p>
            </div>

            {byLine[line].length === 0 ? (
              <p className="py-2 text-center text-[11px] text-white/30">
                Sin jugadores en esta línea
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {byLine[line].map((player) => {
                  const status = statusTheme(player.estado);
                  const off = excluded.has(player.id);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => onToggle(player.id)}
                      title={
                        off
                          ? "Devolver a la sesión"
                          : `${status.label} · Clic para apartar de la sesión`
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition",
                        off
                          ? "border-white/10 bg-white/[0.03] opacity-45 grayscale"
                          : "border-white/15 bg-[#151B23]/85 hover:-translate-y-0.5 hover:border-[#C8A96B]/50"
                      )}
                    >
                      <span
                        className={cn(
                          "relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/40 ring-2",
                          status.ring
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={player.foto || PLAYER_PHOTO_FALLBACK}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-cover"
                        />
                      </span>

                      <span className="min-w-0">
                        <span className="block max-w-[110px] truncate text-xs font-semibold text-white">
                          {player.apodo || player.nombre}
                        </span>

                        <span
                          className={cn(
                            "block text-[9px] font-medium uppercase tracking-wider",
                            off ? "text-white/40" : "text-white/50"
                          )}
                        >
                          {off ? "Fuera de sesión" : status.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
