/**
 * LOS ENCARGOS AL ORDENADOR DEL CLUB.
 *
 * Hay cosas que **no puede hacer el servidor**: BeSoccer contesta con una
 * página vacía a las IP de centro de datos, y Wyscout sólo se baja manejando un
 * Chrome con la sesión del club. Eso lo hace el ordenador del club.
 *
 * Así que los botones de Ajustes no ejecutan nada aquí: **dejan un encargo**
 * (`quiniela`, `rivales` o `wyscout`). El vigía de ese ordenador
 * (`scripts/vigia.cjs`) mira cada pocos segundos, lo hace, y apunta cuándo
 * empezó, cuándo acabó y cómo fue. La pantalla lo va leyendo de aquí, junto con
 * el latido del vigía: si lleva minutos sin dar señal, el ordenador está
 * apagado y se dice.
 */

import { NextRequest, NextResponse } from "next/server";

import { esTarea } from "@/lib/mantenimiento";
import { leeMantenimiento, pideEncargo } from "@/lib/mantenimientoServidor";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await leeMantenimiento()) });
  } catch (error) {
    console.error("[mantenimiento] leer", error);

    return NextResponse.json({ ok: false, error: "No se ha podido leer." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug || !PERSONA_POR_SLUG.has(slug)) {
    return NextResponse.json(
      { ok: false, error: "Entra con tu correo para poder pedirlo." },
      { status: 401 },
    );
  }

  /* Sin cuerpo es el encargo de siempre, el de los rivales. */
  const cuerpo = (await request.json().catch(() => ({}))) as { tarea?: unknown };

  const tarea = cuerpo.tarea ?? "rivales";

  if (!esTarea(tarea)) {
    return NextResponse.json({ ok: false, error: "No sé qué hay que hacer." }, { status: 400 });
  }

  try {
    const estado = await pideEncargo(tarea, slug);

    return NextResponse.json({ ok: true, estado });
  } catch (error) {
    console.error("[mantenimiento] pedir", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido dejar el encargo." },
      { status: 503 },
    );
  }
}
