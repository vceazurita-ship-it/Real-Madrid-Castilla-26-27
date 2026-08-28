/**
 * Hablar con el Apps Script de la hoja desde una ruta del servidor.
 *
 * Las cinco rutas cortas que hacían de puente —dar de alta un jugador, buscarlo
 * por nombre, guardar un alias, cambiar el estado— repetían el mismo bloque y
 * ninguna miraba qué contestaba la hoja. Eso importa aquí más que en otro sitio:
 * **Apps Script no responde JSON cuando algo va mal**. Devuelve una página HTML
 * de error, y a veces con un 200 limpio, así que `response.json()` reventaba y
 * la petición moría con un 500 sin explicación. Quien llamaba no se enteraba de
 * qué había pasado.
 *
 * Con esto, un fallo de la hoja llega al navegador como `{ ok: false, error }`,
 * que es algo que la pantalla puede enseñar.
 */

import { explicaErrorScript } from "@/lib/appsScriptErrors";

const ORIGEN = () => process.env.APPS_SCRIPT_URL ?? process.env.NEXT_PUBLIC_API_URL;

export type RespuestaScript = { ok: false; error: string } | Record<string, unknown>;

/**
 * Manda una acción a la hoja y devuelve ya la `Response` de la ruta.
 *
 * No se registra nunca la URL del script: lleva el identificador del
 * despliegue, que es lo único que hace falta para escribir en la hoja.
 */
export async function llamaScript(
  accion: string,
  datos: Record<string, unknown> = {},
) {
  const url = ORIGEN();

  if (!url) {
    console.error(`[apps-script] ${accion}: falta APPS_SCRIPT_URL`);

    return Response.json(
      { ok: false, error: "La hoja no está configurada en el servidor" },
      { status: 500 },
    );
  }

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: accion, ...datos }),
    });

    const cuerpo = await respuesta.text();

    if (!respuesta.ok) {
      console.error(`[apps-script] ${accion}: HTTP ${respuesta.status}`);

      return Response.json(
        { ok: false, error: `La hoja respondió ${respuesta.status}` },
        { status: 502 },
      );
    }

    try {
      const leido = JSON.parse(cuerpo);

      /*
      | Un fallo dentro del script llega con `200` y su mensaje de JavaScript;
      | se traduce aquí para que la pantalla pueda enseñar qué hay que tocar.
      */
      if (leido && typeof leido === "object" && leido.error) {
        leido.error = explicaErrorScript(leido.error);
      }

      return Response.json(leido);
    } catch {
      /* Casi siempre es la página de "Authorization required" de Google. */
      console.error(`[apps-script] ${accion}: la hoja no devolvió JSON`);

      return Response.json(
        { ok: false, error: "La hoja no devolvió datos legibles" },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error(`[apps-script] ${accion}`, error);

    return Response.json(
      { ok: false, error: "No se ha podido hablar con la hoja" },
      { status: 502 },
    );
  }
}

/** El cuerpo de la petición, sin que un JSON roto tumbe la ruta. */
export async function cuerpoJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const valor = await req.json();

    return valor && typeof valor === "object" ? valor : {};
  } catch {
    return {};
  }
}
