import { NextRequest, NextResponse } from "next/server";
import { readDoc, writeDoc } from "@/lib/docStore";

/** Clave: letras, números, guiones y dos puntos. Evita accesos arbitrarios. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,120}$/i;

/**
 * Las claves `secreto:` no se sirven por aquí. Nunca.
 *
 * Esta ruta entrega cualquier documento a quien sepa su clave, sin más: es lo
 * que hace que las pizarras y el calendario funcionen sin una tabla por
 * pantalla. Pero en `app_documents` vive también el token de refresco de la
 * cuenta de YouTube (`secreto:youtube`), y ése no puede llegar al navegador ni
 * por descuido ni adivinando la clave. Quien lo necesita lo lee en el
 * servidor, con `readDoc` directamente.
 */
const PREFIJO_VETADO = /^secreto:/i;

/**
 * Claves que NO se leen por aquí.
 *
 * La quiniela lleva dentro los pronósticos de todos, y antes del viernes eso
 * es privado: cada uno ve el suyo y cuántos lleva puestos el resto. Esa criba
 * la hace `/api/quiniela/leer`, que mira quién pregunta y si la jornada está
 * cerrada. Servir el documento entero por esta puerta dejaba esa criba en
 * papel mojado: bastaba con pedir `?key=quiniela` —sin entrar siquiera— para
 * tener la apuesta de los diez el martes.
 */
const CLAVES_VETADAS = new Set(["quiniela"]);

/**
 * Y la caché del servidor tampoco se toca desde fuera.
 *
 * `cache:apps-script:<accion>` son las copias que `lib/appsScript.ts` guarda
 * de las lecturas de la hoja y sirve durante horas a todo el mundo. Escribir
 * ahí desde el navegador es poder inventarse la plantilla, el seguimiento o
 * las alertas para todos; leerlo de aquí no hace daño, pero tampoco lo
 * necesita nadie.
 */
const PREFIJO_CACHE = /^cache:/i;

const vetada = (key: string) =>
  PREFIJO_VETADO.test(key) ||
  PREFIJO_CACHE.test(key) ||
  CLAVES_VETADAS.has(key.trim().toLowerCase());

/**
 * Claves que se leen por aquí pero **no se escriben** por aquí.
 *
 * La quiniela tiene su propia puerta (`/api/quiniela/guardar`), que mira quién
 * ha entrado y si la jornada ya se cerró el viernes. Si esta ruta siguiera
 * aceptando el documento entero, ese cierre sería decorativo, y una pestaña
 * vieja —o una copia de antes de la actualización guardada en el navegador—
 * podría pisar las apuestas de todos con lo que tenía al cargar.
 */
const SOLO_LECTURA = new Set(["quiniela"]);

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";

  if (!KEY_PATTERN.test(key) || vetada(key)) {
    return NextResponse.json(
      { success: false, error: "Clave no válida." },
      { status: 400 }
    );
  }

  try {
    const result = await readDoc(key);

    return NextResponse.json({
      success: true,
      data: result.data,
      updatedAt: result.updatedAt,
      missingTable: result.missingTable ?? false,
    });
  } catch (error) {
    console.error("[docs] GET", error);

    return NextResponse.json(
      { success: false, error: "No se pudo leer el documento." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const key = String(body?.key ?? "");
    const kind = String(body?.kind ?? "generic");

    if (!KEY_PATTERN.test(key) || vetada(key)) {
      return NextResponse.json(
        { success: false, error: "Clave no válida." },
        { status: 400 }
      );
    }

    if (SOLO_LECTURA.has(key)) {
      return NextResponse.json(
        { success: false, error: "Este documento se guarda desde su pantalla." },
        { status: 403 }
      );
    }

    if (body?.data === undefined) {
      return NextResponse.json(
        { success: false, error: "Falta el contenido del documento." },
        { status: 400 }
      );
    }

    const result = await writeDoc(key, kind, body.data);

    return NextResponse.json({
      success: true,
      updatedAt: result.updatedAt,
      missingTable: result.missingTable ?? false,
    });
  } catch (error) {
    console.error("[docs] POST", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el documento." },
      { status: 500 }
    );
  }
}
