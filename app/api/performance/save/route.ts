import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENT_SEASON = "2026-2027";

export async function POST(req: NextRequest) {
  try {
    const seasonData = await req.json();

    /*
    | UPSERT, y comprobando que ha escrito (igual que /api/general/save).
    |
    | Era un `update` sobre la fila de la temporada: si esa fila no existe,
    | Supabase no da error, afecta a cero filas y esto contestaba «guardado».
    | La forma guardada no cambia: la fila guarda el cuerpo entero
    | (`{ season, data }`), que es lo que desenvuelve `unwrapSeason`.
    */
    const { data: escrito, error } = await supabase
      .from("performance_seasons")
      .upsert(
        {
          season: CURRENT_SEASON,
          data: seasonData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "season" },
      )
      .select("season");

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!escrito || escrito.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se ha escrito ninguna fila de la temporada." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: "Error guardando temporada",
      },
      {
        status: 500,
      }
    );
  }
}
