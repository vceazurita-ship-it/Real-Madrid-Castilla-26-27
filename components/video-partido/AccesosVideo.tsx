"use client";

/**
 * LOS TRES VÍDEOS DE UN PARTIDO NUESTRO (31/10/2026).
 *
 * Hudl, la grabación táctica (sólo en el ordenador principal) y el resumen de
 * la federación en YouTube. Lo que no existe no se pinta: sin resumen todavía
 * no hay botón de resumen, y fuera del ordenador principal no hay grabación.
 * De dónde sale cada enlace: lib/video-partido/enlaces.ts.
 */

import { Clapperboard, Copy, HardDrive, MonitorPlay } from "lucide-react";
import { toast } from "sonner";

import { useOrdenadorPrincipal } from "@/hooks/useOrdenadorPrincipal";
import { cn } from "@/lib/utils";
import {
  HUDL_BIBLIOTECA,
  enlacesDelDia,
  rutaTactica,
  urlTactica,
} from "@/lib/video-partido/enlaces";

const BOTON =
  "flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/60";

const NEUTRO = "border-white/10 bg-white/[0.03] text-white/75 hover:border-[#C8A96B]/50 hover:text-white";

export function AccesosVideo({
  dia,
  jugado,
  className,
}: {
  /** El día del partido, «AAAA-MM-DD». */
  dia: string;
  /** Partido de liga ya jugado: sin su id de Hudl todavía, se ofrece la biblioteca. */
  jugado: boolean;
  className?: string;
}) {
  const principal = useOrdenadorPrincipal();

  const enlaces = enlacesDelDia(dia);

  const hudl = enlaces?.hudl
    ? { url: enlaces.hudl.url, texto: "Hudl", titulo: `El partido en Hudl: ${enlaces.partido}` }
    : jugado
      ? {
          url: HUDL_BIBLIOTECA,
          texto: "Hudl · biblioteca",
          titulo: `La biblioteca del Castilla en Hudl: el partido es el que empieza por «${dia}»`,
        }
      : null;

  const tactica = principal && enlaces?.tactica ? enlaces : null;

  const resumen = enlaces?.resumen ?? null;

  if (!hudl && !tactica && !resumen) return null;

  const copia = async () => {
    if (!tactica) return;

    try {
      await navigator.clipboard.writeText(rutaTactica(tactica));

      toast.success("Ruta copiada", { description: tactica.tactica?.fichero });
    } catch {
      toast.error("No se ha podido copiar la ruta", { description: rutaTactica(tactica) });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {hudl && (
        <a href={hudl.url} target="_blank" rel="noopener noreferrer" title={hudl.titulo} className={cn(BOTON, NEUTRO, "flex-1")}>
          <Clapperboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{hudl.texto}</span>
        </a>
      )}

      {tactica && (
        <span className="flex min-w-0 flex-1 items-stretch">
          <a
            href={urlTactica(tactica.jornada)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abre en este ordenador «${tactica.tactica?.fichero}»`}
            className={cn(BOTON, NEUTRO, "flex-1 rounded-r-none")}
          >
            <HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Grabación táctica</span>
          </a>
          <button
            type="button"
            onClick={() => void copia()}
            title="Copiar la ruta del vídeo"
            aria-label="Copiar la ruta de la grabación táctica"
            className={cn(BOTON, NEUTRO, "-ml-px rounded-l-none px-2")}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}

      {resumen && (
        <a
          href={resumen.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${resumen.canal} · ${resumen.titulo}`}
          className={cn(BOTON, NEUTRO, "flex-1")}
        >
          <MonitorPlay className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Resumen RFEF</span>
        </a>
      )}
    </div>
  );
}

export default AccesosVideo;
