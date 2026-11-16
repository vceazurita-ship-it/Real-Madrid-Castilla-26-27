/**
 * LA PRESIÓN DEL RIVAL EN LA TEMPORADA: UNA SOLA CIFRA (16/11/2026).
 *
 * El juez de fútbol vio el PPDA del Murcia como 8,8, 10,2 y 10,8 en tres
 * sitios. La cifra principal del área es la de Opta de la temporada (sus
 * pases entre sus acciones defensivas, `opta:equipos`) con su puesto entre
 * los equipos de su grupo, la misma cuenta que «Las cifras que más se
 * preguntan» de Plantillas rivales (components/rivals/DatosDelRival.tsx).
 *
 * Es el único sitio de la proyección que la calcula: cuando la capa común del
 * rival (lib/rivals) tenga su «cifra principal con proveedor», se cambia aquí
 * y el Plan de partido la sigue sin tocar nada más.
 */

import { valorEquipo, type Fila } from "@/lib/opta-analisis";
import { puestoEnLiga } from "@/lib/rivals/puesto-liga";

export type PresionTemporada = {
  /** «10,2». */
  valor: number;
  /** 1 = el que más aprieta (menos PPDA). */
  puesto: number;
  de: number;
  proveedor: "Opta";
};

export function presionDeTemporada(equipos: Fila[], grupos: Map<string, number>, teamId: string): PresionTemporada | null {
  const fila = equipos.find((f) => String(f.teamId ?? "") === teamId);
  if (!fila) return null;
  const v = valorEquipo(fila, "PPDA", "partido");
  if (v == null) return null;
  const grupo = grupos.get(teamId);
  const valores = equipos
    .filter((f) => grupos.get(String(f.teamId ?? "")) === grupo)
    .map((f) => valorEquipo(f, "PPDA", "partido"))
    .filter((x): x is number => x != null);
  const p = puestoEnLiga(v, valores, false);
  return p ? { valor: v, puesto: p.puesto, de: p.de, proveedor: "Opta" } : null;
}
