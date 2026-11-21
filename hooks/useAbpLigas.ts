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
import { proximoPartido } from "@/lib/castilla/calendario";
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
      /* 21/11/2026: la regla de la portada (`proximoPartido`: hora de Madrid y 2,5 h de
         gracia), no «el primero con fecha de hoy en adelante», que tras el partido de
         esta tarde seguía nombrando al rival ya jugado hasta medianoche. */
      const sig = proximoPartido(partidos, Date.now());

      if (vivo && sig) setProximo(sig.rival);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return proximo;
}
