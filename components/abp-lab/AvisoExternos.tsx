"use client";

/**
 * AVISO DE ANÁLISIS EXTERNOS NUEVOS (23/11/2026). Petición del analista: «que
 * haya una alerta para mi usuario cuando haya algo nuevo a ver». Montado en
 * toda la app, sólo para el administrador (el dueño del laboratorio): al
 * entrar y cada 15 min con la pestaña a la vista mira
 * /api/abp-lab/externos?resumen=1 y, si hay algo sin ver, avisa una vez por
 * novedad (`clave` = el último que llegó) con «Ver» a la sección. Al abrir la
 * sección se apunta como visto y deja de avisar.
 */

import { useEffect } from "react";

import { useAdmin } from "@/hooks/useAdmin";
import { avisaHecho } from "@/lib/aviso-hecho";

export function AvisoExternos() {
  const { admin } = useAdmin();

  useEffect(() => {
    if (!admin) return;

    let parado = false;
    let reloj: number | undefined;

    const mira = async () => {
      window.clearTimeout(reloj);
      if (parado) return;

      if (document.visibilityState === "visible" && !/\/laboratorio\/abp/.test(window.location.pathname + window.location.search) ) {
        try {
          const r = await fetch("/api/abp-lab/externos?resumen=1", { cache: "no-store" });
          const j = (await r.json()) as { ok?: boolean; nuevos?: number; ultimo?: { id: string; titulo: string; cuenta: string } | null };

          if (j.ok && j.nuevos && j.ultimo) {
            avisaHecho({
              titulo: j.nuevos === 1 ? "ABP · un análisis externo nuevo" : `ABP · ${j.nuevos} análisis externos nuevos`,
              texto: `${j.ultimo.titulo} (@${j.ultimo.cuenta})${j.nuevos > 1 ? ` y ${j.nuevos - 1} más` : ""}`,
              ok: true,
              href: `/laboratorio/abp?seccion=externos#externo-${j.ultimo.id}`,
              clave: `abp-externos:${j.ultimo.id}`,
            });
          }
        } catch {}
      }

      reloj = window.setTimeout(mira, 15 * 60_000);
    };

    const alVolver = () => document.visibilityState === "visible" && void mira();

    /* Un poco después de cargar, para no competir con la pantalla. */
    reloj = window.setTimeout(mira, 5000);
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      parado = true;
      window.clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [admin]);

  return null;
}
