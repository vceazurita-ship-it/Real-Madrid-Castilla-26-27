"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useEffect, useState } from "react";

import { buildRivalSquads, RivalSquad } from "@/lib/tactics/rivals";
import { cargaOrdenRivales, comparaPorCalendario } from "@/lib/rivals/orden-calendario";

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
        /* Compartida con el resto de pantallas que piden lo mismo. El orden
           se pide a la vez: los equipos salen por calendario, con el rival
           de la semana el primero, igual que en `/rivals`. */
        const [data, orden] = await Promise.all([
          traeJson("/api/rivals?action=rivalesPlantillas"),
          cargaOrdenRivales(),
        ]);

        if (cancelled) return;

        const compara = comparaPorCalendario(orden);

        setSquads(buildRivalSquads(data).sort((a, b) => compara(a.equipo, b.equipo)));
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
