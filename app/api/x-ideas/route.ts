/**
 * /api/x-ideas (12/11/2026): las ideas para la app sacadas de las
 * publicaciones de @fernandosb9 en X, y sus botones. Sólo el administrador,
 * como el resto de Ajustes.
 *
 * - GET: cómo fue la última lectura de X y la lista de ideas.
 * - POST `{ id, accion }`: «añadir» y «deshacer» ponen la idea en la cola de
 *   `x:ideas` y piden el encargo `x-idea` al vigía del ordenador del club;
 *   «descartar» y «recuperar» sólo cambian su estado.
 *
 * Las reglas de qué se puede hacer en cada estado están en `lib/x-ideas.ts`.
 */
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { cambiaDoc, readDoc } from "@/lib/docStore";
import { pideEncargo } from "@/lib/mantenimientoServidor";
import {
  ACCIONES_IDEA,
  CLAVE_X_IDEAS,
  CLAVE_X_LECTURA,
  aplicaAccion,
  normalizaIdeas,
  normalizaLectura,
  ordenaIdeas,
  type AccionIdea,
  type DocIdeas,
} from "@/lib/x-ideas";

export const dynamic = "force-dynamic";

const soloAdmin = () => NextResponse.json({ ok: false, error: "Sólo el administrador. Entra en Ajustes con su usuario." }, { status: 403 });

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return soloAdmin();

  try {
    const [lectura, ideas] = await Promise.all([readDoc(CLAVE_X_LECTURA), readDoc(CLAVE_X_IDEAS)]);
    const leida = normalizaLectura(lectura.data);

    return NextResponse.json(
      {
        ok: true,
        /* Los ids vistos no le hacen falta a la pantalla. */
        lectura: leida ? { ...leida, vistos: undefined } : null,
        ideas: ordenaIdeas(normalizaIdeas(ideas.data).ideas),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[x-ideas] leer", error);

    return NextResponse.json({ ok: false, error: "No se ha podido leer." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return soloAdmin();

  const cuerpo = (await request.json().catch(() => ({}))) as { id?: unknown; accion?: unknown };
  const id = typeof cuerpo.id === "string" ? cuerpo.id.slice(0, 80) : "";
  const accion = cuerpo.accion as AccionIdea;

  if (!id || !ACCIONES_IDEA.includes(accion)) {
    return NextResponse.json({ ok: false, error: "Falta la idea o el botón." }, { status: 400 });
  }

  let error = "";
  let encargo = false;

  try {
    /* Lo que no se puede, se contesta sin escribir nada. */
    const previo = aplicaAccion(normalizaIdeas((await readDoc(CLAVE_X_IDEAS)).data), id, accion, "victor-cea", new Date().toISOString());

    if ("error" in previo) return NextResponse.json({ ok: false, error: previo.error }, { status: 409 });

    /* Escritura condicional: el ordenador del club escribe en el mismo documento. */
    const doc = await cambiaDoc<DocIdeas>(CLAVE_X_IDEAS, "x", (actual) => {
      const actualizado = normalizaIdeas(actual);
      const hecho = aplicaAccion(actualizado, id, accion, "victor-cea", new Date().toISOString());

      if ("error" in hecho) {
        error = hecho.error;

        return actualizado;
      }

      error = "";
      encargo = hecho.encargo;

      return hecho.doc;
    });

    if (error) return NextResponse.json({ ok: false, error }, { status: 409 });

    if (encargo) await pideEncargo("x-idea", "victor-cea");

    return NextResponse.json({ ok: true, ideas: ordenaIdeas(doc.ideas) });
  } catch (e) {
    console.error("[x-ideas] botón", e);

    return NextResponse.json({ ok: false, error: "No se ha podido guardar. Inténtalo otra vez." }, { status: 503 });
  }
}
