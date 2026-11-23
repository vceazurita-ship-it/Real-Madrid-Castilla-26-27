/**
 * ANÁLISIS EXTERNOS DEL LABORATORIO DE ABP (23/11/2026).
 *
 *   GET                 el documento entero (la sección «Análisis externos»)
 *   GET ?resumen=1      sólo cuántos hay sin ver y el último (el aviso de toda la app)
 *   POST {accion:"visto"}  el analista lo ha visto: lo de antes deja de ser «nuevo»
 *
 * Sólo el administrador, como el resto del laboratorio. Lo escribe cada mañana
 * scripts/abp-externos.mjs (lib/abp-lab/externos.ts).
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { cambiaDoc, readDoc } from "@/lib/docStore";
import { CLAVE_EXTERNOS, normalizaExternos, nuevosDe, ordenaExternos } from "@/lib/abp-lab/externos";

export const dynamic = "force-dynamic";

const sinPermiso = () => NextResponse.json({ ok: false, error: "Entra como administrador desde Ajustes." }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return sinPermiso();

  try {
    const leido = await readDoc(CLAVE_EXTERNOS);
    const doc = normalizaExternos(leido.data);

    if (request.nextUrl.searchParams.get("resumen") === "1") {
      const nuevos = ordenaExternos(nuevosDe(doc));
      return NextResponse.json({
        ok: true,
        nuevos: nuevos.length,
        ultimo: nuevos[0] ? { id: nuevos[0].id, titulo: nuevos[0].analisis?.titulo ?? "", cuenta: nuevos[0].cuenta, llegoEn: nuevos[0].llegoEn } : null,
      });
    }

    return NextResponse.json({ ok: true, updatedAt: leido.updatedAt, doc: { ...doc, items: ordenaExternos(doc.items) } });
  } catch (error) {
    console.error("[abp-lab] externos", error);
    return NextResponse.json({ ok: false, error: "No se han podido leer los análisis externos." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return sinPermiso();

  const cuerpo = (await request.json().catch(() => null)) as { accion?: string } | null;
  if (cuerpo?.accion !== "visto") return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });

  try {
    const ahora = new Date().toISOString();
    await cambiaDoc(CLAVE_EXTERNOS, "abp", (crudo) => ({ ...normalizaExternos(crudo), vistoHasta: ahora }));
    return NextResponse.json({ ok: true, vistoHasta: ahora });
  } catch (error) {
    console.error("[abp-lab] externos visto", error);
    return NextResponse.json({ ok: false, error: "No se ha podido apuntar." }, { status: 503 });
  }
}
