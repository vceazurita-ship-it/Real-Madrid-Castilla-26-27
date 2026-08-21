import { NextResponse } from "next/server";

import { readSeason } from "@/lib/ratings/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const season = await readSeason();

    return NextResponse.json({ success: true, season });
  } catch (error) {
    console.error("GET /api/ratings/load", error);

    return NextResponse.json(
      { success: false, error: "Error cargando las valoraciones" },
      { status: 500 }
    );
  }
}
