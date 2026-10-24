"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useCallback, useEffect, useState } from "react";

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
  const [error, setError] = useState(false);

  /* «Reintentar»: vuelve a pedir saltándose la copia del aparato. */
  const [intento, setIntento] = useState(0);

  const reintenta = useCallback(() => {
    setLoading(true);
    setError(false);
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        /* Compartida con el resto de pantallas que piden lo mismo. El orden
           se pide a la vez: los equipos salen por calendario, con el rival
           de la semana el primero, igual que en `/rivals`. */
        const [data, orden] = await Promise.all([
          traeJson("/api/rivals?action=rivalesPlantillas", { forzar: intento > 0 }),
          cargaOrdenRivales(),
        ]);

        if (cancelled) return;

        const compara = comparaPorCalendario(orden);

        setSquads(buildRivalSquads(data).sort((a, b) => compara(a.equipo, b.equipo)));
      } catch (error) {
        if (cancelled) return;

        console.error("[useRivalSquads]", error);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [intento]);

  return { squads, loading, error, reintenta };
}
