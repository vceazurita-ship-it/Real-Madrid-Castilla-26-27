"use client";

/**
 * «Ver la acción» (nuestro corte, aquí mismo) y «Abrir en Hudl · mm:ss».
 * Lo comparten goles, faltas, robos, pérdidas, ABP y saques de banda.
 * Hudl no deja enlazar a un instante: el enlace abre el partido y el
 * minuto del vídeo va al lado. El vídeo sólo se carga al pedirlo.
 */

import { useState } from "react";
import { ExternalLink, Film, Play, X } from "lucide-react";
import { rotuloSegundo } from "@/lib/goles/tecnico";

export type EnlaceHudlAccion = { url: string; seg: number };

const BOTON =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/75 transition hover:bg-white/[0.06] hover:text-white";

export const esYoutube = (u: string) => /youtu\.?be/.test(u);

export function EnlaceHudl({ hudl, que = "la acción" }: { hudl: EnlaceHudlAccion; que?: string }) {
  return (
    <a
      href={hudl.url}
      target="_blank"
      rel="noreferrer"
      title={`Abre el partido en Hudl; ${que} está en el ${rotuloSegundo(hudl.seg)} del vídeo`}
      className={BOTON}
    >
      <ExternalLink size={13} className="text-[#C8A96B]" aria-hidden />
      Abrir en Hudl
      <span className="tabular-nums text-white/50">· {rotuloSegundo(hudl.seg)}</span>
    </a>
  );
}

export function VerAccion({ video, hudl, que = "la acción" }: { video?: string; hudl?: EnlaceHudlAccion; que?: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!video && !hudl) return null;
  const ver = `Ver ${que}`;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {video && !esYoutube(video) ? (
          <button type="button" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)} className={BOTON}>
            {abierto ? <X size={13} aria-hidden /> : <Play size={13} className="text-[#C8A96B]" aria-hidden />}
            {abierto ? "Cerrar el vídeo" : ver}
          </button>
        ) : video ? (
          <a href={video} target="_blank" rel="noreferrer" className={BOTON}>
            <Film size={13} className="text-[#C8A96B]" aria-hidden /> {ver}
          </a>
        ) : null}
        {hudl ? <EnlaceHudl hudl={hudl} que={que} /> : null}
      </div>
      {abierto && video ? <video src={video} controls autoPlay playsInline preload="auto" className="aspect-video w-full min-w-[min(18rem,80vw)] max-w-md rounded-xl bg-black" /> : null}
    </div>
  );
}
