"use client";

import { useMemo } from "react";
import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";

import TacticsBoard from "@/components/tactics/TacticsBoard";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { emptyDoc, normalizeDoc } from "@/lib/tactics/helpers";
import type { RivalSquad } from "@/lib/tactics/rivals";
import type { TacticsDoc } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

/** Clave estable aunque el equipo cambie de mayúsculas o acentos. */
function teamKey(equipo: string) {
  return equipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Pizarra táctica de un rival concreto.
 *
 * Cada equipo guarda su propio documento, así que al volver a su plantilla
 * reaparecen las escenas que se dejaron preparadas para ese partido.
 */
export default function RivalBoardPanel({ squad }: { squad: RivalSquad }) {
  const { players } = usePlayers();

  const titulo = `Pizarra · ${squad.equipo}`;

  const fallback = useMemo(() => emptyDoc(titulo), [titulo]);

  const { value, setValue, status, localOnly } = useRemoteDoc<TacticsDoc>({
    key: `tactics:rival:${teamKey(squad.equipo)}`,
    kind: "tactics-board",
    fallback,
  });

  const doc = useMemo(() => normalizeDoc(value, titulo), [value, titulo]);

  const squads = useMemo(() => [squad], [squad]);

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-[#11161D] p-2 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          PIZARRA TÁCTICA
          <span className="ml-2 normal-case tracking-normal text-white/30">
            · {squad.equipo}
          </span>
        </h2>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
            localOnly
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : status === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : status === "saving" || status === "loading"
              ? "border-white/15 bg-white/5 text-white/60"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          )}
        >
          {localOnly ? (
            <>
              <CloudOff size={13} />
              Solo local
            </>
          ) : status === "error" ? (
            <>
              <TriangleAlert size={13} />
              Error
            </>
          ) : status === "saving" || status === "loading" ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              {status === "saving" ? "Guardando" : "Cargando"}
            </>
          ) : (
            <>
              <Check size={13} />
              Guardado
            </>
          )}
        </span>
      </div>

      <TacticsBoard
        doc={doc}
        onChange={setValue}
        roster={players}
        rivalSquads={squads}
        lockedRivalTeam={squad.equipo}
        hint="Pulsa los dorsales del rival para pintarlos y arrástralos por el campo. Cada equipo guarda sus propias escenas."
      />
    </div>
  );
}
