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
import { readDoc, writeDoc } from "@/lib/docStore";

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

/*
|--------------------------------------------------------------------------
| LECTURAS QUE NO SE ESPERAN DOS VECES
|--------------------------------------------------------------------------
|
| Apps Script tarda **entre treinta y setenta segundos** en la primera llamada
| después de un rato parado: tiene que abrir el libro. Una pantalla que sólo
| lee —la lista de tareas con alerta— se quedaba ese minuto en blanco cada vez
| que alguien entraba por la mañana, y eso no es una pantalla, es una espera.
|
| Así que una lectura se contesta con lo último bueno que se sabe y la hoja se
| pregunta por detrás:
|
|   · **En memoria** mientras viva el proceso, con un minuto de frescura.
|   · **En Supabase**, para el servidor recién levantado —que en el despliegue
|     es casi siempre—. De ahí se sirve hasta doce horas.
|
| Escribir tira las dos copias (`olvidaLectura`), que para eso lo que se acaba
| de guardar tiene que verse. Y `fresco` se salta todo, como en
| `app/api/rivals`, que hace esto mismo para las lecturas grandes de la hoja.
*/

const VIDA_FRESCA = 60_000;

const VIDA_GUARDADA = 12 * 60 * 60_000;

const PREFIJO = "cache:apps-script:";

const TIPO = "cache-apps-script";

type Copia = { data: unknown; hecha: number };

const enMemoria = new Map<string, Copia>();

const enVuelo = new Map<string, Promise<unknown>>();

/** Pregunta a la hoja de verdad y guarda lo que llegue. */
function pregunta(accion: string, datos: Record<string, unknown>) {
  const yaVa = enVuelo.get(accion);

  if (yaVa) return yaVa;

  const peticion = (async () => {
    try {
      const respuesta = await llamaScript(accion, datos);

      const leido = await respuesta.json();

      /* Un fallo no se guarda: sería enseñar el error durante doce horas. */
      if (!respuesta.ok || (leido && leido.ok === false)) return leido;

      const copia: Copia = { data: leido, hecha: Date.now() };

      enMemoria.set(accion, copia);

      void writeDoc(`${PREFIJO}${accion}`, TIPO, copia).catch(() => undefined);

      return leido;
    } finally {
      enVuelo.delete(accion);
    }
  })();

  enVuelo.set(accion, peticion);

  return peticion;
}

/**
 * Una lectura de la hoja, ya como `Response` de la ruta.
 *
 * `fresco` es para quien necesita la verdad —después de escribir— y se salta
 * las dos copias.
 */
export async function leeDeLaHoja(
  accion: string,
  opciones: { fresco?: boolean; datos?: Record<string, unknown> } = {},
) {
  const datos = opciones.datos ?? {};

  if (opciones.fresco) return Response.json(await pregunta(accion, datos));

  const guardada = enMemoria.get(accion);

  if (guardada && Date.now() - guardada.hecha < VIDA_FRESCA) {
    return Response.json(guardada.data);
  }

  if (guardada) {
    void pregunta(accion, datos).catch(() => undefined);

    return Response.json(guardada.data);
  }

  /* Nada en memoria: la copia de Supabase salva el arranque en frío. */
  try {
    const { data } = await readDoc<Copia>(`${PREFIJO}${accion}`);

    if (data && data.data != null && Date.now() - data.hecha < VIDA_GUARDADA) {
      enMemoria.set(accion, data);

      void pregunta(accion, datos).catch(() => undefined);

      return Response.json(data.data);
    }
  } catch {
    /* Sin Supabase se sigue como siempre: a la hoja. */
  }

  return Response.json(await pregunta(accion, datos));
}

/** Después de escribir, la copia miente: se tira. */
export function olvidaLectura(accion: string) {
  enMemoria.delete(accion);

  void writeDoc(`${PREFIJO}${accion}`, TIPO, { data: null, hecha: 0 }).catch(
    () => undefined,
  );
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
