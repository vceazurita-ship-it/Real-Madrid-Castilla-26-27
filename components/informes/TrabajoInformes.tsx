"use client";

/*
| El panel de los vídeos de los informes (02/11/2026): el del partido y el de
| ABP, PRE y POST. Está en el layout raíz, así que se ve —y se puede
| cancelar— aunque se haya cerrado el diálogo o se esté en otra pantalla. El
| trabajo en sí vive en `lib/video-informe/trabajo-video.ts`.
*/

import { Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";

import { trabajoVideo, type TrabajoVideo } from "@/lib/video-informe/trabajo-video";

const VACIO: TrabajoVideo[] = [];

export function TrabajoInformes() {
  const trabajos = useSyncExternalStore(trabajoVideo.suscribe, trabajoVideo.foto, () => VACIO);

  if (!trabajos.length) return null;

  return (
    <div
      role="status"
      data-export-hide
      className="siempre-oscuro fixed bottom-4 left-4 z-50 w-[min(340px,calc(100vw-32px))] rounded-xl border border-white/10 p-4 shadow-2xl"
      style={{ background: "#0F141B" }}
    >
      <p className="mb-2 text-sm font-semibold text-white">{trabajos.length === 1 ? "Montando el vídeo del informe" : `Vídeos de informe · ${trabajos.length} en marcha`}</p>
      <p className="mb-3 text-xs leading-snug text-white/60">Sigue aunque cierres el informe, cambies de pantalla o de pestaña.</p>

      <ul className="space-y-2 text-xs">
        {trabajos.map((t) => (
          <li key={t.huella} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {t.estado === "montando" ? <Loader2 size={14} className="animate-spin text-[#C8A96B]" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/30" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-white/90">{t.rotulo}</span>
              <span className="block tabular-nums text-white/55">{t.paso}</span>
            </span>
            <button
              type="button"
              onClick={() => trabajoVideo.cancela(t.huella)}
              className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
