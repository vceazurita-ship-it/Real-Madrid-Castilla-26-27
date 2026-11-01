"use client";

/*
|--------------------------------------------------------------------------
| PROPUESTA DE ONCE PARA EL PRÓXIMO PARTIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Cuatro casillas (duelos, lo que pide su juego, emocional y último partido),
| encendidas por defecto; la propuesta se rehace al tocarlas. Una línea por
| jugador con el porqué, sin método. «Aplicar propuesta» la pasa al once y se
| puede deshacer: nunca se aplica sola. El cálculo vive en
| `lib/tactics/propuestaOnce.ts`.
*/

import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cargaDatosPropuesta } from "@/lib/tactics/propuestaCarga";
import { FACTORES, TODOS_ACTIVOS, preparaPropuesta, proponOnceDelPartido, type DatosPropuesta, type Elegido, type Factor } from "@/lib/tactics/propuestaOnce";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/player";

export default function PropuestaOnce({
  roster,
  rival,
  onceActual,
  onAplica,
  onCierra,
}: {
  roster: Player[];
  rival: string;
  /** Quién está ahora en cada hueco (hueco → nombre de la ficha). */
  onceActual: Record<string, string>;
  onAplica: (elegidos: Elegido[]) => void;
  onCierra: () => void;
}) {
  const [datos, setDatos] = useState<DatosPropuesta | null>(null);
  const [fallo, setFallo] = useState(false);
  const [activos, setActivos] = useState<Record<Factor, boolean>>(TODOS_ACTIVOS);

  useEffect(() => {
    let vivo = true;

    cargaDatosPropuesta(roster, rival)
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((error) => {
        console.error("[pizarra] propuesta de once", error);

        if (vivo) setFallo(true);
      });

    return () => {
      vivo = false;
    };
  }, [roster, rival]);

  const prep = useMemo(() => (datos ? preparaPropuesta(datos) : null), [datos]);
  const propuesta = useMemo(() => (prep ? proponOnceDelPartido(prep, onceActual, activos) : null), [prep, onceActual, activos]);

  return (
    <section aria-label="Propuesta de once" className="rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.05] p-3 sm:p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
            <Sparkles size={12} aria-hidden />
            Propuesta para el partido
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white/90">Once contra el {datos?.rival ?? rival}</h3>
        </div>
        <button type="button" onClick={onCierra} aria-label="Cerrar la propuesta" className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white">
          <X size={16} />
        </button>
      </header>

      {!propuesta && !fallo && (
        <p className="mt-3 flex items-center gap-2 text-xs text-white/55">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Preparando la propuesta con el próximo rival…
        </p>
      )}

      {fallo && <p className="mt-3 text-xs text-amber-300">No se ha podido preparar la propuesta. Vuelve a abrirla en un momento.</p>}

      {propuesta && (
        <>
          <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Qué se tiene en cuenta</legend>
            {FACTORES.map((f) => {
              const estado = propuesta.factores.find((x) => x.clave === f.clave);
              const puede = Boolean(estado?.disponible);
              const marcado = puede && activos[f.clave];

              return (
                <label
                  key={f.clave}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition",
                    marcado ? "border-[#C8A96B]/40 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]",
                    !puede && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!puede}
                    onChange={(e) => setActivos((antes) => ({ ...antes, [f.clave]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#C8A96B]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white/90">{f.rotulo}</span>
                    {estado?.nota ? <span className="mt-0.5 block text-[11px] leading-snug text-white/50">{estado.nota}</span> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <ol className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.02]">
            {propuesta.elegidos.map((e) => (
              <li key={e.hueco} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="flex min-w-0 items-baseline gap-2 sm:w-56 sm:shrink-0">
                  <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{e.rotulo}</span>
                  <span className="truncate text-[13px] font-semibold text-white/90">{e.ficha.apodo || e.ficha.nombre}</span>
                  {!e.repite && <span className="shrink-0 rounded bg-emerald-400/[0.14] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Entra</span>}
                </span>
                <span className="min-w-0 text-[12px] leading-snug text-white/60">{e.motivo}</span>
              </li>
            ))}
          </ol>

          {propuesta.bajas.length > 0 && (
            <p className="mt-2 text-[11px] leading-snug text-white/50">
              <b className="font-semibold text-white/70">No entran:</b> {propuesta.bajas.map((b) => `${b.nombre} (${b.estado})`).join(", ")}.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-white/50">
              {propuesta.cambios === 0
                ? "Es el once que ya tienes en la pizarra."
                : `${propuesta.cambios} ${propuesta.cambios === 1 ? "puesto cambia" : "puestos cambian"} respecto a la pizarra.`}
            </span>
            <button
              type="button"
              onClick={onCierra}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={propuesta.cambios === 0 || propuesta.elegidos.length === 0}
              onClick={() => onAplica(propuesta.elegidos)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C8A96B] px-4 py-1.5 text-[12px] font-bold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
            >
              <Check size={14} aria-hidden />
              Aplicar propuesta
            </button>
          </div>
        </>
      )}
    </section>
  );
}
