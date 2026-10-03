/**
 * MANDAR UN INFORME POR CORREO (el del partido, el de ABP…).
 *
 * El informe llega escrito desde el navegador; aquí sólo se comprueba quién lo
 * pide y se manda con la cuenta de Google del club. Ver
 * `lib/correo/peticionInforme.ts`.
 */

import { NextRequest, NextResponse } from "next/server";

import { envia } from "@/lib/correo/gmail";
import { leePeticionInforme, puedeMandar } from "@/lib/correo/peticionInforme";

export const dynamic = "force-dynamic";

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

  try {
    const { id, cuenta } = await envia(correo);

    return NextResponse.json({ ok: true, id, cuenta, para: correo.para });
  } catch (error) {
    console.error("[informe] por correo", error);

    return mal(error instanceof Error ? error.message : "No se ha podido enviar el informe.", 500);
  }
}
