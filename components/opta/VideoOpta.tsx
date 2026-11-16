"use client";

/**
 * «▶ Vídeo en Opta» de UN evento (16/11/2026).
 *
 * Abre en ProVision el Event Log de ese partido filtrado a esa parte y ese
 * segundo, con el vídeo del evento abierto (8 s antes y 8 s después). Lo
 * monta `lib/opta-video.ts`. Hace falta la sesión de Opta abierta en el
 * navegador; si Opta no tiene el vídeo de ese partido, ProVision lo dice.
 */

import { urlVideoOpta, type EventoOpta, type TipoEventoOpta } from "@/lib/opta-video";

export function VideoOpta({
  evento,
  tipo = "touches",
  etiqueta = "▶ Vídeo en Opta",
  descripcion,
}: {
  evento: EventoOpta;
  tipo?: TipoEventoOpta;
  etiqueta?: string;
  /** Qué es, para el título al pasar el ratón («Córner de Fortuny, 34′»). */
  descripcion?: string;
}) {
  const url = urlVideoOpta(evento, tipo);

  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/40 px-2.5 py-1 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
      title={`${descripcion ? `${descripcion}: ` : ""}abre en Opta ProVision este evento con su vídeo (8 s antes y 8 s después). Hace falta tener la sesión de Opta abierta.`}
    >
      {etiqueta}
    </a>
  );
}
