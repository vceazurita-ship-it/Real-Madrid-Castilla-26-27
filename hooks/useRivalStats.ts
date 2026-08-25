"use client";

import { useEffect, useState } from "react";

import { RIVAL_STATS_KEY, type RivalStatsDoc } from "@/lib/rivals/stats";

/*
| Carga (sólo lectura) el documento de estadísticas de rivales.
|
| Lo escribe `scripts/rivals-stats/`, no la app: aquí nunca se guarda. Un
| fallo no rompe nada —la ficha se pinta igual, sin la parte de números— así
| que no se avisa al usuario con un toast por algo que no puede arreglar.
*/

type State = {
  doc: RivalStatsDoc | null;
  loading: boolean;
  /** El documento no existe todavía: hay que correr el script de descarga. */
  missing: boolean;
};

export function useRivalStats(): State {
  const [state, setState] = useState<State>({
    doc: null,
    loading: true,
    missing: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/docs?key=${encodeURIComponent(RIVAL_STATS_KEY)}`,
        );

        const body = await response.json();

        if (cancelled) return;

        const doc = (body?.data as RivalStatsDoc | null) ?? null;

        setState({
          doc: doc?.porId ? doc : null,
          loading: false,
          missing: !doc?.porId,
        });
      } catch (error) {
        if (cancelled) return;

        console.error("[rivals] estadísticas", error);

        setState({ doc: null, loading: false, missing: true });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default useRivalStats;
