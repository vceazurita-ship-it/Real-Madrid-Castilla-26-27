/**
 * EL PUENTE PARA ESCRIBIR MICROCICLOS EN LA HOJA.
 *
 * El editor de microciclos manda aquí las filas y esto se las pasa al Apps
 * Script de la hoja (`scripts/apps-script/registro-tareas.gs`). Va por el
 * servidor y no directo desde el navegador por lo de siempre: así la URL del
 * despliegue —que es lo único que hace falta para escribir en la hoja— no sale
 * en el código del cliente.
 *
 * **Si el .gs no está pegado todavía**, la hoja no reconoce la acción y
 * contesta cualquier cosa menos lo esperado. Eso se traduce aquí en un mensaje
 * que dice qué falta, en vez de un 500 mudo.
 */

import { NextRequest } from "next/server";

import { llamaScript } from "@/lib/appsScript";

export const dynamic = "force-dynamic";

/* Un microciclo son unas veinte filas: la hoja tarda lo suyo en clonarlas. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cuerpo = (await request.json().catch(() => ({}))) as {
    accion?: string;
    temporada?: string;
    micro?: number;
    rival?: string;
    reemplazar?: boolean;
    filas?: Record<string, string | number>[];
  };

  const micro = Number(cuerpo.micro);

  if (!Number.isFinite(micro) || micro <= 0) {
    return Response.json(
      { ok: false, error: "Falta el número de microciclo." },
      { status: 400 },
    );
  }

  if (cuerpo.accion === "filas") {
    return llamaScript("registroFilas", { temporada: cuerpo.temporada, micro });
  }

  if (!Array.isArray(cuerpo.filas) || cuerpo.filas.length === 0) {
    return Response.json(
      { ok: false, error: "No hay ninguna fila que escribir." },
      { status: 400 },
    );
  }

  return llamaScript("registroGuardar", {
    temporada: cuerpo.temporada ?? "",
    micro,
    rival: cuerpo.rival ?? "",
    reemplazar: Boolean(cuerpo.reemplazar),
    filas: cuerpo.filas,
  });
}
