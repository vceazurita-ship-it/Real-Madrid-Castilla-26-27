"use client";

/**
 * Lo que toca según el último post, como objetivos (21/10/2026): un botón que
 * lee el informe post del último partido y propone sus líneas de «Qué toca en
 * el microciclo». Cada una se añade como objetivo con su origen ya puesto
 * («Post J8 · Transición»); el jugador y el resto se rellenan después.
 */

import { useState } from "react";
import { ListPlus, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/abp/ui";
import { queTocaDelUltimoPost, type QueTocaDelPost as Propuesta } from "@/lib/entreno/sugerencias";

export function QueTocaDelPost({ yaEstan, onAnade }: { yaEstan: string[]; onAnade: (objetivo: string, origen: string) => void }) {
  const [estado, setEstado] = useState<"quieto" | "leyendo" | "listo" | "nada">("quieto");
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);

  const lee = async () => {
    setEstado("leyendo");

    const p = await queTocaDelUltimoPost().catch(() => null);

    setPropuesta(p);
    setEstado(p ? "listo" : "nada");
  };

  if (estado === "quieto" || estado === "leyendo") {
    return (
      <Button icon={estado === "leyendo" ? Loader2 : ListPlus} onClick={() => void lee()} disabled={estado === "leyendo"} title="Lee el informe post del último partido y propone lo que toca trabajar">
        {estado === "leyendo" ? "Leyendo el último post…" : "Lo que toca según el post"}
      </Button>
    );
  }

  if (estado === "nada" || !propuesta) {
    return <p className="text-xs text-white/50">El último post no deja nada que trabajar esta semana.</p>;
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rmcf-gold-ink,#C8A96B)]">
        Qué toca según el {propuesta.origen.replace(/^Post/, "post")} · {propuesta.rival}
      </p>
      <ul className="space-y-1.5">
        {propuesta.lineas.map((l) => {
          const origen = `${propuesta.origen} · ${l.tema}`;
          const puesto = yaEstan.includes(origen);

          return (
            <li key={l.texto} className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm text-white/85">{l.texto}</span>
              <Button icon={Plus} onClick={() => onAnade(l.texto, origen)} disabled={puesto} title={puesto ? "Ya es un objetivo de este día" : "Añadirlo como objetivo, con su origen"}>
                {puesto ? "Añadido" : "Objetivo"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
