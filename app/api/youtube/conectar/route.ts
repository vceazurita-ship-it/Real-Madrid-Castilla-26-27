import { NextRequest, NextResponse } from "next/server";

import { PERMISOS, credenciales, urlDeVuelta } from "@/lib/coding/youtube";

/**
 * Manda al analista a dar permiso en Google.
 *
 * Se entra aquí con el navegador (un enlace, no un `fetch`): Google enseña su
 * pantalla de siempre —qué cuenta, qué permisos— y vuelve a
 * `/api/youtube/callback` con un código de un solo uso.
 *
 * `prompt=consent` y `access_type=offline` no son adorno: sin los dos, Google
 * devuelve `refresh_token` **sólo la primera vez** que esa cuenta autoriza la
 * aplicación. Al reconectar —cambiar de canal, arreglar un permiso caducado—
 * llegaría una autorización sin token de refresco, y la subida funcionaría una
 * hora y dejaría de funcionar sin que nadie hubiera tocado nada.
 */
export async function GET(request: NextRequest) {
  const { id, hay } = credenciales();

  const vuelta = new URL("/coding", request.url);

  if (!hay) {
    vuelta.searchParams.set("youtube", "sin-credenciales");

    return NextResponse.redirect(vuelta);
  }

  /*
  | El `state`, contra el enganche desde otra pestaña.
  |
  | Es un número al azar que viaja a Google y vuelve; el mismo valor queda en
  | una cookie de sesión. Si al volver no coinciden, la vuelta no la ha pedido
  | quien está delante y no se guarda nada.
  */
  const state = crypto.randomUUID();

  const destino = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  destino.searchParams.set("client_id", id);
  destino.searchParams.set("redirect_uri", urlDeVuelta(request));
  destino.searchParams.set("response_type", "code");
  destino.searchParams.set("scope", PERMISOS);
  destino.searchParams.set("access_type", "offline");
  destino.searchParams.set("prompt", "consent");
  destino.searchParams.set("include_granted_scopes", "true");
  destino.searchParams.set("state", state);

  const respuesta = NextResponse.redirect(destino);

  respuesta.cookies.set("youtube_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: request.nextUrl.protocol === "https:",
  });

  return respuesta;
}
