import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { leeAjustes } from "@/lib/coding/youtube";
import { compruebaGoogle, type SaludGoogle } from "@/lib/correo/salud-google";

/**
 * ¿Sigue viva la conexión con Google? (02/11/2026)
 *
 *   GET → { ok, admin, salud?: SaludGoogle }
 *
 * La pregunta la hace el aviso de la portada (`AvisoConexionGoogle`), sólo
 * para el administrador: es quien puede volver a conectar la cuenta del club.
 * No manda nada; canjea el token como haría un envío. Ver
 * `lib/correo/salud-google.ts`.
 *
 * **Se recuerda un rato** para que abrir la portada no sea una llamada a
 * Google cada vez: diez minutos si va bien, dos si no. Se vuelve a preguntar
 * en cuanto cambia la cuenta conectada (`conectadoEn`), que es lo que pasa al
 * reconectar: el aviso se va solo al volver a la portada.
 */

export const dynamic = "force-dynamic";

let recuerdo: { clave: string; hasta: number; salud: SaludGoogle } | null = null;

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: true, admin: false });
  }

  const ajustes = await leeAjustes();

  const clave = `${ajustes.conectadoEn}|${ajustes.refreshToken.length}`;

  const ahora = Date.now();

  if (!recuerdo || recuerdo.clave !== clave || recuerdo.hasta < ahora) {
    const salud = await compruebaGoogle({ lee: async () => ajustes, ahora });

    recuerdo = { clave, hasta: ahora + (salud.estado === "ok" ? 10 : 2) * 60_000, salud };
  }

  return NextResponse.json(
    { ok: true, admin: true, salud: recuerdo.salud },
    { headers: { "Cache-Control": "no-store" } },
  );
}
