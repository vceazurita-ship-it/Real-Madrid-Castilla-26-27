"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Player, EstadoJugador } from "@/types/player";

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
          .map((p) => ({
  id: p.ID_JUGADOR,
  nombre: p.NOMBRE,
  posicion: p.POSICION,
  dorsal: Number(p.DORSAL) || undefined,
  foto: p.FOTO_URL || "/jugador.png",

  licencia: p.LICENCIA || "RMCF Castilla",

  esCastilla:
    (p.LICENCIA || "RMCF Castilla") === "RMCF Castilla",

  estado: p.ESTADO || "DISPONIBLE",
  activo: true,
  hudl: p.HUDL_PERFIL_URL || "",
}));

        setPlayers(plantilla);
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