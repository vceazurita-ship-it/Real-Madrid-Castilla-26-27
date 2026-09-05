"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Player, EstadoJugador } from "../types/player";
import { getPlayerImage, getPlayerPhotoSrc } from "../lib/playerImages";
import { isHiddenPlayer } from "../lib/hiddenPlayers";
import { posicionDe } from "../lib/posiciones";
import { traeCsv } from "../lib/hojaCsv";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1978494160&single=true&output=csv";

interface CsvPlayer {
  ID_JUGADOR: string;
  FECHA: string; // <-- añadir
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

export function useTrainingPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [plantillaActiva, setPlantillaActiva] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;

    /* La descarga la comparte con quien ya haya pedido esta hoja. */
    traeCsv(CSV_URL)
      .then((csv) => {
        if (!vivo) return;

        const { data } = Papa.parse<CsvPlayer>(csv, { header: true });

        const ESTADOS_VALIDOS: EstadoJugador[] = [
          "ÓPTIMO",
          "SANCIONADO",
          "CONTROL DE CARGA",
          "REINCORPORACIÓN",
          "TOCADO",
        ];

        // Eliminar filas vacías
        const filas = data.filter(
          (p) => p.ID_JUGADOR && !isHiddenPlayer(p.NOMBRE, p.APODO)
        );

        /*
        | La última sesión de verdad, que no es "la última fecha".
        |
        | Dos cosas se torcían aquí. Una: las fechas vienen en dd/mm/aaaa y se
        | ordenaban como texto, así que "29/07/2026" quedaba por detrás de
        | "24/08/2026" y la pantalla enseñaba la sesión de julio teniendo la de
        | agosto. Dos: dar de alta a un jugador escribe **su fila sola** con la
        | fecha de hoy, y eso no es una sesión —con la fecha suelta ganando, la
        | plantilla del día se quedaba en una sola persona—. Una sesión es un
        | día con el grupo dentro, así que los días con cuatro filas o menos no
        | cuentan.
        */
        const enDia = new Map<string, number>();

        for (const p of filas) {
          const fecha = (p.FECHA ?? "").trim();

          if (fecha) enDia.set(fecha, (enDia.get(fecha) ?? 0) + 1);
        }

        const alReves = (fecha: string) =>
          fecha.split("/").reverse().join("-");

        const ultimaFecha = [...enDia.entries()]
          .filter(([, cuantos]) => cuantos > 4)
          .sort((una, otra) => alReves(una[0]).localeCompare(alReves(otra[0])))
          .pop()?.[0];

        // Quedarnos únicamente con esa fecha
        const ultimaSesion = filas.filter(
          (p) => (p.FECHA ?? "").trim() === ultimaFecha
        );

        // TODOS los jugadores de la última sesión
        const plantillaCompleta: Player[] = ultimaSesion.map((p) => ({
          id: p.ID_JUGADOR,
          nombre: p.NOMBRE,
          apodo: p.APODO || p.NOMBRE,
          posicion: posicionDe(p.NOMBRE, p.POSICION),
          dorsal: Number(p.DORSAL) || undefined,

          foto: getPlayerPhotoSrc(p.NOMBRE, {
            id: p.ID_JUGADOR,
            variant: "cerca",
            fallbackUrl: p.FOTO_URL,
          }),

          fotoLejos:
            getPlayerImage(p.NOMBRE, "lejos", p.ID_JUGADOR) ?? undefined,

          licencia: p.LICENCIA || "RMCF Castilla",

          esCastilla:
            (p.LICENCIA || "RMCF Castilla") === "RMCF Castilla",

          estado: p.ESTADO,

          activo:
            String(p.ACTIVO).toUpperCase() === "TRUE" ||
            String(p.ACTIVO) === "1",

          hudl: p.HUDL_PERFIL_URL || "",
        }));

        const plantillaActiva = plantillaCompleta.filter(
          (p) => p.activo
        );

        const plantilla = plantillaCompleta.filter((p) =>
          ESTADOS_VALIDOS.includes(p.estado)
        );

        setAllPlayers(plantillaCompleta);
        setPlantillaActiva(plantillaActiva);
        setPlayers(plantilla);

        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Error cargando jugadores:", error);

        if (vivo) setLoading(false);
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
    allPlayers,
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
    plantillaActiva,
  };
}