import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/*
|--------------------------------------------------------------------------
| UNA LECTURA POR TANDA, NO UNA POR PANTALLA
|--------------------------------------------------------------------------
|
| Medido el 03/09/2026 contra el script de la hoja: `rivalesPlantillas` son
| 290 KB y **la primera lectura después de un rato parada tarda entre 30 y
| 70 segundos** —Apps Script tiene que abrir el libro entero—; las de detrás,
| tres o seis. Ésa es, con diferencia, la espera más larga de la app: la
| pantalla de rivales, la pizarra táctica, el coding y el ABP del rival
| piden todas lo mismo.
|
| Así que la respuesta se guarda en dos tramos:
|
|   - **Fresca** el primer minuto: se sirve tal cual.
|   - **Rancia** hasta diez: se sirve igual de rápido y **se pide la nueva
|     por detrás**, para que la siguiente visita ya la tenga. Nadie se come
|     el arranque en frío salvo el primero del día.
|
| Pasado ese plazo se espera a Google, como antes. Las peticiones que llegan
| mientras hay una en vuelo se enganchan a ésa en vez de abrir otra, y un
| fallo no se guarda nunca.
|
| **Quien necesite la verdad de la hoja pide `?fresco=1`** y se salta todo
| esto. Lo usa la relectura que comprueba un guardado (`lib/save-guard`):
| ahí una copia de hace dos minutos diría que no se ha guardado algo que sí
| está escrito, que es el peor error posible.
*/
const VIDA_FRESCA = 60_000;
const VIDA_RANCIA = 10 * 60_000;

type Guardado = { data: unknown; hecha: number };

const cache = new Map<string, Guardado>();
const enVuelo = new Map<string, Promise<unknown>>();

/**
 * Pide a la hoja, guarda lo que llegue y deja de estar en vuelo.
 *
 * La clave es **la consulta entera** —`action=getAlineacion&id=12`—, no sólo
 * la acción: hay lecturas que llevan parámetros y cada una guarda su copia.
 */
function pide(consulta: string) {
  const yaVa = enVuelo.get(consulta);

  if (yaVa) return yaVa;

  const peticion = (async () => {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?${consulta}`, {
        cache: "no-store",
      });

      /* Google contesta a veces con una página de error y un 5xx. Se corta
         aquí para no guardar eso como si fuera la hoja. */
      if (!response.ok) {
        throw new Error(`Apps Script respondió ${response.status}`);
      }

      const data = await response.json();

      cache.set(consulta, { data, hecha: Date.now() });

      return data;
    } finally {
      enVuelo.delete(consulta);
    }
  })();

  enVuelo.set(consulta, peticion);

  return peticion;
}

async function lee(consulta: string, fresco: boolean) {
  if (fresco) {
    /*
    | Quien pide fresco quiere la verdad de la hoja, así que aquí no hay red:
    | si Google falla, falla. Es lo que comprueba un guardado, y contestar con
    | una copia diría que no se ha escrito algo que sí está.
    */
    const anterior = cache.get(consulta);

    cache.delete(consulta);

    try {
      return await pide(consulta);
    } catch (error) {
      /* Se devuelve la copia al sitio: no vale tirarla por un fallo de red. */
      if (anterior) cache.set(consulta, anterior);

      throw error;
    }
  }

  const guardado = cache.get(consulta);

  if (guardado) {
    const edad = Date.now() - guardado.hecha;

    if (edad < VIDA_FRESCA) return guardado.data;

    if (edad < VIDA_RANCIA) {
      /* Se contesta con lo que hay y se renueva por detrás. Un fallo del
         refresco no puede tumbar esta petición, que ya está contestada. */
      void pide(consulta).catch(() => undefined);

      return guardado.data;
    }
  }

  /*
  | Sin copia utilizable hay que esperar a Google. Y si Google falla teniendo
  | nosotros algo guardado —aunque sea de hace media hora—, se sirve eso.
  |
  | El Apps Script se cae a ratos y devuelve una página de error en vez de
  | JSON. Antes eso dejaba la pantalla en «no se pudieron cargar los datos»
  | teniendo una copia perfectamente utilizable a mano; una lista de hace un
  | rato es infinitamente mejor que un calendario vacío.
  */
  try {
    return await pide(consulta);
  } catch (error) {
    if (guardado) return guardado.data;

    throw error;
  }
}

/** Lo que se acaba de escribir tiene que verse ya: el POST tira la copia. */
function olvida() {
  cache.clear();
}

/*
|--------------------------------------------------------------------------
| LAS ESCRITURAS QUE NO PASAN POR AQUÍ
|--------------------------------------------------------------------------
|
| El `POST` de arriba tira la copia porque la escritura pasa por esta ruta.
| Pero media app escribe **directamente contra el Apps Script** desde el
| navegador: `lib/hojaRivales.ts` (informe colectivo, plan de partido,
| alineaciones guardadas) y los guardados por `GET` de la identidad
| posicional, los principios y los valores. Ésas no se enteran, y con una
| copia de hasta diez minutos alguien podía guardar una alineación y no verla
| en la lista.
|
| Así que quien escriba por su cuenta avisa por aquí, y esta caché se vacía
| igual que con un `POST`. Es una llamada suelta y sin cuerpo: no vale nada
| dejarla caer si falla —lo peor que pasa es servir la copia un rato más—.
*/
export async function DELETE() {
  olvida();

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    /*
    | Se reenvía lo que venga —`getAlineacion` necesita su `id`—, quitando
    | `fresco` y `jugador`, que son órdenes para esta ruta y no significan
    | nada en la hoja. Sin parámetros se lee la plantilla de rivales, que es lo
    | que pedía esta ruta cuando sólo servía para eso.
    */
    const parametros = new URLSearchParams(searchParams);

    parametros.delete("fresco");
    parametros.delete("jugador");

    if (!parametros.has("action")) parametros.set("action", "rivalesPlantillas");

    const data = await lee(
      parametros.toString(),
      searchParams.get("fresco") === "1",
    );

    /*
    | `?jugador=<ID_JUGADOR>` devuelve **una fila**, no las mil.
    |
    | Lo pide la comprobación de un guardado (`lib/save-guard`), que necesita
    | releer al jugador que se acaba de escribir y para eso se estaba
    | descargando la plantilla entera: 290 KB por cada pausa al teclear, y
    | encima sin caché porque una copia no vale para comprobar una escritura.
    | La lectura contra Google es la misma —el script no sabe devolver una
    | fila—, pero al navegador le llega un objeto de dos líneas.
    |
    | El filtro va aquí y no en la clave de la caché a propósito: si cada
    | jugador guardara su copia, treinta y dos fichas serían treinta y dos
    | lecturas de la hoja en vez de una.
    */
    const jugador = searchParams.get("jugador");

    if (jugador) {
      const filas = Array.isArray(data) ? data : [];

      const fila = filas.find(
        (una) =>
          String((una as Record<string, unknown>)?.ID_JUGADOR ?? "") === jugador,
      );

      return NextResponse.json(fila ?? null);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error cargando datos de rivales",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    olvida();

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        error: text,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error POST /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error comunicando con Google Apps Script",
      },
      { status: 500 }
    );
  }
}