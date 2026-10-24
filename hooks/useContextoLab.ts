"use client";

/**
 * LO QUE LA PIZARRA DEL LABORATORIO SABE DE FUERA (24/10/2026).
 *
 * Sólo lee; no escribe en ningún sitio:
 * - **Alturas y juego aéreo de los nuestros**: Wyscout (`/api/data-analisis`),
 *   cruzado con la plantilla por nombre como en Duelos (`nuestrosDe`).
 * - **Calibración del xG**: las dos hojas de córners y faltas del Castilla
 *   (`Zona_Remate`, `Resultado_Final`, `xG`).
 * - **El próximo rival**: cómo defiende el córner y la falta lateral según su
 *   scouting de ABP (`abp-rival-scout`, el mismo que usa «Poner su defensa» de
 *   la pizarra de ABP) y sus jugadores más altos (hoja de plantillas).
 *
 * Cada fuente falla por separado: sin una, lo suyo no se pinta y el resto sí.
 */

import { useEffect, useMemo, useState } from "react";

import { useProximoRival } from "@/hooks/useAbpLigas";
import { usePlayers } from "@/hooks/usePlayers";
import { estructuraDefensiva, susCabeceadores, type EstructuraDefensa } from "@/lib/abp/defensa-rival";
import { teamKey } from "@/lib/abp/model";
import { buildAerialThreats, type RivalPlayerAerial } from "@/lib/abp/rival";
import { SCOUT_DOC_KEY, actionsOf, type RivalScoutStore } from "@/lib/abp/rivalScout";
import { ABP_GIDS, loadSheet } from "@/lib/abp/sheets";
import { calibraXg, type CalibreXg } from "@/lib/abp-lab/xg";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { nuestrosDe } from "@/lib/duelos-onces";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";

export type PerfilAereo = {
  altura: number | null;
  /** % de duelos aéreos ganados (Wyscout). */
  aereoPct: number | null;
  /** Duelos aéreos por 90 minutos (Wyscout). */
  aereos90: number | null;
};

export type ProximoRival = {
  equipo: string;
  corner: EstructuraDefensa | null;
  falta: EstructuraDefensa | null;
  /** Sus mejores por alto (los etiquetados y los de 1,86 o más), con altura. */
  cabeceadores: RivalPlayerAerial[];
  /** Toda la plantilla con altura, de más alto a más bajo. */
  plantilla: RivalPlayerAerial[];
};

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

export function useContextoLab() {
  const { players } = usePlayers();

  const proximo = useProximoRival();

  const [wyscout, setWyscout] = useState<FilaJugador[] | null>(null);

  const [calibre, setCalibre] = useState<CalibreXg | null>(null);

  const [scout, setScout] = useState<RivalScoutStore | null>(null);

  const [plantillas, setPlantillas] = useState<unknown[] | null>(null);

  useEffect(() => {
    let vivo = true;

    traeJson<{ ok?: boolean; jugadores?: FilaJugador[] }>("/api/data-analisis")
      .then((r) => vivo && setWyscout(r.jugadores ?? []))
      .catch(() => vivo && setWyscout([]));

    Promise.all([loadSheet(ABP_GIDS.piezasOf).catch(() => []), loadSheet(ABP_GIDS.piezasDef).catch(() => [])])
      .then(([of, def]) =>
        vivo &&
        setCalibre(
          calibraXg([
            { filas: of, atacante: "rmcf" },
            { filas: def, atacante: "rival" },
          ]),
        ),
      )
      .catch(() => undefined);

    fetch(`/api/docs?key=${SCOUT_DOC_KEY}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: RivalScoutStore | null }>) : null))
      .then((r) => vivo && setScout(r?.data ?? null))
      .catch(() => undefined);

    traeJson<unknown>("/api/rivals?action=rivalesPlantillas")
      .then((r) => vivo && setPlantillas(Array.isArray(r) ? r : []))
      .catch(() => vivo && setPlantillas([]));

    return () => {
      vivo = false;
    };
  }, []);

  /* Los nuestros con su perfil aéreo, por id de la plantilla. */
  const aereo = useMemo(() => {
    const mapa = new Map<string, PerfilAereo>();

    if (!wyscout?.length) return mapa;

    const fichas = players.filter((p) => p.esCastilla).map((p) => ({ id: p.id, nombre: p.nombre, apodo: p.apodo, foto: p.foto, posicion: p.posicion }));

    for (const j of nuestrosDe(wyscout, fichas)) {
      if (!j.fichaId) continue;

      const datos = j.wyscout?.datos ?? {};

      mapa.set(j.fichaId, {
        altura: j.altura,
        aereoPct: numero(datos["Duelos aéreos ganados, %"]),
        aereos90: numero(datos["Duelos aéreos en los 90"]),
      });
    }

    return mapa;
  }, [wyscout, players]);

  const rival = useMemo<ProximoRival | null>(() => {
    if (!proximo) return null;

    /* El nombre del calendario (BeSoccer) no tiene por qué ser el de la hoja ni el del scouting. */
    const equipos = [
      ...new Set(
        (plantillas ?? [])
          .map((f) => (f && typeof f === "object" ? String((f as Record<string, unknown>).NOMBRE_EQUIPO ?? "").trim() : ""))
          .filter(Boolean),
      ),
    ];

    const enHoja = equipos.find((e) => mismoClub(e, proximo)) ?? proximo;

    let acciones = actionsOf(scout, enHoja);

    if (!acciones.length && scout?.teams) {
      const clave = Object.keys(scout.teams).find((k) => k === teamKey(proximo) || mismoClub(k, proximo) || mismoClub(k, enHoja));

      if (clave) acciones = (scout.teams[clave] ?? []).map((a) => ({ ...a, patron: a.patron ?? "", observaciones: a.observaciones ?? "" }));
    }

    const plantilla = buildAerialThreats(plantillas ?? [], [], enHoja).filter((j) => j.altura);

    return {
      equipo: enHoja,
      corner: acciones.length ? estructuraDefensiva(acciones, "corner") : null,
      falta: acciones.length ? estructuraDefensiva(acciones, "falta-lateral") : null,
      cabeceadores: susCabeceadores(plantilla, 6),
      plantilla,
    };
  }, [proximo, plantillas, scout]);

  return { aereo, calibre, rival };
}
