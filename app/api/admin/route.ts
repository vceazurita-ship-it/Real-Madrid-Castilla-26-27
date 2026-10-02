/**
 * ENTRAR Y SALIR COMO ADMINISTRADOR (la puerta de Ajustes).
 *
 *   GET    → { admin: true | false }
 *   POST   { email, contrasena } → entra (cookie `admin_sesion`, 12 h)
 *   DELETE → sale
 *
 * Ver `lib/admin/sesion.ts`.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  COOKIE_ADMIN,
  OPCIONES_COOKIE_ADMIN,
  creaSesionAdmin,
  credencialesValidas,
  esAdmin,
} from "@/lib/admin/sesion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({ ok: true, admin: esAdmin(request.cookies.get(COOKIE_ADMIN)?.value) });
}

export async function POST(request: NextRequest) {
  const cuerpo = (await request.json().catch(() => ({}))) as { email?: unknown; contrasena?: unknown };

  const email = String(cuerpo.email ?? "");
  const contrasena = String(cuerpo.contrasena ?? "");

  if (!email || !contrasena || !credencialesValidas(email, contrasena)) {
    /* Un respiro antes de contestar: probar contraseñas a mano se hace lento. */
    await new Promise((r) => setTimeout(r, 1200));

    return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  const respuesta = NextResponse.json({ ok: true, admin: true });

  respuesta.cookies.set(COOKIE_ADMIN, creaSesionAdmin(), OPCIONES_COOKIE_ADMIN);

  return respuesta;
}

export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true, admin: false });

  respuesta.cookies.set(COOKIE_ADMIN, "", { ...OPCIONES_COOKIE_ADMIN, maxAge: 0 });

  return respuesta;
}
