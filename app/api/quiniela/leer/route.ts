/**
 * LEER LA QUINIELA, SIN ENSEÑAR LO QUE NO TOCA.
 *
 * La pantalla leía el documento por `/api/docs`, que lo sirve entero. Con eso,
 * **antes del cierre cualquiera podía ver la apuesta de los demás** con sólo
 * pedir esa dirección: el botón no lo enseñaba, pero el dato viajaba. Y ahora
 * que al cerrarse se publica la parrilla de todos, lo de antes deja de ser un
 * detalle: es la diferencia entre una apuesta y una copia.
 *
 * Así que esta ruta devuelve el mismo documento con una regla:
 *
 * - **Jornada abierta** (antes del viernes a las 12:00): van los pronósticos
 *   **de quien pregunta** y de nadie más. De los demás se manda sólo cuántos
 *   llevan puestos (`puestos`), que es lo que la pantalla necesita para decir
 *   «completa» o «3 de 9».
 * - **Jornada cerrada**: va todo. Ya no hay nada que proteger y empieza lo
 *   divertido.
 *
 * Los resultados y quién juega van siempre: no son de nadie.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc } from "@/lib/docStore";
import { estadoDe } from "@/lib/quiniela/cierre";
import { sinCastilla } from "@/lib/quiniela/migracion";
import {
  QUINIELA_VACIA,
  comoLaVe,
  type DocumentoQuiniela,
  type JornadaQuiniela,
} from "@/lib/quiniela/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";

export const dynamic = "force-dynamic";

const CLAVE_QUINIELA = "quiniela";

export async function GET(request: NextRequest) {
  const yo = leeSesion(request.cookies.get(COOKIE)?.value);

  let doc: DocumentoQuiniela;

  let updatedAt: string | null = null;

  try {
    const leido = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA);

    updatedAt = leido.updatedAt;

    doc = sinCastilla({
      ...QUINIELA_VACIA,
      ...(leido.data ?? {}),
      jornadas: leido.data?.jornadas ?? {},
      jugadores: leido.data?.jugadores ?? [],
    });
  } catch (error) {
    console.error("[quiniela] leer", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido leer la quiniela." },
      { status: 503 },
    );
  }

  const ahora = new Date();

  return NextResponse.json({
    ok: true,
    yo,
    updatedAt,
    doc: {
      ...doc,
      jornadas: Object.fromEntries(
        Object.entries(doc.jornadas).map(([clave, jornada]) => [
          clave,
          comoLaVe(jornada, yo, estadoDe(jornada.jornada, ahora).cerrada),
        ]),
      ),
    },
  });
}
