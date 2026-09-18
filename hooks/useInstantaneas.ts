"use client";

/**
 * LAS FOTOS SEMANALES DE WYSCOUT.
 *
 * Se leen por `/api/docs`, que es la puerta de sólo lectura de los documentos:
 * escribirlas es cosa del script semanal (`scripts/wyscout-instantanea.cjs`),
 * no de la pantalla.
 *
 * La forma del efecto —el `fetch` dentro, con `cancelado`— es la que acepta el
 * linter de pureza de React.
 */

import { useEffect, useState } from "react";

import {
  CLAVE_INSTANTANEAS,
  HISTORIAL_VACIO,
  type HistorialInstantaneas,
} from "@/lib/data-analisis/instantaneas";

export function useInstantaneas() {
  const [historial, setHistorial] = useState<HistorialInstantaneas>(HISTORIAL_VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(CLAVE_INSTANTANEAS)}`, {
      cache: "no-store",
    })
      .then((r) => r.json() as Promise<{ success?: boolean; data?: HistorialInstantaneas | null }>)
      .then((datos) => {
        if (cancelado) return;

        setHistorial(
          datos.data && Array.isArray(datos.data.fotos) ? datos.data : HISTORIAL_VACIO,
        );
        setCargando(false);
      })
      .catch((error) => {
        if (cancelado) return;

        /* Sin fotos la pantalla sigue: es un añadido, no un requisito. */
        console.error("[instantaneas] no se han podido leer", error);
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return { historial, cargando };
}
