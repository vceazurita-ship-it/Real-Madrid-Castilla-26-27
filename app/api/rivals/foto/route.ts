import { NextRequest, NextResponse } from "next/server";

/*
|--------------------------------------------------------------------------
| FOTO DEL JUGADOR RIVAL, SERVIDA DESDE AQUÍ
|--------------------------------------------------------------------------
|
| El PDF del once lleva la foto de cada jugador, y para meterla en el documento
| hay que leer sus píxeles en el navegador. Las fotos de los rivales son de
| BeSoccer (`cdn.resfu.com`) y ese CDN **no** manda `Access-Control-Allow-Origin`:
| el `<canvas>` donde se leen queda contaminado y `toDataURL()` revienta. Por
| eso la imagen se pide aquí, se descarga en el servidor —donde no hay CORS que
| valga— y sale por el mismo origen que la app.
|
| Es un proxy de imágenes, así que va con lista de dominios permitidos: sin
| ella cualquiera podría usar la app para pedir URLs internas de la red donde
| esté desplegada.
*/

/** Dominios de los que salen las fotos de las fichas. */
const DOMINIOS = [
  "cdn.resfu.com",
  "besoccer.com",
  "assets.realmadrid.com",
  "supabase.co",
];

function permitido(url: URL) {
  if (url.protocol !== "https:") return false;

  return DOMINIOS.some(
    (dominio) => url.hostname === dominio || url.hostname.endsWith(`.${dominio}`),
  );
}

export async function GET(request: NextRequest) {
  const bruto = request.nextUrl.searchParams.get("url") ?? "";

  let destino: URL;

  try {
    destino = new URL(bruto);
  } catch {
    return NextResponse.json(
      { success: false, error: "URL no válida." },
      { status: 400 },
    );
  }

  if (!permitido(destino)) {
    return NextResponse.json(
      { success: false, error: "Dominio no permitido." },
      { status: 403 },
    );
  }

  try {
    const respuesta = await fetch(destino, {
      /* La foto de un jugador cambia una vez por temporada; el PDF se genera
         varias veces la misma semana. */
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!respuesta.ok) {
      return NextResponse.json(
        { success: false, error: `El origen respondió ${respuesta.status}.` },
        { status: 502 },
      );
    }

    const tipo = respuesta.headers.get("content-type") ?? "";

    /* Un 404 disfrazado de página HTML no puede colarse como imagen. */
    if (!tipo.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "El origen no ha devuelto una imagen." },
        { status: 502 },
      );
    }

    return new NextResponse(await respuesta.arrayBuffer(), {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error GET /api/rivals/foto:", error);

    return NextResponse.json(
      { success: false, error: "No se ha podido descargar la foto." },
      { status: 502 },
    );
  }
}
