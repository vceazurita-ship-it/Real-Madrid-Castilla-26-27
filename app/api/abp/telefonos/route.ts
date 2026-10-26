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

  if (!/^[\w-]{1,40}$/.test(playerId) || (telefono && !esTelefono(telefono))) {
    return NextResponse.json({ ok: false, error: "Teléfono no válido." }, { status: 400 });
  }

  /*
  | Leer, cambiar uno y escribir el mapa entero: dos guardados casi a la vez
  | se pisarían. Se escribe «sobre» la versión leída y, si otro ha escrito
  | entre medias, se vuelve a leer y a aplicar (hasta tres veces).
  */
  for (let intento = 0; intento < 3; intento += 1) {
    const leido = await readDoc<Telefonos>(CLAVE);

    if (leido.missingTable) {
      return NextResponse.json({ ok: false, error: "El almacén no está disponible." }, { status: 500 });
    }

    const telefonos: Telefonos = { ...(leido.data ?? {}) };

    if (telefono) telefonos[playerId] = normalizaTelefono(telefono);
    else delete telefonos[playerId];

    const escrito = await writeDoc(CLAVE, "telefonos-jugadores", telefonos, leido.updatedAt ?? null);

    if (escrito.missingTable) {
      return NextResponse.json({ ok: false, error: "El almacén no está disponible." }, { status: 500 });
    }

    if (!escrito.conflicto) return NextResponse.json({ ok: true, telefonos });
  }

  return NextResponse.json({ ok: false, error: "Otro guardado a la vez: vuelve a intentarlo." }, { status: 409 });
}
