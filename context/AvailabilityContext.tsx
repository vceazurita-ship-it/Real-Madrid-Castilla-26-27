"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useRemoteDoc, type DocStatus } from "@/hooks/useRemoteDoc";
import type { EstadoJugador } from "@/types/player";

/**
 * Disponibilidad de la plantilla para el partido.
 *
 * La hoja de cálculo ya no manda aquí: todos arrancan disponibles y es el
 * staff quien marca las bajas desde la propia pizarra. Sólo se guardan las
 * bajas, así que un jugador nuevo entra disponible sin tocar nada.
 *
 * El documento vive en Supabase (`app_documents`), de modo que la convocatoria
 * es la misma para todo el cuerpo técnico.
 */

export const UNAVAILABLE_REASONS = [
  "TOCADO",
  "LESIONADO",
  "SANCIONADO",
  "PRIMER EQUIPO",
  "SELECCIÓN",
  "OTROS",
] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/** Motivo -> estado del tema de color compartido con el resto de pantallas. */
export const REASON_STATUS: Record<UnavailableReason, EstadoJugador | undefined> =
  {
    TOCADO: "TOCADO",
    LESIONADO: "LESIONADO",
    SANCIONADO: "SANCIONADO",
    "PRIMER EQUIPO": "PRIMER EQUIPO",
    "SELECCIÓN": "SELECCIÓN",
    OTROS: undefined,
  };

export const REASON_LABEL: Record<UnavailableReason, string> = {
  TOCADO: "Tocado",
  LESIONADO: "Lesionado",
  SANCIONADO: "Sancionado",
  "PRIMER EQUIPO": "Primer equipo",
  "SELECCIÓN": "Selección",
  OTROS: "No disponible",
};

export const REASON_SHORT: Record<UnavailableReason, string> = {
  TOCADO: "TOC",
  LESIONADO: "LES",
  SANCIONADO: "SANC",
  "PRIMER EQUIPO": "1EQ",
  "SELECCIÓN": "SEL",
  OTROS: "N/D",
};

interface AvailabilityDoc {
  /** id de jugador -> motivo de la baja. Ausente = disponible. */
  bajas: Record<string, UnavailableReason>;
}

interface AvailabilityValue {
  bajas: Record<string, UnavailableReason>;
  /** Motivo de la baja, o `null` si el jugador está disponible. */
  reasonFor: (playerId: string) => UnavailableReason | null;
  isAvailable: (playerId: string) => boolean;
  /** `null` devuelve al jugador a la lista de disponibles. */
  setReason: (playerId: string, reason: UnavailableReason | null) => void;
  clearAll: () => void;
  status: DocStatus;
  localOnly: boolean;
}

const EMPTY_DOC: AvailabilityDoc = { bajas: {} };

const AvailabilityContext = createContext<AvailabilityValue | null>(null);

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const { value, setValue, status, localOnly } = useRemoteDoc<AvailabilityDoc>({
    key: "pizarra:disponibilidad",
    kind: "pizarra",
    fallback: EMPTY_DOC,
    debounce: 400,
  });

  const bajas = useMemo(() => value?.bajas ?? {}, [value]);

  const reasonFor = useCallback(
    (playerId: string) => bajas[playerId] ?? null,
    [bajas]
  );

  const isAvailable = useCallback(
    (playerId: string) => !bajas[playerId],
    [bajas]
  );

  const setReason = useCallback(
    (playerId: string, reason: UnavailableReason | null) =>
      setValue((current) => {
        const next = { ...(current?.bajas ?? {}) };

        if (reason) next[playerId] = reason;
        else delete next[playerId];

        return { bajas: next };
      }),
    [setValue]
  );

  const clearAll = useCallback(() => setValue({ bajas: {} }), [setValue]);

  const contextValue = useMemo(
    () => ({
      bajas,
      reasonFor,
      isAvailable,
      setReason,
      clearAll,
      status,
      localOnly,
    }),
    [bajas, reasonFor, isAvailable, setReason, clearAll, status, localOnly]
  );

  return (
    <AvailabilityContext.Provider value={contextValue}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const context = useContext(AvailabilityContext);

  if (!context) {
    throw new Error(
      "useAvailability debe usarse dentro de <AvailabilityProvider>"
    );
  }

  return context;
}
