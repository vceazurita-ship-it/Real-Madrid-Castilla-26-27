"use client";

/**
 * Los seis documentos de Opta que usa el área, pedidos una vez.
 *
 * Con la forma que pasa el linter de React 19 (ver `hooks/useRemoteDoc.ts`):
 * el fetch va dentro del efecto, con su bandera `vivo`, y la recarga manual es
 * sólo un testigo que cambia.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { aObjetos, DOCS_OPTA, traeOpta, type MetaOpta, type TablaOpta } from "@/lib/opta";
import { catalogoDe, gruposDe, type Fila } from "@/lib/opta-analisis";

export type DatosOpta = {
  meta: MetaOpta | null;
  catalogo: ReturnType<typeof catalogoDe>;
  equipos: Fila[];
  partidos: Fila[];
  jugadores: Fila[];
  /** Los del Castilla con TODAS las métricas de jugador (para el perfil de remate). */
  castilla: Fila[];
  castillaPartidos: Fila[];
  grupos: Map<string, number>;
};

type Crudo = {
  meta: MetaOpta | null;
  equipos: TablaOpta | null;
  partidos: TablaOpta | null;
  jugadores: TablaOpta | null;
  castilla: TablaOpta | null;
  castillaPartidos: TablaOpta | null;
};

export function useOpta() {
  const [crudo, setCrudo] = useState<Crudo | null>(null);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let vivo = true;
    void Promise.all([
      traeOpta<MetaOpta>(DOCS_OPTA.meta),
      traeOpta(DOCS_OPTA.equipos),
      traeOpta(DOCS_OPTA.partidos),
      traeOpta(DOCS_OPTA.jugadores),
      traeOpta(DOCS_OPTA.castilla),
      traeOpta(DOCS_OPTA.castillaPartidos),
    ]).then(([meta, equipos, partidos, jugadores, castilla, castillaPartidos]) => {
      if (vivo) setCrudo({ meta, equipos, partidos, jugadores, castilla, castillaPartidos });
    });
    return () => {
      vivo = false;
    };
  }, [testigo]);

  const recarga = useCallback(() => {
    setCrudo(null);
    setTestigo((n) => n + 1);
  }, []);

  const datos = useMemo<DatosOpta | null>(() => {
    if (!crudo) return null;
    return {
      meta: crudo.meta,
      catalogo: catalogoDe(crudo.meta),
      equipos: aObjetos(crudo.equipos),
      partidos: aObjetos(crudo.partidos),
      jugadores: aObjetos(crudo.jugadores),
      castilla: aObjetos(crudo.castilla),
      castillaPartidos: aObjetos(crudo.castillaPartidos),
      grupos: gruposDe(crudo.partidos),
    };
  }, [crudo]);

  return { datos, cargando: crudo === null, recarga };
}
