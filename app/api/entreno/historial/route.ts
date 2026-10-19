import { NextRequest, NextResponse } from "next/server";

import { listDocs } from "@/lib/docStore";
import { puedeVerEntreno } from "@/lib/entreno/acceso";
import type { AnalisisEntreno } from "@/lib/entreno/modelo";

/**
 * TODOS LOS DÍAS ANALIZADOS, DE UNA VEZ (19/10/2026).
 *
 * La vista por jugador necesita sus objetivos de cada sesión con el análisis
 * de cada una. Pedirlos día a día por `/api/docs` eran dos peticiones por día
 * de la temporada; aquí se leen los dos prefijos (`entreno:` y
 * `entreno-analisis:`) en dos consultas. Sólo lectura: la fuente sigue siendo
 * el documento de cada día.
 *
 * Con el mismo candado que la pantalla: administrador o cuerpo técnico.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!puedeVerEntreno(request.cookies)) {
    return NextResponse.json({ ok: false, error: "Entra con tu cuenta del cuerpo técnico." }, { status: 401 });
  }

  try {
    const [sesiones, analisis] = await Promise.all([listDocs("entreno:", 400), listDocs<AnalisisEntreno>("entreno-analisis:", 400)]);
    const fecha = (clave: string) => clave.slice(clave.indexOf(":") + 1);

    return NextResponse.json({
      ok: true,
      sesiones: sesiones.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(fecha(s.key))).map((s) => ({ fecha: fecha(s.key), data: s.data })),
      analisis: analisis.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(fecha(a.key))).map((a) => ({ fecha: fecha(a.key), data: a.data })),
    });
  } catch (error) {
    console.error("[entreno/historial]", error);

    return NextResponse.json({ ok: false, error: "No se ha podido leer el historial." }, { status: 503 });
  }
}
