import { EstadoJugador } from "@/types/player";

export function getStatusBadge(
  estado: EstadoJugador
): { text: string; color: string } | null {
  switch (estado) {
    case "DISPONIBLE":
    case "ÓPTIMO":
      return {
        text: "OPT",
        color: "bg-green-600 border-green-300",
      };

    case "CONTROL DE CARGA":
      return {
        text: "CARGA",
        color: "bg-yellow-500 border-yellow-300 text-black",
      };

    case "TOCADO":
      return {
        text: "TOC",
        color: "bg-orange-600 border-orange-300",
      };

    case "REINCORPORACIÓN":
      return {
        text: "REINC",
        color: "bg-blue-600 border-blue-300",
      };

    case "LESIONADO":
      return {
        text: "LES",
        color: "bg-red-600 border-red-300",
      };

    case "SANCIONADO":
      return {
        text: "SAN",
        color: "bg-orange-700 border-orange-300",
      };

    case "PRIMER EQUIPO":
      return {
        text: "1EQ",
        color: "bg-purple-600 border-purple-300",
      };

    case "SELECCIÓN":
      return {
        text: "SEL",
        color: "bg-cyan-600 border-cyan-300",
      };default:
  return null;
  }
}