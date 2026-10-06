"use client";

/**
 * El sello de «hasta qué jornada» de cada área de DATA (06/10/2026).
 *
 * Una línea: la fuente, la última jornada que tiene, el rival y la fecha, y
 * si está completa. Si no lo está, dice qué falta; y si ya se ha jugado una
 * jornada que todavía no ha entrado, también. El cálculo vive en
 * `lib/data-analisis/alcance.ts`.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import type { Alcance, PartidoCalendario } from "@/lib/data-analisis/alcance";

/** El calendario del Castilla (BeSoccer) y el día de hoy, leídos una vez. */
export function useCalendarioCastilla() {
  const [estado, setEstado] = useState<{ partidos: PartidoCalendario[]; hoy: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/docs?key=${encodeURIComponent("castilla:calendario")}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: { partidos?: PartidoCalendario[] } }) => j?.data?.partidos ?? [])
      .catch(() => [] as PartidoCalendario[])
      .then((partidos) => {
        if (vivo) setEstado({ partidos, hoy: new Date().toISOString().slice(0, 10) });
      });
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}

const fecha = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function SelloJornada({ alcances, nota }: { alcances: Alcance[]; nota?: string }) {
  if (!alcances.length) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {alcances.map((a) => {
        const completa = a.estado === "completa";
        const sin = a.estado === "sin-datos";
        const color = completa ? "#1B9E77" : sin ? "rgba(255,255,255,0.45)" : "#E3A008";
        const Icono = completa ? CheckCircle2 : sin ? CircleDashed : CircleAlert;
        return (
          <div
            key={a.fuente}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: `${color}55`, background: `${color}10` }}
            role="status"
          >
            <Icono size={14} style={{ color }} className="shrink-0" />
            <span className="font-medium text-white/85">
              {a.fuente}: {a.jornada ? `datos hasta la J${a.jornada}` : "sin jornada de liga"}
              {a.rival ? ` · ${a.rival}` : ""}
              {a.fecha ? ` · ${fecha(a.fecha)}` : ""}
            </span>
            {!sin && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color, background: `${color}22` }}>
                {completa ? "Jornada completa" : "Jornada incompleta"}
              </span>
            )}
            <span className="text-white/55">{a.detalle}</span>
            {a.pendientes.length > 0 && (
              <span className="basis-full text-[11px]" style={{ color: "#E3A008" }}>
                Ya jugada{a.pendientes.length > 1 ? "s" : ""} y sin datos todavía: {a.pendientes.join(" · ")}.
              </span>
            )}
          </div>
        );
      })}
      {nota && <p className="text-[11px] text-white/35">{nota}</p>}
    </div>
  );
}
