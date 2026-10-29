"use client";

/**
 * AVISO AL TERMINAR LOS ENCARGOS DEL ORDENADOR DEL CLUB (29/10/2026).
 *
 * Los botones de Ajustes (quiniela, BeSoccer, Wyscout, carpeta, análisis del
 * partido y del entrenamiento) los hace el vigía y pueden tardar horas. Antes
 * había que volver a Ajustes a mirar; ahora este vigilante, montado en toda la
 * app para el administrador, mira el documento de encargos y, cuando uno pasa
 * de en marcha a hecho, avisa estés donde estés (`avisaHecho`).
 *
 * Mira cada 20 s mientras hay algo pedido o en marcha y cada 2 min si no, y
 * sólo con la pestaña a la vista (al volver a ella mira en el acto).
 */

import { useEffect, useRef } from "react";

import { useAdmin } from "@/hooks/useAdmin";
import { avisaHecho, pidePermisoAvisos } from "@/lib/aviso-hecho";
import { TAREAS, estadoEncargo, type Mantenimiento, type Tarea } from "@/lib/mantenimiento";

const NOMBRE: Record<Tarea, string> = {
  quiniela: "Resultados de la quiniela",
  rivales: "Jornada de BeSoccer",
  wyscout: "Datos de Wyscout",
  carpeta: "Carpeta de análisis del rival",
  partido: "Análisis del partido",
  entreno: "Análisis de entrenamiento",
};

export function AvisoEncargos() {
  const { admin } = useAdmin();

  /* Lo que estaba pedido o en marcha la última vez que se miró. */
  const activos = useRef<Set<Tarea>>(new Set());

  const visto = useRef(false);

  useEffect(() => {
    if (!admin) return;

    let parado = false;
    let reloj: number | undefined;

    const mira = async () => {
      window.clearTimeout(reloj);

      if (parado) return;

      let hayActivos = activos.current.size > 0;

      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/mantenimiento", { cache: "no-store" });
          const leido = (await r.json()) as { ok?: boolean; estado?: Mantenimiento };

          if (leido.ok && leido.estado) {
            const ahora = new Set<Tarea>();

            for (const tarea of TAREAS) {
              const encargo = leido.estado[tarea];
              const estado = estadoEncargo(tarea, encargo);

              if (estado === "pedido" || estado === "en-marcha") ahora.add(tarea);
              else if (visto.current && activos.current.has(tarea) && encargo?.hechoEn) {
                avisaHecho({
                  titulo: encargo.ok === false ? `${NOMBRE[tarea]}: no ha salido` : `${NOMBRE[tarea]}: hecho`,
                  texto: encargo.resultado?.replace(/^RESUMEN:\s*/i, "").slice(0, 160),
                  ok: encargo.ok !== false,
                  href: "/ajustes",
                  clave: `${tarea}:${encargo.hechoEn}`,
                });
              }
            }

            /* Algo recién lanzado: es el momento de pedir el aviso del sistema. */
            if (ahora.size > activos.current.size) pidePermisoAvisos();

            activos.current = ahora;
            visto.current = true;
            hayActivos = ahora.size > 0;
          }
        } catch {}
      }

      reloj = window.setTimeout(mira, hayActivos ? 20_000 : 120_000);
    };

    const alVolver = () => document.visibilityState === "visible" && void mira();

    void mira();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      parado = true;
      window.clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [admin]);

  return null;
}
