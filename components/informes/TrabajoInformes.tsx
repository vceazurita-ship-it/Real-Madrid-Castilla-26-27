"use client";

/*
| El panel de los vídeos de los informes (02/11/2026): el del partido y el de
| ABP, PRE y POST. Está en el layout raíz, así que se ve —y se puede
| cancelar— aunque se haya cerrado el diálogo o se esté en otra pantalla. El
| trabajo en sí vive en `lib/video-informe/trabajo-video.ts`.
|
| Y los ENVÍOS de los informes (02/11/2026, lib/informes/trabajo-envios.ts):
| por dónde va cada uno, «Reintentar» si ha fallado y, si era por WhatsApp,
| un botón por persona cuando ya están los enlaces. Con un envío en marcha,
| cerrar o recargar la pestaña pregunta antes (se perdería).
*/

import { AlertTriangle, Loader2, RotateCw, Send, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { PanelWhatsapp } from "@/components/correo/PanelWhatsapp";
import { trabajoEnvios, type TrabajoEnvio } from "@/lib/informes/trabajo-envios";
import { trabajoVideo, type TrabajoVideo } from "@/lib/video-informe/trabajo-video";

const VACIO: TrabajoVideo[] = [];
const SIN_ENVIOS: TrabajoEnvio[] = [];

export function TrabajoInformes() {
  const trabajos = useSyncExternalStore(trabajoVideo.suscribe, trabajoVideo.foto, () => VACIO);
  const envios = useSyncExternalStore(trabajoEnvios.suscribe, trabajoEnvios.foto, () => SIN_ENVIOS);
  const enviando = envios.some((e) => e.estado === "enviando");

  /* Recargar o cerrar con un envío a medias lo corta: el navegador pregunta. */
  useEffect(() => {
    if (!enviando) return;

    const antes = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", antes);

    return () => window.removeEventListener("beforeunload", antes);
  }, [enviando]);

  if (!trabajos.length && !envios.length) return null;

  const enMarcha = envios.filter((e) => e.estado === "enviando").length;

  return (
    <div
      role="status"
      data-export-hide
      className="siempre-oscuro fixed bottom-4 left-4 z-50 max-h-[calc(100dvh-32px)] w-[min(380px,calc(100vw-32px))] space-y-4 overflow-y-auto rounded-xl border border-white/10 p-4 shadow-2xl"
      style={{ background: "#0F141B" }}
    >
      {envios.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-white">{enMarcha > 1 ? `Enviando ${enMarcha} informes` : enMarcha ? "Enviando el informe" : "Envíos de informes"}</p>
          {enMarcha ? <p className="mb-3 text-xs leading-snug text-white/60">Puedes cerrar el informe y seguir con otra cosa: te avisa al terminar.</p> : null}

          <ul className="space-y-3 text-xs">
            {envios.map((e) => (
              <li key={e.clave} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {e.estado === "enviando" ? (
                      <Loader2 size={14} className="animate-spin text-[#C8A96B]" />
                    ) : e.estado === "fallo" ? (
                      <AlertTriangle size={14} className="text-red-300" />
                    ) : (
                      <Send size={13} className="text-emerald-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-white/90">{e.rotulo}</span>
                    {e.estado === "enviando" && e.paso ? <span className="block tabular-nums text-white/55">{e.paso}</span> : null}
                    {e.estado === "fallo" && e.error ? (
                      /* El fallo de Gmail trae la dirección donde se arregla: que se pueda pulsar. */
                      <span className="block break-words text-red-200/90">
                        {e.error.split(/(https?:\/\/[^\s)»"]+)/).map((trozo, i) =>
                          i % 2 ? (
                            <a key={i} href={trozo} target="_blank" rel="noopener noreferrer" className="underline">
                              {trozo}
                            </a>
                          ) : (
                            trozo
                          ),
                        )}
                      </span>
                    ) : null}
                  </span>
                  {e.estado === "fallo" ? (
                    <button
                      type="button"
                      onClick={() => trabajoEnvios.reintenta(e.clave)}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs text-white/85 hover:bg-white/10"
                    >
                      <RotateCw size={12} /> Reintentar
                    </button>
                  ) : null}
                  {e.estado === "fallo" ? (
                    <button type="button" aria-label="Quitar" onClick={() => trabajoEnvios.quita(e.clave)} className="shrink-0 p-1 text-white/45 hover:text-white">
                      <X size={14} />
                    </button>
                  ) : null}
                </div>

                {e.estado === "whatsapp" && e.whatsapp ? (
                  <PanelWhatsapp mensajes={e.whatsapp.mensajes} telefonos={e.whatsapp.telefonos} archivo={e.whatsapp.archivo} onCierra={() => trabajoEnvios.quita(e.clave)} />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trabajos.length ? (
        <div>
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
      ) : null}
    </div>
  );
}
