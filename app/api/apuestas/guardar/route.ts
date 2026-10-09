/**
 * GUARDAR EN LAS APUESTAS DEL STAFF.
 *
 * Todo lo que se escribe en el documento `apuestas-staff` pasa por aquí, y
 * sólo por aquí: `/api/docs` se niega a escribir esa clave. Los motivos son
 * los de la quiniela: quién eres lo dice la cookie y no el navegador, y nadie
 * pisa a nadie porque cada acción lee el documento del momento, cambia sólo
 * su trozo y lo escribe con `cambiaDoc` (un UPDATE condicionado al
 * `updated_at` leído; si otro escribió en medio, se relee y se repite).
 *
 * Las reglas —qué se puede hacer y cuándo— están en `lib/apuestas/modelo.ts`
 * (`aplica`); aquí sólo se convierte su `Rechazo` en respuesta.
 */

import { NextRequest, NextResponse } from "next/server";

import { cambiaDoc } from "@/lib/docStore";
import { CLAVE_APUESTAS, Rechazo, aplica, esDelStaff } from "@/lib/apuestas/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";

export const dynamic = "force-dynamic";

const mal = (error: string, estado = 400) =>
  NextResponse.json({ ok: false, error }, { status: estado });

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!esDelStaff(slug)) return mal("Entra con tu correo para poder apostar.", 401);

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }

  const accion = String(cuerpo.accion ?? "");

  try {
    const doc = await cambiaDoc(CLAVE_APUESTAS, "apuestas-staff", (actual) =>
      aplica(actual, accion, cuerpo, slug),
    );

    return NextResponse.json({ ok: true, doc });
  } catch (error) {
    if (error instanceof Rechazo) return mal(error.message, error.estado);

    console.error("[apuestas] guardar", error);

    return mal("No se ha podido guardar. Inténtalo en un momento.", 503);
  }
}
