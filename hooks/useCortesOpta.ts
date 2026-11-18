"use client";

/**
 * Los cortes de Opta en B2 (`lib/opta-cortes.ts`) para una pantalla, y el
 * mejor enlace de cada evento: nuestro corte o, si no está, ProVision.
 * Hasta que llegan los documentos, el enlace es el de ProVision.
 */

import { useCallback, useEffect, useState } from "react";

import { cargaCortesOpta, enlaceClipOpta, type CortesOpta } from "@/lib/opta-cortes";
import type { EventoOpta, TipoEventoOpta } from "@/lib/opta-video";

export function useCortesOpta(): CortesOpta | null {
  const [cortes, setCortes] = useState<CortesOpta | null>(null);

  useEffect(() => {
    let vivo = true;

    void cargaCortesOpta().then((c) => {
      if (vivo) setCortes(c);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return cortes;
}

/** `clip(evento, tipo)` → el enlace del vídeo de ese evento (o undefined sin reloj). */
export function useEnlaceClipOpta(): (evento: EventoOpta, tipo?: TipoEventoOpta) => string | undefined {
  const cortes = useCortesOpta();

  return useCallback((evento: EventoOpta, tipo: TipoEventoOpta = "touches") => enlaceClipOpta(evento, tipo, cortes), [cortes]);
}
