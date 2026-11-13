"use client";

/**
 * EL DIRECTO DE OPTA DESDE LA PORTADA (13/11/2026, petición del analista).
 *
 * Un solo botón: si el directo ya corre, lleva a verlo; si no, lo lanza en
 * GitHub (sin diálogo) y lleva a la pantalla, que espera sola la primera
 * lectura. El administrador lo ve siempre (pequeño si no hay directo); el
 * resto, sólo mientras hay un directo vivo, y su botón sólo lleva a verlo.
 */

import { Radio } from "lucide-react";

import { useDirectoOpta } from "@/hooks/useDirectoOpta";

const ROJO = "#E5484D";

export function DirectoPortada({ admin }: { admin: boolean }) {
  const d = useDirectoOpta(admin);

  if (!d.enMarcha && !admin) return null;
  /* Sin token en Render el botón no podría lanzar nada: no se ofrece. */
  if (!d.enMarcha && admin && d.preparado === false) return null;
  if (!d.enMarcha && d.preparado === null) return null;

  const castilla = (d.indice?.partidos ?? []).some((p) => (p.equipos ?? []).includes("Real Madrid II"));

  return (
    <section
      aria-label="Directo de Opta"
      className={`portada-entra relative flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[24px] border p-4 sm:p-5 ${
        d.enMarcha ? "border-red-500/40 bg-red-500/[0.07]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
          {d.enMarcha && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: ROJO }} />}
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: d.enMarcha ? ROJO : "rgba(127,127,127,0.55)" }} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Opta en directo</p>
          <p className="truncate text-[15px] font-semibold text-white/90">
            {d.enMarcha
              ? castilla
                ? "Nuestro partido, contra el plan"
                : "Partidos de la jornada en juego"
              : "Lánzalo y te llevo a verlo"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void d.abre()}
        disabled={d.lanzando}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[14px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
        style={{ background: ROJO }}
      >
        <Radio className="h-4 w-4" aria-hidden />
        {d.lanzando ? "Lanzando…" : d.enMarcha ? "Ver el directo" : "Empezar directo"}
      </button>
    </section>
  );
}
