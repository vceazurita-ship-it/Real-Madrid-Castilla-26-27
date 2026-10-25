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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** 4 MB de base64 (~3 MB de PNG): sobra para la lámina y cabe en Gmail. */
const MAX_BASE64 = 4 * 1024 * 1024;

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

  const imagen = String(cuerpo.imagen ?? "");

  if (!imagen || imagen.length > MAX_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imagen)) {
    return mal("La imagen no es válida o pesa demasiado.");
  }

  if (!Buffer.from(imagen.slice(0, 16), "base64").subarray(0, 4).equals(PNG)) return mal("La imagen tiene que ser un PNG.");

  const { data: cuentas }= await readDoc<DocumentoCuentas>(CLAVE_CUENTAS);
  const cuenta = (cuentas?.cuentas ?? CUENTAS_VACIAS.cuentas)[slug];

  if (!cuenta?.correo) return mal("Tu cuenta no tiene correo.", 404);

  const { data } = await readDoc<DocumentoQuiniela>("quiniela");
  const signos = (data ?? QUINIELA_VACIA).jornadas?.[String(jornada)]?.pronosticos?.[slug] ?? [];

  if (!signos.some(Boolean)) return mal("Guarda primero tu apuesta de esa jornada.");

  const nombre = PERSONA_POR_SLUG.get(slug)?.nombre ?? slug;
  const cid = "quiniela-lamina";
  const archivo = `mi-quiniela-jornada-${jornada}.png`;

  const html = `<div style="margin:0;padding:24px 12px;background:#0A0A0B;font-family:Arial,Helvetica,sans-serif;text-align:center">
<div style="max-width:480px;margin:0 auto">
<div style="color:#C8A96B;font-size:12px;letter-spacing:4px;text-transform:uppercase;padding-bottom:6px">Real Madrid Castilla</div>
<div style="color:#F4F1EA;font-size:22px;font-weight:bold;padding-bottom:16px">Tu quiniela · Jornada ${jornada}</div>
<img src="cid:${cid}" alt="Tu quiniela, jornada ${jornada}" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0;border-radius:12px">
<div style="color:#8F8A7E;font-size:12px;padding-top:16px">La imagen también va adjunta para guardarla o reenviarla.</div>
</div></div>`;

  await envia({
    para: [cuenta.correo],
    asunto: `Tu quiniela · Jornada ${jornada}`,
    html,
    texto: textoDeMisPronosticos(jornada, nombre, signos),
    adjuntos: [
      { nombre: archivo, tipo: "image/png", base64: imagen, cid },
      { nombre: archivo, tipo: "image/png", base64: imagen },
    ],
  });

  return NextResponse.json({ ok: true });
}
