import { NextRequest, NextResponse } from "next/server";

import {
  dameAcceso,
  dameListas,
  dameVideosDeLista,
  leeAjustes,
} from "@/lib/coding/youtube";

/**
 * Los vídeos del canal, para verlos desde el scouting individual del rival.
 *
 * - `GET` sin nada: las listas de reproducción del canal. Una por rival.
 * - `GET ?lista=<id>`: los vídeos de esa lista.
 *
 * Va por el servidor porque **el token no puede salir al navegador**: el
 * `refresh_token` vive en `secreto:youtube` y `/api/docs` ya no sirve ese
 * prefijo. Aquí sólo salen títulos, miniaturas y los ids de los vídeos, que son
 * públicos en cuanto el vídeo está subido.
 *
 * Si la cuenta no está conectada contesta `ok: true` con `conectado: false`, no
 * un error: la pantalla tiene que poder explicar qué falta en vez de enseñar un
 * fallo rojo a alguien que no ha conectado nada todavía.
 */

export const dynamic = "force-dynamic";

/* Una lista de un rival puede tener doscientos cortes de media temporada. */
export const maxDuration = 60;

export async function GET(peticion: NextRequest) {
  const ajustes = await leeAjustes();

  if (!ajustes.refreshToken) {
    return NextResponse.json({
      ok: true,
      conectado: false,
      aviso:
        "No hay ninguna cuenta de YouTube conectada. Se conecta desde el coding, en el panel de YouTube.",
    });
  }

  try {
    const acceso = await dameAcceso(ajustes);

    const lista = peticion.nextUrl.searchParams.get("lista");

    if (!lista) {
      return NextResponse.json({
        ok: true,
        conectado: true,
        canal: ajustes.canalTitulo,
        listas: await dameListas(acceso),
      });
    }

    return NextResponse.json({
      ok: true,
      conectado: true,
      canal: ajustes.canalTitulo,
      videos: await dameVideosDeLista(acceso, lista),
    });
  } catch (error) {
    console.error("[youtube/videos]", error);

    return NextResponse.json({
      ok: true,
      conectado: false,
      aviso:
        error instanceof Error
          ? error.message
          : "La cuenta de YouTube ya no responde.",
    });
  }
}
