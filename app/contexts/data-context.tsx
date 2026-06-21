"use client";

import { createContext, useContext, useState } from "react";

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