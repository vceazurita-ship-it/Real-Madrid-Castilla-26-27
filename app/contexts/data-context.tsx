"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

/** Una fila de un CSV subido: columna → valor, tal y como lo deja Papa. */
export type FilaDatos = Record<string, unknown>;

type DataContextType = {
  playersData: FilaDatos[];
  setPlayersData: (data: FilaDatos[]) => void;

  teamData: FilaDatos[];
  setTeamData: (data: FilaDatos[]) => void;

  scoutData: FilaDatos[];
  setScoutData: (data: FilaDatos[]) => void;
};

const DataContext = createContext<DataContextType | null>(null);

/*
| Los datos guardados se leen de `localStorage` con `useSyncExternalStore` y no
| con un efecto que hace `setState`: el servidor pinta la lista vacía, el
| cliente la guardada, y React no protesta al hidratar. Sin suscripción: como
| antes, lo que cambie otra pestaña no se ve aquí hasta recargar.
*/
const SIN_SUSCRIPCION = () => () => {};
const enServidor = () => null;

function useFilasGuardadas(clave: string): FilaDatos[] {
  const crudo = useSyncExternalStore(
    SIN_SUSCRIPCION,
    () => {
      try {
        return localStorage.getItem(clave);
      } catch (error) {
        console.error("Error cargando datos guardados:", error);
        return null;
      }
    },
    enServidor,
  );

  return useMemo(() => {
    if (!crudo) return [];

    try {
      return JSON.parse(crudo) as FilaDatos[];
    } catch (error) {
      console.error("Error cargando datos guardados:", error);
      return [];
    }
  }, [crudo]);
}

/*
| Lo que se sube en esta sesión manda sobre lo guardado (`null` = aún no se ha
| subido nada) y se guarda solo en cuanto cambia.
*/
function useFilas(clave: string) {
  const guardadas = useFilasGuardadas(clave);
  const [subidas, setSubidas] = useState<FilaDatos[] | null>(null);

  useEffect(() => {
    if (subidas === null) return;

    /* Un CSV grande llena el `localStorage` (unos 5 MB) y `setItem` lanza:
       sin esto, el error tumbaba la pantalla entera desde el proveedor, que
       envuelve toda la app (19/10/2026). Los datos siguen en memoria. */
    try {
      localStorage.setItem(clave, JSON.stringify(subidas));
    } catch (error) {
      console.error("No se han podido guardar los datos en el navegador:", error);
    }
  }, [clave, subidas]);

  return [subidas ?? guardadas, setSubidas] as const;
}

export function DataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [playersData, setPlayersData] = useFilas("playersData");
  const [teamData, setTeamData] = useFilas("teamData");
  const [scoutData, setScoutData] = useFilas("scoutData");

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
