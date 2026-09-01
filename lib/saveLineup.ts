/**
 * Guardar una alineación en la hoja.
 *
 * Iba como formulario (`URLSearchParams`) y dejó de escribir: el `doPost` del
 * Apps Script pasa el cuerpo por `JSON.parse`, así que un formulario se
 * estrella antes de repartir por acción. Ahora va en JSON, como el resto de
 * escrituras de la app (`lib/hojaRivales.ts`).
 */

import { guardaEnLaHoja } from "@/lib/hojaRivales";

export async function saveLineup(data: {
  id?: string;
  nombre: string;
  fecha: string;
  rival: string;
  sistema: string;
  alineacion: unknown;
  observaciones: string;
}) {
  /* Los nombres son los de las columnas de la hoja, no los de aquí. */
  const fila: Record<string, unknown> = {
    Nombre: data.nombre,
    Fecha: data.fecha,
    Rival: data.rival,
    Sistema: data.sistema,
    Alineacion: JSON.stringify(data.alineacion),
    Observaciones: data.observaciones,
  };

  /* Sin `ID` la hoja da de alta una fila nueva; con él, reescribe la suya. */
  if (data.id) fila.ID = data.id;

  /*
  | La respuesta se normaliza siempre a `{ success }`: antes se devolvía el
  | JSON en crudo y quien llamaba lo ignoraba, así que un error del servidor
  | acababa con un "guardado" en pantalla y la alineación sin escribir.
  */
  try {
    const cuerpo = await guardaEnLaHoja("guardarAlineacion", fila);

    return { success: true, ...cuerpo };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "La respuesta del servidor no se ha podido leer",
    };
  }
}
