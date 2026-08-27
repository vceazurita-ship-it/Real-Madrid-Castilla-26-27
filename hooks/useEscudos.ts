"use client";

import { useCallback } from "react";

import { findTeam } from "@/lib/rivals/stats";

import { useRivalStats } from "./useRivalStats";

/*
|--------------------------------------------------------------------------
| EL ESCUDO DE UN CLUB RIVAL, EN CUALQUIER PÁGINA
|--------------------------------------------------------------------------
|
| El escudo no está en la hoja: RIVALES escribe por nombre de columna y no
| tiene ninguna para él, así que viaja en el documento de estadísticas que
| baja `scripts/rivals-stats.mjs`. Ver `lib/rivals/stats.ts`.
|
| Cada página tiene el nombre del rival escrito de una forma —la hoja
| RIVALES, el calendario, lo que el cuerpo técnico teclea en la pizarra—, y
| `findTeam` ya normaliza acentos y mayúsculas para cruzarlos. Cuando no hay
| escudo —un amistoso de pretemporada, un documento anterior al script—
| devuelve `undefined` y `EscudoEquipo` pinta la inicial del club: el hueco
| mide siempre lo mismo, con escudo y sin él.
*/

export function useEscudos() {
  const { doc } = useRivalStats();

  return useCallback(
    (equipo: { ID_EQUIPO?: unknown; NOMBRE_EQUIPO?: unknown } | string | null) =>
      findTeam(doc, equipo)?.escudo,
    [doc],
  );
}

export default useEscudos;
