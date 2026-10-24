"use client";

import { useEffect, useState } from "react";

import { cargaPlantilla } from "@/hooks/usePlayers";
import { traeJson } from "@/lib/hojaCsv";
import { UMBRAL_DUELO, normalizaDuelos } from "@/lib/duelos";
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
  /** Minutos del jugador con menos minutos del cruce: la base del percentil. 0 si no consta. */
  minutos: number;
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

        const aDuelo = (d: (typeof duelos)[number], valor: number): DueloClave => ({
          clave: d.def.clave,
          titulo: d.def.titulo,
          nuestros: d.nuestros.map(rotulo),
          suyos: d.suyos.map(rotulo),
          valor,
          minutos: (() => {
            const todosMin = [...d.nuestros, ...d.suyos].map((j) => j.minutos).filter((m) => m > 0 && m < 1e5);

            return todosMin.length ? Math.round(Math.min(...todosMin)) : 0;
          })(),
        });

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

        if (vivo) {
          setEstado({
            equipo,
            datos: ventaja.length || riesgo.length ? { ventaja, riesgo, conVentajaNuestra, conVentajaSuya, medidos, enLosDos } : null,
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
