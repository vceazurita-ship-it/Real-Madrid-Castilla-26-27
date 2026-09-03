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

/** Pide a la hoja, guarda lo que llegue y deja de estar en vuelo. */
function pide(action: string) {
  const yaVa = enVuelo.get(action);

  if (yaVa) return yaVa;

  const peticion = (async () => {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, {
        cache: "no-store",
      });

      const data = await response.json();

      cache.set(action, { data, hecha: Date.now() });

      return data;
    } finally {
      enVuelo.delete(action);
    }
  })();

  enVuelo.set(action, peticion);

  return peticion;
}

async function lee(action: string, fresco: boolean) {
  if (fresco) {
    cache.delete(action);

    return pide(action);
  }

  const guardado = cache.get(action);

  if (guardado) {
    const edad = Date.now() - guardado.hecha;

    if (edad < VIDA_FRESCA) return guardado.data;

    if (edad < VIDA_RANCIA) {
      /* Se contesta con lo que hay y se renueva por detrás. Un fallo del
         refresco no puede tumbar esta petición, que ya está contestada. */
      void pide(action).catch(() => undefined);

      return guardado.data;
    }
  }

  return pide(action);
}

/** Lo que se acaba de escribir tiene que verse ya: el POST tira la copia. */
function olvida() {
  cache.clear();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const action =
      searchParams.get("action") ||
      "rivalesPlantillas";

    const data = await lee(action, searchParams.get("fresco") === "1");

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