import { NextRequest, NextResponse } from "next/server";

import { readDoc, writeDoc } from "@/lib/docStore";
import { puedeMandar } from "@/lib/correo/peticionInforme";
import { esTelefono, normalizaTelefono } from "@/lib/correo/whatsapp";

/**
 * Los móviles de los jugadores, para mandarles su PDF de balón parado por
 * WhatsApp con un toque (26/10/2026).
 *
 * Son datos personales: van en una clave `secreto:` —que `/api/docs` no sirve
 * a nadie— y sólo se leen y escriben aquí, con la sesión del cuerpo técnico.
 */
const CLAVE = "secreto:telefonos-jugadores";

type Telefonos = Record<string, string>;

export async function GET(request: NextRequest) {
  if (!puedeMandar(request)) {
    return NextResponse.json({ ok: false, error: "Entra con tu cuenta del cuerpo técnico." }, { status: 401 });
  }

  const { data } = await readDoc<Telefonos>(CLAVE);

  return NextResponse.json({ ok: true, telefonos: data ?? {} });
}

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) {
    return NextResponse.json({ ok: false, error: "Entra con tu cuenta del cuerpo técnico." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { playerId?: string; telefono?: string } | null;
  const playerId = String(body?.playerId ?? "").trim();
  const telefono = String(body?.telefono ?? "").trim();

  if (!playerId || (telefono && !esTelefono(telefono))) {
    return NextResponse.json({ ok: false, error: "Teléfono no válido." }, { status: 400 });
  }

  const { data } = await readDoc<Telefonos>(CLAVE);
  const telefonos: Telefonos = { ...(data ?? {}) };

  if (telefono) telefonos[playerId] = normalizaTelefono(telefono);
  else delete telefonos[playerId];

  await writeDoc(CLAVE, "telefonos-jugadores", telefonos);

  return NextResponse.json({ ok: true, telefonos });
}
