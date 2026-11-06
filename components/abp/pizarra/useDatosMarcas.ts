"use client";

/*
| La propuesta de «Quién marca a quién» para lo exportado (06/11/2026): se
| carga al abrir la pizarra y la exportación la aplica a las diapositivas de
| marcas que el analista no ha tocado (`conMarcasPropuestas`).
*/

import { useEffect, useState } from "react";

import { cargaDatosMarcas, type DatosMarcasRival } from "@/lib/abp/marcas-datos";
import type { Player } from "@/types/player";

export function useDatosMarcas(rival: string, players: Map<string, Player>): DatosMarcasRival | null {
  const [datos, setDatos] = useState<{ clave: string; datos: DatosMarcasRival | null } | null>(null);

  useEffect(() => {
    if (!rival) return;

    let vivo = true;

    void cargaDatosMarcas(rival, [...players.values()])
      .catch(() => null)
      .then((d) => {
        if (vivo) setDatos({ clave: rival, datos: d });
      });

    return () => {
      vivo = false;
    };
  }, [rival, players]);

  return datos && datos.clave === rival ? datos.datos : null;
}
