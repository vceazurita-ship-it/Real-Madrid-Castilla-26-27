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
};

export function useRivalPerfiles(equipo: string) {
  const [estado, setEstado] = useState<{ equipo: string; datos: PerfilesRival | null }>({
    equipo: "",
    datos: null,
  });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<{ ok?: boolean } & Partial<PerfilesRival>>(
      `/api/data-analisis?perfiles=${encodeURIComponent(equipo)}`,
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
    };
  }, [equipo]);

  /* Lo de otro equipo no se enseña mientras llega lo de éste. */
  return estado.equipo === equipo ? estado.datos : null;
}

export default useRivalPerfiles;
