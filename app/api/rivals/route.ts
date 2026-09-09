import { NextRequest, NextResponse } from "next/server";

import { listDocs, readDoc, writeDoc } from "@/lib/docStore";

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

/*
|--------------------------------------------------------------------------
| Y UNA COPIA QUE SOBREVIVE AL SERVIDOR
|--------------------------------------------------------------------------
|
| Lo de arriba vive en la memoria del proceso, y en el despliegue eso dura lo
| que dure la función: **el primero que entra por la mañana —o después de un
| rato sin nadie— se come los treinta a setenta segundos del arranque en frío
| de Apps Script**, y con él todas las pantallas que piden la plantilla de
| rivales. Es la espera que hace que la app no parezca funcional.
|
| Así que lo que llega bueno se guarda además en Supabase, en la misma tabla
| de documentos que usa el resto de la app. Un servidor recién levantado
| encuentra ahí la última copia buena —una lectura de décimas—, contesta con
| ella y pide la nueva por detrás. Nadie vuelve a esperar a Google salvo que
| no haya copia de ninguna clase.
|
| Se guardan **sólo las lecturas gordas y compartidas**: son las que cuestan y
| las que piden todas las pantallas. Una consulta con parámetros —la
| alineación de un partido— no entra: son muchas, pequeñas y cada una la mira
| una persona.
|
| La copia se sirve hasta doce horas. Más allá se espera a la hoja: preferimos
| que el primero del día pague la espera a enseñar la plantilla de anteayer sin
| avisar.
*/
const VIDA_GUARDADA = 12 * 60 * 60_000;

const PREFIJO_GUARDADO = "cache:apps-script:";

const TIPO_GUARDADO = "cache-apps-script";

/** Las lecturas que merece la pena guardar fuera. */
const SE_GUARDAN = new Set([
  "rivalesPlantillas",
  "rivales",
  "jugadores",
  "seguimiento",
  "microciclo",
  "condicional",
  "alineaciones",
]);

function seGuarda(consulta: string) {
  const accion = new URLSearchParams(consulta).get("action") ?? "";

  /* Sólo la consulta pelada: `action=X` y nada más. Con parámetros es la
     lectura de una cosa concreta y no la comparte nadie. */
  return SE_GUARDAN.has(accion) && consulta === `action=${accion}`;
}

function claveGuardada(consulta: string) {
  return `${PREFIJO_GUARDADO}${new URLSearchParams(consulta).get("action")}`;
}

/** Deja la copia en Supabase. Nunca tumba la petición que la provocó. */
function guardaFuera(consulta: string, data: unknown) {
  if (!seGuarda(consulta)) return;

  void writeDoc(claveGuardada(consulta), TIPO_GUARDADO, {
    data,
    hecha: Date.now(),
  }).catch(() => undefined);
}

/** La copia de Supabase, si la hay y todavía vale. */
async function buscaFuera(consulta: string): Promise<Guardado | null> {
  if (!seGuarda(consulta)) return null;

  try {
    const { data } = await readDoc<Guardado>(claveGuardada(consulta));

    if (!data || data.data == null || typeof data.hecha !== "number") return null;

    if (Date.now() - data.hecha > VIDA_GUARDADA) return null;

    return data;
  } catch {
    /* Sin Supabase se sigue como siempre: a la hoja. */
    return null;
  }
}

/**
 * Tira también las copias de fuera.
 *
 * Después de escribir en la hoja, una copia de hace un rato diría que no se ha
 * guardado algo que sí está. No se pueden borrar filas desde aquí, así que se
 * vacían: una copia sin datos no la usa nadie.
 */
function olvidaFuera() {
  void (async () => {
    try {
      const guardados = await listDocs(PREFIJO_GUARDADO);

      await Promise.all(
        guardados.map((uno) =>
          writeDoc(uno.key, TIPO_GUARDADO, { data: null, hecha: 0 }),
        ),
      );
    } catch {
      /* Lo peor que pasa es servir la copia un rato más. */
    }
  })();
}

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

      guardaFuera(consulta, data);

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
  | Sin copia en memoria, antes de esperar a Google se mira la de Supabase:
  | es la que salva al primero que entra después de un rato —y a cualquier
  | servidor recién levantado— de los treinta a setenta segundos del arranque
  | en frío. Se contesta con ella y se pide la nueva por detrás.
  */
  const deFuera = await buscaFuera(consulta);

  if (deFuera) {
    cache.set(consulta, deFuera);

    void pide(consulta).catch(() => undefined);

    return deFuera.data;
  }

  /*
  | Ahora sí hay que esperar a Google. Y si Google falla teniendo nosotros
  | algo guardado —aunque sea de hace media hora—, se sirve eso.
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

  olvidaFuera();
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