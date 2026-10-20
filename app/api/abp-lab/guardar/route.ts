/**
 * GUARDAR EN EL LABORATORIO DE ABP.
 *
 * Lo único que escribe el documento `abp-laboratorio`, y sólo con la sesión
 * de administrador. Como en las apuestas del staff: cada acción lee el
 * documento del momento, cambia su trozo y lo escribe con `cambiaDoc` (CAS
 * por `updated_at`), así dos pestañas abiertas no se pisan. Las reglas están
 * en `lib/abp-lab/modelo.ts` (`aplica`); aquí sólo se traduce su `Rechazo`.
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { cambiaDoc } from "@/lib/docStore";
import { CLAVE_LAB, Rechazo, aplica } from "@/lib/abp-lab/modelo";

export const dynamic = "force-dynamic";

const mal = (error: string, estado = 400) => NextResponse.json({ ok: false, error }, { status: estado });

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return mal("Entra como administrador desde Ajustes.", 401);

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }

  const accion = String(cuerpo.accion ?? "");

  try {
    const doc = await cambiaDoc(CLAVE_LAB, "abp-laboratorio", (actual) => aplica(actual, accion, cuerpo));

    return NextResponse.json({ ok: true, doc });
  } catch (error) {
    if (error instanceof Rechazo) return mal(error.message, error.estado);

    console.error("[abp-lab] guardar", error);

    return mal("No se ha podido guardar. Inténtalo en un momento.", 503);
  }
}
