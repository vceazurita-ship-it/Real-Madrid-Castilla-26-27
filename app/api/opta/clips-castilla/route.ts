/**
 * LOS CLIPS DE NUESTROS JUGADORES, PARTIDO A PARTIDO (26/11/2026).
 *
 *   GET   el documento `opta:clips-castilla` (los partidos, del último hacia atrás)
 *
 * Sólo el administrador. Lo escribe scripts/opta-clips-castilla.mjs tras cada
 * partido (lib/opta-clips-castilla.ts). Lo nuevo se ve sin publicar: la
 * página lee el documento en cada visita.
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { readDoc } from "@/lib/docStore";
import { CLAVE_CLIPS_CASTILLA, normalizaClipsCastilla } from "@/lib/opta-clips-castilla";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: false, error: "Entra como administrador." }, { status: 401 });
  }

  try {
    const leido = await readDoc(CLAVE_CLIPS_CASTILLA);
    return NextResponse.json({ ok: true, doc: normalizaClipsCastilla(leido.data) });
  } catch (error) {
    console.error("[opta] clips-castilla", error);
    return NextResponse.json({ ok: false, error: "No se han podido leer los clips de los nuestros." }, { status: 503 });
  }
}
