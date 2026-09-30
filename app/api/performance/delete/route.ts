import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
| Sólo se borra dentro de las carpetas del Área Condicional.
|
| Antes la ruta del cuerpo se pasaba tal cual al bucket `performance`, que es
| compartido: ahí viven también los vídeos de coding, los dossiers de
| desplazamiento y las alertas. Con una petición se podía borrar cualquiera.
| Quien la llama es `deleteSeasonFile` (lib/season/api.ts) con las carpetas
| que arma WeekPanel: `2026/performance/semana-XX/…` y, en semanas subidas
| antes de separar las áreas, la antigua `2026/semana-XX/…`.
*/
const CARPETAS = [
  /^2026\/performance\/semana-\d{1,3}\//i,
  /^2026\/semana-\d{1,3}\//i,
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
