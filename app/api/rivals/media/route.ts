import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
|--------------------------------------------------------------------------
| ARCHIVOS DE RECURSOS DEL RIVAL
|--------------------------------------------------------------------------
|
| Sube al bucket los vídeos y documentos que el cuerpo técnico arrastra a la
| ficha del rival, y los borra cuando se quitan de la lista.
|
| Va aparte de `/api/general/upload` por dos motivos: aquel sube con
| `upsert: false` y revienta si ya existe un archivo con ese nombre —aquí dos
| rivales pueden tener perfectamente su "informe.pdf"—, y no devuelve la ruta
| dentro del bucket, que es lo único que permite borrar el archivo después.
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "performance";

/** Solo dentro de la carpeta de rivales: la ruta llega del cliente. */
const CARPETA_PATTERN = /^2026\/rivales\/[a-z0-9][a-z0-9_-]{0,80}$/;

/** Nombre de archivo sin acentos ni caracteres que rompan la URL pública. */
function limpiarNombre(nombre: string) {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return limpio || "archivo";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const folder = String(formData.get("folder") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No ha llegado ningún archivo." },
        { status: 400 }
      );
    }

    if (!CARPETA_PATTERN.test(folder)) {
      return NextResponse.json(
        { success: false, error: "Carpeta no válida." },
        { status: 400 }
      );
    }

    /* Prefijo de tiempo: dos informes con el mismo nombre conviven en vez de
       pisarse, y el orden del bucket queda cronológico. */
    const path = `${folder}/${Date.now().toString(36)}-${limpiarNombre(
      file.name
    )}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[rivals/media] subida", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path,
      url: data.publicUrl,
      mime: file.type,
      tamano: file.size,
    });
  } catch (error) {
    console.error("[rivals/media] POST", error);

    return NextResponse.json(
      { success: false, error: "No se ha podido subir el archivo." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const path = String(request.nextUrl.searchParams.get("path") ?? "");

    const carpeta = path.slice(0, path.lastIndexOf("/"));

    if (!CARPETA_PATTERN.test(carpeta)) {
      return NextResponse.json(
        { success: false, error: "Ruta no válida." },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      console.error("[rivals/media] borrado", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[rivals/media] DELETE", error);

    return NextResponse.json(
      { success: false, error: "No se ha podido borrar el archivo." },
      { status: 500 }
    );
  }
}
