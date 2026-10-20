/**
 * LEER EL LABORATORIO DE ABP.
 *
 * Sólo el administrador: el laboratorio es suyo mientras no se abra a la
 * plantilla. Por eso `/api/docs` tiene la clave vetada y la lectura va por
 * aquí, con la cookie de administrador mirada en el servidor.
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { readDoc } from "@/lib/docStore";
import { CLAVE_LAB, normaliza } from "@/lib/abp-lab/modelo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: false, error: "Entra como administrador desde Ajustes." }, { status: 401 });
  }

  try {
    const leido = await readDoc(CLAVE_LAB);

    return NextResponse.json({ ok: true, updatedAt: leido.updatedAt, doc: normaliza(leido.data) });
  } catch (error) {
    console.error("[abp-lab] leer", error);

    return NextResponse.json({ ok: false, error: "No se ha podido leer el laboratorio." }, { status: 503 });
  }
}
