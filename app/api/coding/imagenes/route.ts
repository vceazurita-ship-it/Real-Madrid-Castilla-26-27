import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
|--------------------------------------------------------------------------
| LAS IMÁGENES DE UNA EXPORTACIÓN
|--------------------------------------------------------------------------
|
| La carátula del vídeo unificado y cada pizarra quemada son fotogramas a la
| resolución del partido. Iban dentro del JSON de `/api/coding/export`, y en
| un despliegue con funciones eso es un callejón sin salida: el cuerpo de una
| petición no puede pasar de 4,5 MB y ahí no hay nada que configurar —la
| exportación respondía **413** antes de llegar a la aplicación—.
|
| Aquí cada imagen sube **suelta**, en su propia petición de unos cientos de
| kilobytes, y a la exportación sólo viaja el enlace. Da igual que sean tres
| pizarras o cuarenta: el cuerpo de la exportación no crece.
|
| Van a una carpeta aparte del bucket (`CARPETA`) y las borra el propio
| navegador al terminar. Son de usar y tirar: si alguna se queda por un
| cierre a destiempo, no estorba a nadie más que al recuento del bucket.
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "performance";

const CARPETA = "2026/coding/temporales";

/** Lo que el navegador puede componer: fotogramas de vídeo y poco más. */
const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/*
| Techo por imagen. Un fotograma de 1080p en JPEG son ~300 KB y en PNG unos
| pocos megas; ocho deja sitio de sobra sin dejar la puerta abierta.
*/
const MAX_BYTES = 8 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const tipo = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const extension = EXTENSIONES[tipo];

    if (!extension) {
      return NextResponse.json(
        { ok: false, error: "Eso no es una imagen que se pueda quemar." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await request.arrayBuffer());

    if (bytes.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: "No ha llegado ninguna imagen." },
        { status: 400 },
      );
    }

    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "La imagen pesa demasiado." },
        { status: 413 },
      );
    }

    const ruta = `${CARPETA}/${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, bytes, { contentType: tipo, upsert: false });

    if (error) {
      console.error("[coding/imagenes] subida", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);

    return NextResponse.json({ ok: true, ruta, url: data.publicUrl });
  } catch (error) {
    console.error("[coding/imagenes] POST", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido subir la imagen." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rutas = (await request.json().catch(() => null)) as {
      rutas?: unknown;
    } | null;

    const lista = Array.isArray(rutas?.rutas)
      ? rutas.rutas
          .map((ruta) => String(ruta))
          /* Sólo la carpeta de usar y tirar: la ruta la manda el cliente. */
          .filter((ruta) => ruta.startsWith(`${CARPETA}/`) && !ruta.includes(".."))
      : [];

    if (lista.length === 0) return NextResponse.json({ ok: true });

    const { error } = await supabase.storage.from(BUCKET).remove(lista);

    if (error) {
      console.error("[coding/imagenes] borrado", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[coding/imagenes] DELETE", error);

    return NextResponse.json(
      { ok: false, error: "No se han podido borrar las imágenes." },
      { status: 500 },
    );
  }
}
