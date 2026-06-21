"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

type DataContextType = {
  playersData: any[];
  setPlayersData: (data: any[]) => void;

  teamData: any[];
  setTeamData: (data: any[]) => void;

  scoutData: any[];
  setScoutData: (data: any[]) => void;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [playersData, setPlayersData] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any[]>([]);
  const [scoutData, setScoutData] = useState<any[]>([]);
  // Cargar datos guardados al iniciar la aplicación
useEffect(() => {
  if (typeof window === "undefined") return;

  try {
    const players = localStorage.getItem("playersData");
    const team = localStorage.getItem("teamData");
    const scout = localStorage.getItem("scoutData");

    if (players) setPlayersData(JSON.parse(players));
    if (team) setTeamData(JSON.parse(team));
    if (scout) setScoutData(JSON.parse(scout));
  } catch (error) {
    console.error("Error cargando datos guardados:", error);
  }
}, []);

// Guardar automáticamente cambios en jugadores
useEffect(() => {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "playersData",
    JSON.stringify(playersData)
  );
}, [playersData]);

// Guardar automáticamente cambios en equipo
useEffect(() => {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "teamData",
    JSON.stringify(teamData)
  );
}, [teamData]);

// Guardar automáticamente cambios en scout
useEffect(() => {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    "scoutData",
    JSON.stringify(scoutData)
  );
}, [scoutData]);
  return (
    <DataContext.Provider
      value={{
        playersData,
        setPlayersData,

        teamData,
        setTeamData,

        scoutData,
        setScoutData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error("useData must be used inside DataProvider");
  }

  return context;
}