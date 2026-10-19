"use client";

/**
 * El sello de «hasta qué jornada» de cada área de DATA (06/10/2026).
 *
 * Una línea: la fuente, la última jornada que tiene, el rival y la fecha, y
 * si está completa. Si no lo está, dice qué falta; y si ya se ha jugado una
 * jornada que todavía no ha entrado, también. El cálculo vive en
 * `lib/data-analisis/alcance.ts`.
 *
 * (14/10/2026) A la vista sólo queda «Datos hasta la J7 · rival · fecha» y si
 * la jornada está completa. La fuente, el detalle de lo que falta y la nota
 * cuentan cómo se ha montado el dato: van con los textos explicativos de
 * Ajustes (`useTextosExplicativos`).
 */

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import { cargaCalendario } from "@/hooks/useCalendario";
import type { Alcance, PartidoCalendario } from "@/lib/data-analisis/alcance";
import { useTextosExplicativos } from "@/components/ui/textos-analisis";
import { chipInk } from "@/lib/theme";

/** El calendario del Castilla (BeSoccer) y el día de hoy, leídos una vez. */
export function useCalendarioCastilla() {
  const [estado, setEstado] = useState<{ partidos: PartidoCalendario[]; hoy: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    /* Por `cargaCalendario`: la misma descarga que el resto de paneles y la
       copia del aparato; antes cada sello volvía a bajar el documento. */
    void cargaCalendario().then((partidos) => {
      /* El día de aquí (19/10/2026): `toISOString` es UTC y entre las 00:00
         y las 02:00 daba todavía el de ayer, así que la jornada recién
         jugada no salía como «ya jugada y sin datos». */
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

      if (vivo) setEstado({ partidos, hoy });
    });
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}

const fecha = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function SelloJornada({ alcances, nota }: { alcances: Alcance[]; nota?: string }) {
  const explicativos = useTextosExplicativos();

  if (!alcances.length) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {alcances.map((a) => {
        const completa = a.estado === "completa";
        const sin = a.estado === "sin-datos";
        /* 19/10/2026: el gris de «sin datos» era un blanco al 45 % —invisible
           en modo día— y además `${color}55` sobre un `rgba()` daba un color
           inválido. Ahora es un gris en hex, que se lee en los dos temas. */
        const color = completa ? "#1B9E77" : sin ? "#7C8794" : "#E3A008";
        const Icono = completa ? CheckCircle2 : sin ? CircleDashed : CircleAlert;
        return (
          <div
            key={a.fuente}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: `${color}55`, background: `${color}10` }}
            role="status"
          >
            <Icono size={14} style={{ color: chipInk(color) }} className="shrink-0" />
            <span className="font-medium text-white/85">
              {explicativos ? `${a.fuente}: ` : ""}
              {a.jornada ? `${explicativos ? "datos" : "Datos"} hasta la J${a.jornada}` : "Sin jornada de liga"}
              {a.rival ? ` · ${a.rival}` : ""}
              {a.fecha ? ` · ${fecha(a.fecha)}` : ""}
            </span>
            {!sin && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: chipInk(color), background: `${color}22` }}>
                {completa ? "Jornada completa" : "Jornada incompleta"}
              </span>
            )}
            {explicativos && <span className="text-white/55">{a.detalle}</span>}
            {explicativos && a.pendientes.length > 0 && (
              <span className="basis-full text-[11px]" style={{ color: chipInk("#E3A008") }}>
                Ya jugada{a.pendientes.length > 1 ? "s" : ""} y sin datos todavía: {a.pendientes.join(" · ")}.
              </span>
            )}
          </div>
        );
      })}
      {explicativos && nota && <p className="text-[11px] text-white/35">{nota}</p>}
    </div>
  );
}
