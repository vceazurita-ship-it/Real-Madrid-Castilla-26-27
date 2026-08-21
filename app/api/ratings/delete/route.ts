import { NextRequest, NextResponse } from "next/server";

import { readSeason, writeSeason } from "@/lib/ratings/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { matchId } = (await request.json()) as { matchId?: string };

    if (!matchId) {
      return NextResponse.json(
        { success: false, error: "Falta el partido" },
        { status: 400 }
      );
    }

    const season = await readSeason();

    delete season.matches[matchId];

    const saved = await writeSeason(season);

    return NextResponse.json({ success: true, season: saved });
  } catch (error) {
    console.error("POST /api/ratings/delete", error);

    return NextResponse.json(
      { success: false, error: "Error borrando las valoraciones" },
      { status: 500 }
    );
  }
}
