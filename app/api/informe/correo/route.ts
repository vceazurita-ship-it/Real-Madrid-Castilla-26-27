/**
 * MANDAR UN INFORME POR CORREO (el del partido, el de ABP…).
 *
 * El informe llega escrito desde el navegador; aquí sólo se comprueba quién lo
 * pide y se manda con la cuenta de Google del club. Ver
 * `lib/correo/peticionInforme.ts`.
 *
 * Los adjuntos grandes (el PDF o el PPT del rival) no viajan en la petición:
 * llegan como `adjuntosUrl` —ya subidos a Supabase por el navegador— y se
 * traen desde aquí.
 */

import { NextRequest, NextResponse } from "next/server";

import { envia } from "@/lib/correo/gmail";
import { leeAdjuntosUrl, leePeticionInforme, puedeMandar, traeAdjuntosUrl } from "@/lib/correo/peticionInforme";

export const dynamic = "force-dynamic";

/* Traer un PPT de 20 MB y subirlo a Gmail no cabe en los 10 s por defecto. */
export const maxDuration = 60;

const mal = (mensaje: string, estado = 400) => NextResponse.json({ ok: false, error: mensaje }, { status: estado });

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) {
    return mal("Entra con tu cuenta del cuerpo técnico (la de la quiniela) para mandar informes.", 401);
  }

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("La petición no trae datos.");
  }

  const correo = leePeticionInforme(cuerpo);

  if ("error" in correo) return mal(correo.error);

  const porUrl = leeAdjuntosUrl(cuerpo);

  if ("error" in porUrl) return mal(porUrl.error);

  /* Lo que no cabe adjunto se queda como enlace (ya va su botón en el cuerpo):
     se devuelve para que la pantalla lo diga. */
  let enlazados: string[] = [];

  try {
    const traidos = await traeAdjuntosUrl(porUrl);

    correo.adjuntos = [...(correo.adjuntos ?? []), ...traidos.adjuntos];

    enlazados = traidos.enlazados.map((x) => x.nombre);
  } catch (error) {
    return mal(error instanceof Error ? error.message : "No se han podido traer los adjuntos.");
  }

  try {
    const { id, cuenta } = await envia(correo);

    return NextResponse.json({ ok: true, id, cuenta, para: correo.para, enlazados });
  } catch (error) {
    console.error("[informe] por correo", error);

    return mal(error instanceof Error ? error.message : "No se ha podido enviar el informe.", 500);
  }
}
