"use client";

/**
 * SU BALÓN PARADO, COMO AMENAZA (27/11/2026, ronda 10, jueces de fútbol).
 *
 * «Cómo nos hacen daño» del Scout colectivo no hablaba del balón parado
 * aunque el rival saque de ahí más de un tercio de sus remates. Con la misma
 * petición que ABP del rival (`/api/data-analisis?abpRival=<equipo>&v=7`,
 * misma caché de `traeJson`): si «Remates que nacen de ABP %» está entre los
 * 6 primeros de su liga, sale una tarjeta con esa cifra, su puesto y sus goles
 * a balón parado (penalti, dato; córner y falta, estimación de Wyscout). Por
 * debajo, no sale: no es su vía.
 */

import { useEffect, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";

type Fila = { nombre: string; valor: number; puesto?: number | null; de?: number | null; partidos?: number; base?: { arriba: number; abajo: number } | null };
type Goles = { partidos: number; goles: number; penalti: number; abp: number };
type Respuesta = { ok?: boolean; aspectos?: { clave?: string; filas?: Fila[] }[]; golesAbp?: { aFavor: Goles } | null };

export type AmenazaAbpDato = { dato: string; orden: string; base: string };

const coma1 = (v: number) => v.toFixed(1).replace(".", ",");

/** Tope del «es su vía»: entre los 6 primeros de su grupo (el tercio de arriba de 20). */
const PUESTO_MAXIMO = 6;

export function useAmenazaAbp(equipo: string): AmenazaAbpDato | null {
  const [estado, setEstado] = useState<{ equipo: string; dato: AmenazaAbpDato | null }>({ equipo: "", dato: null });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<Respuesta>(`/api/data-analisis?abpRival=${encodeURIComponent(equipo)}&v=7`)
      .then((r) => {
        if (cancelado) return;
        const filas = r?.ok && Array.isArray(r.aspectos) ? r.aspectos.filter((a) => a.clave === "abpOf").flatMap((a) => a.filas ?? []) : [];
        const cuota = filas.find((f) => f.nombre === "Remates que nacen de ABP %");

        if (!cuota || !Number.isFinite(cuota.valor) || !cuota.puesto || cuota.puesto > PUESTO_MAXIMO) {
          setEstado({ equipo, dato: null });
          return;
        }

        const g = r.golesAbp?.aFavor;
        const abp = g ? Math.round(g.abp) : 0;
        const goles = g && g.goles > 0 && abp > 0 ? ` y unos ${abp} de sus ${g.goles} goles (${g.penalti > 0 ? `${g.penalti} de penalti, dato; ` : ""}córner y falta, estimación)` : "";

        setEstado({
          equipo,
          dato: {
            dato: `El ${coma1(cuota.valor)} % de sus remates nace de balón parado (${cuota.puesto}.º${cuota.de ? ` de ${cuota.de}` : ""})${goles}`,
            orden: "ninguna falta tonta cerca del área y el córner defensivo trabajado en la semana: es su vía de remate",
            base: `Wyscout, temporada${cuota.base ? ` · ${Math.round(cuota.base.arriba)} de ${Math.round(cuota.base.abajo)} remates` : ""}${cuota.partidos ? ` · ${cuota.partidos} partidos` : ""}`,
          },
        });
      })
      .catch(() => {
        if (!cancelado) setEstado({ equipo, dato: null });
      });

    return () => {
      cancelado = true;
    };
  }, [equipo]);

  return estado.equipo === equipo ? estado.dato : null;
}
