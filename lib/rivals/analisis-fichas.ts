/**
 * Las fichas de las láminas, sacadas de la hoja de plantillas rivales.
 *
 * Aparte de `analisis-svg.ts` porque las usa también el informe del
 * microciclo, que no tiene por qué cargar la pizarra entera.
 */

import { pieLegible } from "@/lib/rivals/analisis";
import type { FichaLamina } from "@/lib/rivals/analisis-svg";
import { playerKey } from "@/lib/rivals/once";
import { casaJugador } from "@/lib/rivals/importa-pdf";

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
  const delEquipo: Record<string, unknown>[] = [];

  for (const fila of filas) {
    if (String(fila.NOMBRE_EQUIPO ?? "") !== equipo) continue;

    const ficha = fichaDesdePlantilla(fila);

    porClave.set(playerKey(fila), ficha);
    porNombre.set(ficha.nombre.toUpperCase(), ficha);
    delEquipo.push(fila);
  }

  /*
  | Y si la lámina no trae clave —se importó de un PDF cuando la plantilla no
  | había llegado, como la J6 del Atlético Madrileño—, por el nombre del
  | vestuario con la misma regla que la importación: «ANTAL» es ANTAL
  | YAAKOBISHVILI y «PABLO PAN» es PABLO PAN ABAJO. Sólo si no hay duda.
  */
  const porApodo = new Map<string, FichaLamina | null>();

  const buscaPorApodo = (nombre: string) => {
    if (!nombre) return null;

    if (!porApodo.has(nombre)) {
      const fila = casaJugador(nombre, delEquipo);
      porApodo.set(nombre, fila ? fichaDesdePlantilla(fila) : null);
    }

    return porApodo.get(nombre) ?? null;
  };

  return (clave: string, nombre: string) =>
    porClave.get(clave) ?? porNombre.get(nombre.toUpperCase()) ?? buscaPorApodo(nombre);
}
