"use client";

/**
 * EL RESPALDO DE OPTA EN LA PANTALLA (17/11/2026).
 *
 * `useRespaldoOpta("transiciones", fechasEtiquetadas)` pide a
 * /api/opta/respaldo las filas de esa pantalla. Mientras llega (o si Opta no
 * contesta), la pantalla sigue con lo etiquetado, como siempre: el respaldo
 * sólo suma. La respuesta se comparte entre pantallas durante la visita.
 */

import { useEffect, useState } from "react";

import type { PartidoOpta, QueRespaldo } from "./tipos";

type Respuesta<T> = { partidos: PartidoOpta[]; filas: T[] };

const pedidas = new Map<string, Promise<Respuesta<unknown>>>();

function pide<T>(url: string): Promise<Respuesta<T>> {
  let p = pedidas.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => ({ partidos: Array.isArray(j?.partidos) ? j.partidos : [], filas: Array.isArray(j?.filas) ? j.filas : [] }))
      .catch(() => {
        pedidas.delete(url);
        return { partidos: [], filas: [] };
      });
    pedidas.set(url, p);
  }
  return p as Promise<Respuesta<T>>;
}

const urlDe = (que: QueRespaldo, etiquetadas: string[]) => {
  const clave = [...new Set(etiquetadas)].sort().join(",");
  return `/api/opta/respaldo?que=${que}${clave ? `&etiquetadas=${clave}` : ""}`;
};

/** Para las pantallas que ya cargan sus datos en un efecto propio (las de ABP y banda). Nunca falla: sin Opta, vacío. */
export function traeRespaldoOpta<T>(que: QueRespaldo, etiquetadas: string[] = []): Promise<Respuesta<T>> {
  return pide<T>(urlDe(que, etiquetadas));
}

export function useRespaldoOpta<T>(que: QueRespaldo, etiquetadas: string[] = []): Respuesta<T> & { listo: boolean } {
  const url = urlDe(que, etiquetadas);
  const [estado, setEstado] = useState<{ url: string; datos: Respuesta<T> } | null>(null);

  useEffect(() => {
    let vivo = true;
    pide<T>(url).then((datos) => {
      if (vivo) setEstado({ url, datos });
    });
    return () => {
      vivo = false;
    };
  }, [url]);

  const datos = estado?.url === url ? estado.datos : null;
  return { partidos: datos?.partidos ?? [], filas: datos?.filas ?? [], listo: Boolean(datos) };
}
