import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FileItem = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
};

/**
 * Todo lo que cuelga de una carpeta del bucket, bajando por las subcarpetas.
 *
 * Las subcarpetas se piden **a la vez**, no una detrás de otra. Hay una por
 * semana de temporada, así que en marzo eran más de treinta viajes a Supabase
 * encadenados —cada uno esperando al anterior— y el calendario tardaba en
 * pintar los adjuntos o se quedaba sin tiempo. En paralelo es un viaje por
 * nivel, no uno por carpeta.
 */
async function listFolder(path: string): Promise<FileItem[]> {
  const { data, error } = await supabase.storage
    .from("performance")
    .list(path, {
      limit: 1000,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (error || !data) return [];

  const ficheros: FileItem[] = [];
  const carpetas: string[] = [];

  for (const item of data) {
    const fullPath = `${path}/${item.name}`;

    /* Sin `id` no es un fichero: es una carpeta. */
    if (!(item as { id?: string }).id) {
      carpetas.push(fullPath);
      continue;
    }

    const { data: publicUrl } = supabase.storage
      .from("performance")
      .getPublicUrl(fullPath);

    ficheros.push({
      url: publicUrl.publicUrl,
      name: item.name,
      created_at: (item as { created_at: string }).created_at,
      type: item.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
    });
  }

  const anidados = await Promise.all(carpetas.map((carpeta) => listFolder(carpeta)));

  return ficheros.concat(...anidados);
}

export async function GET() {
  try {
    const files = await listFolder("2026/performance");

    return NextResponse.json(files);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 500 });
  }
}