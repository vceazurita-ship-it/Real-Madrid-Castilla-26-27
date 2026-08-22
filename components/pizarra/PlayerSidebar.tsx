"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useLineup } from "@/context/LineupContext";
import { useAvailability } from "@/context/AvailabilityContext";
import { usePlayers } from "@/hooks/usePlayers";
import { normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";
import { cn } from "@/lib/utils";
import PlayerToken from "./PlayerToken";

type Line = "TODOS" | "POR" | "DEF" | "MED" | "ATA";
type Filter = "TODOS" | "DISPONIBLES" | "BAJAS";

const LINES: { id: Line; label: string }[] = [
  { id: "TODOS", label: "Todas" },
  { id: "POR", label: "POR" },
  { id: "DEF", label: "DEF" },
  { id: "MED", label: "MED" },
  { id: "ATA", label: "ATA" },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "DISPONIBLES", label: "Disponibles" },
  { id: "BAJAS", label: "Bajas" },
];

/** Línea del campo a la que pertenece la posición de la hoja. */
function lineOf(posicion: string): Exclude<Line, "TODOS"> {
  const value = posicion.toUpperCase();

  if (value.includes("PORTERO")) return "POR";
  if (value.includes("LATERAL") || value.includes("CENTRAL")) return "DEF";
  if (["6", "8", "10"].includes(value)) return "MED";

  return "ATA";
}

/**
 * Plantilla disponible para colocar.
 *
 * Muestra a quien todavía no está en el campo ni en el banquillo, y deja
 * marcar aquí mismo quién está de baja para el partido.
 */
export default function PlayerSidebar() {
  const { players } = usePlayers();
  const { lineup, bench } = useLineup();
  const { bajas, isAvailable, clearAll } = useAvailability();

  const scrollRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: "bench" });

  const [search, setSearch] = useState("");
  const [line, setLine] = useState<Line>("TODOS");
  const [filter, setFilter] = useState<Filter>("TODOS");

  const playersOnPitch = useMemo(
    () => new Set(lineup.map((slot) => slot.playerId).filter(Boolean)),
    [lineup]
  );

  /** Los que quedan por colocar: ni en el once ni en el banquillo. */
  const remaining = useMemo(
    () =>
      players.filter(
        (player) =>
          !playersOnPitch.has(player.id) && !bench.includes(player.id)
      ),
    [players, playersOnPitch, bench]
  );

  const counts = useMemo(() => {
    const disponibles = remaining.filter((player) =>
      isAvailable(player.id)
    ).length;

    return { disponibles, bajas: remaining.length - disponibles };
  }, [remaining, isAvailable]);

  const visible = useMemo(() => {
    const query = normalizePlayerName(search);

    return remaining.filter((player) => {
      if (line !== "TODOS" && lineOf(player.posicion) !== line) return false;

      const available = isAvailable(player.id);

      if (filter === "DISPONIBLES" && !available) return false;
      if (filter === "BAJAS" && available) return false;

      if (!query) return true;

      // Buscamos por nombre, apodo y dorsal: el staff usa los tres.
      return (
        normalizePlayerName(player.nombre).includes(query) ||
        normalizePlayerName(player.apodo ?? "").includes(query) ||
        String(player.dorsal ?? "").includes(query)
      );
    });
  }, [remaining, search, line, filter, isAvailable]);

  const totalBajas = Object.keys(bajas).length;

  const scrollBy = (offset: number) =>
    scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl bg-[#11161D] transition",
        isOver && "bg-[#1A222C] ring-2 ring-[#C8A96B]"
      )}
    >
      {/* CABECERA */}

      <div className="shrink-0 border-b border-[#C8A96B]/15 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">Plantilla</h2>

            <p className="mt-0.5 text-[11px] text-white/45">
              <span className="font-semibold text-emerald-300">
                {counts.disponibles}
              </span>{" "}
              por colocar
              {counts.bajas > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-red-300">
                    {counts.bajas}
                  </span>{" "}
                  de baja
                </>
              )}
            </p>
          </div>

          {totalBajas > 0 && (
            <button
              type="button"
              onClick={clearAll}
              title="Devolver a todos a disponible"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-medium text-white/50 transition hover:border-[#C8A96B]/40 hover:text-white"
            >
              <RotateCcw size={11} />
              Reiniciar
            </button>
          )}
        </div>

        {/* BUSCADOR */}

        <div className="relative mt-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, apodo o dorsal..."
            aria-label="Buscar jugador"
            className="w-full rounded-xl border border-white/10 bg-[#1A222C] py-2 pl-9 pr-8 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#C8A96B]/60"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar la búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* FILTROS */}

        <div className="mt-2.5 flex flex-wrap gap-1">
          {LINES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={line === item.id}
              onClick={() => setLine(item.id)}
            />
          ))}
        </div>

        <div className="mt-1.5 flex gap-1">
          {FILTERS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={filter === item.id}
              onClick={() => setFilter(item.id)}
              className="flex-1"
            />
          ))}
        </div>
      </div>

      {/* LISTADO */}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-x-auto overflow-y-hidden p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#C8A96B]/40 lg:overflow-x-hidden lg:overflow-y-auto"
        >
          <div className="flex w-max gap-2 lg:w-auto lg:flex-col lg:gap-1.5">
            {visible.length > 0 ? (
              visible.map((player: Player) => (
                <PlayerToken key={player.id} player={player} />
              ))
            ) : (
              <p className="flex min-w-[240px] items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40 lg:min-w-0">
                {remaining.length === 0
                  ? "Todos los jugadores están en el campo o en el banquillo"
                  : "Ningún jugador coincide con el filtro"}
              </p>
            )}
          </div>
        </div>

        {/* Flechas sólo en móvil, donde la lista es horizontal */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-2 lg:hidden">
          <ArrowButton
            label="Ver jugadores anteriores"
            onClick={() => scrollBy(-300)}
          >
            <ChevronLeft size={22} />
          </ArrowButton>

          <ArrowButton
            label="Ver más jugadores"
            onClick={() => scrollBy(300)}
          >
            <ChevronRight size={22} />
          </ArrowButton>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "bg-[#C8A96B] text-[#0B0F14]"
          : "bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white",
        className
      )}
    >
      {label}
    </button>
  );
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto mx-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#C8A96B]/40 bg-[#11161D]/85 text-[#C8A96B] backdrop-blur transition active:scale-90 hover:bg-[#C8A96B] hover:text-black"
    >
      {children}
    </button>
  );
}
