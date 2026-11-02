/*
|--------------------------------------------------------------------------
| NUESTRO ONCE PREVISTO, HUECO A HUECO, DESDE LA PIZARRA TÁCTICA (02/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «si ponemos una alineación en la pizarra táctica, que
| se traslade a todas las áreas donde afecta el once». Emotion y la pizarra de
| ABP ya leían las fichas (`onceDeLaPizarra`); Duelos, el Plan de partido
| (duelos clave), el once de DATA y las marcas del córner partían del último
| once de Valoraciones. Aquí se traduce el tablero a lo que esas pantallas
| entienden: hueco del 4-2-3-1 → id de la ficha de la plantilla.
|
| - El hueco sale de dónde está cada ficha (`huecosDeFichas`, el mismo reparto
|   que usa la pizarra al cambiar a un titular).
| - El jugador, por NOMBRE (los JUG-XX se renumeran): la ficha guarda el apodo
|   o el nombre.
| - Con menos de siete casados no vale: cada pantalla sigue con lo de antes.
| - Si se pide para un rival y el tablero es de otro partido, tampoco.
*/

import { mismoClub } from "@/lib/rivals/mismoClub";

import { huecosDeFichas } from "./editaOnce";
import { mejorCasado, type TableroDeOnces } from "./onceDeLaPizarra";

export type BaseDeLaPizarra = {
  /** hueco → id de la ficha de la plantilla. */
  huecos: Record<string, string>;
  /** El rival del tablero, tal y como lo guarda la pizarra. */
  rival: string;
};

/** Los casados que hacen falta para que el once de la pizarra mande. */
export const MINIMO_DE_LA_PIZARRA = 7;

export function huecosDeLaPizarra<T extends { id: string; nombre: string; apodo?: string }>(
  tablero: TableroDeOnces | null | undefined,
  plantilla: T[],
  /** El rival que se mira: si el tablero es de otro, `null`. */
  rival?: string,
): BaseDeLaPizarra | null {
  if (!tablero || !plantilla.length) return null;

  const rivalDelTablero = tablero.semanaOnces.split("|")[1]?.trim() ?? "";

  /* Un tablero sin rival no vale para un rival concreto: no se sabe de quién es. */
  if (rival && (!rivalDelTablero || !mismoClub(rivalDelTablero, rival))) return null;

  const hueco = huecosDeFichas(tablero.escena);
  const usados = new Set<T>();
  const huecos: Record<string, string> = {};

  for (const t of tablero.escena.tokens) {
    const nombre = String(t.nombre ?? "").trim();
    const h = hueco.get(t.id);

    if (t.kind !== "home" || !nombre || !h) continue;

    const p = mejorCasado<T>([nombre], plantilla, (j) => [j.nombre, j.apodo], usados);

    if (!p) continue;

    usados.add(p);
    huecos[h] = p.id;
  }

  return Object.keys(huecos).length >= MINIMO_DE_LA_PIZARRA ? { huecos, rival: rivalDelTablero } : null;
}
