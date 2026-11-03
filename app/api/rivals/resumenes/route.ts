import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { leeResumenesRfef } from "@/lib/rivals/resumenes-rfef-servidor";

/*
| GET /api/rivals/resumenes → los resúmenes oficiales de Primera Federación de
| la temporada, del canal de YouTube de la RFEF (03/11/2026).
|
| Nunca se lee YouTube en cada visita: la lectura (de 5 a 25 peticiones
| seguidas, según lo avanzada que vaya la temporada) se guarda seis horas en
| la caché de datos de Next y, pasadas, se sirve la anterior mientras se rehace
| por detrás. Un fallo de YouTube no se guarda (la función lanza) y la caché
| sigue con la última lectura buena; si no hay ninguna, la ruta contesta
| `ok: false` y la ficha del rival no enseña el bloque.
|
| Encima, la caché de Vercel: la respuesta es la misma para todo el mundo.
*/

export const maxDuration = 60;

const SEIS_HORAS = 6 * 60 * 60;

const leeConCache = unstable_cache(async () => leeResumenesRfef(), ["rivals-resumenes-rfef-v1"], {
  revalidate: SEIS_HORAS,
  tags: ["rivals-resumenes-rfef"],
});

export async function GET() {
  try {
    const videos = await leeConCache();

    return NextResponse.json(
      { ok: true, videos },
      { headers: { "Cache-Control": `public, s-maxage=${SEIS_HORAS}, stale-while-revalidate=86400` } },
    );
  } catch (error) {
    console.error("[rivals/resumenes]", error);

    return NextResponse.json(
      { ok: false, error: "No se han podido leer los resúmenes." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
