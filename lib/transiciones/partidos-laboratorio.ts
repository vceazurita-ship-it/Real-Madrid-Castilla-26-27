"use client";

/*
| LOS PARTIDOS DE LOS LABORATORIOS DE ROBOS Y PÉRDIDAS (17/11/2026, ronda 21).
|
| Lo etiquetado en Hudl manda y, lo que aún no lo está, sale del evento a
| evento de Opta (respaldo). Vivía dentro de `PantallaTransiciones`; ahora es
| compartido para que «Post del partido» de Análisis de datos diga la MISMA
| cifra, con el mismo nombre, que /laboratorio/transiciones y
| /laboratorio/perdidas («40 robos», «21 pérdidas en campo propio»), y no la
| recuperación agregada de Opta, que cuenta otra cosa.
*/

import { useMemo } from "react";

import { PARTIDOS as PARTIDOS_ETIQUETADOS, type Robo } from "@/lib/transiciones/datos";
import { useRespaldoOpta } from "@/lib/opta-respaldo/cliente";
import { fechaEtiquetada } from "@/lib/opta-respaldo/etiquetado";
import type { PartidoTransicionesOpta } from "@/lib/opta-respaldo/tipos";
import { mismoClub } from "@/lib/rivals/mismoClub";

export type ModoLaboratorio = "robos" | "perdidas";

/** La zona del campo de un robo o una pérdida, como la cuentan los laboratorios. */
export function zonaDeRobo(r: Pick<Robo, "zona">): "campo rival" | "medio campo" | "campo propio" {
  if (r.zona.includes("rival")) return "campo rival";
  if (r.zona.includes("medio")) return "medio campo";
  return "campo propio";
}

export function usePartidosLaboratorio(modo: ModoLaboratorio) {
  const fechasEtiquetadas = useMemo(
    () => PARTIDOS_ETIQUETADOS.filter((p) => (modo === "robos" ? p.robos : p.perdidas ?? []).length > 0).map((p) => p.fecha),
    [modo],
  );
  const respaldo = useRespaldoOpta<PartidoTransicionesOpta>("transiciones", fechasEtiquetadas);
  const partidos = useMemo(() => {
    /* 17/11/2026 (ronda 20): la J4 salía dos veces («Sant Andreu» de Opta y
       «UE Sant Andreu» etiquetado, con la fecha de Hudl dos días después):
       además de la fecha, un partido de Opta con la misma jornada y el mismo
       club que uno ya etiquetado no entra. */
    const conFilas = PARTIDOS_ETIQUETADOS.filter((p) => (modo === "robos" ? p.robos : p.perdidas ?? []).length > 0);
    const opta = respaldo.filas.filter(
      (o) => !fechaEtiquetada(o.fecha, fechasEtiquetadas) && !conFilas.some((p) => p.jornada === o.jornada && mismoClub(p.rival, o.rival)),
    );
    const usados = new Set<string>();
    /* J2 y J3 (mirados a ojo) no tienen pérdidas: en ese modo se rellenan con las de Opta sin tocar el resto del partido. */
    const propios = PARTIDOS_ETIQUETADOS.map((p) => {
      const o = opta.find((x) => fechaEtiquetada(x.fecha, [p.fecha]));
      if (!o) return p;
      usados.add(o.id);
      return modo === "robos" ? { ...p, robos: o.robos } : { ...p, perdidas: o.perdidas };
    });
    return [...propios, ...opta.filter((o) => !usados.has(o.id))];
  }, [respaldo.filas, fechasEtiquetadas, modo]);
  return { partidos, listo: respaldo.listo };
}
