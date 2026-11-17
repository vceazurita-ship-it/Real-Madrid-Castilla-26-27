"use client";

/**
 * «Desde Opta · aún sin etiquetar en Hudl» (17/11/2026).
 *
 * Sale en ABP, banda, robos, pérdidas y faltas cuando algún partido de lo que
 * se ve viene del respaldo de Opta (lib/opta-respaldo). Dice cuáles y lo que
 * Opta no trae; cuando el partido se etiqueta, desaparece solo.
 */

import { Database } from "lucide-react";

import { nombreEquipo } from "@/lib/equipos";

export type PartidoSelloOpta = { jornada: string; rival: string };

export function SelloOpta({ partidos, className = "" }: { partidos: PartidoSelloOpta[]; className?: string }) {
  const unicos = [...new Map(partidos.map((p) => [`${p.jornada}|${p.rival}`, p])).values()];
  if (!unicos.length) return null;

  return (
    <div
      role="note"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-xs text-white/80 ${className}`}
    >
      <Database size={14} className="shrink-0 text-[#C8A96B]" aria-hidden />
      <span className="font-semibold text-[#C8A96B]">Desde Opta · aún sin etiquetar en Hudl</span>
      <span className="min-w-0 break-words">
        {unicos.map((p) => `${p.jornada} ${nombreEquipo(p.rival)}`).join(" · ")}
      </span>
    </div>
  );
}
