"use client";

/**
 * Cómo se llega al clip de una acción. Wyscout no da enlaces a sus clips:
 * se enseña SIEMPRE el partido, la competición, la jornada y el minuto (con
 * los segundos de partido que trae Wyscout) y un botón que copia el texto
 * para buscarla allí. Si hay resumen oficial en YouTube, también su enlace
 * (con `&t=` cuando el segundo se sabe sin duda).
 */

import { useState } from "react";
import { Check, Copy, PlayCircle } from "lucide-react";

import { mmss, partidoSinMarcador, textoParaBuscar, tiempoVideo, videoDe, type Accion, type CompeticionAcciones } from "@/lib/abp-lab/acciones";

const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

async function copia(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);

    return true;
  } catch {
    try {
      const t = document.createElement("textarea");

      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();

      const ok = document.execCommand("copy");

      t.remove();

      return ok;
    } catch {
      return false;
    }
  }
}

const BOTON =
  "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/[0.08]";

export function ClipAccion({
  accion: a,
  competicion,
  jornada,
  videos,
  compacto = false,
}: {
  accion: Accion;
  competicion: string;
  jornada: string;
  videos: CompeticionAcciones["videos"];
  compacto?: boolean;
}) {
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);

  const video = videoDe(a, { videos });

  const { nombre, marcador } = partidoSinMarcador(a.p);

  const vt = tiempoVideo(a);

  const copiar = async () => {
    const ok = await copia(textoParaBuscar(a, jornada));

    setCopiado(ok ? "si" : "no");

    window.setTimeout(() => setCopiado(null), 2200);
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="break-words text-[13px] font-semibold text-white/90">
          {nombre}
          {marcador && <span className="ml-1.5 tabular-nums text-white/55">{marcador}</span>}
        </p>
        <p className="break-words text-[11px] text-white/55">
          {competicion} · {jornada} · {fecha(a.fecha)}
        </p>
        <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#C8A96B]">
          min {a.min}&apos; <span className="font-normal text-white/60">· {mmss(a.seg)} de partido{vt ? ` · ${vt} en el vídeo` : ""}</span>
        </p>
      </div>

      <div className={`grid gap-2 ${video ? "grid-cols-2" : "grid-cols-1"}`}>
        {video && (
          <a href={video.url} target="_blank" rel="noopener noreferrer" title={`${video.etiqueta} en YouTube${video.canal ? ` · ${video.canal}` : ""}`} className={BOTON}>
            <PlayCircle size={14} className="shrink-0" />
            <span className="truncate">{video.etiqueta}</span>
          </a>
        )}
        <button type="button" onClick={copiar} className={BOTON} title={`Copia «${textoParaBuscar(a, jornada)}»`}>
          {copiado === "si" ? <Check size={14} className="shrink-0 text-emerald-400" /> : <Copy size={14} className="shrink-0" />}
          <span className="truncate">{copiado === "si" ? "Copiado" : copiado === "no" ? "No se pudo copiar" : compacto ? "Copiar para Wyscout" : "Copiar para buscar en Wyscout"}</span>
        </button>
      </div>
    </div>
  );
}
