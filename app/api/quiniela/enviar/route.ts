/**
 * MANDARME MI QUINIELA POR CORREO.
 *
 * Sólo a petición de quien ha entrado y sólo a SU correo (el de su cuenta):
 * ni el destinatario ni el texto vienen del navegador, se arman aquí con lo
 * guardado. Sale de la cuenta de Google del club (`envia`).
 */

import { NextRequest, NextResponse } from "next/server";

import { envia } from "@/lib/correo/gmail";
import { readDoc } from "@/lib/docStore";
import { CLAVE_CUENTAS, CUENTAS_VACIAS, type DocumentoCuentas } from "@/lib/quiniela/cuentas";
import { textoDeMisPronosticos } from "@/lib/quiniela/envio";
import { JORNADAS, QUINIELA_VACIA, type DocumentoQuiniela } from "@/lib/quiniela/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

const mal = (error: string, estado = 400) => NextResponse.json({ ok: false, error }, { status: estado });

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug) return mal("Entra con tu cuenta para recibir tu quiniela.", 401);

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }

  const jornada = Number(cuerpo.jornada);

  if (!JORNADAS.includes(jornada)) return mal("Esa jornada no existe.");

  const { data: cuentas } = await readDoc<DocumentoCuentas>(CLAVE_CUENTAS);
  const cuenta = (cuentas?.cuentas ?? CUENTAS_VACIAS.cuentas)[slug];

  if (!cuenta?.correo) return mal("Tu cuenta no tiene correo.", 404);

  const { data } = await readDoc<DocumentoQuiniela>("quiniela");
  const signos = (data ?? QUINIELA_VACIA).jornadas?.[String(jornada)]?.pronosticos?.[slug] ?? [];

  if (!signos.some(Boolean)) return mal("Guarda primero tu apuesta de esa jornada.");

  const nombre = PERSONA_POR_SLUG.get(slug)?.nombre ?? slug;
  const texto = textoDeMisPronosticos(jornada, nombre, signos);

  await envia({
    para: [cuenta.correo],
    asunto: `Tu quiniela · Jornada ${jornada}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">${esc(texto).replace(/\n/g, "<br>")}</div>`,
    texto,
  });

  return NextResponse.json({ ok: true });
}
