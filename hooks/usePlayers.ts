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

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  esCastilla:
    (p.LICENCIA || "RMCF Castilla") === "RMCF Castilla",

  estado: p.ESTADO || "DISPONIBLE",
  activo: true,
  hudl: p.HUDL_PERFIL_URL || "",
}));

        /*
        | Y los fichajes que la hoja todavía no trae (`lib/fichajes.ts`).
        |
        | Se añaden aquí, en el punto de entrada, para que valgan igual en el
        | once, en la pizarra de ABP y en el coding sin tocar ni una pantalla.
        | Si la hoja ya los tiene, esto no añade nada.
        */
        /*
        | Y el dorsal de los que la hoja todavía no numera (`lib/dorsales.ts`).
        |
        | También aquí, en el punto de entrada, para que el número salga igual
        | en el coding, en las pizarras, en el once y en las valoraciones. Lo
        | que la hoja traiga escrito manda siempre.
        */
        setPlayers(conDorsales(conFichajes(plantilla)));
        setLoading(false);
      },

      error: (error) => {
        console.error("Error cargando jugadores:", error);
        setLoading(false);
      },
    });
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