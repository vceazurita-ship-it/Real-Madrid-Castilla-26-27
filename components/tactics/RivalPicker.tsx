"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Shirt, X } from "lucide-react";

import type { RivalPick, RivalSquad } from "@/lib/tactics/rivals";
import { cn } from "@/lib/utils";

interface Props {
  squads: RivalSquad[];
  /** Identificadores de los rivales que ya están sobre el campo. */
  activeIds: string[];
  onToggle: (player: RivalPick) => void;
  /** Dorsal suelto, para un rival que no está en la hoja. */
  onAddNumber: (label: string) => void;
  onClear: () => void;
  /** Equipo fijo: se oculta el selector (la pizarra ya vive dentro de él). */
  lockedTeam?: string;
}

/**
 * Selector de dorsales rivales.
 *
 * Cada dorsal es un interruptor: al pulsarlo la ficha aparece en la escena
 * actual y al volver a pulsarlo desaparece, así que se pinta exactamente el
 * bloque de rivales que interesa explicar.
 */
export default function RivalPicker({
  squads,
  activeIds,
  onToggle,
  onAddNumber,
  onClear,
  lockedTeam,
}: Props) {
  const [team, setTeam] = useState(lockedTeam ?? squads[0]?.equipo ?? "");
  const [manual, setManual] = useState("");
  const [open, setOpen] = useState(true);

  // El equipo elegido puede desaparecer al recargar la hoja.
  useEffect(() => {
    if (squads.some((squad) => squad.equipo === team)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeam(lockedTeam ?? squads[0]?.equipo ?? "");
  }, [squads, team, lockedTeam]);

  const squad = useMemo(
    () => squads.find((item) => item.equipo === team) ?? null,
    [squads, team]
  );

  const active = useMemo(() => new Set(activeIds), [activeIds]);

  const addManual = () => {
    const label = manual.trim();

    if (!label) return;

    onAddNumber(label.slice(0, 3));
    setManual("");
  };

  return (
    <div
      data-export-hide
      className="rounded-2xl border border-white/10 bg-[#11161D] p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
        >
          <Shirt size={13} className="text-[#F87171]" />
          Rivales
          <ChevronDown
            size={13}
            className={cn("transition", open ? "" : "-rotate-90")}
          />
        </button>

        {!lockedTeam && squads.length > 0 && (
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            className="min-w-0 max-w-[220px] rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[11px] text-white/75 outline-none"
          >
            {squads.map((item) => (
              <option key={item.equipo} value={item.equipo}>
                {item.equipo}
              </option>
            ))}
          </select>
        )}

        {lockedTeam && (
          <span className="truncate rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/60">
            {lockedTeam}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addManual();
              }
            }}
            placeholder="nº"
            inputMode="numeric"
            className="w-12 rounded-xl border border-white/10 bg-[#0F141B] px-2 py-2 text-center text-[11px] text-white outline-none placeholder:text-white/25"
          />

          <button
            type="button"
            onClick={addManual}
            title="Añadir dorsal suelto"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Plus size={14} />
          </button>

          {activeIds.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              title="Quitar todos los rivales de la escena"
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 text-[11px] font-semibold text-white/50 transition hover:border-red-400/40 hover:text-red-300"
            >
              <X size={12} />
              Quitar
            </button>
          )}
        </div>
      </div>

      {/* En el móvil la lista se queda en dos filas para no empujar el campo
          fuera de la pantalla; el resto de dorsales sigue ahí al deslizar. */}
      {open && (
        <div className="mt-2 max-h-[4.75rem] overflow-y-auto pr-1 md:max-h-32">
          {!squad || squad.players.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-white/35">
              {squads.length === 0
                ? "No se han podido cargar las plantillas rivales."
                : "Este equipo todavía no tiene jugadores en la hoja."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {squad.players.map((player) => {
                const on = active.has(player.id);

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onToggle(player)}
                    title={`${player.dorsal ? `${player.dorsal} · ` : ""}${player.nombre}${
                      player.posicion ? ` · ${player.posicion}` : ""
                    }`}
                    className={cn(
                      "flex min-w-[2.5rem] items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold tabular-nums transition",
                      on
                        ? "border-[#F87171] bg-[#F87171]/15 text-[#FCA5A5]"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/30 hover:text-white"
                    )}
                  >
                    {player.dorsal || "–"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
