"use client";

import { useEffect, useState } from "react";

import { buildRivalSquads, RivalSquad } from "@/lib/tactics/rivals";

/**
 * Plantillas rivales agrupadas por equipo, listas para la pizarra táctica.
 *
 * Es la misma hoja que alimenta `/rivals`, aquí reducida a dorsal, nombre y
 * posición: lo único que necesita una ficha.
 */
export function useRivalSquads() {
  const [squads, setSquads] = useState<RivalSquad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/rivals?action=rivalesPlantillas", {
          cache: "no-store",
        });

        const data = await response.json();

        if (cancelled) return;

        setSquads(buildRivalSquads(data));
      } catch (error) {
        if (cancelled) return;

        console.error("[useRivalSquads]", error);
        setSquads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { squads, loading };
}
