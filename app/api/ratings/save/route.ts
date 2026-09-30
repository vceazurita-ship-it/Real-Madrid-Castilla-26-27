import { NextRequest, NextResponse } from "next/server";

import {
  ConflictoDeGuardado,
  cambiaTemporada,
} from "../_lib/cambiaTemporada";
import { MatchMeta, PlayerRating, hasContent } from "@/lib/ratings/types";

export const dynamic = "force-dynamic";

type Body = {
  match?: MatchMeta;
  players?: Record<string, PlayerRating>;
};

/**
 * Guarda un partido completo. El servidor relee la temporada antes de mezclar
 * y escribe sólo si nadie lo ha hecho en medio (`cambiaTemporada`): así dos
 * personas valorando partidos distintos a la vez no se pisan.
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

    const saved = await cambiaTemporada((season) => {
      season.matches[match.id] = { match, players, updatedAt: now };
    });

    return NextResponse.json({ success: true, season: saved });
  } catch (error) {
    console.error("POST /api/ratings/save", error);

    if (error instanceof ConflictoDeGuardado) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Error guardando las valoraciones" },
      { status: 500 }
    );
  }
}
