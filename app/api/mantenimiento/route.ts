/**
 * EL ENCARGO PARA EL TRABAJO NOCTURNO.
 *
 * Hay cosas que **no puede hacer el servidor**: bajar de BeSoccer los informes
 * de los rivales, sus plantillas y las fichas es media hora de trabajo y, sobre
 * todo, BeSoccer contesta 403 o 406 a las IP de centro de datos. Eso lo hace el
 * ordenador del club cada noche (`scripts/jornada-nocturna.cmd`).
 *
 * Así que el botón de Ajustes no ejecuta nada: **deja un encargo aquí**. La
 * tarea de ese ordenador se despierta cada dos horas, ve el encargo y hace la
 * pasada aunque ya la hubiera hecho hoy. Cuando termina, lo marca como hecho y
 * la pantalla lo cuenta.
 *
 * Es menos inmediato que un botón que ejecuta, y es lo honesto: lo otro sería
 * un botón que dice que sí y no hace nada.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc, writeDoc } from "@/lib/docStore";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

const CLAVE = "mantenimiento";

export type Mantenimiento = {
  /** Cuándo se pidió la última pasada, y quién. */
  pedidoEn?: string;
  pedidoPor?: string;
  /** Cuándo la terminó el ordenador del club. */
  hechoEn?: string;
  /** Cómo fue: lo escribe el propio trabajo nocturno. */
  resultado?: string;
};

async function lee(): Promise<Mantenimiento> {
  const { data } = await readDoc<Mantenimiento>(CLAVE);

  return data ?? {};
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, estado: await lee() });
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

  try {
    const estado = await lee();

    const nuevo: Mantenimiento = {
      ...estado,
      pedidoEn: new Date().toISOString(),
      pedidoPor: slug,
    };

    await writeDoc(CLAVE, "mantenimiento", nuevo);

    return NextResponse.json({ ok: true, estado: nuevo });
  } catch (error) {
    console.error("[mantenimiento] pedir", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido dejar el encargo." },
      { status: 503 },
    );
  }
}
