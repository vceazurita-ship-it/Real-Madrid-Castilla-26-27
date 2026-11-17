"use client";

/*
| ¿TIENE ESTE PARTIDO ROBOS, PÉRDIDAS O FALTAS ETIQUETADOS? (16/11/2026,
| expertos, ronda 18)
|
| Para enlazar a los laboratorios sólo cuando ese partido ya está etiquetado
| en cada uno (lo que no existe no se ofrece). Los datos pesan cientos de KB:
| se cargan aparte, al montar, con la forma de efecto que pasa el linter
| (fetch dentro del efecto y bandera de cancelado). El partido se casa como en
| los laboratorios, por fecha a 4 días como mucho y palabra del rival
| (`partidoEnlazado`). Mientras carga, `null`.
*/

import { useEffect, useMemo, useState } from "react";

import { partidoEnlazado } from "@/lib/partido-enlazado";

type ConFecha = { id: string; fecha: string; rival: string };
type Lado = "robos" | "perdidas" | "faltas";
export type Etiquetado = Record<Lado, (p: { fecha: string; rival: string }) => boolean>;

export function useEtiquetadoEnVideo(): Etiquetado | null {
  const [listas, setListas] = useState<Record<Lado, ConFecha[]> | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([import("@/lib/transiciones/datos"), import("@/lib/faltas/datos")])
      .then(([t, f]) => {
        if (cancelado) return;
        const corta = (p: ConFecha) => ({ id: p.id, fecha: p.fecha, rival: p.rival });
        setListas({
          robos: t.PARTIDOS.filter((p) => p.robos.length > 0).map(corta),
          perdidas: t.PARTIDOS.filter((p) => (p.perdidas ?? []).length > 0).map(corta),
          faltas: f.PARTIDOS.filter((p) => p.faltas.length > 0).map(corta),
        });
      })
      .catch(() => {
        /* sin los datos, no se ofrece ningún enlace */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return useMemo(() => {
    if (!listas) return null;
    const tiene = (l: ConFecha[]) => (p: { fecha: string; rival: string }) => Boolean(p.fecha) && partidoEnlazado(l, p.fecha, p.rival) !== null;
    return { robos: tiene(listas.robos), perdidas: tiene(listas.perdidas), faltas: tiene(listas.faltas) };
  }, [listas]);
}
