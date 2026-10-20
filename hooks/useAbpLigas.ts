"use client";

/**
 * El balón parado de cada liga (`public/data/abp-ligas.json`) y el próximo
 * rival del calendario, para el laboratorio de ABP.
 *
 * El fichero se pide una vez por pestaña y se comparte: lo usan la pantalla
 * de Datos y el encaje con el rival del taller.
 */

import { useEffect, useState } from "react";

import { cargaCalendario } from "@/hooks/useCalendario";
import type { AbpLigas } from "@/lib/abp-ligas/modelo";

let enVuelo: Promise<AbpLigas> | null = null;

const trae = () => {
  enVuelo ??= fetch("/data/abp-ligas.json", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<AbpLigas>) : Promise.reject(new Error(String(r.status)))))
    .catch((error) => {
      /* Que el siguiente intento vuelva a pedirlo. */
      enVuelo = null;

      throw error;
    });

  return enVuelo;
};

export function useAbpLigas() {
  const [datos, setDatos] = useState<AbpLigas | null>(null);
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

/** El rival del próximo partido del Castilla, del calendario de BeSoccer; vacío si no lo hay. */
export function useProximoRival() {
  const [proximo, setProximo] = useState("");

  useEffect(() => {
    let vivo = true;

    void cargaCalendario().then((partidos) => {
      const ahora = new Date();

      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

      const sig = partidos.filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy).sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

      if (vivo && sig) setProximo(/castilla/i.test(sig.local) ? sig.visitante : sig.local);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return proximo;
}
