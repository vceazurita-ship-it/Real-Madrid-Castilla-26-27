"use client";

/**
 * LA PIZARRA DEL LABORATORIO FUERA DE PANTALLA (08/11/2026).
 *
 * Para exportar en segundo plano (`lib/trabajos/descargas.ts`): el anfitrión
 * de las descargas pinta esta mesa con la foto de la rutina tomada al pulsar
 * —la misma `EscenaViva`, con su propio reloj— y el rodaje mueve ESTE reloj,
 * no el de la pizarra que se ve. Así la pizarra sigue libre mientras se monta
 * el vídeo o el GIF y la exportación sigue aunque se cambie de pantalla.
 *
 * La tarea encuentra su rodaje con `rodajeDeMesa(clave)`: la mesa lo apunta al
 * montarse y lo borra al desmontarse.
 */

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";

import { EscenaViva } from "@/components/abp-lab/EscenaViva";
import type { Rodaje, Rotulo } from "@/lib/abp-lab/exporta";

type PropsEscena = Omit<ComponentProps<typeof EscenaViva>, "id" | "reloj" | "svgRef" | "sinTransicion" | "manejadores" | "seleccionado" | "editaBalon" | "cursor">;

const rodajes = new Map<string, Rodaje>();

let siguiente = 0;

/** Una clave nueva para cada encargo (y para los `id` del SVG de la mesa). */
export const claveMesa = () => `mesarod${(siguiente += 1)}`;

/** El rodaje de la mesa ya montada (null si todavía no está o ya se fue). */
export const rodajeDeMesa = (clave: string) => rodajes.get(clave) ?? null;

/** Un reloj mínimo (el `t` de la jugada como almacén), sin reproducción. */
function creaReloj(inicial: number) {
  let t = inicial;

  const oyentes = new Set<() => void>();

  return {
    ahora: () => t,
    pon: (v: number) => {
      if (v === t) return;

      t = v;
      oyentes.forEach((f) => f());
    },
    suscribe: (f: () => void) => {
      oyentes.add(f);

      return () => {
        oyentes.delete(f);
      };
    },
  };
}

export function MesaRodaje({
  clave,
  inicial = 0,
  rotulo,
  familia,
  ...escena
}: PropsEscena & {
  clave: string;
  inicial?: number;
  rotulo: (t: number) => Rotulo;
  familia: string;
}) {
  const [reloj] = useState(() => creaReloj(inicial));

  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    rodajes.set(clave, {
      pon: (v) => flushSync(() => reloj.pon(v)),
      svg: () => svg.current,
      rotulo,
      familia,
    });

    return () => {
      rodajes.delete(clave);
    };
  }, [clave, reloj, rotulo, familia]);

  return <EscenaViva id={clave} reloj={reloj} svgRef={svg} sinTransicion {...escena} />;
}
