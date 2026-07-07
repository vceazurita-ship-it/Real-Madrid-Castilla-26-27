"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Player, EstadoJugador } from "@/types/player";

const CSV_URLS = {
  micro:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=2041966583&single=true&output=csv",

  competicion:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1735710063&single=true&output=csv",
} as const;

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

export function usePlayers(
  source: keyof typeof CSV_URLS = "micro"
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  setLoading(true);

  Papa.parse<CsvPlayer>(CSV_URLS[source], {
    download: true,
    header: true,

    complete: ({ data }) => {
        console.log("CSV RAW", data);

      const plantilla: Player[] = data
        .filter((p) => p.ACTIVO === "TRUE")
        .map((p) => ({
          id: p.ID_JUGADOR,
          nombre: p.NOMBRE,
          apodo: p.APODO || p.NOMBRE,
          posicion: p.POSICION,
          dorsal: Number(p.DORSAL) || undefined,
          foto: p.FOTO_URL || "/jugador.png",
          licencia: p.LICENCIA || "RMCF Castilla",
          esCastilla:
            (p.LICENCIA || "RMCF Castilla") ===
            "RMCF Castilla",
          estado: p.ESTADO || "DISPONIBLE",
          activo: true,
          hudl: p.HUDL_PERFIL_URL || "",
        }));
console.log(source);
console.log(CSV_URLS[source]);
console.log(plantilla);

      setPlayers(plantilla);
      setLoading(false);
    },

    error: (err) => {
      console.error(err);
      setLoading(false);
    },
  });
}, [source]);

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