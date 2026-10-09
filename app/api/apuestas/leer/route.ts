/**
 * LEER LAS APUESTAS DEL STAFF.
 *
 * Van enteras y para todos: una apuesta es pública desde que se lanza, y la
 * gracia está justo en ver quién se moja con quién. Lo único que se añade es
 * quién ha entrado (`yo`), que sale de la cookie de la quiniela.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc } from "@/lib/docStore";
import { CLAVE_APUESTAS, normaliza } from "@/lib/apuestas/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const yo = leeSesion(request.cookies.get(COOKIE)?.value);

  try {
    const leido = await readDoc(CLAVE_APUESTAS);

    return NextResponse.json({
      ok: true,
      yo,
      updatedAt: leido.updatedAt,
      doc: normaliza(leido.data),
    });
  } catch (error) {
    console.error("[apuestas] leer", error);

    return NextResponse.json(
      { ok: false, error: "No se han podido leer las apuestas." },
      { status: 503 },
    );
  }
}
