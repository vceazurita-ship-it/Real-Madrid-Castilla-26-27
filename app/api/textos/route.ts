/**
 * ¿SE ENSEÑAN LOS TEXTOS EXPLICATIVOS?
 *
 * En los análisis de ABP, saques de banda, faltas y transiciones, los textos
 * que cuentan cómo se ha hecho el análisis van escondidos salvo que el
 * administrador los encienda desde Ajustes (02/10/2026). Las conclusiones se
 * ven siempre.
 *
 *   GET  → { explicativos: boolean }     (lo lee cualquiera)
 *   POST { explicativos } → lo cambia     (sólo el administrador)
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { readDoc, writeDoc } from "@/lib/docStore";

export const dynamic = "force-dynamic";

const CLAVE = "ajustes:textos";

type Textos = { explicativos?: boolean };

export async function GET() {
  try {
    const { data } = await readDoc<Textos>(CLAVE);

    return NextResponse.json({ ok: true, explicativos: Boolean(data?.explicativos) });
  } catch {
    /* Sin poder leerlo, lo de por defecto: escondidos. */
    return NextResponse.json({ ok: true, explicativos: false });
  }
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: false, error: "Sólo el administrador." }, { status: 403 });
  }

  const cuerpo = (await request.json().catch(() => ({}))) as Textos;

  const explicativos = Boolean(cuerpo.explicativos);

  try {
    await writeDoc(CLAVE, "ajustes", { explicativos });

    return NextResponse.json({ ok: true, explicativos });
  } catch (error) {
    console.error("[textos] guardar", error);

    return NextResponse.json({ ok: false, error: "No se ha podido guardar." }, { status: 503 });
  }
}
