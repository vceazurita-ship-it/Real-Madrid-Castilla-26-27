/**
 * EL VÍDEO DE CADA JUGADOR RIVAL POR SUS FORTALEZAS (24/11/2026).
 *
 *   GET   el documento `opta:clips-jugador` entero
 *
 * Sólo el administrador («en una sección que sólo vea yo»). Lo escribe cada
 * noche scripts/opta-clips-jugador.mjs (lib/opta-clips-jugador.ts).
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { readDoc } from "@/lib/docStore";
import { CLAVE_CLIPS_JUGADOR, normalizaClipsJugador } from "@/lib/opta-clips-jugador";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: false, error: "Entra como administrador." }, { status: 401 });
  }

  try {
    const leido = await readDoc(CLAVE_CLIPS_JUGADOR);
    return NextResponse.json({ ok: true, doc: normalizaClipsJugador(leido.data) });
  } catch (error) {
    console.error("[opta] clips-jugador", error);
    return NextResponse.json({ ok: false, error: "No se han podido leer los vídeos de los jugadores rivales." }, { status: 503 });
  }
}
