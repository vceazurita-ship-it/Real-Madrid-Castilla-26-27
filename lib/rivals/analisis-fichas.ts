/**
 * Las fichas de las láminas, sacadas de la hoja de plantillas rivales.
 *
 * Aparte de `analisis-svg.ts` porque las usa también el informe del
 * microciclo, que no tiene por qué cargar la pizarra entera.
 */

import { pieLegible } from "@/lib/rivals/analisis";
import type { FichaLamina } from "@/lib/rivals/analisis-svg";
import { playerKey } from "@/lib/rivals/once";

export function fichaDesdePlantilla(fila: Record<string, unknown>): FichaLamina {
  const altura = String(fila.ALTURA ?? "").trim();

  return {
    nombre: String(fila["NOMBRE DEPORTIVO"] || fila.JUGADOR || "").trim(),
    altura: /^\d+$/.test(altura) ? `${altura}cm` : altura,
    edad: String(fila.EDAD ?? "").trim(),
    pie: pieLegible(fila["PIE DOMINANTE"]),
    foto: String(fila.FOTO ?? "").trim(),
  };
}

/** El resolutor de fichas de un equipo: por clave y, si no, por nombre. */
export function resolutorDeFichas(plantilla: unknown, equipo: string) {
  const filas = Array.isArray(plantilla) ? (plantilla as Record<string, unknown>[]) : [];

  const porClave = new Map<string, FichaLamina>();
  const porNombre = new Map<string, FichaLamina>();

  for (const fila of filas) {
    if (String(fila.NOMBRE_EQUIPO ?? "") !== equipo) continue;

    const ficha = fichaDesdePlantilla(fila);

    porClave.set(playerKey(fila), ficha);
    porNombre.set(ficha.nombre.toUpperCase(), ficha);
  }

  return (clave: string, nombre: string) =>
    porClave.get(clave) ?? porNombre.get(nombre.toUpperCase()) ?? null;
}
