"use client";

/**
 * LOS TRES DOCUMENTOS LIGEROS DE OPTA (10/11/2026): `opta:meta`,
 * `opta:equipos` y `opta:partidos` (≈0,5 MB entre los tres). Es lo que
 * necesitan la portada y el laboratorio de partido para poner al Castilla y
 * al rival frente a su grupo; nada evento a evento.
 *
 * Pasan por `useDocsOpta`: una petición por clave para toda la pestaña, así
 * que si se abre «Análisis de datos» después ya están.
 */

import { useMemo } from "react";

import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, DOCS_OPTA, type MetaOpta, type TablaOpta } from "@/lib/opta";
import { catalogoDe, gruposDe, type Fila } from "@/lib/opta-analisis";

export type OptaLigero = {
  meta: MetaOpta | null;
  catalogo: ReturnType<typeof catalogoDe>;
  equipos: Fila[];
  partidos: Fila[];
  grupos: Map<string, number>;
};

export function useOptaLigero(): { opta: OptaLigero | null; cargando: boolean } {
  const { docs, cargando } = useDocsOpta<[MetaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.meta, DOCS_OPTA.equipos, DOCS_OPTA.partidos);
  const [meta, equipos, partidos] = docs;
  const opta = useMemo<OptaLigero | null>(() => {
    if (!equipos || !partidos) return null;
    return {
      meta,
      catalogo: catalogoDe(meta),
      equipos: aObjetos(equipos),
      partidos: aObjetos(partidos),
      grupos: gruposDe(partidos),
    };
  }, [meta, equipos, partidos]);
  return { opta, cargando };
}
