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
    const body = await req.json();

    /*
    | Lo normal desde el 19/10/2026: `{ cambio }` con lo que ha cambiado en
    | UNA semana, que se aplica sobre lo último guardado (lib/season/fusion.ts).
    | Mandar la temporada entera hacía que dos personas a la vez se borrasen
    | lo subido la una a la otra.
    */
    const porCambio = await respondeCambio(
      body,
      supabase,
      "general_seasons",
      CURRENT_SEASON
    );

    if (porCambio) {
      return NextResponse.json(porCambio.json, { status: porCambio.status });
    }

    /* Formato antiguo (temporada entera). Sin un array de meses no se
       escribe: antes un cuerpo vacío dejaba la temporada en `null`. */
    if (!Array.isArray(body?.data)) {
      return NextResponse.json(
        { success: false, error: "Falta la temporada que guardar." },
        { status: 400 }
      );
    }

    /*
    | La temporada entera sólo se acepta para CREAR la fila (temporada nueva).
    | Encima de una que ya existe es justo lo que borraba el trabajo de otros
    | (19/10/2026); sólo lo mandaría una pestaña abierta antes de esta versión,
    | y a esa se le pide que recargue. Antes era un upsert —y antes aún un
    | `update` que, sin fila, contestaba «guardado» sin escribir nada—.
    */
    const { data: escrito, error } = await supabase
      .from("general_seasons")
      .insert({
        season: CURRENT_SEASON,
        data: body.data,
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