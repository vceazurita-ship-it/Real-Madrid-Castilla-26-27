"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Users } from "lucide-react";

import { formatRating, ratingColor } from "@/lib/ratings/compute";
import { ROW_LABELS, PitchRowKey, detectRow } from "@/lib/ratings/pitch";

import type { PitchPlayer } from "./SquadPitch";
import { SquadPitch } from "./SquadPitch";
import type { RankedPlayer } from "./TeamPanel";
import { EmptyState, Panel, SegmentedControl } from "./ui";

type Metric = "avg" | "weighted" | "form" | "last";

/** Qué parte de la plantilla se pinta sobre el campo. */
type Scope = "rated" | "regulars" | "all";

const METRICS: { key: Metric; label: string; hint: string }[] = [
  { key: "avg", label: "Media", hint: "media de todas sus notas" },
  { key: "weighted", label: "Ponderada", hint: "media pesada por minutos jugados" },
  { key: "form", label: "Forma", hint: "media de los cinco últimos partidos" },
  { key: "last", label: "Último", hint: "nota del último partido valorado" },
];

const SCOPES: { key: Scope; label: string }[] = [
  { key: "rated", label: "Valorados" },
  { key: "regulars", label: "3+ PJ" },
  { key: "all", label: "Plantilla" },
];

const SCALE = [
  { label: "< 5", color: "#F87171" },
  { label: "5 – 6,5", color: "#FBBF24" },
  { label: "6,5 – 8", color: "#4ADE80" },
  { label: "8+", color: "#22D3EE" },
];

/** Orden en el que se listan las medias por línea, de atrás hacia delante. */
const ROW_ORDER: PitchRowKey[] = ["por", "def", "piv", "ocho", "diez", "band", "del"];

/**
 * Campograma de valoraciones: la plantilla colocada por posición, con la nota
 * de cada uno pintada sobre su ficha.
 *
 * Por defecto sólo se pintan los jugadores que tienen nota: con los 40 y pico
 * de la plantilla entera el campo se satura y no se lee nada. La plantilla
 * completa sigue estando a un clic, con los no valorados en gris.
 */
export function PitchPanel({
  ranked,
  onSelectPlayer,
}: {
  ranked: RankedPlayer[];
  onSelectPlayer: (playerId: string) => void;
}) {
  const [metric, setMetric] = useState<Metric>("avg");
  const [scope, setScope] = useState<Scope>("rated");

  const items = useMemo<PitchPlayer[]>(() => {
    const valueOf = (entry: RankedPlayer) =>
      metric === "last"
        ? (entry.summary.last?.entry.rating ?? 0)
        : entry.summary[metric];

    /* El mejor de los que se van a pintar se lleva la corona. */
    const best = ranked.reduce<{ id: string; value: number }>(
      (top, entry) => {
        const value = valueOf(entry);

        return value > top.value ? { id: entry.player.id, value } : top;
      },
      { id: "", value: 0 }
    );

    return ranked
      .filter((entry) => {
        if (scope === "all") return true;
        if (scope === "regulars") return entry.summary.played >= 3;

        return valueOf(entry) > 0;
      })
      .map((entry) => {
        const { summary, player } = entry;
        const value = valueOf(entry);

        return {
          id: player.id,
          position: player.posicion,
          name: player.apodo || player.nombre,
          photo: player.foto,
          dorsal: player.dorsal,
          value,
          /* Manda la nota para decidir quién va en la sub-fila de delante. */
          rank: value,
          caption:
            summary.played > 0
              ? `${summary.played} PJ · ${summary.minutes}′`
              : "Sin valorar",
          detail:
            summary.played > 0
              ? `Media ${formatRating(summary.avg)} · Forma ${formatRating(summary.form)}`
              : undefined,
          dimmed: value <= 0,
          mvp: player.id === best.id && best.value > 0,
        };
      });
  }, [ranked, metric, scope]);

  const rated = useMemo(() => items.filter((item) => item.value > 0), [items]);

  const average = rated.length
    ? rated.reduce((total, item) => total + item.value, 0) / rated.length
    : 0;

  /* Media por línea: el resumen que de verdad se busca en un campograma. */
  const byLine = useMemo(() => {
    const buckets = new Map<PitchRowKey, number[]>();

    rated.forEach((item) => {
      const key = detectRow(item.position);
      const list = buckets.get(key);

      if (list) list.push(item.value);
      else buckets.set(key, [item.value]);
    });

    return ROW_ORDER.filter((key) => buckets.has(key)).map((key) => {
      const values = buckets.get(key) ?? [];

      return {
        key,
        count: values.length,
        value: values.reduce((total, value) => total + value, 0) / values.length,
      };
    });
  }, [rated]);

  const metricHint = METRICS.find((item) => item.key === metric)?.hint ?? "";

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
      subtitle={`${rated.length} en el campo · media ${formatRating(average)} · ${metricHint}`}
      icon={LayoutGrid}
      bodyClassName="p-0"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={SCOPES}
            value={scope}
            onChange={setScope}
          />

          <SegmentedControl
            options={METRICS}
            value={metric}
            onChange={setMetric}
          />
        </div>
      }
    >
      {rated.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={Users}
            title="Todavía no hay notas que pintar"
            description="Registra las valoraciones de un partido y la plantilla aparecerá aquí colocada por posición."
          />
        </div>
      ) : (
        <SquadPitch players={items} onSelect={onSelectPlayer} />
      )}

      {/* MEDIAS POR LÍNEA */}

      {byLine.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          {byLine.map((line) => (
            <span
              key={line.key}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5"
            >
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                {ROW_LABELS[line.key]}
              </span>

              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: ratingColor(line.value) }}
              >
                {formatRating(line.value)}
              </span>

              <span className="text-[10px] tabular-nums text-white/25">
                ({line.count})
              </span>
            </span>
          ))}
        </div>
      )}

      {/* LEYENDA */}

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

        {scope === "all" && (
          <span className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span className="h-2.5 w-2.5 rounded-full bg-[#64748B]" />
            Sin nota
          </span>
        )}

        <span className="ml-auto text-[11px] text-white/25">
          Pulsa un jugador para abrir su ficha de valoraciones
        </span>
      </div>
    </Panel>
  );
}
