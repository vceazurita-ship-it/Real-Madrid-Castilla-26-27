import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
| Sólo se borra dentro de las carpetas que sube esta app.
|
| Antes llegaba la ruta del cuerpo y se pasaba tal cual: con una petición se
| podía vaciar el bucket entero —dossiers de desplazamiento, informes, vídeos
| de coding—, que es material que no se puede reconstruir. Los recursos del
| rival tienen su propia puerta (`/api/rivals/media`), con su propia lista.
*/
const CARPETAS = [
  /^alertas\/[a-z0-9][a-z0-9_-]{0,80}\//i,
  /^training\//i,
  /^desplazamientos\/[a-z0-9][a-z0-9_-]{0,80}\//i,
];

const rutaValida = (path: string) =>
  !path.includes("..") && CARPETAS.some((patron) => patron.test(path));

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json(
        { error: "Falta el path." },
        { status: 400 }
      );
    }

    if (!rutaValida(String(path))) {
      return NextResponse.json(
        { error: "Ruta no válida." },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage
      .from("performance")
      .remove([path]);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json(
      { error: "Error interno." },
      { status: 500 }
    );
  }
}