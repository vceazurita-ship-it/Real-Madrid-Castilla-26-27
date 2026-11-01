/*
| QUIÉN PUEDE JUGAR (01/11/2026)
|
| La columna ESTADO de la plantilla. Fuera del once: lesionados, sancionados y
| los que están con el primer equipo o con su selección. Con cuidado: tocados,
| control de carga y recién reincorporados. Aparte de la propuesta de once
| para que la lista de cambio del campo no cargue con todo el cálculo.
*/

import type { EstadoJugador, Player } from "@/types/player";

export const NO_DISPONIBLE = new Set<EstadoJugador>(["LESIONADO", "SANCIONADO", "PRIMER EQUIPO", "SELECCIÓN"]);

/** Los que pueden, pero con cuidado: cómo se dice en una frase. */
export const CON_CUIDADO: Partial<Record<EstadoJugador, string>> = {
  TOCADO: "llega tocado",
  "CONTROL DE CARGA": "va con control de carga",
  REINCORPORACIÓN: "acaba de volver",
};

export const disponible = (p: Player) => p.activo !== false && !NO_DISPONIBLE.has(p.estado);

/** «Lesionado», «Con el primer equipo»…: para la lista de cambios y la propuesta. */
export function estadoEnPalabras(p: Pick<Player, "estado">): string | null {
  switch (p.estado) {
    case "LESIONADO":
      return "Lesionado";
    case "SANCIONADO":
      return "Sancionado";
    case "PRIMER EQUIPO":
      return "Con el primer equipo";
    case "SELECCIÓN":
      return "Con la selección";
    case "TOCADO":
      return "Tocado";
    case "CONTROL DE CARGA":
      return "Control de carga";
    case "REINCORPORACIÓN":
      return "Reincorporación";
    default:
      return null;
  }
}
