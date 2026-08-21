import { NextRequest, NextResponse } from "next/server";

import { readSeason, writeSeason } from "@/lib/ratings/store";
import { MatchMeta, PlayerRating, hasContent } from "@/lib/ratings/types";

export const dynamic = "force-dynamic";

type Body = {
  match?: MatchMeta;
  players?: Record<string, PlayerRating>;
};

/**
 * Guarda un partido completo. El servidor relee la temporada antes de mezclar,
 * así dos personas valorando partidos distintos nunca se pisan.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;

    const match = body.match;

    if (!match?.id) {
      return NextResponse.json(
        { success: false, error: "Falta el partido" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const players: Record<string, PlayerRating> = {};

    Object.entries(body.players ?? {}).forEach(([playerId, entry]) => {
      if (!entry || !hasContent(entry)) return;

      players[playerId] = { ...entry, playerId, updatedAt: entry.updatedAt || now };
    });

    const season = await readSeason();

    season.matches[match.id] = { match, players, updatedAt: now };

    const saved = await writeSeason(season);

    return NextResponse.json({ success: true, season: saved });
  } catch (error) {
    console.error("POST /api/ratings/save", error);

    return NextResponse.json(
      { success: false, error: "Error guardando las valoraciones" },
      { status: 500 }
    );
  }
}
