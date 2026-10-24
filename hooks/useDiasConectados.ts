"use client";

/**
 * LO QUE LAS OTRAS PANTALLAS DICEN DE UNOS DÍAS (24/10/2026).
 *
 * Sólo lee, por `/api/docs`: el almacén de Jugadores sesión (un documento
 * para todas las sesiones) y, por fecha, los objetivos del análisis de
 * entrenamiento y lo que devolvió el ordenador del club. Escribir sigue
 * siendo cosa de cada pantalla, con su `useRemoteDoc`. Ver
 * lib/sesion-dia/conexion.ts.
 */

import { useEffect, useMemo, useState } from "react";

import { claveAnalisis, claveSesion, normalizaSesion, type AnalisisEntreno, type SesionEntreno } from "@/lib/entreno/modelo";
import type { AlmacenEquipos } from "@/lib/sesion-equipos/modelo";

export type EntrenoDelDia = { sesion: SesionEntreno | null; analisis: AnalisisEntreno | null };

async function leeDoc<T>(clave: string): Promise<T | null> {
  const r = await fetch(`/api/docs?key=${encodeURIComponent(clave)}`, { cache: "no-store" });

  if (!r.ok) return null;

  return (((await r.json()) as { data?: T | null })?.data ?? null) as T | null;
}

export function useDiasConectados(fechas: string[], { equipos = true, entreno = true }: { equipos?: boolean; entreno?: boolean } = {}) {
  const lista = useMemo(() => [...new Set(fechas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)))].sort().join(","), [fechas]);

  const [almacen, setAlmacen] = useState<AlmacenEquipos | null>(null);
  const [porFecha, setPorFecha] = useState<{ clave: string; dias: Record<string, EntrenoDelDia> } | null>(null);

  useEffect(() => {
    if (!equipos) return;

    let cancelado = false;

    leeDoc<AlmacenEquipos>("jugadores-sesion")
      .then((a) => {
        if (!cancelado) setAlmacen(a ?? { sesiones: [] });
      })
      .catch(() => {
        if (!cancelado) setAlmacen({ sesiones: [] });
      });

    return () => {
      cancelado = true;
    };
  }, [equipos]);

  useEffect(() => {
    if (!entreno || !lista) return;

    let cancelado = false;

    Promise.all(
      lista.split(",").map(async (fecha) => {
        const [sesion, analisis] = await Promise.all([leeDoc<unknown>(claveSesion(fecha)).catch(() => null), leeDoc<AnalisisEntreno>(claveAnalisis(fecha)).catch(() => null)]);

        return [fecha, { sesion: sesion ? normalizaSesion(sesion) : null, analisis }] as const;
      }),
    ).then((pares) => {
      if (!cancelado) setPorFecha({ clave: lista, dias: Object.fromEntries(pares) });
    });

    return () => {
      cancelado = true;
    };
  }, [entreno, lista]);

  return {
    /** El almacén de Jugadores sesión (null mientras llega). */
    almacen,
    /** Objetivos y análisis por fecha; vacío mientras llega o si las fechas han cambiado. */
    entrenos: porFecha?.clave === lista ? porFecha.dias : {},
    cargandoEntrenos: entreno && Boolean(lista) && porFecha?.clave !== lista,
  };
}
