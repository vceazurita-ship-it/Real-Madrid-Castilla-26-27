"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Player, EstadoJugador } from "@/types/player";
import { getPlayerImage, getPlayerPhotoSrc } from "@/lib/playerImages";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";
import { conFichajes } from "@/lib/fichajes";
import { conDorsales } from "@/lib/dorsales";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

interface CsvPlayer {
  ID_JUGADOR: string;
  NOMBRE: string;
  POSICION: string;
  DORSAL: string;
  FOTO_URL: string;
  LICENCIA: string;
  ESTADO: EstadoJugador;
  ACTIVO: string;
  HUDL_PERFIL_URL: string;
  APODO: string;
}

/*
|--------------------------------------------------------------------------
| UNA SOLA DESCARGA PARA TODA LA PANTALLA
|--------------------------------------------------------------------------
|
| Este hook lo llaman muchos componentes a la vez —en `/pizarra` hay ocho: la
| página, el contexto del once, la barra de formación, el campo, el banquillo,
| las estadísticas, el lateral de jugadores y el tablero de fase—, y cada uno
| se bajaba **su propia copia** del CSV de la plantilla, un cuarto de mega, y
| lo parseaba entero por su cuenta.
|
| Ocho descargas simultáneas del mismo archivo publicado de Google es lo que
| hacía que la pantalla tardara o se quedara a medias: el navegador limita las
| peticiones al mismo servidor y Google responde despacio cuando le llegan
| todas de golpe. Ahora la descarga es una, la comparten todos y queda en
| memoria mientras dure la pestaña.
*/

let plantillaEnMemoria: Player[] | null = null;
let descargaEnVuelo: Promise<Player[]> | null = null;

function cargaPlantilla(): Promise<Player[]> {
  if (plantillaEnMemoria) return Promise.resolve(plantillaEnMemoria);

  descargaEnVuelo ??= new Promise<Player[]>((resolve) => {
    Papa.parse<CsvPlayer>(CSV_URL, {
      download: true,
      header: true,

      complete: ({ data }) => {
        const plantilla: Player[] = data
          .filter((p) => p.ACTIVO === "TRUE")
          .filter((p) => !isHiddenPlayer(p.NOMBRE, p.APODO))
          .map((p) => ({
            id: p.ID_JUGADOR,
            nombre: p.NOMBRE,
            apodo: p.APODO || p.NOMBRE,
            posicion: p.POSICION,
            dorsal: Number(p.DORSAL) || undefined,
            foto: getPlayerPhotoSrc(p.NOMBRE, {
              id: p.ID_JUGADOR,
              variant: "cerca",
              fallbackUrl: p.FOTO_URL,
            }),

            fotoLejos: getPlayerImage(p.NOMBRE, "lejos", p.ID_JUGADOR) ?? undefined,

            licencia: p.LICENCIA || "RMCF Castilla",

            esCastilla: (p.LICENCIA || "RMCF Castilla") === "RMCF Castilla",

            estado: p.ESTADO || "DISPONIBLE",
            activo: true,
            hudl: p.HUDL_PERFIL_URL || "",
          }));

        /*
        | Y los fichajes que la hoja todavía no trae (`lib/fichajes.ts`) y el
        | dorsal de los que todavía no numera (`lib/dorsales.ts`).
        |
        | Aquí, en el punto de entrada, para que valgan igual en el once, en la
        | pizarra de ABP, en el coding y en las valoraciones sin tocar ni una
        | pantalla. Lo que la hoja traiga escrito manda siempre.
        */
        plantillaEnMemoria = conDorsales(conFichajes(plantilla));

        resolve(plantillaEnMemoria);
      },

      error: (error) => {
        console.error("Error cargando jugadores:", error);

        /* Un fallo no se guarda: el siguiente montaje vuelve a intentarlo. */
        descargaEnVuelo = null;

        resolve([]);
      },
    });
  });

  return descargaEnVuelo;
}

export function usePlayers() {
  /* Si otra parte de la pantalla ya la bajó, se pinta sin esperar a nada. */
  const [players, setPlayers] = useState<Player[]>(
    () => plantillaEnMemoria ?? [],
  );

  const [loading, setLoading] = useState(plantillaEnMemoria === null);

  useEffect(() => {
    if (plantillaEnMemoria) return;

    let vivo = true;

    void cargaPlantilla().then((plantilla) => {
      if (!vivo) return;

      setPlayers(plantilla);
      setLoading(false);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const disponibles = useMemo(
    () => players.filter((p) => p.estado === "DISPONIBLE"),
    [players]
  );

  const lesionados = useMemo(
    () => players.filter((p) => p.estado === "LESIONADO"),
    [players]
  );

  const primerEquipo = useMemo(
    () => players.filter((p) => p.estado === "PRIMER EQUIPO"),
    [players]
  );

  const seleccion = useMemo(
    () => players.filter((p) => p.estado === "SELECCIÓN"),
    [players]
  );

  const porteros = useMemo(
    () =>
      players.filter((p) =>
        p.posicion.toUpperCase().includes("PORTERO")
      ),
    [players]
  );

  const defensas = useMemo(
    () =>
      players.filter(
        (p) =>
          p.posicion.toUpperCase().includes("LATERAL") ||
          p.posicion.toUpperCase().includes("CENTRAL")
      ),
    [players]
  );

  const centrocampistas = useMemo(
    () =>
      players.filter((p) =>
        ["6", "8", "10"].includes(p.posicion)
      ),
    [players]
  );

  const extremos = useMemo(
    () =>
      players.filter((p) =>
        ["7", "11"].includes(p.posicion)
      ),
    [players]
  );

  const delanteros = useMemo(
    () => players.filter((p) => p.posicion === "9"),
    [players]
  );

  return {
    players,
    loading,

    disponibles,
    lesionados,
    primerEquipo,
    seleccion,

    porteros,
    defensas,
    centrocampistas,
    extremos,
    delanteros,
  };
}