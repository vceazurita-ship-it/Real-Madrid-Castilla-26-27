"use client";

import { useEffect, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import type { AspectoDestacado } from "@/lib/rivals/destacados-rival";
import type { PerfilesDeEquipo } from "@/lib/rivals/perfil-wyscout";

/*
| La plantilla rival en Wyscout (21/10/2026): cada jugador contra su puesto en
| la categoría y lo que hace distinto al equipo. Lo calcula el servidor
| (`/api/data-analisis?perfiles=`) y aquí sólo se lee, con la copia del aparato
| de `traeJson`: abrir otra vez el mismo rival no vuelve a esperar.
|
| Nunca lanza. Sin descarga de Wyscout para ese rival, `datos` se queda en
| `null` y la pantalla no pinta nada de esto.
*/

export type PerfilesRival = PerfilesDeEquipo & {
  temporada: string;
  equipos: number;
  aspectos: AspectoDestacado[];
  /** Cuántos partidos suyos tiene Wyscout: la base de las cifras «por partido». Falta en respuestas viejas de la copia. */
  partidos?: number;
  /** Su sistema principal partido a partido en Wyscout, de más a menos usado. Falta en respuestas viejas. */
  sistemas?: { partidos: number; lista: { sistema: string; veces: number }[] };
};

/** Lo que se espera a Wyscout antes de pintar con lo que haya (la copia del aparato suele contestar al momento). */
const PLAZO_PERFILES_MS = 10_000;

export function useRivalPerfiles(equipo: string) {
  return useRivalPerfilesEstado(equipo).datos;
}

/**
 * Lo mismo con «ya ha contestado» (28/11/2026, Plantillas rivales): sin esto,
 * «aún no ha llegado» y «no hay Wyscout de este rival» se leían igual y la
 * pantalla pintaba una cosa antes y otra después (el dibujo con base
 * BeSoccer y luego Wyscout; «El once de un vistazo» vacío).
 */
export function useRivalPerfilesEstado(equipo: string): { datos: PerfilesRival | null; listo: boolean } {
  const [estado, setEstado] = useState<{ equipo: string; datos: PerfilesRival | null }>({
    equipo: "",
    datos: null,
  });
  /* El equipo cuya espera ya pasó del plazo: la pantalla deja de esperar y pinta con lo que tiene (si llega luego, se pone al día). */
  const [sinEsperarA, setSinEsperarA] = useState("");

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;
    const plazo = window.setTimeout(() => {
      if (!cancelado) setSinEsperarA(equipo);
    }, PLAZO_PERFILES_MS);

    traeJson<{ ok?: boolean } & Partial<PerfilesRival>>(
      `/api/data-analisis?perfiles=${encodeURIComponent(equipo)}&v=4`,
    )
      .then((r) => {
        if (cancelado) return;

        const vale = r?.ok && Array.isArray(r.perfiles);

        setEstado({ equipo, datos: vale ? (r as PerfilesRival) : null });
      })
      .catch((error) => {
        console.error("[rivals] perfiles de Wyscout", error);

        if (!cancelado) setEstado({ equipo, datos: null });
      });

    return () => {
      cancelado = true;
      window.clearTimeout(plazo);
    };
  }, [equipo]);

  /* Lo de otro equipo no se enseña mientras llega lo de éste. */
  const listo = !equipo || estado.equipo === equipo || sinEsperarA === equipo;

  return { datos: estado.equipo === equipo ? estado.datos : null, listo };
}

export default useRivalPerfiles;
