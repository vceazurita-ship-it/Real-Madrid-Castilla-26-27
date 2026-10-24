"use client";

/**
 * EL CALENDARIO DEL CASTILLA, UNA SOLA VEZ.
 *
 * El documento `castilla:calendario` (BeSoccer en Supabase) lo pedían por su
 * cuenta una decena de pantallas y componentes —la portada, el sello de la
 * jornada, el microciclo, los duelos, el informe del partido…— cada uno con
 * su `fetch` y `cache: "no-store"`, así que abrir la portada lo bajaba dos o
 * tres veces y cada pantalla volvía a esperar. Desde el 11/10/2026 pasa por
 * `traeJson`: una descarga por pestaña, copia en el aparato y renovación por
 * detrás. Lo que cambia por la noche (el cron de BeSoccer) llega a la vuelta.
 */

import { useEffect, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import { CLAVE_CALENDARIO, type PartidoCastilla } from "@/lib/castilla/calendario";

type RespuestaDoc = { data?: { partidos?: PartidoCastilla[] } };

export const URL_CALENDARIO = `/api/docs?key=${encodeURIComponent(CLAVE_CALENDARIO)}`;

/** Los partidos del calendario, o `[]` si el documento no está o falla. */
export async function cargaCalendario(opciones: { forzar?: boolean } = {}): Promise<PartidoCastilla[]> {
  try {
    const r = await traeJson<RespuestaDoc>(URL_CALENDARIO, opciones);

    return Array.isArray(r?.data?.partidos) ? r.data.partidos : [];
  } catch {
    return [];
  }
}

/**
 * El calendario en un componente: `partidos` (vacío mientras llega o si
 * falla) y `cargando`. Con la copia del aparato suele estar al primer
 * render útil.
 */
export function useCalendario() {
  const [partidos, setPartidos] = useState<PartidoCastilla[]>([]);
  const [cargando, setCargando] = useState(true);
  /* No llegó a tiempo: la pantalla puede ofrecer «Reintentar» en vez de
     quedarse en el esqueleto para siempre. */
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;

    const reloj = setTimeout(() => {
      if (!vivo) return;

      setFallo(true);
      setCargando(false);
    }, 12_000);

    void cargaCalendario({ forzar: intento > 0 }).then((lista) => {
      clearTimeout(reloj);

      if (!vivo) return;

      setPartidos(lista);
      setFallo(false);
      setCargando(false);
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [intento]);

  const reintentar = () => {
    setFallo(false);
    setCargando(true);
    setIntento((n) => n + 1);
  };

  return { partidos, cargando, fallo, reintentar };
}
