"use client";

/**
 * Las mejores acciones a balón parado de cada jornada
 * (`public/data/abp-acciones.json`), para el laboratorio de ABP. Se pide una
 * vez por pestaña, como `useAbpLigas`.
 */

import { useEffect, useState } from "react";

import type { AbpAcciones } from "@/lib/abp-lab/acciones";

let enVuelo: Promise<AbpAcciones> | null = null;

const trae = () => {
  enVuelo ??= fetch("/data/abp-acciones.json", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<AbpAcciones>) : Promise.reject(new Error(String(r.status)))))
    .catch((error) => {
      enVuelo = null;

      throw error;
    });

  return enVuelo;
};

export function useAbpAcciones() {
  const [datos, setDatos] = useState<AbpAcciones | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;

    trae()
      .then((j) => vivo && setDatos(j))
      .catch(() => vivo && setFallo(true));

    return () => {
      vivo = false;
    };
  }, []);

  return { datos, fallo };
}
