"use client";

import { useMemo } from "react";
import { Users2 } from "lucide-react";
import { toast } from "sonner";

import EstadoGuardado from "@/components/tactics/EstadoGuardado";
import TacticsBoard from "@/components/tactics/TacticsBoard";
import { useLineup } from "@/context/LineupContext";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { emptyDoc, normalizeDoc } from "@/lib/tactics/helpers";
import { tokensFromLineup } from "@/lib/tactics/fromLineup";
import type { TacticsDoc } from "@/lib/tactics/types";

interface Props {
  phase: "defensiva" | "ofensiva";
}

const COPY = {
  defensiva: {
    titulo: "Fase defensiva",
    descripcion:
      "Marca cómo defenderemos: altura del bloque, líneas de presión, coberturas y basculaciones.",
    hint: "Consejo: usa la flecha para desplazamientos, la línea discontinua para orientar la presión y la zona para delimitar el bloque. Ctrl+Z deshace.",
  },
  ofensiva: {
    titulo: "Fase ofensiva",
    descripcion:
      "Marca cómo atacaremos: salida de balón, ocupación de espacios, circulaciones y finalizaciones.",
    /* No hay ningún botón «Animar» (19/10/2026): la animación sale del ▶ de la barra de escenas. */
    hint: "Consejo: encadena escenas y pulsa ▶ en la barra de escenas para explicar la secuencia completa al grupo.",
  },
} as const;

export default function PhaseBoard({ phase }: Props) {
  const copy = COPY[phase];

  const { lineup, formation } = useLineup();
  const { players } = usePlayers();

  const fallback = useMemo(() => emptyDoc(copy.titulo), [copy.titulo]);

  const { value, setValue, status, localOnly, sinGuardar, guardaYa } =
    useRemoteDoc<TacticsDoc>({
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
      toast.error("No hay ninguna alineación cargada", {
        description:
          "Coloca a los jugadores en la pestaña «Alineación y banquillo» y vuelve aquí.",
      });
      return;
    }

    /*
    | Se puede deshacer (19/10/2026). Colocar la alineación sustituye las
    | fichas de la primera escena, y lo hace por fuera del historial del
    | tablero: quien ya había movido a sus jugadores para explicar la presión
    | lo perdía de un clic, y ni la flecha de deshacer ni Ctrl+Z llegaban.
    */
    const antes = doc;
    const habiaFichas = (doc.scenes[0]?.tokens.length ?? 0) > 0;

    setValue({
      ...doc,
      scenes: doc.scenes.map((scene, index) =>
        index === 0 ? { ...scene, tokens } : scene
      ),
    });

    toast.success("Alineación colocada en la primera escena", {
      description: habiaFichas
        ? "Ha sustituido a las fichas que había en esa escena."
        : undefined,
      duration: habiaFichas ? 8000 : undefined,
      action: habiaFichas
        ? { label: "Deshacer", onClick: () => setValue(antes) }
        : undefined,
    });
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadLineup}
            title="Pone en la primera escena a los once que tengas en «Alineación y banquillo»"
            className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3.5 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
          >
            <Users2 size={14} />
            Colocar alineación
          </button>

          <EstadoGuardado
            status={status}
            localOnly={localOnly}
            sinGuardar={sinGuardar}
            onGuardar={() => void guardaYa()}
          />
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
