"use client";

import { useEffect, useState } from "react";

import { RIVAL_STATS_KEY, type RivalStatsDoc } from "@/lib/rivals/stats";

/*
| Carga (sólo lectura) el documento de estadísticas de rivales.
|
| Lo escribe `scripts/rivals-stats/`, no la app: aquí nunca se guarda. Un
| fallo no rompe nada —la ficha se pinta igual, sin la parte de números— así
| que no se avisa al usuario con un toast por algo que no puede arreglar.
|
| La descarga se comparte entre todos los que lo piden en la misma pantalla.
| Desde que los escudos salen por media app —el selector de ABP del rival, el
| plan de partido, el desplazamiento…— hay páginas con dos o tres llamadas a
| este hook a la vez, y el documento trae la temporada entera de cada jugador
| rival: bajarlo una sola vez por carga de página es lo que evita pedir el
| mismo JSON grande tres veces seguidas.
*/

type State = {
  doc: RivalStatsDoc | null;
  loading: boolean;
  /** El documento no existe todavía: hay que correr el script de descarga. */
  missing: boolean;
};

/* La descarga en curso —o ya terminada—, viva mientras dure la pestaña. */
let enVuelo: Promise<RivalStatsDoc | null> | null = null;

function cargaDocumento() {
  enVuelo ??= (async () => {
    try {
      const response = await fetch(
        `/api/docs?key=${encodeURIComponent(RIVAL_STATS_KEY)}`,
      );

      const body = await response.json();

      return (body?.data as RivalStatsDoc | null) ?? null;
    } catch (error) {
      console.error("[rivals] estadísticas", error);

      /* Un fallo de red no se guarda: la siguiente página vuelve a intentarlo. */
      enVuelo = null;

      return null;
    }
  })();

  return enVuelo;
}

export function useRivalStats(): State {
  const [state, setState] = useState<State>({
    doc: null,
    loading: true,
    missing: false,
  });

  useEffect(() => {
    let cancelled = false;

    cargaDocumento().then((doc) => {
      if (cancelled) return;

      setState({
        doc: doc?.porId ? doc : null,
        loading: false,
        missing: !doc?.porId,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default useRivalStats;
