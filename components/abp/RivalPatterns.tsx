"use client";

/**
 * Patrones de ABP del rival: lo que de verdad se lleva a la pizarra.
 *
 * El registro de acciones (`RivalScoutEditor`) sirve para contar volumen —
 * cuántos córners saca, cuántos remata, cuánto peligro genera—. Pero un plan
 * de partido no se prepara con un número, sino con «al córner del segundo
 * palo llegan siempre con bloqueo al portero, y así hicieron el gol de la J3».
 *
 * Eso es lo que recoge el campo `patron` de cada acción, que se rellena sólo
 * en las significativas. Aquí se agrupan por ese texto: el mismo patrón visto
 * tres veces sube arriba con sus tres minutos, sus rematadores y las notas de
 * cada una, y el resto del registro no estorba.
 */

import { AlertTriangle, Sparkles } from "lucide-react";

import { EmptyState, Panel } from "@/components/abp/ui";
import { FAMILY_LABEL } from "@/lib/abp/model";
import { AbpSide } from "@/lib/abp/rival";
import { PatternGroup } from "@/lib/abp/rivalScout";

export function RivalPatterns({
  patrones,
  side,
  equipo,
  total,
}: {
  patrones: PatternGroup[];
  side: AbpSide;
  equipo: string;
  /** Acciones registradas en la selección actual, con patrón o sin él. */
  total: number;
}) {
  return (
    <Panel
      title="Patrones para el plan de partido"
      subtitle={
        patrones.length
          ? `${patrones.length} ${patrones.length === 1 ? "patrón marcado" : "patrones marcados"} sobre ${total} ${total === 1 ? "acción registrada" : "acciones registradas"}`
          : "Lo que se marca al registrar una acción sube aquí"
      }
      icon={Sparkles}
    >
      {patrones.length === 0 ? (
        <EmptyState
          title={
            total === 0
              ? `Sin acciones registradas del ${equipo} en esta selección`
              : "Ninguna acción tiene patrón escrito"
          }
          description={
            total === 0
              ? "Registra abajo las acciones de su vídeo y escribe el patrón en las que tengan algo que contar."
              : "Abre una acción significativa, escribe su patrón en «Para el plan de partido» y aparecerá aquí agrupado con las demás que lo repitan."
          }
        />
      ) : (
        <ul className="space-y-3">
          {patrones.map((patron) => (
            <PatternCard
              key={`${patron.condicion}-${patron.patron}`}
              patron={patron}
              side={side}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PatternCard({
  patron,
  side,
}: {
  patron: PatternGroup;
  side: AbpSide;
}) {
  /* Un patrón que ya acabó en gol se marca en rojo: es el que manda en la
     charla, por encima de los que sólo se repiten mucho. */
  const grave = patron.goles > 0;

  return (
    <li
      className={`rounded-xl border px-4 py-3.5 ${
        grave
          ? "border-[color:var(--rmcf-rate-low)]/40 bg-[color:var(--rmcf-rate-low)]/[0.06]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            {grave && (
              <AlertTriangle
                size={14}
                className="shrink-0 text-[color:var(--rmcf-rate-low)]"
              />
            )}
            <span className="min-w-0 break-words">{patron.patron}</span>
          </p>

          <p className="mt-1 text-[11px] text-white/40">
            {side === "ofensivo" ? "Lo ejecuta él" : "Se lo hacen a él"} ·{" "}
            {patron.familias.map((family) => FAMILY_LABEL[family]).join(" · ")}
            {patron.zonas.length > 0 && ` · ${patron.zonas.join(" / ")}`}
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-1.5">
          <Tag>
            {patron.veces} {patron.veces === 1 ? "vez" : "veces"}
          </Tag>

          {patron.remates > 0 && <Tag>{patron.remates} rem.</Tag>}

          {patron.peligro > 0 && (
            <Tag tone="gold">
              {patron.peligro} {patron.peligro === 1 ? "ocasión" : "ocasiones"}
            </Tag>
          )}

          {patron.goles > 0 && (
            <Tag tone="alerta">
              {patron.goles} {patron.goles === 1 ? "gol" : "goles"}
            </Tag>
          )}
        </ul>
      </div>

      {(patron.sacadores.length > 0 ||
        patron.rematadores.length > 0 ||
        patron.jornadas.length > 0) && (
        <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
          <Dato label="Saca" values={patron.sacadores} />
          <Dato label="Remata" values={patron.rematadores} />
          <Dato label="Visto en" values={patron.jornadas} />
        </dl>
      )}

      {patron.notas.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
          {patron.notas.map((nota) => (
            <li key={nota.id} className="flex gap-2 text-[12px] leading-snug">
              <span className="shrink-0 tabular-nums text-white/30">
                {[nota.jornada, nota.minuto && `${nota.minuto}'`]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
              <span className="min-w-0 text-white/60">{nota.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Tag({
  children,
  tone = "neutro",
}: {
  children: React.ReactNode;
  tone?: "neutro" | "gold" | "alerta";
}) {
  const styles = {
    neutro: "border-white/12 text-white/55",
    gold: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]",
    alerta:
      "border-[color:var(--rmcf-rate-low)]/50 bg-[color:var(--rmcf-rate-low)]/10 text-[color:var(--rmcf-rate-low)]",
  }[tone];

  return (
    <li
      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tabular-nums ${styles}`}
    >
      {children}
    </li>
  );
}

function Dato({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 uppercase tracking-[0.14em] text-white/30">
        {label}
      </dt>
      <dd className="min-w-0 text-white/60">{values.join(", ")}</dd>
    </div>
  );
}
