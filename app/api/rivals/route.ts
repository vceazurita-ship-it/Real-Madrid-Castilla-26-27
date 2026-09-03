import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/*
|--------------------------------------------------------------------------
| UNA LECTURA POR TANDA, NO UNA POR PANTALLA
|--------------------------------------------------------------------------
|
| Apps Script tarda entre dos y ocho segundos en contestar, y una pantalla
| como `/rivals` pide lo mismo varias veces seguidas: las plantillas, el
| calendario para ordenarlas, y otra vez las plantillas al abrir el informe.
| Cada una era un viaje entero a Google.
|
| Se guarda la respuesta unos segundos: lo justo para que las peticiones de un
| mismo momento compartan una sola lectura, y lo bastante poco para que un
| guardado se vea al recargar. Las peticiones que llegan **mientras** hay una
| en vuelo esperan a ésa en vez de abrir otra —que es lo que de verdad
| atascaba—, y un fallo no se guarda nunca.
*/
const VIDA_CACHE = 20_000;

type Guardado = { data: unknown; hasta: number };

const cache = new Map<string, Guardado>();
const enVuelo = new Map<string, Promise<unknown>>();

async function lee(action: string) {
  const vivo = cache.get(action);

  if (vivo && vivo.hasta > Date.now()) return vivo.data;

  const yaVa = enVuelo.get(action);

  if (yaVa) return yaVa;

  const peticion = (async () => {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, {
        cache: "no-store",
      });

      const data = await response.json();

      cache.set(action, { data, hasta: Date.now() + VIDA_CACHE });

      return data;
    } finally {
      enVuelo.delete(action);
    }
  })();

  enVuelo.set(action, peticion);

  return peticion;
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

    const data = await lee(action);

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