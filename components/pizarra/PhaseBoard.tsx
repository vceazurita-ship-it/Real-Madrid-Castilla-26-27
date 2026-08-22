"use client";

import { useMemo } from "react";
import { Check, CloudOff, Loader2, TriangleAlert, Users2 } from "lucide-react";
import { toast } from "sonner";

import TacticsBoard from "@/components/tactics/TacticsBoard";
import { useLineup } from "@/context/LineupContext";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { emptyDoc, normalizeDoc } from "@/lib/tactics/helpers";
import { tokensFromLineup } from "@/lib/tactics/fromLineup";
import type { TacticsDoc } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

interface Props {
  phase: "defensiva" | "ofensiva";
}

const COPY = {
  defensiva: {
    titulo: "Fase defensiva",
    descripcion:
      "Marca cómo defenderemos: altura del bloque, líneas de presión, coberturas y basculaciones.",
    hint: "Consejo: usa la flecha para desplazamientos, la línea discontinua para orientar la presión y la zona para delimitar el bloque.",
  },
  ofensiva: {
    titulo: "Fase ofensiva",
    descripcion:
      "Marca cómo atacaremos: salida de balón, ocupación de espacios, circulaciones y finalizaciones.",
    hint: "Consejo: encadena escenas y pulsa Animar para explicar la secuencia completa al grupo.",
  },
} as const;

export default function PhaseBoard({ phase }: Props) {
  const copy = COPY[phase];

  const { lineup, formation } = useLineup();
  const { players } = usePlayers();

  const fallback = useMemo(() => emptyDoc(copy.titulo), [copy.titulo]);

  const { value, setValue, status, localOnly } = useRemoteDoc<TacticsDoc>({
    key: `match-board:${phase}`,
    kind: "match-board",
    fallback,
  });

  const doc = useMemo(
    () => normalizeDoc(value, copy.titulo),
    [value, copy.titulo]
  );

  const loadLineup = () => {
    const tokens = tokensFromLineup(lineup, formation, players);

    if (tokens.length === 0) {
      toast.error("No hay ninguna alineación cargada");
      return;
    }

    setValue({
      ...doc,
      scenes: doc.scenes.map((scene, index) =>
        index === 0 ? { ...scene, tokens } : scene
      ),
    });

    toast.success("Alineación colocada en la primera escena");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{copy.titulo}</h2>

          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-white/45">
            {copy.descripcion}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLineup}
            className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3.5 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
          >
            <Users2 size={14} />
            Colocar alineación
          </button>

          <SaveBadge status={status} localOnly={localOnly} />
        </div>
      </div>

      <TacticsBoard
        doc={doc}
        onChange={setValue}
        roster={players}
        hint={copy.hint}
      />
    </div>
  );
}

function SaveBadge({
  status,
  localOnly,
}: {
  status: string;
  localOnly: boolean;
}) {
  const [tone, icon, text] = localOnly
    ? (["amber", <CloudOff key="i" size={13} />, "Solo local"] as const)
    : status === "saving" || status === "loading"
    ? ([
        "neutral",
        <Loader2 key="i" size={13} className="animate-spin" />,
        status === "saving" ? "Guardando" : "Cargando",
      ] as const)
    : status === "error"
    ? (["red", <TriangleAlert key="i" size={13} />, "Error"] as const)
    : (["green", <Check key="i" size={13} />, "Guardado"] as const);

  const tones = {
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    neutral: "border-white/15 bg-white/5 text-white/60",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
        tones[tone]
      )}
    >
      {icon}
      {text}
    </span>
  );
}
