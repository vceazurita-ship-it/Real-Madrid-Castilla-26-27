"use client";

/**
 * LOS PORQUÉS DEL BOCETO, PLEGADOS AL PIE Y SÓLO PARA EL ADMINISTRADOR (11/10/2026).
 *
 * El plan lleva sólo las marcas («?» a valorar cambiar, «*» a valorar
 * incorporar): es lo que se lee el día de partido y no tiene que llevar la
 * cuenta de por qué se cuestiona cada línea. Los motivos se guardaron aparte
 * al aplicar el boceto (`plan-boceto:<ID>`) y aquí se enseñan, cerrados, y
 * sólo cuando hay sesión de administrador: es la lectura del que prepara el
 * plan, no la del vestuario.
 */

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  CAMPOS_BOCETO,
  KIND_MOTIVOS_PLAN,
  TITULO_CAMPO,
  claveMotivosPlan,
  type LineaBoceto,
  type MotivosPlan,
} from "@/lib/plan-partido/boceto";
import { useTextosExplicativos } from "@/components/ui/textos-analisis";

export function PorQueDelBoceto({ idRival }: { idRival: string }) {
  const { admin } = useAdmin();

  const doc = useRemoteDoc<MotivosPlan | null>({
    key: claveMotivosPlan(idRival),
    kind: KIND_MOTIVOS_PLAN,
    fallback: null,
  });

  const [abierto, setAbierto] = useState(false);

  /* Los porqués son el método del boceto: con sesión de administrador y, además, los textos explicativos encendidos. */
  const explicativos = useTextosExplicativos();

  if (admin !== true || !explicativos || !doc.value?.campos) return null;

  const motivos = doc.value;

  const conMarca = CAMPOS_BOCETO.map((campo) => ({
    campo,
    lineas: (motivos.campos[campo] ?? []).filter((l) => l.marca !== ""),
  })).filter((c) => c.lineas.length > 0);

  if (conMarca.length === 0) return null;

  const dudas = conMarca.reduce((n, c) => n + c.lineas.filter((l) => l.marca === "?").length, 0);
  const sugerencias = conMarca.reduce((n, c) => n + c.lineas.filter((l) => l.marca === "*").length, 0);

  const cuando = new Date(motivos.generadoEn);
  const fecha = Number.isNaN(cuando.getTime())
    ? ""
    : cuando.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  return (
    <section data-export-hide className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <Sparkles size={15} className="shrink-0 text-[#C8A96B]" />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white/85">
            Por qué se cuestiona y qué se propone
          </span>

          <span className="block text-[11px] text-white/40">
            Boceto{fecha ? ` del ${fecha}` : ""}, replicado de la J{motivos.origen.jornada} ({motivos.origen.equipo}) ·{" "}
            {dudas} {dudas === 1 ? "punto" : "puntos"} con «?» · {sugerencias} con «*» · sólo lo ves tú
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-white/40 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="border-t border-white/10 px-5 py-4">
          {motivos.fuentes.length > 0 && (
            <p className="mb-4 text-[11px] leading-relaxed text-white/40">{motivos.fuentes.join(" · ")}.</p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {conMarca.map(({ campo, lineas }) => (
              <div key={campo} className="rounded-xl border border-white/[0.07] p-3.5">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {TITULO_CAMPO[campo]}
                </h3>

                <ul className="space-y-1.5">
                  {lineas.map((l, i) => (
                    <Linea key={`${i}-${l.texto}`} linea={l} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Linea({ linea }: { linea: LineaBoceto }) {
  const duda = linea.marca === "?";

  return (
    <li className="flex items-start gap-2 text-[13px] leading-snug">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
          duda
            ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
            : "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
        }`}
      >
        {linea.marca}
      </span>

      <span className="min-w-0">
        <span className={duda ? "text-amber-100" : "text-emerald-100"}>{linea.texto}</span>

        <span className="block text-[11px] leading-snug text-white/45">
          {linea.motivo || (duda ? "a valorar" : "lo proponen los datos: la cifra va en la propia línea")}
        </span>
      </span>
    </li>
  );
}

export default PorQueDelBoceto;
