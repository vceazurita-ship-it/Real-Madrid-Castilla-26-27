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
import { after } from "next/server";
import { readDoc, writeDoc } from "@/lib/docStore";

/** El despliegue principal (hoja RIVALES): el mismo que `lib/hojaRivales.ts`. */
const PRINCIPAL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/*
| La variable de entorno, limpia. Con comillas o un salto de línea pegados al
| copiarla en Vercel, Google contesta 404 y todas las rutas que escriben por
| aquí —alta de jugadores, alias, alertas— fallaban sin decir por qué
| (01/10/2026: el registro de microciclos recibía «La hoja respondió 404»).
*/
const ORIGEN = () =>
  (process.env.APPS_SCRIPT_URL ?? process.env.NEXT_PUBLIC_API_URL ?? PRINCIPAL)
    .trim()
    .replace(/^["']|["']$/g, "") || PRINCIPAL;

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
  { url: destino }: { url?: string } = {},
) {
  const url = destino ?? ORIGEN();

  if (!url) {
    console.error(`[apps-script] ${accion}: falta APPS_SCRIPT_URL`);

    return Response.json(
      { ok: false, error: "La hoja no está configurada en el servidor" },
      { status: 500 },
    );
  }

  try {
    /*
    | La redirección, a mano (01/10/2026).
    |
    | Apps Script contesta al POST con un 302 hacia googleusercontent.com, y
    | lo que hay allí se pide con GET. Desde Vercel, dejando que `fetch` la
    | siguiera solo, la hoja contestaba 404 a lo que en local iba bien. Se
    | hace como el navegador: POST, y si viene 3xx, GET a su `location`. Y en
    | `text/plain`, como `app/api/rivals`: el script lee el cuerpo tal cual.
    */
    const manda = async (a: string) => {
      const primera = await fetch(a, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: accion, ...datos }),
        redirect: "manual",
      });

      const destinoRedirigido = primera.headers.get("location");

      if (primera.status >= 300 && primera.status < 400 && destinoRedirigido) {
        return fetch(destinoRedirigido, { method: "GET" });
      }

      return primera;
    };

    let respuesta = await manda(url);

    /* Un 404 es un despliegue que ya no existe: se prueba el principal. */
    if (respuesta.status === 404 && !destino && url !== PRINCIPAL) {
      console.error(`[apps-script] ${accion}: 404 en la URL configurada, pruebo la principal`);

      respuesta = await manda(PRINCIPAL);
    }

    const cuerpo = await respuesta.text();

    if (!respuesta.ok) {
      console.error(`[apps-script] ${accion}: HTTP ${respuesta.status}`);

      return Response.json(
        {
          ok: false,
          /* Con el sitio que contestó: un 404 de script.google.com es un
             despliegue que no existe; de googleusercontent, la redirección. */
          error: `La hoja respondió ${respuesta.status}${
            respuesta.url ? ` (${new URL(respuesta.url).host})` : ""
          }`,
        },
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

/**
 * Cuántas veces se ha escrito: lo que salió antes de una escritura no se guarda
 * como copia (06/10/2026). Con el refresco por detrás vivo, una lectura lanzada
 * antes de crear una alerta podía llegar después y dejar como buena la lista
 * sin ella.
 */
let generacion = 0;

/**
 * Pregunta a la hoja de verdad y guarda lo que llegue.
 *
 * `propia`: no se engancha a la lectura que ya iba (que puede ser de antes de
 * escribir). La usa la relectura fresca que comprueba un guardado.
 */
function pregunta(accion: string, datos: Record<string, unknown>, { propia = false } = {}) {
  const yaVa = propia ? null : enVuelo.get(accion);

  if (yaVa) return yaVa;

  const nacida = generacion;

  /* Declarada antes: el `finally` de dentro la compara para no quitar del mapa una lectura más nueva. */
  let peticion: Promise<unknown> | null = null;

  peticion = (async () => {
    try {
      const respuesta = await llamaScript(accion, datos);

      const leido = await respuesta.json();

      /* Un fallo no se guarda: sería enseñar el error durante doce horas. */
      if (!respuesta.ok || (leido && leido.ok === false)) return leido;

      if (nacida === generacion) {
        const copia: Copia = { data: leido, hecha: Date.now() };

        enMemoria.set(accion, copia);

        void writeDoc(`${PREFIJO}${accion}`, TIPO, copia).catch(() => undefined);
      }

      return leido;
    } finally {
      if (!propia && enVuelo.get(accion) === peticion) enVuelo.delete(accion);
    }
  })();

  if (!propia) enVuelo.set(accion, peticion);

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

  if (opciones.fresco) return Response.json(await pregunta(accion, datos, { propia: true }));

  const guardada = enMemoria.get(accion);

  if (guardada && Date.now() - guardada.hecha < VIDA_FRESCA) {
    return Response.json(guardada.data);
  }

  if (guardada) {
    /* Con `after`: un `void` suelto se congela con la función y la copia no se renovaba nunca. */
    after(() => pregunta(accion, datos).catch(() => undefined));

    return Response.json(guardada.data);
  }

  /* Nada en memoria: la copia de Supabase salva el arranque en frío. */
  try {
    const { data } = await readDoc<Copia>(`${PREFIJO}${accion}`);

    if (data && data.data != null && Date.now() - data.hecha < VIDA_GUARDADA) {
      enMemoria.set(accion, data);

      /* Con `after`: un `void` suelto se congela con la función y la copia no se renovaba nunca. */
    after(() => pregunta(accion, datos).catch(() => undefined));

      return Response.json(data.data);
    }
  } catch {
    /* Sin Supabase se sigue como siempre: a la hoja. */
  }

  return Response.json(await pregunta(accion, datos));
}

/** Después de escribir, la copia miente: se tira. */
export function olvidaLectura(accion: string) {
  generacion += 1;

  enMemoria.delete(accion);

  /* Nadie debe engancharse a una lectura que salió antes de escribir. */
  enVuelo.delete(accion);

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
