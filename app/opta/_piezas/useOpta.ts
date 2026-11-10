"use client";

/**
 * Los seis documentos de Opta que usan las áreas de «Análisis de datos»,
 * pedidos una vez.
 *
 * Con la forma que pasa el linter de React 19 (ver `hooks/useRemoteDoc.ts`):
 * el fetch va dentro del efecto, con su bandera `vivo`, y la recarga manual es
 * sólo un testigo que cambia.
 *
 * 10/11/2026 (fase 4): las pestañas de `/opta` son ahora áreas sueltas de
 * `/data-analisis`, y cada una monta este hook sólo cuando se abre. Para que
 * pasar de un área a otra no vuelva a bajar los seis documentos, la descarga
 * se guarda para toda la pestaña del navegador (como `hooks/useDocsOpta.ts`);
 * «Volver a mirar» (`recarga`) la olvida.
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

/* La descarga compartida: una promesa para todas las áreas; si no llega nada, se olvida. */
let enVuelo: Promise<Crudo> | null = null;
let listo: Crudo | null = null;

function trae(): Promise<Crudo> {
  if (!enVuelo) {
    enVuelo = Promise.all([
      traeOpta<MetaOpta>(DOCS_OPTA.meta),
      traeOpta(DOCS_OPTA.equipos),
      traeOpta(DOCS_OPTA.partidos),
      traeOpta(DOCS_OPTA.jugadores),
      traeOpta(DOCS_OPTA.castilla),
      traeOpta(DOCS_OPTA.castillaPartidos),
    ]).then(([meta, equipos, partidos, jugadores, castilla, castillaPartidos]) => {
      const crudo = { meta, equipos, partidos, jugadores, castilla, castillaPartidos };
      if (equipos) listo = crudo;
      else enVuelo = null;
      return crudo;
    });
  }
  return enVuelo;
}

export function useOpta() {
  const [crudo, setCrudo] = useState<Crudo | null>(() => listo);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let vivo = true;
    void trae().then((c) => {
      if (vivo) setCrudo(c);
    });
    return () => {
      vivo = false;
    };
  }, [testigo]);

  const recarga = useCallback(() => {
    enVuelo = null;
    listo = null;
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
