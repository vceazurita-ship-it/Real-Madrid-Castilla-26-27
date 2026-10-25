"use client";

/**
 * LA PIZARRA DE ABP, SÓLO PARA LEERLA (25/10/2026).
 *
 * El laboratorio necesita saber si las rutinas que trajo de la pizarra siguen
 * allí y si alguien las ha cambiado, y poder traer otras. Para eso lee el
 * documento `abp-pizarra` por `GET /api/docs`, y nada más: **no lo escribe
 * nunca**. Quien escribe la pizarra es la pizarra (`useRemoteDoc`, con su cola
 * y su CAS); lo que el laboratorio le manda va por recado (`puente-envio.ts`).
 *
 * Los tableros salen ya puestos al día con su plantilla (`normalizaTablero`),
 * que es como los ve el entrenador.
 */

import { useCallback, useEffect, useState } from "react";

import { normalizaTablero, type PizarraStore, type TableroPizarra } from "@/lib/abp/pizarra";

export function usePizarraAbpLectura(activo = true) {
  const [tableros, setTableros] = useState<Record<string, TableroPizarra> | null>(null);

  const [error, setError] = useState(false);

  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    if (!activo) return;

    let cancelado = false;

    fetch("/api/docs?key=abp-pizarra", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ success?: boolean; data?: PizarraStore | null }>)
      .then((datos) => {
        if (cancelado) return;

        if (!datos.success) throw new Error("No se ha podido leer la pizarra.");

        const crudos = datos.data?.tableros ?? {};

        setTableros(Object.fromEntries(Object.entries(crudos).map(([id, t]) => [id, normalizaTablero(t)])));
        setError(false);
      })
      .catch((e) => {
        if (cancelado) return;

        console.error("[abp-lab] leer la pizarra", e);
        setError(true);
      });

    return () => {
      cancelado = true;
    };
  }, [activo, testigo]);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  return { tableros, error, recarga };
}
