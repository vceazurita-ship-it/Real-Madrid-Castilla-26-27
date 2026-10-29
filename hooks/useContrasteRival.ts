"use client";

import { useEffect, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { leePosicionesDeLaTemporada } from "@/lib/rivals/posiciones-temporada";

/*
|--------------------------------------------------------------------------
| CONTRASTE DEL PLAN CON LOS DATOS (24/10/2026)
|--------------------------------------------------------------------------
|
| Lo que escribe el analista en «Análisis del rival» (estructuras, «ABP
| excelente sacador») puede no coincidir con lo que miden BeSoccer (el dibujo
| que más repite, el mismo cálculo que la franja «Cómo llega» de /rivals) y
| Wyscout (la fila «Remates que nacen de ABP» de ABP del Rival). Esta línea se
| lo pone delante al analista; no sale en el PDF ni en el PPT.
|
| Nunca lanza: lo que no llega, no se nombra.
*/

export type ContrasteRival = {
  dibujo: { estructura: string; veces: number; de: number } | null;
  abp: { valor: number; arriba: number | null; abajo: number | null; equipos: number; percentil: number } | null;
};

type FilaAbp = {
  nombre: string;
  valor: number;
  percentil: number;
  base?: { arriba: number; abajo: number } | null;
};

async function leeInforme(): Promise<InformeDoc | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent("rivals:informe")}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: InformeDoc | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

export function useContrasteRival(equipo: string) {
  const [estado, setEstado] = useState<{ equipo: string; datos: ContrasteRival | null }>({ equipo: "", datos: null });

  useEffect(() => {
    if (!equipo) return;

    let vivo = true;

    (async () => {
      try {
        const [doc, wy] = await Promise.all([
          leeInforme(),
          traeJson<{ ok?: boolean; equipos?: number; aspectos?: { filas: FilaAbp[] }[] }>(
            `/api/data-analisis?abpRival=${encodeURIComponent(equipo)}&v=4`,
          ).catch(() => null),
        ]);

        const informe = findInforme(doc, equipo);
        /*
        | La MISMA cuenta que el campograma de /rivals (29/10/2026): antes se
        | sumaban `estructuras` («5 de las 8 alineaciones con dibujo») y /rivals
        | decía «5 de sus 9 alineaciones», porque allí se cuentan las
        | alineaciones de la temporada (`leePosicionesDeLaTemporada`). El
        | dibujo y las veces no dependen de la plantilla: basta con una ficha
        | de relleno para que la función no salga en vacío.
        */
        const temporada = leePosicionesDeLaTemporada(informe, [{ clave: "", dorsal: "", nombre: "", slot: "" }]);
        const dibujo =
          temporada.estructura && temporada.alineaciones > 0
            ? { estructura: temporada.estructura, veces: temporada.veces, de: temporada.alineaciones }
            : null;

        const fila = wy?.ok ? wy.aspectos?.flatMap((a) => a.filas).find((f) => f.nombre === "Remates que nacen de ABP %") : undefined;
        const abp =
          fila && wy?.equipos
            ? {
                valor: fila.valor,
                arriba: fila.base?.arriba ?? null,
                abajo: fila.base?.abajo ?? null,
                equipos: wy.equipos,
                percentil: fila.percentil,
              }
            : null;

        if (vivo) setEstado({ equipo, datos: dibujo || abp ? { dibujo, abp } : null });
      } catch (error) {
        console.error("[plan] contraste con los datos", error);

        if (vivo) setEstado({ equipo, datos: null });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [equipo]);

  return estado.equipo === equipo ? estado.datos : null;
}

export default useContrasteRival;
