"use client";

/**
 * LOS TRES VÍDEOS DE UN PARTIDO NUESTRO (31/10/2026).
 *
 * Hudl, la grabación táctica (sólo en el ordenador principal) y el resumen de
 * la federación en YouTube. Lo que no existe no se pinta: sin resumen todavía
 * no hay botón de resumen, y fuera del ordenador principal no hay grabación.
 * De dónde sale cada enlace: lib/video-partido/enlaces.ts.
 */

import Link from "next/link";
import { Clapperboard, Copy, HardDrive, MonitorPlay, Scissors } from "lucide-react";
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
  coding,
  className,
  completos = false,
}: {
  /** El día del partido, «AAAA-MM-DD». */
  dia: string;
  /** Partido de liga ya jugado: sin su id de Hudl todavía, se ofrece la biblioteca. */
  jugado: boolean;
  /** 16/11/2026: enlace a sus cortes en Coding, en la misma fila y con el mismo peso que el resto. */
  coding?: string;
  className?: string;
  /**
   * 20/11/2026 (jueces, ronda 8, Data análisis): los rótulos enteros. En una
   * fila estrecha (390 px) los botones encogían a «Codi…», «Resu…»; con esto
   * no encogen y la fila pasa de línea.
   */
  completos?: boolean;
}) {
  const principal = useOrdenadorPrincipal();

  const ANCHO = completos ? "flex-none shrink-0" : "flex-1";
  const TEXTO = completos ? "whitespace-nowrap" : "truncate";

  const enlaces = enlacesDelDia(dia);

  /* 16/11/2026 (fútbol): una sola etiqueta, «Hudl»; la diferencia (el
     partido o la biblioteca del club) va en el título del botón. */
  const hudl = enlaces?.hudl
    ? { url: enlaces.hudl.url, texto: "Hudl", titulo: `Abre el partido en Hudl: ${enlaces.partido}` }
    : jugado
      ? {
          url: HUDL_BIBLIOTECA,
          texto: "Hudl",
          titulo: `Abre la biblioteca del Castilla en Hudl (este partido aún no tiene enlace propio): es el que empieza por «${dia}»`,
        }
      : null;

  const tactica = principal && enlaces?.tactica ? enlaces : null;

  const resumen = enlaces?.resumen ?? null;

  /*
  | 26/11/2026: el Coding se abre con ESTE partido elegido (`dia`) y, en el
  | ordenador principal, con su grabación táctica cargada y lista para cortar
  | (`tactica`, ver app/coding/page.tsx). En los demás, el selector de vídeo a la vista.
  */
  const codingHref = coding && dia
    ? `${coding}${coding.includes("?") ? "&" : "?"}dia=${encodeURIComponent(dia)}${principal && enlaces?.jornada ? `&tactica=${enlaces.jornada}` : ""}`
    : null;

  if (!hudl && !tactica && !resumen && !coding) return null;

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
      {coding && (
        <Link href={codingHref ?? coding} title={principal && enlaces?.tactica ? "Coding de este partido con la grabación táctica cargada" : "Coding de este partido: elige el vídeo y a cortar"} className={cn(BOTON, NEUTRO, ANCHO)}>
          <Scissors className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={TEXTO}>Coding</span>
        </Link>
      )}

      {hudl && (
        <a href={hudl.url} target="_blank" rel="noopener noreferrer" title={hudl.titulo} className={cn(BOTON, NEUTRO, ANCHO)}>
          <Clapperboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={TEXTO}>{hudl.texto}</span>
        </a>
      )}

      {tactica && (
        <span className={cn("flex min-w-0 items-stretch", ANCHO)}>
          <a
            href={urlTactica(tactica.jornada)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abre en este ordenador «${tactica.tactica?.fichero}»`}
            className={cn(BOTON, NEUTRO, ANCHO, "rounded-r-none")}
          >
            <HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className={TEXTO}>Grabación táctica</span>
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
          title={`Resumen en YouTube · ${resumen.canal} · ${resumen.titulo}`}
          className={cn(BOTON, NEUTRO, ANCHO)}
        >
          <MonitorPlay className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={TEXTO}>Resumen</span>
        </a>
      )}
    </div>
  );
}

export default AccesosVideo;
