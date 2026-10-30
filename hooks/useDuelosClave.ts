"use client";

import { useEffect, useState } from "react";

import { cargaPlantilla } from "@/hooks/usePlayers";
import { traeJson } from "@/lib/hojaCsv";
import { MUESTRA_CORTA_DUELO, UMBRAL_DUELO, normalizaDuelos, referenciasPorPuesto } from "@/lib/duelos";
import { MINUTOS_MINIMOS, puestoDe } from "@/lib/data-analisis/individual";
import { duelosDelPartido } from "@/lib/duelos-onces";
import { huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { slugClave } from "@/lib/rivals/media";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, rivalOnceKey } from "@/lib/rivals/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import type { RatingsSeason } from "@/lib/ratings/types";
import { puestoEnPalabras } from "@/lib/posiciones";

/*
|--------------------------------------------------------------------------
| LOS DUELOS CLAVE DEL PARTIDO (23/10/2026)
|--------------------------------------------------------------------------
|
| Los dos duelos de más ventaja y los dos de más riesgo que calcula /duelos,
| con jugador y cifra, para el Plan de partido. Es la misma cuenta que la
| pantalla de Duelos y el informe del partido (`duelosDelPartido`), con el
| mismo punto de partida para nuestro once (el último de Valoraciones), así
| que no pueden discrepar.
|
| Nunca lanza: si falta Wyscout, la plantilla del rival o lo que sea, devuelve
| `null` y el plan no pinta nada de esto.
*/

export type DueloClave = {
  clave: string;
  titulo: string;
  nuestros: string[];
  suyos: string[];
  valor: number;
  /**
   * Los minutos que pide la referencia del percentil (los de su puesto en la
   * categoría con al menos esos minutos, `referenciasPorPuesto`). 0 si nadie del
   * cruce tiene fila de Wyscout. Antes eran los minutos del que menos tenía del
   * cruce, que no es contra lo que se mide (29/10/2026).
   */
  minutos: number;
  /** Cuántos jugadores tiene esa referencia: uno si todos los del cruce comparten puesto, el menor y el mayor si no. Vacío si no consta. */
  muestra: number[];
  /** «Base: 709′ los nuestros · 578′ los suyos», como en /duelos. Vacío si ninguno tiene minutos de Wyscout. */
  base: string;
  /** Las dos cifras del cruce (30/10/2026): con nuestro balón y con el suyo. */
  conBalon: number | null;
  sinBalon: number | null;
};

export type DuelosClave = {
  ventaja: DueloClave[];
  riesgo: DueloClave[];
  /** Cuántos duelos, de todos los medidos, caen de cada lado (con balón nuestro / con balón suyo). */
  conVentajaNuestra: number;
  conVentajaSuya: number;
  /** Duelos con dato en los dos lados: sobre ellos se cuentan los dos números de arriba. */
  medidos: number;
  /** Cuántos de ellos salen en los dos lados (ventaja con nuestro balón y riesgo con el suyo). */
  enLosDos: number;
  /*
  | Los medidos, repartidos sin pisarse (30/10/2026): un duelo que ganamos con
  | balón y perdemos sin él va UNA vez, en «doble cara», y no en «Para buscar»
  | y otra vez en «Para vigilar». Los parejos también, para pintarlos plegados.
  */
  grupos: {
    buscar: DueloClave[];
    doble: DueloClave[];
    vigilar: DueloClave[];
    parejos: DueloClave[];
  };
};

type Fila = Record<string, unknown>;

async function leeDoc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: T | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

export function useDuelosClave(equipo: string) {
  const [estado, setEstado] = useState<{ equipo: string; datos: DuelosClave | null }>({ equipo: "", datos: null });

  useEffect(() => {
    if (!equipo) return;

    let vivo = true;

    (async () => {
      try {
        const [wy, filas, fichas, informes, ratings] = await Promise.all([
          traeJson<{ ok?: boolean; jugadores?: FilaJugador[] }>("/api/data-analisis"),
          traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas"),
          cargaPlantilla(),
          leeDoc<InformeDoc>("rivals:informe"),
          traeJson<{ success?: boolean; season?: RatingsSeason }>("/api/ratings/load").catch(() => null),
        ]);

        const hoja = Array.isArray(filas) ? filas : [];
        const jugadores = wy?.jugadores ?? [];

        const equipoHoja = String(hoja.find((f) => mismoClub(String(f.NOMBRE_EQUIPO ?? ""), equipo))?.NOMBRE_EQUIPO ?? "").trim();

        if (!equipoHoja || jugadores.length === 0) {
          if (vivo) setEstado({ equipo, datos: null });

          return;
        }

        const [onceDoc, manual] = await Promise.all([
          leeDoc<unknown>(rivalOnceKey(equipoHoja)),
          leeDoc<unknown>(`duelos:${slugClave(equipoHoja)}`),
        ]);

        const reparto = ratings?.success && ratings.season ? huecosDelUltimoOnce(ratings.season, fichas) : null;

        const { duelos } = duelosDelPartido({
          jugadores,
          fichas: fichas.map((f) => ({ id: f.id, nombre: f.nombre, apodo: f.apodo, foto: f.foto, posicion: f.posicion })),
          filasHoja: hoja,
          equipo: equipoHoja,
          marcados: normalizarOnce(onceDoc).titulares,
          informe: findInforme(informes, equipoHoja),
          aMano: normalizaDuelos(manual),
          baseNuestra: reparto?.ultimo ? Object.fromEntries(Object.entries(reparto.huecos).filter(([, id]) => id)) : null,
        });

        /* Si dos jugadores distintos comparten apellido (Sergio y Joan Martínez, o un
           «Martínez» a secas), se les pone el puesto: la línea no puede ser ambigua. */
        const todos = duelos.flatMap((d) => [...d.nuestros, ...d.suyos]);
        const apellidoDe = (nombre: string) => nombre.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";
        const porApellido = new Map<string, Set<string>>();

        todos.forEach((j) => {
          const a = apellidoDe(j.nombre);
          if (!porApellido.has(a)) porApellido.set(a, new Set());
          porApellido.get(a)!.add(j.clave);
        });

        const rotulo = (j: (typeof todos)[number]) => {
          if ((porApellido.get(apellidoDe(j.nombre))?.size ?? 0) < 2) return j.nombre;

          const puesto = puestoEnPalabras(j.posicion.split(",")[0]?.trim() ?? "") || j.dorsal || "";

          return puesto ? `${j.nombre} (${puesto})` : j.nombre;
        };

        /* La misma referencia con la que `duelosDelPartido` saca los percentiles. */
        const referencias = referenciasPorPuesto(jugadores);

        const aDuelo = (d: (typeof duelos)[number], valor: number): DueloClave => {
          const tamanos = [...d.nuestros, ...d.suyos]
            .filter((j) => j.wyscout && j.wyscout.minutos >= MINUTOS_MINIMOS)
            .map((j) => referencias.get(puestoDe(j.wyscout!.posicion))?.length ?? 0)
            .filter((n) => n > 0);
          const menor = tamanos.length ? Math.min(...tamanos) : 0;
          const mayor = tamanos.length ? Math.max(...tamanos) : 0;

          /* Los minutos de quien menos ha jugado de cada lado, sólo entre los cruzados con Wyscout (como /duelos). */
          const minLado = (l: (typeof d.nuestros)) => {
            const con = l.filter((j) => j.wyscout);

            return con.length ? Math.min(...con.map((j) => j.minutos || 0)) : 0;
          };
          const mn = minLado(d.nuestros);
          const ms = minLado(d.suyos);
          const trozos = [mn > 0 ? `${mn}′ los nuestros` : "", ms > 0 ? `${ms}′ los suyos` : ""].filter(Boolean);

          return {
            clave: d.def.clave,
            base: trozos.length
              ? `Base: ${trozos.join(" · ")}${
                  (mn > 0 && mn < MUESTRA_CORTA_DUELO) || (ms > 0 && ms < MUESTRA_CORTA_DUELO)
                    ? ` · muestra corta: menos de ${MUESTRA_CORTA_DUELO}′`
                    : ""
                }`
              : "",
            conBalon: d.conBalon ?? null,
            sinBalon: d.sinBalon ?? null,
            titulo: d.def.titulo,
            nuestros: d.nuestros.map(rotulo),
            suyos: d.suyos.map(rotulo),
            valor,
            minutos: tamanos.length ? MINUTOS_MINIMOS : 0,
            muestra: !tamanos.length ? [] : menor === mayor ? [menor] : [menor, mayor],
          };
        };

        const ventaja = duelos
          .filter((d) => (d.conBalon ?? 0) >= UMBRAL_DUELO)
          .sort((a, b) => (b.conBalon ?? 0) - (a.conBalon ?? 0))
          .slice(0, 2)
          .map((d) => aDuelo(d, d.conBalon ?? 0));

        const riesgo = duelos
          .filter((d) => (d.sinBalon ?? 0) <= -UMBRAL_DUELO)
          .sort((a, b) => (a.sinBalon ?? 0) - (b.sinBalon ?? 0))
          .slice(0, 2)
          .map((d) => aDuelo(d, d.sinBalon ?? 0));

        const conVentajaNuestra = duelos.filter((d) => (d.conBalon ?? 0) >= UMBRAL_DUELO).length;
        const conVentajaSuya = duelos.filter((d) => (d.sinBalon ?? 0) <= -UMBRAL_DUELO).length;
        const medidos = duelos.filter((d) => d.veredicto !== "sin-datos").length;
        const enLosDos = duelos.filter(
          (d) => (d.conBalon ?? 0) >= UMBRAL_DUELO && (d.sinBalon ?? 0) <= -UMBRAL_DUELO,
        ).length;

        const medidosTodos = duelos.filter((d) => d.veredicto !== "sin-datos");
        const aFavor = (d: (typeof duelos)[number]) => (d.conBalon ?? 0) >= UMBRAL_DUELO;
        const enContra = (d: (typeof duelos)[number]) => (d.sinBalon ?? 0) <= -UMBRAL_DUELO;
        const grupos = {
          buscar: medidosTodos
            .filter((d) => aFavor(d) && !enContra(d))
            .sort((a, b) => (b.conBalon ?? 0) - (a.conBalon ?? 0))
            .map((d) => aDuelo(d, d.conBalon ?? 0)),
          doble: medidosTodos
            .filter((d) => aFavor(d) && enContra(d))
            .sort((a, b) => (b.conBalon ?? 0) - (b.sinBalon ?? 0) - ((a.conBalon ?? 0) - (a.sinBalon ?? 0)))
            .map((d) => aDuelo(d, d.conBalon ?? 0)),
          vigilar: medidosTodos
            .filter((d) => enContra(d) && !aFavor(d))
            .sort((a, b) => (a.sinBalon ?? 0) - (b.sinBalon ?? 0))
            .map((d) => aDuelo(d, d.sinBalon ?? 0)),
          parejos: medidosTodos
            .filter((d) => !aFavor(d) && !enContra(d))
            .map((d) => aDuelo(d, d.conBalon ?? 0)),
        };

        if (vivo) {
          setEstado({
            equipo,
            datos: ventaja.length || riesgo.length ? { ventaja, riesgo, conVentajaNuestra, conVentajaSuya, medidos, enLosDos, grupos } : null,
          });
        }
      } catch (error) {
        console.error("[plan] duelos clave", error);

        if (vivo) setEstado({ equipo, datos: null });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [equipo]);

  /* Lo de otro rival no se enseña mientras llega lo de éste. */
  return estado.equipo === equipo ? estado.datos : null;
}

export default useDuelosClave;
