"use client";

/*
| EL PORTERO DEL ONCE DE LA PIZARRA TÁCTICA (06/11/2026)
|
| Las diapositivas de ABP dibujan a los diez de campo; el portero sale del once
| de la pizarra táctica (el once de toda la app) para que tenga su PDF.
*/

import { useEffect, useState } from "react";

import { esPortero } from "@/lib/abp/pizarra-jugador";
import { idsDelOnce, onceDeLaPizarra } from "@/lib/tactics/onceDeLaPizarra";
import type { Player } from "@/types/player";

export async function porteroDelOnce(players: Map<string, Player>): Promise<string | undefined> {
  try {
    const once = await onceDeLaPizarra();
    if (!once) return undefined;
    return idsDelOnce(once, [...players.values()]).find((id) => esPortero(players.get(id)));
  } catch {
    return undefined;
  }
}

export function usePorteroDelOnce(players: Map<string, Player>): string | undefined {
  const [portero, setPortero] = useState<string | undefined>(undefined);

  useEffect(() => {
    let vivo = true;

    void porteroDelOnce(players).then((id) => {
      if (vivo) setPortero(id);
    });

    return () => {
      vivo = false;
    };
  }, [players]);

  return portero;
}
