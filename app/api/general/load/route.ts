import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENT_SEASON = "2026-2027";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("performance_seasons")
      .select("data")
      .eq("season", CURRENT_SEASON)
      .single();

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

    return NextResponse.json({
      success: true,
      season: data.data,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: "Error cargando temporada",
      },
      {
        status: 500,
      }
    );
  }
}