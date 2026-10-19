import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { respondeCambio } from "@/lib/season/guardaCambio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENT_SEASON = "2026-2027";

export async function POST(req: NextRequest) {
  try {
    const seasonData = await req.json();

    /*
    | Lo normal desde el 19/10/2026: `{ cambio }` con lo que ha cambiado en
    | UNA semana (ver /api/general/save y lib/season/fusion.ts). Va antes que
    | lo demás: guardado tal cual, `{ season, cambio }` machacaría la temporada.
    */
    const porCambio = await respondeCambio(
      seasonData,
      supabase,
      "performance_seasons",
      CURRENT_SEASON
    );

    if (porCambio) {
      return NextResponse.json(porCambio.json, { status: porCambio.status });
    }

    /* Formato antiguo (temporada entera, `{ season, data }`): sin un array de
       meses dentro no se escribe nada. */
    if (!Array.isArray(seasonData?.data)) {
      return NextResponse.json(
        { success: false, error: "Falta la temporada que guardar." },
        { status: 400 }
      );
    }

    /*
    | La temporada entera sólo se acepta para CREAR la fila (igual que
    | /api/general/save, 19/10/2026): encima de una que ya existe borraba lo
    | que otros hubieran subido. La forma guardada no cambia: la fila guarda
    | el cuerpo entero (`{ season, data }`), que es lo que desenvuelve
    | `unwrapSeason`.
    */
    const { data: escrito, error } = await supabase
      .from("performance_seasons")
      .insert({
        season: CURRENT_SEASON,
        data: seasonData,
        updated_at: new Date().toISOString(),
      })
      .select("season");

    if (error?.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Esta página está desactualizada. Recárgala para guardar sin pisar lo de los demás.",
        },
        { status: 409 }
      );
    }

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
