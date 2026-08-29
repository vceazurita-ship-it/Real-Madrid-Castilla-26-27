import { NextRequest, NextResponse } from "next/server";

import {
  credenciales,
  dameCanal,
  guardaAjustes,
  leeAjustes,
  urlDeVuelta,
} from "@/lib/coding/youtube";

/**
 * La vuelta de Google: se cambia el código por el token y se guarda la cuenta.
 *
 * Termina siempre en `/coding` con un `?youtube=` que la pantalla traduce a un
 * aviso. Devolver aquí un JSON dejaría al analista mirando un texto en crudo
 * en una pestaña en blanco, que es exactamente donde no tiene que acabar.
 *
 * Lo que se guarda es el `refresh_token` y el nombre del canal. **La lista de
 * reproducción y la privacidad que hubiera puestas se respetan**: reconectar
 * la cuenta —porque caducó el permiso— no puede llevarse por delante la
 * configuración del cuerpo técnico.
 */
export async function GET(request: NextRequest) {
  const vuelta = new URL("/coding", request.url);

  const acaba = (resultado: string) => {
    vuelta.searchParams.set("youtube", resultado);

    const respuesta = NextResponse.redirect(vuelta);

    respuesta.cookies.delete("youtube_state");

    return respuesta;
  };

  const codigo = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  /* El analista le ha dado a «Cancelar» en la pantalla de Google. */
  if (request.nextUrl.searchParams.get("error")) return acaba("cancelado");

  if (!codigo) return acaba("sin-codigo");

  if (!state || state !== request.cookies.get("youtube_state")?.value) {
    return acaba("state");
  }

  const { id, secreto, hay } = credenciales();

  if (!hay) return acaba("sin-credenciales");

  try {
    const respuesta = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secreto,
        code: codigo,
        grant_type: "authorization_code",
        redirect_uri: urlDeVuelta(request),
      }),
    });

    const datos = (await respuesta.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
    } | null;

    if (!respuesta.ok || !datos?.access_token) return acaba("token");

    /*
    | Sin `refresh_token` no se guarda nada.
    |
    | Google lo manda con `prompt=consent`, pero si algún día no llega, dejar
    | la cuenta «conectada» con sólo el token de una hora sería peor que no
    | conectarla: funcionaría esta tarde y fallaría mañana sin motivo visible.
    */
    if (!datos.refresh_token) return acaba("sin-refresco");

    const canal = await dameCanal(datos.access_token);

    const anteriores = await leeAjustes();

    /* Cambiar de canal deja la lista de antes sin sentido: era de otro canal. */
    const mismoCanal = anteriores.canalId === canal.id;

    await guardaAjustes({
      ...anteriores,
      refreshToken: datos.refresh_token,
      canalId: canal.id,
      canalTitulo: canal.titulo,
      listaId: mismoCanal ? anteriores.listaId : "",
      listaNombre: mismoCanal ? anteriores.listaNombre : "",
      conectadoEn: new Date().toISOString(),
    });

    return acaba("ok");
  } catch (error) {
    console.error("[youtube] callback", error);

    return acaba("fallo");
  }
}
