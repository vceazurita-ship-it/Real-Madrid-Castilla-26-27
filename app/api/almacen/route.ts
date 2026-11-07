/**
 * LO QUE OCUPA EL ALMACÉN DE SUPABASE (07/11/2026).
 *
 *   GET                  la última medida (`almacen:ocupacion`)
 *   GET ?medir=1         la mide otra vez (unos segundos)
 *   POST {accion:"barrer"}  sólo admin: borra los adjuntos de correo repetidos
 *                        o de más de 30 días y vuelve a medir
 *
 * Ver lib/almacen/ocupacion.ts.
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { AVISO, FRENO, FRENO_ACTIVO, barreAdjuntos, clienteAlmacen, mideOcupacion, ultimaOcupacion } from "@/lib/almacen/ocupacion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sb = clienteAlmacen();

  if (!sb) return NextResponse.json({ ok: false, error: "Falta la configuración de Supabase." }, { status: 500 });

  try {
    const medir = request.nextUrl.searchParams.get("medir") === "1";
    const ocupacion = medir ? await mideOcupacion(sb, true) : ((await ultimaOcupacion(sb)) ?? (await mideOcupacion(sb)));

    return NextResponse.json({ ok: true, ocupacion, aviso: AVISO, freno: FRENO, frenoActivo: FRENO_ACTIVO });
  } catch (error) {
    console.error("[almacen] GET", error);

    return NextResponse.json({ ok: false, error: "No se ha podido medir el almacén." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ ok: false, error: "Sólo el administrador puede liberar espacio." }, { status: 401 });
  }

  const sb = clienteAlmacen();

  if (!sb) return NextResponse.json({ ok: false, error: "Falta la configuración de Supabase." }, { status: 500 });

  const { accion } = ((await request.json().catch(() => ({}))) ?? {}) as { accion?: unknown };

  if (accion !== "barrer") return NextResponse.json({ ok: false, error: "No sé qué hacer." }, { status: 400 });

  try {
    const liberados = await barreAdjuntos(sb);
    const ocupacion = await mideOcupacion(sb, true);

    return NextResponse.json({ ok: true, liberados: Math.round(liberados * 10) / 10, ocupacion, aviso: AVISO, freno: FRENO, frenoActivo: FRENO_ACTIVO });
  } catch (error) {
    console.error("[almacen] barrer", error);

    return NextResponse.json({ ok: false, error: "No se ha podido liberar espacio." }, { status: 500 });
  }
}
