"use client";

import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";

import { formatRating } from "@/lib/ratings/compute";

import type { PitchPlayer } from "./SquadPitch";
import { SquadPitch } from "./SquadPitch";
import type { RankedPlayer } from "./TeamPanel";
import { EmptyState, Panel, SegmentedControl } from "./ui";

type Metric = "avg" | "weighted" | "form" | "last";

const METRICS: { key: Metric; label: string }[] = [
  { key: "avg", label: "Media" },
  { key: "weighted", label: "Ponderada" },
  { key: "form", label: "Últimos 5" },
  { key: "last", label: "Último partido" },
];

const SCALE = [
  { label: "< 5", color: "#F87171" },
  { label: "5 – 6,5", color: "#FBBF24" },
  { label: "6,5 – 8", color: "#4ADE80" },
  { label: "8+", color: "#22D3EE" },
  { label: "Sin nota", color: "#64748B" },
];

/**
 * Campograma de valoraciones: la plantilla colocada por posición, con la nota
 * de cada uno pintada sobre su ficha. Mismo lenguaje que el de plantillas rival.
 */
export function PitchPanel({
  ranked,
  onSelectPlayer,
}: {
  ranked: RankedPlayer[];
  onSelectPlayer: (playerId: string) => void;
}) {
  const [metric, setMetric] = useState<Metric>("avg");
  const [minMatches, setMinMatches] = useState(0);

  const items = useMemo<PitchPlayer[]>(() => {
    return ranked.map((entry) => {
      const { summary, player } = entry;

      const value =
        metric === "last"
          ? (summary.last?.entry.rating ?? 0)
          : summary[metric];

      return {
        id: player.id,
        position: player.posicion,
        name: player.apodo || player.nombre,
        photo: player.foto,
        value,
        caption:
          summary.played > 0
            ? `${summary.played} PJ · ${summary.minutes}′`
            : "Sin valorar",
        dimmed: summary.played < minMatches || summary.played === 0,
      };
    });
  }, [ranked, metric, minMatches]);

  const rated = items.filter((item) => item.value > 0);

  const average = rated.length
    ? rated.reduce((total, item) => total + item.value, 0) / rated.length
    : 0;

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Sin plantilla cargada"
        description="No se han podido leer los jugadores de la hoja."
      />
    );
  }

  return (
    <Panel
      title="Campograma de valoraciones"
      subtitle={`${rated.length} jugadores valorados · media ${formatRating(average)}`}
      icon={LayoutGrid}
      bodyClassName="p-0"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={[
              { key: "0", label: "Todos" },
              { key: "3", label: "3+ PJ" },
              { key: "5", label: "5+ PJ" },
            ]}
            value={String(minMatches)}
            onChange={(key) => setMinMatches(Number(key))}
          />

          <SegmentedControl
            options={METRICS}
            value={metric}
            onChange={setMetric}
          />
        </div>
      }
    >
      <SquadPitch players={items} onSelect={onSelectPlayer} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3">
        {SCALE.map((step) => (
          <span
            key={step.label}
            className="flex items-center gap-1.5 text-[11px] text-white/40"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: step.color }}
            />
            {step.label}
          </span>
        ))}

        <span className="ml-auto text-[11px] text-white/25">
          Pulsa un jugador para abrir su ficha de valoraciones
        </span>
      </div>
    </Panel>
  );
}
