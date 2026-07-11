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

    const { error } = await supabase
  .from("general_seasons")
  .update({
    data: seasonData,
    updated_at: new Date().toISOString(),
  })
  .eq("season", CURRENT_SEASON);

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